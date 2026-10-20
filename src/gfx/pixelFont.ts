/**
 * A tiny 3x5 pixel font for numbers drawn in the world, such as the AP gauge.
 * Each glyph is five rows of three characters; '#' is a lit pixel.
 */
export const GLYPHS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'],
};

export const GLYPH_WIDTH = 3;
export const GLYPH_HEIGHT = 5;

/** Glyph textures get a 1-pixel dark outline, so they read on any background. */
export const GLYPH_TEXTURE_WIDTH = GLYPH_WIDTH + 2;
export const GLYPH_TEXTURE_HEIGHT = GLYPH_HEIGHT + 2;

/** The outlined glyph, for text drawn straight onto the map. */
export function glyphTextureKey(char: string): string {
  return `glyph_${char}`;
}

/** The plain 3x5 glyph without an outline, for text on a solid background such as the AP gauge. */
export function plainGlyphKey(char: string): string {
  return `glyph_plain_${char}`;
}
