"use client";

import { useEffect, useRef } from "react";
import type { PetStats } from "@/lib/hedera/stats";

const TILE_SIZE = 18;
const TILE_SCALE = 3;
const COLS = 16;
const ROWS = 10;
const CANVAS_W = COLS * TILE_SIZE * TILE_SCALE;
const CANVAS_H = ROWS * TILE_SIZE * TILE_SCALE;

// Rock home tile and avatar tile (grid coords)
const ROCK_HOME = { col: 7, row: 5 };
const AVATAR_POS = { col: 9, row: 5 };

const GRASS_COLOR = 0x4c9900;
const GRASS_DARK = 0x3c7a00;
const DIRT_COLOR = 0x8b5a2b;
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
  const pixiRef = useRef<{
    app: import("pixi.js").Application;
    rock: import("pixi.js").Container;
    avatar: import("pixi.js").Container;
    ticker: import("pixi.js").Ticker;
    cleanup: () => void;
  } | null>(null);

  const statsRef = useRef(stats);
  const reactionRef = useRef(reaction);
  statsRef.current = stats;
  reactionRef.current = reaction;

  useEffect(() => {
    if (!canvasRef.current) return;

    let mounted = true;

    async function init() {
      const PIXI = await import("pixi.js");

      if (!mounted || !canvasRef.current) return;

      const app = new PIXI.Application();
      await app.init({
        canvas: canvasRef.current,
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundColor: GRASS_COLOR,
        antialias: false,
        resolution: 1,
      });

      // Set nearest-neighbor scale mode for crisp pixels
      PIXI.TextureSource.defaultOptions.scaleMode = "nearest";

      // === BUILD GARDEN ===
      const worldContainer = new PIXI.Container();
      app.stage.addChild(worldContainer);

      drawGarden(PIXI, worldContainer);

      // === ROCK CONTAINER ===
      const rock = new PIXI.Container();
      rock.x = (ROCK_HOME.col + 0.5) * TILE_SIZE * TILE_SCALE;
      rock.y = (ROCK_HOME.row + 0.5) * TILE_SIZE * TILE_SCALE;
      worldContainer.addChild(rock);

      // Draw rock (SVG as Graphics fallback or colored circle)
      const rockBody = drawRockBody(PIXI, serial);
      rock.addChild(rockBody);

      // === AVATAR CONTAINER ===
      const avatar = new PIXI.Container();
      avatar.x = (AVATAR_POS.col + 0.5) * TILE_SIZE * TILE_SCALE;
      avatar.y = (AVATAR_POS.row + 0.5) * TILE_SIZE * TILE_SCALE;
      worldContainer.addChild(avatar);
      drawAvatar(PIXI, avatar);

      // === AMBIENT OVERLAY (day/night pulse) ===
      const ambientOverlay = new PIXI.Graphics();
      ambientOverlay.rect(0, 0, CANVAS_W, CANVAS_H).fill({ color: 0x000033, alpha: 0 });
      app.stage.addChild(ambientOverlay);

      // === PARTICLE CONTAINER ===
      const particles = new PIXI.Container();
      app.stage.addChild(particles);

      // === TICKER ANIMATIONS ===
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
      let tiltDir = 1;
      let wanderCol = ROCK_HOME.col;
      let wanderRow = ROCK_HOME.row;
      let wanderTargetCol = ROCK_HOME.col;
      let wanderTargetRow = ROCK_HOME.row;
      let wanderProgress = 1;
      let isHopping = false;
      let hopProgress = 0;

      app.ticker.maxFPS = 60;
      app.ticker.add((ticker) => {
        if (document.hidden) return;
        const dt = ticker.deltaMS;
        const currentStats = statsRef.current;
        const currentReaction = reactionRef.current;

        // Determine mood state
        const mood = currentStats?.mood ?? 100;
        const hunger = currentStats?.hunger ?? 100;
        const energy = currentStats?.energy ?? 100;
        const alive = currentStats?.alive !== false;

        // Breathing
        const breathSpeed = mood > 70 ? 1500 : mood < 30 ? 3000 : 2000;
        breathT += dt;
        const breathScale = 1 + 0.04 * Math.sin((breathT / breathSpeed) * Math.PI * 2);
        rock.scale.y = breathScale;

        // Avatar bob
        avatarBobT += dt;
        const bobOffset = Math.sin((avatarBobT / 1000) * Math.PI * 2);
        avatar.y = (AVATAR_POS.row + 0.5) * TILE_SIZE * TILE_SCALE + bobOffset;

        // Ambient overlay pulse
        ambientT += dt;
        const ambientAlpha = 0.05 * (0.5 + 0.5 * Math.sin((ambientT / 30000) * Math.PI * 2));
        ambientOverlay.alpha = ambientAlpha;

        // Blinking
        blinkT += dt;
        if (blinkT > blinkInterval) {
          blinkT = 0;
          blinkInterval = randomBetween(4000, 7000);
          doBlink(rock);
        }

        // Head tilt
        tiltT += dt;
        if (tiltT > tiltInterval) {
          tiltT = 0;
          tiltInterval = randomBetween(8000, 15000);
          tiltDir = Math.random() > 0.5 ? 1 : -1;
          doTilt(rock, tiltDir);
        }

        // Hop (mood-dependent)
        const hopIntervalBase = mood > 70 ? 10000 : 25000;
        hopT += dt;
        if (!isHopping && mood >= 30 && alive && hopT > hopInterval) {
          hopT = 0;
          hopInterval = randomBetween(hopIntervalBase * 0.8, hopIntervalBase * 1.2);
          isHopping = true;
          hopProgress = 0;
          doHop(rock, () => { isHopping = false; });
        }

        // Wander
        wanderT += dt;
        if (wanderT > wanderInterval && alive) {
          wanderT = 0;
          wanderInterval = randomBetween(30000, 60000);
          const targets = getWanderTargets();
          const t = targets[Math.floor(Math.random() * targets.length)];
          wanderTargetCol = t.col;
          wanderTargetRow = t.row;
          wanderProgress = 0;
          doWanderHop(PIXI, rock, avatar, t.col, t.row, ROCK_HOME.col, ROCK_HOME.row);
        }

        // Hungry drift toward avatar
        if (hunger < 30 && alive) {
          // Rock has a subtle drift handled by wander logic
        }

        // Sad tilt (mood < 30)
        if (mood < 30 && alive) {
          rock.rotation = -0.14; // tilt down ~8°
        }

        // Tired squash (energy < 30)
        if (energy < 30 && alive) {
          rock.scale.y = 0.9;
        }

        // Reaction animations
        if (currentReaction && currentReaction !== reactionActive) {
          reactionActive = currentReaction;
          reactionT = 0;
          spawnReactionParticles(PIXI, particles, rock, currentReaction);
        }

        if (reactionActive) {
          reactionT += dt;
          if (reactionT > 2500) {
            reactionActive = null;
            onReactionDone?.();
          }
        }

        // Dead state
        if (!alive) {
          rock.alpha = 0.4;
          rock.tint = 0x888888;
        }
      });

      pixiRef.current = {
        app,
        rock,
        avatar,
        ticker: app.ticker,
        cleanup: () => {
          app.destroy(false, { children: true });
        },
      };
    }

    init().catch(console.error);

    return () => {
      mounted = false;
      pixiRef.current?.cleanup();
      pixiRef.current = null;
    };
  }, [serial]); // Re-init if pet changes

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ imageRendering: "pixelated", display: "block" }}
    />
  );
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function drawGarden(PIXI: typeof import("pixi.js"), container: import("pixi.js").Container) {
  const g = new PIXI.Graphics();

  // Base grass
  g.rect(0, 0, CANVAS_W, CANVAS_H).fill({ color: GRASS_COLOR });

  // Dirt path accent
  for (let col = 5; col <= 10; col++) {
    g.rect(col * TILE_SIZE * TILE_SCALE, 4 * TILE_SIZE * TILE_SCALE,
      TILE_SIZE * TILE_SCALE, TILE_SIZE * TILE_SCALE)
      .fill({ color: GRASS_DARK });
  }

  // Fence (perimeter, 2px wide)
  const fs = TILE_SIZE * TILE_SCALE;
  g.rect(0, 0, CANVAS_W, 4).fill({ color: FENCE_COLOR });
  g.rect(0, CANVAS_H - 4, CANVAS_W, 4).fill({ color: FENCE_COLOR });
  g.rect(0, 0, 4, CANVAS_H).fill({ color: FENCE_COLOR });
  g.rect(CANVAS_W - 4, 0, 4, CANVAS_H).fill({ color: FENCE_COLOR });

  // Fence posts
  for (let col = 0; col <= COLS; col += 2) {
    const x = col * TILE_SIZE * TILE_SCALE;
    g.rect(x - 3, 0, 6, 10).fill({ color: FENCE_COLOR });
    g.rect(x - 3, CANVAS_H - 10, 6, 10).fill({ color: FENCE_COLOR });
  }

  // Flowers
  const flowerSpots = [
    [3, 3], [5, 2], [11, 3], [13, 2], [2, 7], [12, 7], [6, 2], [10, 8],
  ];
  for (const [col, row] of flowerSpots) {
    const x = (col + 0.5) * TILE_SIZE * TILE_SCALE;
    const y = (row + 0.5) * TILE_SIZE * TILE_SCALE;
    const color = (col + row) % 2 === 0 ? FLOWER_YELLOW : FLOWER_PINK;
    g.circle(x, y, 5).fill({ color });
    g.rect(x - 1, y, 2, 8).fill({ color: 0x2d7a00 });
  }

  container.addChild(g);
}

