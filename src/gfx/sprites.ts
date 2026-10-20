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

const RADROACH_PALETTE = {
  k: '#1a120a', // outline
  r: '#7a3b1a', // shell
  R: '#a0522d', // shell highlight
  l: '#3a2410', // legs and antennae
};

const MOLE_RAT_PALETTE = {
  k: '#1a1414', // outline and eyes
  m: '#b08a80', // skin
  M: '#8a6a62', // skin shade
  t: '#f0e8d0', // teeth
  p: '#d0a090', // tail
};

const RAIDER_PALETTE = {
  k: '#1a1a1a', // outline
  h: '#b02020', // mohawk
  s: '#c89070', // skin
  j: '#3a2a1a', // leather
  J: '#5a4028', // leather highlight
  g: '#3a3a3a', // boots
  x: '#888888', // pistol
};

// Creature sprites are keyed by creature id (see core/creature.ts).
export const SPRITES: Record<string, PixelSprite> = {
  radroach: {
    palette: RADROACH_PALETTE,
    rows: [
      '................',
      '................',
      '....l......l....',
      '.....l....l.....',
      '......kkkk......',
      '.l...krrrrk...l.',
      '..l.kRrrrrRk.l..',
      '...kRrrrrrrRk...',
      '.llkrrrrrrrrkll.',
      '...krrrrrrrrk...',
      '..lkrRrrrrRrkl..',
      '.l..krrrrrrk..l.',
      '.....krrrrk.....',
      '......kkkk......',
      '................',
      '................',
    ],
  },
  mole_rat: {
    palette: MOLE_RAT_PALETTE,
    rows: [
      '................',
      '................',
      '................',
      '.....kkkkkk.....',
      '....kmmmmmmk....',
      '...kmmmmmmmmk...',
      '...kmkmmmmkmk...',
      '...kmmmmmmmmk...',
      '..kmmmmttmmmmk..',
      '..kmMmmttmmMmk..',
      '..kmMMmmmmMMmk..',
      '...kmMMMMMMmk...',
      '....kkmmmmkk....',
      '......kppk......',
      '.......pp.......',
      '................',
    ],
  },
  raider: {
    palette: RAIDER_PALETTE,
    rows: [
      '................',
      '.......hh.......',
      '....kkhhhhkk....',
      '....kssssssk....',
      '....kssssssk....',
      '....kskssksk....',
      '....kssssssk....',
      '...kkjjJJjjkk...',
      '..kjkjjJJjjkjk..',
      '..kskjjJJjjksx..',
      '...kkjjjjjjkkx..',
      '....kjjkkjjk....',
      '....kjjkkjjk....',
      '....kggkkggk....',
      '....kkk..kkk....',
      '................',
    ],
  },
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
