import { describe, expect, it } from 'vitest';
import { hashSeed, Random } from './random';

describe('Random', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = new Random(42);
    const b = new Random(42);
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
    expect(new Random(43).next()).not.toBe(new Random(42).next());
  });

  it('keeps int() within its bounds, both ends included', () => {
    const rng = new Random(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const n = rng.int(2, 5);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it('picks by weight', () => {
    const rng = new Random(1);
    const counts = { common: 0, rare: 0 };
    const items = [
      { name: 'common' as const, weight: 9 },
      { name: 'rare' as const, weight: 1 },
    ];
    for (let i = 0; i < 1000; i++) counts[rng.pickWeighted(items).name]++;
    expect(counts.common).toBeGreaterThan(800);
    expect(counts.rare).toBeGreaterThan(50);
  });

  it('hashes seeds stably', () => {
    expect(hashSeed(123, 'forest')).toBe(hashSeed(123, 'forest'));
    expect(hashSeed(123, 'forest')).not.toBe(hashSeed(123, 'village'));
  });
});