function drawRockBody(PIXI: typeof import("pixi.js"), serial?: number): import("pixi.js").Container {
  const container = new PIXI.Container();
  const g = new PIXI.Graphics();

  const S = TILE_SIZE * TILE_SCALE;
  const seed = serial ?? 1;

  // Deterministic color from serial
  const colors = [0x8b8b8b, 0x6b6b6b, 0xa09080, 0x7a8a7a, 0x5a7060, 0x8090a0, 0x70605a, 0xc0c0b0];
  const bodyColor = colors[seed % colors.length];
  const shadowColor = darkenHex(bodyColor, 0.7);
  const highlightColor = lightenHex(bodyColor, 1.4);

  // Rock body (oval shape)
  g.ellipse(0, 0, S * 0.55, S * 0.48).fill({ color: bodyColor });
  // Shadow edge
  g.ellipse(S * 0.08, S * 0.08, S * 0.5, S * 0.43).fill({ color: shadowColor });
  // Re-draw main body
  g.ellipse(0, 0, S * 0.5, S * 0.44).fill({ color: bodyColor });
  // Highlight
  g.ellipse(-S * 0.12, -S * 0.12, S * 0.22, S * 0.16).fill({ color: highlightColor });

  // Eyes (two small circles)
  const eyeOffsets = [
    [-0.15, -0.05], [0.15, -0.05],   // center set
    [-0.12, -0.1], [0.12, -0.1],
  ];
  const eyeSet = seed % 2;
  const e1 = eyeOffsets[eyeSet * 2];
  const e2 = eyeOffsets[eyeSet * 2 + 1];

  g.circle(e1[0] * S, e1[1] * S, S * 0.07).fill({ color: 0x1a1a2e });
  g.circle(e2[0] * S, e2[1] * S, S * 0.07).fill({ color: 0x1a1a2e });
  // Eye shines
  g.circle(e1[0] * S - 2, e1[1] * S - 2, 2).fill({ color: 0xffffff });
  g.circle(e2[0] * S - 2, e2[1] * S - 2, 2).fill({ color: 0xffffff });

  // Mouth (deterministic)
  const moodMarks = ["smile", "neutral", "grin"];
  const mark = moodMarks[seed % moodMarks.length];
  drawMouth(g, S, mark as "smile" | "neutral" | "grin");

  container.addChild(g);
  return container;
}

