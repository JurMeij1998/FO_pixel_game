/**
 * Hand-drawn 16x16 sprites as character grids. Each character is a palette key;
 * '.' (or any key missing from the palette) is transparent.
 * Placeholder art until there is a real sprite sheet.
 */
export interface PixelSprite {
  palette: Record<string, string>;
  rows: string[];
}

const CHEST_PALETTE = {
  k: '#1e1a14', // outline
  w: '#8a5a2b', // wood
  d: '#5e3c1c', // dark wood
  m: '#b8b8a0', // metal bands
  l: '#e0c050', // lock
  '0': '#120e0a', // inside
};

const PLAYER_PALETTE = {
  k: '#1a1a1a', // outline
  h: '#4a2e1a', // hair
  s: '#e0b088', // skin
  b: '#2d5aa8', // jumpsuit
  B: '#1c3a70', // jumpsuit shade
  y: '#e8c440', // yellow stripe
  g: '#3a3a3a', // boots
};

export const SPRITES: Record<string, PixelSprite> = {
  chest_closed: {
    palette: CHEST_PALETTE,
    rows: [
      '................',
      '................',
      '................',
      '..kkkkkkkkkkkk..',
      '.kwwwwwwwwwwwwk.',
      '.kwmwwwwwwwwmwk.',
      '.kddddddddddddk.',
      '.kmmmmmllmmmmmk.',
      '.kwwwwwllwwwwwk.',
      '.kwmwwwwwwwwmwk.',
      '.kwwwwwwwwwwwwk.',
      '.kwmwwwwwwwwmwk.',
      '.kddddddddddddk.',
      '..kkkkkkkkkkkk..',
      '................',
      '................',
    ],
  },
  chest_open: {
    palette: CHEST_PALETTE,
    rows: [
      '................',
      '..kkkkkkkkkkkk..',
      '.kddddddddddddk.',
      '.kwwwwwwwwwwwwk.',
      '.kkkkkkkkkkkkkk.',
      '.k000000000000k.',
      '.k000000000000k.',
      '.kmmmmmmmmmmmmk.',
      '.kwwwwwwwwwwwwk.',
      '.kwmwwwwwwwwmwk.',
      '.kwwwwwwwwwwwwk.',
      '.kwmwwwwwwwwmwk.',
      '.kddddddddddddk.',
      '..kkkkkkkkkkkk..',
      '................',
      '................',
    ],
  },
  player_down: {
    palette: PLAYER_PALETTE,
    rows: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '....khhhhhhk....',
      '....kssssssk....',
      '....kskssksk....',
      '....kssssssk....',
      '...kkbbyybbkk...',
      '..kbkbbyybbkbk..',
      '..kskbbyybbksk..',
      '...kkbbyybbkk...',
      '....kbbBBbbk....',
      '....kbbkkbbk....',
      '....kggkkggk....',
      '....kkk..kkk....',
      '................',
    ],
  },
  player_up: {
    palette: PLAYER_PALETTE,
    rows: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '....khhhhhhk....',
      '....khhhhhhk....',
      '....khhhhhhk....',
      '....kshhhhsk....',
      '...kkbbbbbbkk...',
      '..kbkbbbbbbkbk..',
      '..kskbbbbbbksk..',
      '...kkbbbbbbkk...',
      '....kbbBBbbk....',
      '....kbbkkbbk....',
      '....kggkkggk....',
      '....kkk..kkk....',
      '................',
    ],
  },
  // Faces right; flipped horizontally for left.
  player_side: {
    palette: PLAYER_PALETTE,
    rows: [
      '................',
      '......kkkkk.....',
      '.....khhhhhk....',
      '.....khhhhhk....',
      '.....khsssssk...',
      '.....khssksk....',
      '.....kssssk.....',
      '....kkbbyykk....',
      '....kbbbyybk....',
      '....kbkbyybk....',
      '....kbsbbbbk....',
      '....kbbBBbbk....',
      '.....kbbbbk.....',
      '.....kgkkgk.....',
      '.....kkk.kkk....',
      '................',
    ],
  },
};
