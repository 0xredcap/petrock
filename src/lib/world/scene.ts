import {
  TILES,
  WORLD_COLS,
  WORLD_ROWS,
  ROCK_HOME_COL,
  ROCK_HOME_ROW,
  AVATAR_COL,
  AVATAR_ROW,
} from "./tiles";

export type TileEntry = {
  col: number;
  row: number;
  src: string;
};

export function buildGardenLayout(): TileEntry[] {
  const tiles: TileEntry[] = [];

  // Fill base with grass
  for (let row = 0; row < WORLD_ROWS; row++) {
    for (let col = 0; col < WORLD_COLS; col++) {
      tiles.push({ col, row, src: TILES.GRASS });
    }
  }

  // Fence perimeter
  for (let col = 0; col < WORLD_COLS; col++) {
    tiles.push({ col, row: 0, src: TILES.FENCE_H });
    tiles.push({ col, row: WORLD_ROWS - 1, src: TILES.FENCE_H });
  }
  for (let row = 1; row < WORLD_ROWS - 1; row++) {
    tiles.push({ col: 0, row, src: TILES.FENCE_V });
    tiles.push({ col: WORLD_COLS - 1, row, src: TILES.FENCE_V });
  }
  // Corners
  tiles.push({ col: 0, row: 0, src: TILES.FENCE_CORNER });
  tiles.push({ col: WORLD_COLS - 1, row: 0, src: TILES.FENCE_CORNER });
  tiles.push({ col: 0, row: WORLD_ROWS - 1, src: TILES.FENCE_CORNER });
  tiles.push({ col: WORLD_COLS - 1, row: WORLD_ROWS - 1, src: TILES.FENCE_CORNER });

  // Decorative flowers (avoid rock/avatar tiles and fence)
  const decorTiles = [
    [3, 3], [5, 2], [11, 3], [13, 2],
    [2, 7], [4, 8], [12, 7], [14, 8],
    [6, 2], [10, 8],
  ];

  for (const [col, row] of decorTiles) {
    if (isGrassTile(col, row)) {
      const src = (col + row) % 2 === 0 ? TILES.FLOWER_YELLOW : TILES.FLOWER_PINK;
      tiles.push({ col, row, src });
    }
  }

  return tiles;
}

function isGrassTile(col: number, row: number): boolean {
  if (col === ROCK_HOME_COL && row === ROCK_HOME_ROW) return false;
  if (col === AVATAR_COL && row === AVATAR_ROW) return false;
  if (row === 0 || row === WORLD_ROWS - 1) return false;
  if (col === 0 || col === WORLD_COLS - 1) return false;
  return true;
}

// Returns a list of grass tiles the rock can wander to (3×3 safe zone around home)
export function getWanderTiles(): { col: number; row: number }[] {
  const result: { col: number; row: number }[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const col = ROCK_HOME_COL + dc;
      const row = ROCK_HOME_ROW + dr;
      if (isGrassTile(col, row)) {
        result.push({ col, row });
      }
    }
  }
  return result;
}
