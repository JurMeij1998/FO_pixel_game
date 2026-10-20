import type { PixelSprite } from './sprites';

/**
 * Side views of the weapons, pointing right, for the combat card: each lies behind the card
 * with only its business end sticking out. `peek` is how many pixels show past the card's edge.
 */
export interface WeaponSprite extends PixelSprite {
  peek: number;
}

const WOOD = {
  k: '#1a1208', // outline
  w: '#7a4e26', // wood
  W: '#9a6a38', // wood highlight
  m: '#5a5a5a', // metal
  M: '#8e8e8e', // metal highlight
};

/** Keyed by item id (see core/items.ts). */
export const WEAPON_SPRITES: Record<string, WeaponSprite> = {
  hunting_rifle: {
    palette: WOOD,
    peek: 12,
    rows: [
      '............kkkkk...........k.....',
      'kkkkkkkkkkkkMMMMMkkkkkkkkkkkkkkkkk',
      'kWWWWWWWWWWkmmmmmMMMMMMMMMMMMMMMMk',
      'kwwwwwwwwwwwkmmmkkkkkkkkkkkkkkkkkk',
      '.kkkkkkkkkkk.kk...................',
    ],
  },
  '10mm_pistol': {
    palette: WOOD,
    peek: 6,
    rows: [
      '..kkkkkkkkkkkk',
      '..kMMMMMMMMMMk',
      '..kmmmmmmmmmmk',
      '..kmmmkkkkkkkk',
      '..kmmk........',
      '..kkkk........',
    ],
  },
  knife: {
    palette: WOOD,
    peek: 7,
    rows: [
      '......kkkkkkk.',
      'kwwwwkMMMMMMMk',
      '......kkkkkk..',
    ],
  },
  spear: {
    palette: WOOD,
    peek: 9,
    rows: [
      '......................kkkk....',
      'kwwwwwwwwwwwwwwwwwwwwkMMMMMkk.',
      '......................kkkk....',
    ],
  },
};

export function weaponTextureKey(itemId: string): string {
  return `weapon_${itemId}`;
}
