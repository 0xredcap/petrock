"use client";

import { useEffect, useRef } from "react";
import type { PetStats } from "@/lib/hedera/stats";

const TILE_SIZE = 18;
const TILE_SCALE = 3;
const COLS = 16;
const ROWS = 10;
const CANVAS_W = COLS * TILE_SIZE * TILE_SCALE;
const CANVAS_H = ROWS * TILE_SIZE * TILE_SCALE;

const ROCK_HOME = { col: 7, row: 5 };
const AVATAR_POS = { col: 9, row: 5 };

const GRASS_COLOR = 0x4c9900;
const GRASS_DARK = 0x3c7a00;
const FENCE_COLOR = 0x7a4a28;
const FLOWER_YELLOW = 0xffdd00;
const FLOWER_PINK = 0xff6eb4;
const AVATAR_COLOR = 0x4a90d9;
const AVATAR_SKIN = 0xf5c5a0;

export type ReactionType =
  | "fed"
  | "played"
  | "groomed"
  | "sleeping"
  | "dying"
  | "dead"
  | null;

interface WorldProps {
  serial?: number;
  stats?: PetStats;
  reaction?: ReactionType;
  onReactionDone?: () => void;
}

export default function World({ serial, stats, reaction, onReactionDone }: WorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixiRef = useRef<{ cleanup: () => void } | null>(null);
  const statsRef = useRef(stats);
  const reactionRef = useRef(reaction);
  const onReactionDoneRef = useRef(onReactionDone);
  statsRef.current = stats;
  reactionRef.current = reaction;
  onReactionDoneRef.current = onReactionDone;

  useEffect(() => {
    if (!canvasRef.current) return;
    let mounted = true;

    async function init() {
      const PIXI = await import("pixi.js");
      if (!mounted || !canvasRef.current) return;

      PIXI.TextureSource.defaultOptions.scaleMode = "nearest";

      const app = new PIXI.Application();
      await app.init({
        canvas: canvasRef.current,
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundColor: GRASS_COLOR,
        antialias: false,
        resolution: 1,
      });

      if (!mounted) { app.destroy(false, { children: true }); return; }

      const worldContainer = new PIXI.Container();
      app.stage.addChild(worldContainer);
      drawGarden(PIXI, worldContainer);

      // Rock
      const rock = new PIXI.Container();
      rock.x = (ROCK_HOME.col + 0.5) * TILE_SIZE * TILE_SCALE;
      rock.y = (ROCK_HOME.row + 0.5) * TILE_SIZE * TILE_SCALE;
      worldContainer.addChild(rock);

      const rockBody = drawRockBody(PIXI, serial);
      rock.addChild(rockBody);

      // Dead overlay (grey semi-transparent ellipse shown when pet dies)
      const deadOverlay = new PIXI.Graphics();
      deadOverlay.ellipse(0, 0, TILE_SIZE * TILE_SCALE * 0.5, TILE_SIZE * TILE_SCALE * 0.44)
        .fill({ color: 0x888888, alpha: 0.6 });
      deadOverlay.alpha = 0;
      rock.addChild(deadOverlay);

      // Avatar
      const avatar = new PIXI.Container();
      avatar.x = (AVATAR_POS.col + 0.5) * TILE_SIZE * TILE_SCALE;
      avatar.y = (AVATAR_POS.row + 0.5) * TILE_SIZE * TILE_SCALE;
      worldContainer.addChild(avatar);
      drawAvatar(PIXI, avatar);

      // Ambient overlay
      const ambientOverlay = new PIXI.Graphics();
      ambientOverlay.rect(0, 0, CANVAS_W, CANVAS_H).fill({ color: 0x000033, alpha: 1 });
      ambientOverlay.alpha = 0;
      app.stage.addChild(ambientOverlay);

      // Fireflies
      const fireflyContainer = new PIXI.Container();
      app.stage.addChild(fireflyContainer);

      const FIREFLY_COLORS = [0xffff88, 0x88ffaa, 0xaaddff, 0xffddaa];
      interface Firefly { g: import("pixi.js").Graphics; x: number; y: number; vx: number; vy: number; phase: number; }
      const fireflies: Firefly[] = [];
      for (let i = 0; i < 10; i++) {
        const fg = new PIXI.Graphics();
        fg.circle(0, 0, 2).fill({ color: FIREFLY_COLORS[i % FIREFLY_COLORS.length] });
        const fx = 20 + Math.random() * (CANVAS_W - 40);
        const fy = 20 + Math.random() * (CANVAS_H - 40);
        fg.x = fx; fg.y = fy;
        fireflyContainer.addChild(fg);
        fireflies.push({ g: fg, x: fx, y: fy, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, phase: Math.random() * Math.PI * 2 });
      }

      // Particles on top
      const particles = new PIXI.Container();
      app.stage.addChild(particles);

      let breathT = 0;
      let blinkT = 0;
      let blinkInterval = randomBetween(4000, 7000);
      let tiltT = 0;
      let tiltInterval = randomBetween(8000, 15000);
      let hopT = 0;
      let hopInterval = randomBetween(20000, 30000);
      let wanderT = 0;
      let wanderInterval = randomBetween(30000, 60000);
      let ambientT = 0;
      let avatarBobT = 0;
      let reactionT = 0;
      let reactionActive: ReactionType = null;
      let isHopping = false;

      app.ticker.maxFPS = 60;
      app.ticker.add((ticker) => {
        if (document.hidden) return;
        const dt = ticker.deltaMS;
        const currentStats = statsRef.current;
        const currentReaction = reactionRef.current;

        const mood = currentStats?.mood ?? 100;
        const energy = currentStats?.energy ?? 100;
        const alive = currentStats?.alive !== false;

        // Breathing — tired squashes the base scale
        const breathSpeed = mood > 70 ? 1500 : mood < 30 ? 3000 : 2000;
        const breathBase = energy < 30 ? 0.9 : 1.0;
        breathT += dt;
        rock.scale.y = breathBase + 0.04 * Math.sin((breathT / breathSpeed) * Math.PI * 2);

        // Sad tilt
        if (mood < 30 && alive) rock.rotation = -0.14;

        // Dead overlay
        deadOverlay.alpha = alive ? 0 : 0.6;

        // Avatar bob
        avatarBobT += dt;
        avatar.y = (AVATAR_POS.row + 0.5) * TILE_SIZE * TILE_SCALE +
          Math.sin((avatarBobT / 1000) * Math.PI * 2);

        // Ambient pulse
        ambientT += dt;
        ambientOverlay.alpha = 0.05 * (0.5 + 0.5 * Math.sin((ambientT / 30000) * Math.PI * 2));

        // Fireflies
        for (let i = 0; i < fireflies.length; i++) {
          const ff = fireflies[i];
          ff.phase += dt * 0.002;
          ff.x += ff.vx + 0.25 * Math.sin(ff.phase + i * 1.3);
          ff.y += ff.vy + 0.18 * Math.cos(ff.phase * 0.7 + i * 0.9);
          if (ff.x < 12 || ff.x > CANVAS_W - 12) ff.vx *= -1;
          if (ff.y < 12 || ff.y > CANVAS_H - 12) ff.vy *= -1;
          ff.x = Math.max(12, Math.min(CANVAS_W - 12, ff.x));
          ff.y = Math.max(12, Math.min(CANVAS_H - 12, ff.y));
          ff.g.x = ff.x; ff.g.y = ff.y;
          ff.g.alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(ff.phase * 2.5));
        }

        // Blink
        blinkT += dt;
        if (blinkT > blinkInterval) {
          blinkT = 0;
          blinkInterval = randomBetween(4000, 7000);
          doBlink(rock);
        }

        // Head tilt
        tiltT += dt;
        if (mood >= 30 && tiltT > tiltInterval) {
          tiltT = 0;
          tiltInterval = randomBetween(8000, 15000);
          doTilt(rock, Math.random() > 0.5 ? 1 : -1);
        }

        // Idle hop
        const hopBase = mood > 70 ? 10000 : 25000;
        hopT += dt;
        if (!isHopping && mood >= 30 && alive && hopT > hopInterval) {
          hopT = 0;
          hopInterval = randomBetween(hopBase * 0.8, hopBase * 1.2);
          isHopping = true;
          doHop(rock, () => { isHopping = false; });
        }

        // Wander
        wanderT += dt;
        if (wanderT > wanderInterval && alive) {
          wanderT = 0;
          wanderInterval = randomBetween(30000, 60000);
          const targets = getWanderTargets();
          const t = targets[Math.floor(Math.random() * targets.length)];
          doWanderHop(rock, avatar, t.col, t.row, ROCK_HOME.col, ROCK_HOME.row);
        }

        // Reaction
        if (currentReaction && currentReaction !== reactionActive) {
          reactionActive = currentReaction;
          reactionT = 0;
          spawnReactionParticles(PIXI, particles, rock, currentReaction);
        }

        if (reactionActive) {
          reactionT += dt;
          if (reactionT > 2500) {
            reactionActive = null;
            reactionT = 0;
            onReactionDoneRef.current?.();
          }
        }
      });

      pixiRef.current = {
        cleanup: () => { app.destroy(false, { children: true }); },
      };
    }

    init().catch(console.error);
    return () => {
      mounted = false;
      pixiRef.current?.cleanup();
      pixiRef.current = null;
    };
  }, [serial]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ imageRendering: "pixelated", display: "block" }}
    />
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function drawGarden(PIXI: typeof import("pixi.js"), container: import("pixi.js").Container) {
  const g = new PIXI.Graphics();
  const TS = TILE_SIZE * TILE_SCALE;

  // Base grass
  g.rect(0, 0, CANVAS_W, CANVAS_H).fill({ color: GRASS_COLOR });

  // Grass variation patches
  const patches: [number, number][] = [[1,1],[3,2],[7,1],[11,2],[14,1],[2,8],[5,8],[10,7],[14,8],[0,5],[15,4]];
  for (const [col, row] of patches) {
    g.rect(col * TS, row * TS, TS, TS).fill({ color: GRASS_DARK });
  }

  // Dirt path (center strip)
  for (let col = 5; col <= 10; col++) {
    g.rect(col * TS, 4 * TS, TS, TS).fill({ color: 0x6b4c2a });
    g.rect(col * TS + 2, 4 * TS + 2, TS - 4, TS - 4).fill({ color: 0x7a5a35 });
  }

  // Fence border
  g.rect(0, 0, CANVAS_W, 4).fill({ color: FENCE_COLOR });
  g.rect(0, CANVAS_H - 4, CANVAS_W, 4).fill({ color: FENCE_COLOR });
  g.rect(0, 0, 4, CANVAS_H).fill({ color: FENCE_COLOR });
  g.rect(CANVAS_W - 4, 0, 4, CANVAS_H).fill({ color: FENCE_COLOR });

  for (let col = 0; col <= COLS; col += 2) {
    const x = col * TS;
    g.rect(x - 3, 0, 6, 14).fill({ color: FENCE_COLOR });
    g.rect(x - 3, CANVAS_H - 14, 6, 14).fill({ color: FENCE_COLOR });
  }

  // Trees in corners
  const trees: [number, number][] = [[1, 1], [14, 1], [1, 7], [14, 7]];
  for (const [col, row] of trees) {
    const tx = (col + 0.5) * TS;
    const ty = (row + 0.5) * TS;
    g.rect(tx - 3, ty + 4, 6, 12).fill({ color: 0x5a3820 });
    g.circle(tx, ty - 2, 14).fill({ color: 0x2d6e20 });
    g.circle(tx - 6, ty + 2, 10).fill({ color: 0x2d6e20 });
    g.circle(tx + 6, ty + 2, 10).fill({ color: 0x2d6e20 });
    g.circle(tx, ty - 6, 9).fill({ color: 0x3a8a28 });
  }

  // Flowers with stems and petals
  const flowerSpots: [number, number][] = [[3,3],[5,2],[11,3],[13,2],[2,7],[12,7],[6,2],[10,8],[4,8],[9,2]];
  for (const [col, row] of flowerSpots) {
    const x = (col + 0.5) * TS;
    const y = (row + 0.5) * TS;
    const isYellow = (col + row) % 2 === 0;
    g.rect(x - 1, y - 2, 2, 10).fill({ color: 0x2d7a00 });
    g.circle(x, y - 4, 4).fill({ color: isYellow ? FLOWER_YELLOW : FLOWER_PINK });
    g.circle(x - 4, y - 4, 2).fill({ color: isYellow ? 0xffee44 : 0xff88cc });
    g.circle(x + 4, y - 4, 2).fill({ color: isYellow ? 0xffee44 : 0xff88cc });
    g.circle(x, y - 8, 2).fill({ color: isYellow ? 0xffee44 : 0xff88cc });
  }

  // Pebbles for texture
  const pebbles: [number, number][] = [[6,6],[8,4],[10,6],[5,7],[11,5]];
  for (const [col, row] of pebbles) {
    const x = (col + 0.3 + Math.sin(col * 7) * 0.3) * TS;
    const y = (row + 0.3 + Math.cos(row * 11) * 0.3) * TS;
    g.ellipse(x, y, 4, 3).fill({ color: 0x8a8a7a });
  }

  container.addChild(g);
}

