import { describe, expect, it } from 'vitest';
import { GLYPH_HEIGHT, GLYPH_WIDTH, GLYPHS } from './pixelFont';
import { SPRITES } from './sprites';

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

  it('has every digit and the signs the AP gauge needs', () => {
    for (const char of '0123456789+-AP') expect(GLYPHS[char]).toBeDefined();
  });
});
