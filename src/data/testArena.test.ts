import { describe, expect, it } from 'vitest';
import { GridMap } from '../core/gridMap';
import { LOCKS } from '../core/locks';
import { playabilityProblems } from './biomes/playability';
import { TEST_ARENA, TEST_SHOP, testCharacter } from './testArena';

describe('test arena', () => {
  const map = GridMap.parse(TEST_ARENA, 'test_arena');

  it('has a shack with a good lock the test character can pick, and a strongbox under its roof', () => {
    const [door] = map.doors;
    expect(door.lock).toBe(LOCKS.good);
    expect(testCharacter().skill('lockpick')).toBeGreaterThanOrEqual(LOCKS.good);
    const strongbox = map.chests.find((c) => c.name === 'Strongbox')!;
    expect(map.isHidden(strongbox.x, strongbox.y)).toBe(true);
  });
});

describe('test shop', () => {
  const map = GridMap.parse(TEST_SHOP, 'test_shop');

  it('is the village store: Gus, the guard, and a crate that belongs to the store', () => {
    expect(map.creatures.map((c) => c.def.id).sort()).toEqual(['guard', 'shopkeeper']);
    expect(map.chests.filter((c) => c.owner).map((c) => [c.name, c.owner])).toEqual([['Stockroom Crate', 'store']]);
  });

  it("has a shack beside the store with a hard lock, beyond the test character's skill", () => {
    const locked = map.doors.filter((d) => d.lock !== null);
    expect(locked.map((d) => d.lock)).toEqual([LOCKS.hard]);
    expect(testCharacter().skill('lockpick')).toBeLessThan(LOCKS.hard);
    expect(map.buildings).toHaveLength(2);
  });

  it('starts you facing Gus across his counter', () => {
    const gus = map.creatures.find((c) => c.def.id === 'shopkeeper');
    expect(map.personFacing(map.playerStart, { x: 0, y: -1 })).toBe(gus);
  });

  it('can be walked out of, and nothing there attacks you', () => {
    expect(playabilityProblems(map)).toEqual([]);
  });
});
