import { describe, expect, it } from 'vitest';
import { SPRITES } from './sprites';

describe('SPRITES', () => {
  it.each(Object.entries(SPRITES))('%s is 16x16', (_key, sprite) => {
    expect(sprite.rows).toHaveLength(16);
    for (const row of sprite.rows) expect(row).toHaveLength(16);
  });
});
