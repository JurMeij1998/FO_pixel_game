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
  s: '#c8c8c0', // padlock shackle
  L: '#f0d848', // padlock body
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

const DOG_PALETTE = {
  k: '#1a120a', // outline and eye
  d: '#8a6a40', // fur
  D: '#6a4e2e', // belly
};

const SIGNPOST_PALETTE = {
  k: '#2a1a0a', // outline and lettering
  w: '#a0784a', // board
  p: '#5e3c1c', // post
};

const GHOUL_PALETTE = {
  k: '#1a1a14', // outline
  s: '#8a9a6a', // rotting skin
  S: '#6a7a4e', // skin shade
  e: '#d8d040', // glowing eyes
  c: '#5a4a3a', // rags
  C: '#3e3428', // rag shade
};

const SHOPKEEPER_PALETTE = {
  k: '#1a1a1a', // outline and eyes
  s: '#d8a47c', // skin
  b: '#b0aca0', // grey beard
  w: '#d8d0b8', // shirt
  a: '#7a5a30', // apron
  A: '#5e4422', // apron pocket
  p: '#3a4a5a', // trousers
  g: '#3a3a3a', // boots
};

const GUARD_PALETTE = {
  k: '#1a1a1a', // outline and eyes
  h: '#4a5a32', // helmet
  H: '#5e7040', // helmet highlight
  s: '#c89070', // skin
  v: '#5a5a52', // armored vest
  V: '#74746a', // vest plates
  c: '#3a4a5a', // shirt sleeves and trousers
  g: '#2a2a2a', // boots
  x: '#888888', // pistol
};

const ROSA_PALETTE = {
  k: '#1a1a1a', // outline and eyes
  h: '#8a3a1e', // auburn hair
  H: '#a8502a', // hair highlight
  s: '#e0b088', // skin
  r: '#c84848', // lips
  d: '#4a7a5a', // dress
  D: '#3a6048', // dress shade
  a: '#d8d0b8', // apron
  g: '#4a3424', // shoes
};