function mulberry32(seed: number) {
  return function (): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function shiftColorNum(color: number, amount: number): number {
  const r = Math.min(255, Math.max(0, ((color >> 16) & 0xff) + amount));
  const gg = Math.min(255, Math.max(0, ((color >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (color & 0xff) + amount));
  return (r << 16) | (gg << 8) | b;
}

function drawRockBody(PIXI: typeof import("pixi.js"), serial?: number): import("pixi.js").Container {
  const container = new PIXI.Container();
  const g = new PIXI.Graphics();
  const rand = mulberry32(serial ?? 1);

  const BODY_COLORS = [0x8B8B8B, 0x6B6B6B, 0xA09080, 0x7A8A7A, 0x5A7060, 0x8090A0, 0x70605A, 0xC0C0B0];
  const EYE_POSITIONS = [
    [4, 6], [7, 6],
    [4, 8], [7, 8],
    [3, 7], [6, 7],
    [5, 7], [8, 7],
    [4, 7], [8, 7],
    [5, 6], [7, 9],
  ];
  const MOOD_MARKS = ["smile", "neutral", "asleep", "grin", "droopy"] as const;

  const bodyColor = BODY_COLORS[Math.floor(rand() * BODY_COLORS.length)];
  const eyePairIdx = Math.floor(rand() * 6) * 2;
  const eye1 = EYE_POSITIONS[eyePairIdx];
  const eye2 = EYE_POSITIONS[eyePairIdx + 1];
  const moodMark = MOOD_MARKS[Math.floor(rand() * MOOD_MARKS.length)];

  const shadowColor = shiftColorNum(bodyColor, -30);
  const highlightColor = shiftColorNum(bodyColor, 40);
  const eyeColor = 0x1A1A2E;
  const markColor = 0x3A3A3A;

  const EMPTY = -1;
  const pixels: number[][] = Array.from({ length: 16 }, () => Array(16).fill(EMPTY));

  function px(x: number, y: number, color: number) {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) pixels[y][x] = color;
  }
  function fillRect(x: number, y: number, w: number, h: number, color: number) {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        px(x + dx, y + dy, color);
  }

  // Rock body shape
  fillRect(3, 4, 10, 9, bodyColor);
  fillRect(2, 5, 12, 7, bodyColor);
  fillRect(4, 3, 8, 1, bodyColor);
  fillRect(4, 13, 8, 1, bodyColor);

  // Shadow (bottom-right)
  for (let x = 7; x < 13; x++) px(x, 13, shadowColor);
  for (let y = 8; y < 13; y++) px(13, y, shadowColor);
  px(12, 13, shadowColor);

  // Highlight (top-left)
  for (let x = 3; x < 7; x++) px(x, 4, highlightColor);
  for (let y = 4; y < 8; y++) px(3, y, highlightColor);

  // Eyes
  fillRect(eye1[0], eye1[1], 2, 2, eyeColor);
  fillRect(eye2[0], eye2[1], 2, 2, eyeColor);
  px(eye1[0], eye1[1], 0xFFFFFF);
  px(eye2[0], eye2[1], 0xFFFFFF);

  // Mood mark
  switch (moodMark) {
    case "smile":
      px(5, 10, markColor); px(6, 11, markColor); px(7, 11, markColor); px(8, 10, markColor);
      break;
    case "grin":
      for (let x = 5; x <= 8; x++) px(x, 10, markColor);
      px(5, 11, markColor); px(8, 11, markColor);
      break;
    case "neutral":
      for (let x = 5; x <= 8; x++) px(x, 10, markColor);
      break;
    case "asleep":
      px(5, 10, markColor); px(6, 11, markColor); px(7, 11, markColor); px(8, 10, markColor);
      px(5, 9, markColor); px(8, 9, markColor);
      break;
    case "droopy":
      px(5, 11, markColor); px(6, 10, markColor); px(7, 10, markColor); px(8, 11, markColor);
      break;
  }

  // Render each pixel as a 4px square, centered at origin
  const PS = 4;
  const OFFSET = -8 * PS;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (pixels[y][x] !== EMPTY) {
        g.rect(OFFSET + x * PS, OFFSET + y * PS, PS, PS).fill({ color: pixels[y][x] });
      }
    }
  }

  container.addChild(g);
  return container;
}

