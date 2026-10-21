import { describe, expect, it } from 'vitest';
import { GridMap } from '../gridMap';
import { Random } from '../random';
import { MapBuilder, type Prefab } from './mapBuilder';

/** A hut with its keeper (K) inside and a chest that belongs to the keeper's group. */
const HUT: Prefab = {
  name: 'hut',
  rows: ['%%%%%', '%K+$%', '%+++%', '%%+%%', '  :  '],
  entrance: { x: 2, y: 4 },
  chest: { name: 'Strongbox', loot: { rolls: [1, 1], entries: [{ itemId: 'rope', min: 1, max: 1, weight: 1 }] }, owner: 'store' },
  residents: { K: 'shopkeeper' },
};

function builtHut() {
  const b = new MapBuilder(12, 10, '.', 7);
  b.stamp(HUT, 3, 2, new Random(1));
  b.addExit('south', 'elsewhere', ':');
  b.connect(':');
  return GridMap.parse(b.toMapDef('hut'), 'hut');
}

describe('MapBuilder residents and owned chests', () => {
  it('places residents as the people they are, where the prefab puts them', () => {
    const map = builtHut();
    const keeper = map.creatures.find((c) => c.def.id === 'shopkeeper');
    expect(keeper?.pos).toEqual({ x: 4, y: 3 });
    expect(keeper?.id).toBe('shopkeeper@4,3');
    expect(keeper?.hostile).toBe(false);
    expect(map.tileAt(4, 3)).toBe('planks'); // stands on the hut's floor
  });

  it("keeps a chest's owner, so taking from it is stealing", () => {
    const map = builtHut();
    expect(map.chests).toHaveLength(1);
    expect(map.chests[0].owner).toBe('store');
  });

  it('rejects a capital letter that has no resident', () => {
    const b = new MapBuilder(12, 10, '.');
    expect(() => b.stamp({ ...HUT, residents: {} }, 3, 2, new Random(1))).toThrow(/no resident for 'K'/);
  });

  it('routes paths around residents rather than through them', () => {
    // A row of trees with a single gap, and a resident standing in it: the chest beyond can
    // only be reached by cutting through a tree.
    const b = new MapBuilder(9, 5, '.', 3);
    for (let y = 0; y < 5; y++) if (y !== 2) b.set(4, y, '^');
    b.addExit('west', 'elsewhere', ':');
    b.addCreature({ x: 4, y: 2 }, 'shopkeeper', true);
    b.addChest({ x: 7, y: 2 }, 'Box', [['rope', 1]]);
    const trees = () => b.toMapDef('t').rows.join('').split('^').length - 1;
    const before = trees();
    b.connect(':');
    expect(trees()).toBe(before - 1);
    expect(b.toMapDef('t').rows[2][4]).toBe('A'); // the resident is still in the gap
  });
});