// Creature sprites (people included) are keyed by creature id (see core/creature.ts).
export const SPRITES: Record<string, PixelSprite> = {
  // Rosa, who takes you in at the start: long auburn hair, a green dress and an apron.
  rosa: {
    palette: ROSA_PALETTE,
    rows: [
      '................',
      '.....kkkkkk.....',
      '....khHHHHhk....',
      '...khhssssshk...',
      '...khskssksshk..',
      '...khssrrsshk...',
      '...khhssssshhk..',
      '...khkdddddkhk..',
      '..kskddaaddkhk..',
      '..kskdDaaDdksk..',
      '...kkdDaaDdkk...',
      '....kddaadddk...',
      '...kddddddddk...',
      '...kkkkkkkkkk...',
      '.....kgk.kgk....',
      '.....kkk.kkk....',
    ],
  },
  // The store's guard: helmet, armored vest, 10mm pistol in hand.
  guard: {
    palette: GUARD_PALETTE,
    rows: [
      '................',
      '.....kkkkkk.....',
      '....khHHHHhk....',
      '...khhhhhhhhk...',
      '....kssssssk....',
      '....kskssksk....',
      '....kssssssk....',
      '...kkvVVVVvkk...',
      '..kckvVvvVvkck..',
      '..kskvVVVVvksx..',
      '...kkvvvvvvkkx..',
      '....kcckkcck....',
      '....kcckkcck....',
      '....kggkkggk....',
      '....kkk..kkk....',
      '................',
    ],
  },
  // Gus, the village shopkeeper: bald, bearded, in his apron.
  shopkeeper: {
    palette: SHOPKEEPER_PALETTE,
    rows: [
      '................',
      '.....kkkkkk.....',
      '....kssssssk....',
      '....kssssssk....',
      '....kskssksk....',
      '....kssssssk....',
      '....kbbbbbbk....',
      '...kkwbbbbwkk...',
      '..kwkwaaaawkwk..',
      '..kskwaaaawksk..',
      '...kkaaaaaakk...',
      '....kaaAAaak....',
      '....kppkkppk....',
      '....kggkkggk....',
      '....kkk..kkk....',
      '................',
    ],
  },
  feral_ghoul: {
    palette: GHOUL_PALETTE,
    rows: [
      '................',
      '.....kkkkkk.....',
      '....kssssssk....',
      '....ksSssSsk....',
      '....kseSSesk....',
      '....ksskkssk....',
      '.....kssssk.....',
      '...kkccCCcckk...',
      '..kskccCCccksk..',
      '..ks.kcccck.sk..',
      '..kk.kcCCck.kk..',
      '.....kSkkSk.....',
      '.....kSk.kSk....',
      '.....kkk.kkk....',
      '................',
      '................',
    ],
  },
  // Side view, facing right.
  wild_dog: {
    palette: DOG_PALETTE,
    rows: [
      '................',
      '................',
      '................',
      '............kk..',
      '...........kddk.',
      '.k.........kdddk',
      '..kkkkkkkkdkddkk',
      '..kddddddddddddk',
      '..kdDdddddddddk.',
      '...kDDDDDDDDDk..',
      '...kdk.kdk.kdk..',
      '...kdk.kdk.kdk..',
      '...kkk.kkk.kkk..',
      '................',
      '................',
      '................',
    ],
  },
  // Marks an exit to another map.
  signpost: {
    palette: SIGNPOST_PALETTE,
    rows: [
      '................',
      '................',
      '...kkkkkkkkk....',
      '...kwwwwwwwkk...',
      '...kwkkkkkwwwk..',
      '...kwwwwwwwkk...',
      '...kkkkkkkkk....',
      '.......pp.......',
      '.......pp.......',
      '.......pp.......',
      '.......pp.......',
      '.......pp.......',
      '.......pp.......',
      '.......pp.......',
      '......pppp......',
      '................',
    ],
  },
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
  // The closed chest with a padlock hanging from its latch.
  chest_locked: {
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
      '.kwwwwsllswwwwk.',
      '.kwmwkkkkkkwmwk.',
      '.kwwwkLLLLkwwwk.',
      '.kwmwkLkkLkwmwk.',
      '.kdddkLLLLkdddk.',
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

/** A copy of `sprite` with some rows replaced, for animation frames that differ only in part. */
function withRows(sprite: PixelSprite, replacements: Record<number, string>): PixelSprite {
  return { palette: sprite.palette, rows: sprite.rows.map((row, y) => replacements[y] ?? row) };
}

// Walk frames: one stride per direction, only the legs change. The world scene alternates
// stride and standing frames, and mirrors the up/down stride every other step so the legs alternate.
const FRONT_STRIDE = {
  12: '....kbbkkggk....', // right leg lifted
  13: '....kggk.kkk....',
  14: '....kkk.........',
};
SPRITES.player_down_walk = withRows(SPRITES.player_down, FRONT_STRIDE);
SPRITES.player_up_walk = withRows(SPRITES.player_up, FRONT_STRIDE);
const SIDE_STRIDE = {
  12: '....kbbkkbbk....', // legs apart
  13: '...kggk..kggk...',
  14: '...kkk....kkk...',
};
SPRITES.player_side_walk = withRows(SPRITES.player_side, SIDE_STRIDE);

// The female player: the same vault jumpsuit, with long blonde hair down to the shoulders
// (not Rosa's auburn, so the two don't look alike).
const FEMALE_PLAYER_PALETTE = {
  ...PLAYER_PALETTE,
  h: '#d0a848', // blonde hair
  r: '#c05050', // lips
};

SPRITES.player_female_down = {
  palette: FEMALE_PLAYER_PALETTE,
  rows: [
    '................',
    '....kkkkkkkk....',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khsssssshk...',
    '...khsksskshk...',
    '...khssrrsshk...',
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
};
SPRITES.player_female_up = {
  palette: FEMALE_PLAYER_PALETTE,
  rows: [
    '................',
    '....kkkkkkkk....',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '..kbkbbbbbbkbk..',
    '..kskbbbbbbksk..',
    '...kkbbbbbbkk...',
    '....kbbBBbbk....',
    '....kbbkkbbk....',
    '....kggkkggk....',
    '....kkk..kkk....',
    '................',
  ],
};
// Faces right; flipped horizontally for left. The hair falls down the back of her head.
SPRITES.player_female_side = {
  palette: FEMALE_PLAYER_PALETTE,
  rows: [
    '................',
    '.....kkkkkk.....',
    '....khhhhhhk....',
    '....khhhhhhk....',
    '....khhsssssk...',
    '....khhssksk....',
    '....khhssrk.....',
    '....khbbyykk....',
    '....kbbbyybk....',
    '....kbkbyybk....',
    '....kbsbbbbk....',
    '....kbbBBbbk....',
    '.....kbbbbk.....',
    '.....kgkkgk.....',
    '.....kkk.kkk....',
    '................',
  ],
};
SPRITES.player_female_down_walk = withRows(SPRITES.player_female_down, FRONT_STRIDE);
SPRITES.player_female_up_walk = withRows(SPRITES.player_female_up, FRONT_STRIDE);
SPRITES.player_female_side_walk = withRows(SPRITES.player_female_side, SIDE_STRIDE);