function drawAvatar(PIXI: typeof import("pixi.js"), container: import("pixi.js").Container) {
  const g = new PIXI.Graphics();
  const S = TILE_SIZE * TILE_SCALE;
  g.rect(-S * 0.2, -S * 0.3, S * 0.4, S * 0.55).fill({ color: AVATAR_COLOR });
  g.circle(0, -S * 0.42, S * 0.18).fill({ color: AVATAR_SKIN });
  g.circle(-5, -S * 0.44, 2).fill({ color: 0x333333 });
  g.circle(5, -S * 0.44, 2).fill({ color: 0x333333 });
  container.addChild(g);
}

function doBlink(rock: import("pixi.js").Container) {
  const orig = rock.scale.y;
  rock.scale.y = orig * 0.95;
  setTimeout(() => { rock.scale.y = orig; }, 150);
}

function doTilt(rock: import("pixi.js").Container, dir: number) {
  const target = dir * (4 * Math.PI / 180);
  const startRot = rock.rotation;
  const start = performance.now();
  function step(now: number) {
    const t = Math.min((now - start) / 400, 1);
    rock.rotation = startRot + (target - startRot) * easeInOut(t);
    if (t < 1) { requestAnimationFrame(step); return; }
    setTimeout(() => {
      const s2 = performance.now();
      const from = rock.rotation;
      function snap(n: number) {
        const t2 = Math.min((n - s2) / 300, 1);
        rock.rotation = from * (1 - easeInOut(t2));
        if (t2 < 1) requestAnimationFrame(snap);
      }
      requestAnimationFrame(snap);
    }, 200);
  }
  requestAnimationFrame(step);
}

