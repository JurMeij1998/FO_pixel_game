import { describe, expect, it } from 'vitest';
import { GridMap } from '../core/gridMap';
import { playabilityProblems } from './biomes/playability';
import { TEST_SHOP } from './testArena';

describe('test shop', () => {
  const map = GridMap.parse(TEST_SHOP, 'test_shop');

  it('is the village store: Gus, the guard, and a crate that belongs to the store', () => {
    expect(map.creatures.map((c) => c.def.id).sort()).toEqual(['guard', 'shopkeeper']);
    expect(map.chests.map((c) => [c.name, c.owner])).toEqual([['Stockroom Crate', 'store']]);
  });

  it('starts you facing Gus across his counter', () => {
    const gus = map.creatures.find((c) => c.def.id === 'shopkeeper');
    expect(map.personFacing(map.playerStart, { x: 0, y: -1 })).toBe(gus);
  });

  it('can be walked out of, and nothing there attacks you', () => {
    expect(playabilityProblems(map)).toEqual([]);
  });
});
