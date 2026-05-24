// Kenney Pixel Platformer tile references
// All paths relative to /public/assets/kenney/

export const TILES = {
  // Ground
  GRASS: "/assets/kenney/Tiles/tile_0001.png",
  DIRT: "/assets/kenney/Tiles/tile_0002.png",
  GRASS_DARK: "/assets/kenney/Tiles/tile_0003.png",
  GRASS_LIGHT: "/assets/kenney/Tiles/tile_0004.png",

  // Decoration
  FLOWER_YELLOW: "/assets/kenney/Tiles/tile_0058.png",
  FLOWER_PINK: "/assets/kenney/Tiles/tile_0059.png",

  // Fence
  FENCE_H: "/assets/kenney/Tiles/tile_0085.png",
  FENCE_V: "/assets/kenney/Tiles/tile_0086.png",
  FENCE_CORNER: "/assets/kenney/Tiles/tile_0087.png",
  FENCE_POST: "/assets/kenney/Tiles/tile_0088.png",
} as const;

export const CHARACTERS = {
  PLAYER: "/assets/kenney/Characters/tile_0001.png",
  PLAYER_ALT: "/assets/kenney/Characters/tile_0002.png",
} as const;

export const TILE_SIZE = 18;
export const TILE_SCALE = 3;
export const WORLD_COLS = 16;
export const WORLD_ROWS = 10;

// Home tile for the rock (0-indexed)
export const ROCK_HOME_COL = 7;
export const ROCK_HOME_ROW = 5;

// Avatar tile (right of rock)
export const AVATAR_COL = 9;
export const AVATAR_ROW = 5;