function doHop(rock: import("pixi.js").Container, onDone: () => void) {
  const origY = rock.y;
  const start = performance.now();
  function step(now: number) {
    const t = Math.min((now - start) / 200, 1);
    rock.y = origY - 8 * Math.sin(t * Math.PI);
    if (t < 1) { requestAnimationFrame(step); return; }
    rock.y = origY;
    rock.scale.set(1.1, 0.9);
    setTimeout(() => { rock.scale.set(1, 1); onDone(); }, 100);
  }
  requestAnimationFrame(step);
}

function doWanderHop(
  rock: import("pixi.js").Container,
  avatar: import("pixi.js").Container,
  targetCol: number, targetRow: number,
  homeCol: number, homeRow: number,
) {
  const sx = rock.x, sy = rock.y;
  const tx = (targetCol + 0.5) * TILE_SIZE * TILE_SCALE;
  const ty = (targetRow + 0.5) * TILE_SIZE * TILE_SCALE;
  const start = performance.now();
  function step(now: number) {
    const t = Math.min((now - start) / 300, 1);
    rock.x = sx + (tx - sx) * easeInOut(t);
    rock.y = sy + (ty - sy) * easeInOut(t) - 12 * Math.sin(t * Math.PI);
    avatar.scale.x = rock.x < avatar.x ? -1 : 1;
    if (t < 1) { requestAnimationFrame(step); return; }
    setTimeout(() => {
      const s2 = performance.now();
      const hx = (homeCol + 0.5) * TILE_SIZE * TILE_SCALE;
      const hy = (homeRow + 0.5) * TILE_SIZE * TILE_SCALE;
      function back(n: number) {
        const t2 = Math.min((n - s2) / 300, 1);
        rock.x = tx + (hx - tx) * easeInOut(t2);
        rock.y = ty + (hy - ty) * easeInOut(t2) - 12 * Math.sin(t2 * Math.PI);
        if (t2 < 1) requestAnimationFrame(back);
      }
      requestAnimationFrame(back);
    }, 500);
  }
  requestAnimationFrame(step);
}

