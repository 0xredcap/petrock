// Deterministic 16×16 pixel-art SVG generator using mulberry32 PRNG

function mulberry32(seed: number) {
  return function (): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

const BODY_COLORS = [
  "#8B8B8B", // mid grey
  "#6B6B6B", // dark grey
  "#A09080", // warm stone
  "#7A8A7A", // mossy grey
  "#5A7060", // mossy green
  "#8090A0", // slate blue
  "#70605A", // earthy brown
  "#C0C0B0", // pale chalk
];

const EYE_POSITIONS = [
  [4, 6], [7, 6],   // position set 0: upper mid
  [4, 8], [7, 8],   // position set 1: mid
  [3, 7], [6, 7],   // position set 2: left-leaning
  [5, 7], [8, 7],   // position set 3: right-leaning
  [4, 7], [8, 7],   // position set 4: wide-set
  [5, 6], [7, 9],   // position set 5: asymmetric
];

type MoodMark = "smile" | "neutral" | "asleep" | "grin" | "droopy";
const MOOD_MARKS: MoodMark[] = ["smile", "neutral", "asleep", "grin", "droopy"];

function drawPixel(pixels: string[][], x: number, y: number, color: string) {
  if (x >= 0 && x < 16 && y >= 0 && y < 16) {
    pixels[y][x] = color;
  }
}

function drawRect(
  pixels: string[][],
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      drawPixel(pixels, x + dx, y + dy, color);
    }
  }
}

function moodMarkPixels(
  pixels: string[][],
  mark: MoodMark,
  color: string
) {
  switch (mark) {
    case "smile":
      drawPixel(pixels, 5, 10, color);
      drawPixel(pixels, 6, 11, color);
      drawPixel(pixels, 7, 11, color);
      drawPixel(pixels, 8, 10, color);
      break;
    case "grin":
      for (let x = 5; x <= 8; x++) drawPixel(pixels, x, 10, color);
      drawPixel(pixels, 5, 11, color);
      drawPixel(pixels, 8, 11, color);
      break;
    case "neutral":
      for (let x = 5; x <= 8; x++) drawPixel(pixels, x, 10, color);
      break;
    case "asleep":
      drawPixel(pixels, 5, 10, color);
      drawPixel(pixels, 6, 11, color);
      drawPixel(pixels, 7, 11, color);
      drawPixel(pixels, 8, 10, color);
      drawPixel(pixels, 5, 9, color);
      drawPixel(pixels, 8, 9, color);
      break;
    case "droopy":
      drawPixel(pixels, 5, 11, color);
      drawPixel(pixels, 6, 10, color);
      drawPixel(pixels, 7, 10, color);
      drawPixel(pixels, 8, 11, color);
      break;
  }
}

export function generateRockSvg(seed: number): string {
  const rand = mulberry32(seed);

  const bodyColor = BODY_COLORS[Math.floor(rand() * BODY_COLORS.length)];
  const eyePairIdx = Math.floor(rand() * 6) * 2;
  const eye1 = EYE_POSITIONS[eyePairIdx];
  const eye2 = EYE_POSITIONS[eyePairIdx + 1];
  const moodMark = MOOD_MARKS[Math.floor(rand() * MOOD_MARKS.length)];

  // Shadow/highlight
  const shadowColor = shiftColor(bodyColor, -30);
  const highlightColor = shiftColor(bodyColor, 40);
  const eyeColor = "#1A1A2E";
  const markColor = "#3A3A3A";

  // Initialize pixel grid
  const pixels: string[][] = Array.from({ length: 16 }, () =>
    Array(16).fill("transparent")
  );

  // Draw rock body (oval-ish shape)
  drawRect(pixels, 3, 4, 10, 9, bodyColor);
  drawRect(pixels, 2, 5, 12, 7, bodyColor);
  drawRect(pixels, 4, 3, 8, 1, bodyColor);
  drawRect(pixels, 4, 13, 8, 1, bodyColor);

  // Shadow edge (bottom-right)
  for (let x = 7; x < 13; x++) drawPixel(pixels, x, 13, shadowColor);
  for (let y = 8; y < 13; y++) drawPixel(pixels, 13, y, shadowColor);
  drawPixel(pixels, 12, 13, shadowColor);

  // Highlight (top-left)
  for (let x = 3; x < 7; x++) drawPixel(pixels, x, 4, highlightColor);
  for (let y = 4; y < 8; y++) drawPixel(pixels, 3, y, highlightColor);

  // Eyes
  drawRect(pixels, eye1[0], eye1[1], 2, 2, eyeColor);
  drawRect(pixels, eye2[0], eye2[1], 2, 2, eyeColor);
  // Eye shine
  drawPixel(pixels, eye1[0], eye1[1], "#FFFFFF");
  drawPixel(pixels, eye2[0], eye2[1], "#FFFFFF");

  // Mood mark
  moodMarkPixels(pixels, moodMark, markColor);

  // Build SVG
  const rects: string[] = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const color = pixels[y][x];
      if (color !== "transparent") {
        rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="64" height="64" shape-rendering="crispEdges">
  <rect width="16" height="16" fill="transparent"/>
  ${rects.join("\n  ")}
</svg>`;
}

function shiftColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
