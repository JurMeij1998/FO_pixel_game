import { describe, expect, it } from 'vitest';
import { GLYPH_HEIGHT, GLYPH_WIDTH, GLYPHS } from './pixelFont';
import { getItem } from '../core/items';
import { SPRITES } from './sprites';
import { WEAPON_SPRITES } from './weaponSprites';

describe('SPRITES', () => {
  it.each(Object.entries(SPRITES))('%s is 16x16', (_key, sprite) => {
    expect(sprite.rows).toHaveLength(16);
    for (const row of sprite.rows) expect(row).toHaveLength(16);
  });
});

describe('GLYPHS', () => {
  it.each(Object.entries(GLYPHS))("'%s' is 3x5 and only uses '#' and '.'", (_char, rows) => {
    expect(rows).toHaveLength(GLYPH_HEIGHT);
    for (const row of rows) expect(row).toMatch(new RegExp(`^[#.]{${GLYPH_WIDTH}}$`));
  });

  it('has every digit and the signs the combat card needs', () => {
    for (const char of '0123456789+-/AP') expect(GLYPHS[char]).toBeDefined();
  });
});

describe('WEAPON_SPRITES', () => {
  it.each(Object.entries(WEAPON_SPRITES))('%s is a weapon with even rows, peeking out less than its length', (id, sprite) => {
    expect(getItem(id).weapon).toBeDefined();
    const width = sprite.rows[0].length;
    for (const row of sprite.rows) expect(row).toHaveLength(width);
    expect(sprite.peek).toBeGreaterThan(0);
    expect(sprite.peek).toBeLessThan(width);
  });

  it('has a sprite for every weapon', () => {
    const weapons = ['knife', 'spear', '10mm_pistol', 'hunting_rifle'];
    for (const id of weapons) expect(WEAPON_SPRITES[id]).toBeDefined();
  });
});