function spawnReactionParticles(
  PIXI: typeof import("pixi.js"),
  container: import("pixi.js").Container,
  rock: import("pixi.js").Container,
  reaction: ReactionType,
) {
  const rx = rock.x, ry = rock.y;

  function dot(color: number, x: number, y: number, r = 5) {
    const g = new PIXI.Graphics();
    g.circle(0, 0, r).fill({ color });
    g.x = x; g.y = y;
    container.addChild(g);
    animateFloat(g, () => container.removeChild(g));
  }

  switch (reaction) {
    case "fed":
      for (let i = 0; i < 4; i++)
        dot(0x22cc55, rx + (Math.random() - 0.5) * 30, ry - 20 - Math.random() * 20);
      break;
    case "played":
      for (let i = 0; i < 5; i++)
        dot(0xffcc00, rx + (Math.random() - 0.5) * 40, ry - 10 - Math.random() * 30, 4);
      break;
    case "groomed":
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        dot(0xaaddff, rx + Math.cos(a) * 30, ry + Math.sin(a) * 30, 4);
      }
      break;
    case "sleeping":
      for (let i = 0; i < 3; i++)
        dot(0x8888ff, rx + 10 + i * 8, ry - 20 - i * 8, 3 + i);
      break;
    case "dying":
    case "dead":
      for (let i = 0; i < 5; i++)
        dot(0x888888, rx + (Math.random() - 0.5) * 30, ry - Math.random() * 30, 4);
      break;
  }
}

function animateFloat(obj: import("pixi.js").Container, onDone: () => void, duration = 1500) {
  const start = performance.now();
  const startY = obj.y;
  function step(now: number) {
    const t = Math.min((now - start) / duration, 1);
    obj.y = startY - 30 * t;
    obj.alpha = 1 - t;
    if (t < 1) requestAnimationFrame(step); else onDone();
  }
  requestAnimationFrame(step);
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function getWanderTargets() {
  const out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const col = ROCK_HOME.col + dc, row = ROCK_HOME.row + dr;
      if (col > 0 && col < COLS - 1 && row > 0 && row < ROWS - 1)
        out.push({ col, row });
    }
  return out;
}
