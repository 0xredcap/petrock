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

      // Set before app.init so all textures pick up nearest-neighbor
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

      // Dead overlay — a grey semi-transparent ellipse drawn over the rock body
      const deadOverlay = new PIXI.Graphics();
      deadOverlay.ellipse(0, 0, TILE_SIZE * TILE_SCALE * 0.5, TILE_SIZE * TILE_SCALE * 0.44)
        .fill({ color: 0x888888, alpha: 0.6 });
      deadOverlay.alpha = 0;

      const rockBody = drawRockBody(PIXI, serial);
      rock.addChild(rockBody);
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

        // Sad tilt — only apply if not already tilted by tilt animation
        if (mood < 30 && alive) {
          rock.rotation = -0.14;
        }

        // Dead overlay
        deadOverlay.alpha = alive ? 0 : 0.6;

        // Avatar bob
        avatarBobT += dt;
        avatar.y = (AVATAR_POS.row + 0.5) * TILE_SIZE * TILE_SCALE +
          Math.sin((avatarBobT / 1000) * Math.PI * 2);

        // Ambient pulse
        ambientT += dt;
        ambientOverlay.alpha = 0.05 * (0.5 + 0.5 * Math.sin((ambientT / 30000) * Math.PI * 2));

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

        // Reaction — trigger once per new reaction value
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
  g.rect(0, 0, CANVAS_W, CANVAS_H).fill({ color: GRASS_COLOR });

  for (let col = 5; col <= 10; col++) {
    g.rect(col * TILE_SIZE * TILE_SCALE, 4 * TILE_SIZE * TILE_SCALE,
      TILE_SIZE * TILE_SCALE, TILE_SIZE * TILE_SCALE).fill({ color: GRASS_DARK });
  }

  g.rect(0, 0, CANVAS_W, 4).fill({ color: FENCE_COLOR });
  g.rect(0, CANVAS_H - 4, CANVAS_W, 4).fill({ color: FENCE_COLOR });
  g.rect(0, 0, 4, CANVAS_H).fill({ color: FENCE_COLOR });
  g.rect(CANVAS_W - 4, 0, 4, CANVAS_H).fill({ color: FENCE_COLOR });

  for (let col = 0; col <= COLS; col += 2) {
    const x = col * TILE_SIZE * TILE_SCALE;
    g.rect(x - 3, 0, 6, 10).fill({ color: FENCE_COLOR });
    g.rect(x - 3, CANVAS_H - 10, 6, 10).fill({ color: FENCE_COLOR });
  }

  const flowerSpots = [[3,3],[5,2],[11,3],[13,2],[2,7],[12,7],[6,2],[10,8]];
  for (const [col, row] of flowerSpots) {
    const x = (col + 0.5) * TILE_SIZE * TILE_SCALE;
    const y = (row + 0.5) * TILE_SIZE * TILE_SCALE;
    g.circle(x, y, 5).fill({ color: (col + row) % 2 === 0 ? FLOWER_YELLOW : FLOWER_PINK });
    g.rect(x - 1, y, 2, 8).fill({ color: 0x2d7a00 });
  }

  container.addChild(g);
}

function drawRockBody(PIXI: typeof import("pixi.js"), serial?: number): import("pixi.js").Container {
  const container = new PIXI.Container();
  const g = new PIXI.Graphics();
  const S = TILE_SIZE * TILE_SCALE;
  const seed = serial ?? 1;

  const palette = [0x8b8b8b, 0x6b6b6b, 0xa09080, 0x7a8a7a, 0x5a7060, 0x8090a0, 0x70605a, 0xc0c0b0];
  const body = palette[seed % palette.length];

  g.ellipse(0, 0, S * 0.55, S * 0.48).fill({ color: body });
  g.ellipse(S * 0.08, S * 0.08, S * 0.5, S * 0.43).fill({ color: darkenHex(body, 0.7) });
  g.ellipse(0, 0, S * 0.5, S * 0.44).fill({ color: body });
  g.ellipse(-S * 0.12, -S * 0.12, S * 0.22, S * 0.16).fill({ color: lightenHex(body, 1.4) });

  const eyeOffsets = [[-0.15, -0.05], [0.15, -0.05], [-0.12, -0.1], [0.12, -0.1]];
  const e1 = eyeOffsets[(seed % 2) * 2];
  const e2 = eyeOffsets[(seed % 2) * 2 + 1];
  g.circle(e1[0] * S, e1[1] * S, S * 0.07).fill({ color: 0x1a1a2e });
  g.circle(e2[0] * S, e2[1] * S, S * 0.07).fill({ color: 0x1a1a2e });
  g.circle(e1[0] * S - 2, e1[1] * S - 2, 2).fill({ color: 0xffffff });
  g.circle(e2[0] * S - 2, e2[1] * S - 2, 2).fill({ color: 0xffffff });

  const marks = ["smile", "neutral", "grin"] as const;
  const y = S * 0.15;
  switch (marks[seed % marks.length]) {
    case "smile":
      g.arc(0, y - S * 0.03, S * 0.14, 0.2, Math.PI - 0.2).stroke({ color: 0x3a3a3a, width: 2 });
      break;
    case "grin":
      g.rect(-S * 0.14, y, S * 0.28, S * 0.06).fill({ color: 0x3a3a3a });
      break;
    case "neutral":
      g.rect(-S * 0.12, y, S * 0.24, 2).fill({ color: 0x3a3a3a });
      break;
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

function darkenHex(color: number, f: number) {
  return (Math.floor(((color >> 16) & 0xff) * f) << 16) |
    (Math.floor(((color >> 8) & 0xff) * f) << 8) |
    Math.floor((color & 0xff) * f);
}

function lightenHex(color: number, f: number) {
  return (Math.min(255, Math.floor(((color >> 16) & 0xff) * f)) << 16) |
    (Math.min(255, Math.floor(((color >> 8) & 0xff) * f)) << 8) |
    Math.min(255, Math.floor((color & 0xff) * f));
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