function drawMouth(
  g: import("pixi.js").Graphics,
  S: number,
  mark: "smile" | "neutral" | "grin"
) {
  const y = S * 0.15;
  switch (mark) {
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
}

function drawAvatar(PIXI: typeof import("pixi.js"), container: import("pixi.js").Container) {
  const g = new PIXI.Graphics();
  const S = TILE_SIZE * TILE_SCALE;

  // Body
  g.rect(-S * 0.2, -S * 0.3, S * 0.4, S * 0.55).fill({ color: AVATAR_COLOR });
  // Head
  g.circle(0, -S * 0.42, S * 0.18).fill({ color: AVATAR_SKIN });
  // Eyes
  g.circle(-5, -S * 0.44, 2).fill({ color: 0x333333 });
  g.circle(5, -S * 0.44, 2).fill({ color: 0x333333 });

  container.addChild(g);
}

function doBlink(rock: import("pixi.js").Container) {
  // Quick scale squish to simulate blink
  const orig = rock.scale.y;
  rock.scale.y = orig * 0.95;
  setTimeout(() => { rock.scale.y = orig; }, 150);
}

function doTilt(rock: import("pixi.js").Container, dir: number) {
  const targetRot = dir * (4 * Math.PI / 180);
  const startRot = rock.rotation;
  const duration = 400;
  const start = performance.now();

  function step(now: number) {
    const t = Math.min((now - start) / duration, 1);
    rock.rotation = startRot + (targetRot - startRot) * easeInOut(t);
    if (t < 1) requestAnimationFrame(step);
    else {
      // Snap back
      setTimeout(() => {
        const s2 = performance.now();
        const origRot = rock.rotation;
        function snap(n: number) {
          const t2 = Math.min((n - s2) / 300, 1);
          rock.rotation = origRot * (1 - easeInOut(t2));
          if (t2 < 1) requestAnimationFrame(snap);
        }
        requestAnimationFrame(snap);
      }, 200);
    }
  }
  requestAnimationFrame(step);
}

function doHop(rock: import("pixi.js").Container, onDone: () => void) {
  const origY = rock.y;
  const duration = 200;
  const start = performance.now();

  function step(now: number) {
    const t = Math.min((now - start) / duration, 1);
    rock.y = origY - 8 * Math.sin(t * Math.PI);
    if (t < 1) requestAnimationFrame(step);
    else {
      rock.y = origY;
      // Landing squash
      rock.scale.x = 1.1;
      rock.scale.y = 0.9;
      setTimeout(() => {
        rock.scale.x = 1;
        rock.scale.y = 1;
        onDone();
      }, 100);
    }
  }
  requestAnimationFrame(step);
}

function doWanderHop(
  PIXI: typeof import("pixi.js"),
  rock: import("pixi.js").Container,
  avatar: import("pixi.js").Container,
  targetCol: number,
  targetRow: number,
  homeCol: number,
  homeRow: number,
) {
  const startX = rock.x;
  const startY = rock.y;
  const targetX = (targetCol + 0.5) * TILE_SIZE * TILE_SCALE;
  const targetY = (targetRow + 0.5) * TILE_SIZE * TILE_SCALE;
  const duration = 300;
  const start = performance.now();

  function step(now: number) {
    const t = Math.min((now - start) / duration, 1);
    rock.x = startX + (targetX - startX) * easeInOut(t);
    rock.y = startY + (targetY - startY) * easeInOut(t) - 12 * Math.sin(t * Math.PI);

    // Avatar faces the rock
    if (rock.x < avatar.x) {
      avatar.scale.x = -1;
    } else {
      avatar.scale.x = 1;
    }

    if (t < 1) requestAnimationFrame(step);
    else {
      // Hold, then hop back
      setTimeout(() => {
        const s2 = performance.now();
        function back(n: number) {
          const t2 = Math.min((n - s2) / duration, 1);
          const hx = (homeCol + 0.5) * TILE_SIZE * TILE_SCALE;
          const hy = (homeRow + 0.5) * TILE_SIZE * TILE_SCALE;
          rock.x = targetX + (hx - targetX) * easeInOut(t2);
          rock.y = targetY + (hy - targetY) * easeInOut(t2) - 12 * Math.sin(t2 * Math.PI);
          if (t2 < 1) requestAnimationFrame(back);
        }
        requestAnimationFrame(back);
      }, 500);
    }
  }
  requestAnimationFrame(step);
}

function spawnReactionParticles(
  PIXI: typeof import("pixi.js"),
  container: import("pixi.js").Container,
  rock: import("pixi.js").Container,
  reaction: ReactionType,
) {
  if (!reaction) return;

  const rockX = rock.x;
  const rockY = rock.y;

  switch (reaction) {
    case "fed": {
      const label = new PIXI.Text({ text: "🍎", style: { fontSize: 20 } });
      label.x = rockX - 10;
      label.y = rockY - 40;
      container.addChild(label);
      animateFloat(label, () => container.removeChild(label));
      break;
    }
    case "played": {
      for (let i = 0; i < 3; i++) {
        const star = new PIXI.Text({ text: "✨", style: { fontSize: 14 } });
        star.x = rockX + (Math.random() - 0.5) * 40;
        star.y = rockY - 20;
        container.addChild(star);
        animateFloat(star, () => container.removeChild(star));
      }
      break;
    }
    case "groomed": {
      for (let i = 0; i < 5; i++) {
        const sparkle = new PIXI.Text({ text: "✦", style: { fontSize: 12, fill: 0xffee00 } });
        const angle = (i / 5) * Math.PI * 2;
        sparkle.x = rockX + Math.cos(angle) * 30;
        sparkle.y = rockY + Math.sin(angle) * 30;
        container.addChild(sparkle);
        animateFloat(sparkle, () => container.removeChild(sparkle));
      }
      break;
    }
    case "sleeping": {
      const zzz = new PIXI.Text({ text: "Zzz", style: { fontSize: 14, fill: 0xaaaaff } });
      zzz.x = rockX + 10;
      zzz.y = rockY - 30;
      container.addChild(zzz);
      animateFloat(zzz, () => container.removeChild(zzz), 3000);
      break;
    }
    case "dying": {
      const skull = new PIXI.Text({ text: "💀", style: { fontSize: 24 } });
      skull.x = rockX - 12;
      skull.y = rockY - 50;
      container.addChild(skull);
      animateFloat(skull, () => container.removeChild(skull), 2000);
      break;
    }
    case "dead": {
      const ghost = new PIXI.Text({ text: "👻", style: { fontSize: 28 } });
      ghost.x = rockX - 14;
      ghost.y = rockY - 20;
      container.addChild(ghost);
      animateFadeUp(ghost, () => container.removeChild(ghost), 2000);
      break;
    }
  }
}

function animateFloat(obj: import("pixi.js").Container, onDone: () => void, duration = 1500) {
  const start = performance.now();
  const startY = obj.y;
  function step(now: number) {
    const t = Math.min((now - start) / duration, 1);
    obj.y = startY - 30 * t;
    obj.alpha = 1 - t;
    if (t < 1) requestAnimationFrame(step);
    else onDone();
  }
  requestAnimationFrame(step);
}

function animateFadeUp(obj: import("pixi.js").Container, onDone: () => void, duration = 2000) {
  const start = performance.now();
  const startY = obj.y;
  function step(now: number) {
    const t = Math.min((now - start) / duration, 1);
    obj.y = startY - 30 * t;
    obj.alpha = 1 - t;
    if (t < 1) requestAnimationFrame(step);
    else onDone();
  }
  requestAnimationFrame(step);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function darkenHex(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function lightenHex(color: number, factor: number): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.floor((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

function getWanderTargets() {
  const targets = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const col = ROCK_HOME.col + dc;
      const row = ROCK_HOME.row + dr;
      if (col > 0 && col < COLS - 1 && row > 0 && row < ROWS - 1) {
        targets.push({ col, row });
      }
    }
  }
  return targets;
}
