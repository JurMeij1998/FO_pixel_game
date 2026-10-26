import { describe, expect, it } from 'vitest';
import { GridMap } from '../gridMap';
import { Random } from '../random';
import { flipVertical, MapBuilder, type Prefab } from './mapBuilder';

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

describe('MapBuilder stairs, doors and chests', () => {
  /** A room with stairs against its west wall, and its door in the bottom wall. */
  const STAIRWELL: Prefab = {
    name: 'stairwell',
    rows: ['#####', '#___#', '#___#', '##/##', '  :  '],
    entrance: { x: 2, y: 4 },
    stairs: { x: 1, y: 1 },
  };

  it('puts stairs inside a building as an exit with the stairs look, reachable through the door', () => {
    const b = new MapBuilder(12, 10, '.', 7);
    b.addExit('south', 'outside', ':');
    b.stamp(STAIRWELL, 3, 2, new Random(1));
    b.addStairs({ x: 3 + STAIRWELL.stairs!.x, y: 2 + STAIRWELL.stairs!.y }, 'up', 'attic');
    b.connect(':');
    const map = GridMap.parse(b.toMapDef('house'), 'house');
    const stairs = map.exitAt(4, 3)!;
    expect(stairs).toEqual({ x: 4, y: 3, to: 'attic', look: 'stairsUp' });
    expect(map.tileAt(4, 3)).toBe('floor'); // the marker stands on the room's floor
    expect(map.buildingAt(4, 3)).toBeDefined();
    const arrival = map.arrivalFrom('attic');
    expect(map.buildingAt(arrival.x, arrival.y)).toBe(map.buildingAt(4, 3));
    expect(map.reachableFrom(map.arrivalFrom('outside')).has('4,3')).toBe(true);
  });

  it('starts beside the first stairs on a map with no edge exits', () => {
    const b = new MapBuilder(6, 5, '_', 1);
    b.addStairs({ x: 2, y: 2 }, 'down', 'below');
    expect(b.start).not.toBeNull();
    expect(Math.abs(b.start!.x - 2) + Math.abs(b.start!.y - 2)).toBe(1);
  });

  it('turns stairs around with the prefab', () => {
    expect(flipVertical(STAIRWELL).stairs).toEqual({ x: 1, y: 3 });
    expect(flipVertical(STAIRWELL).rows[3]).toBe('#___#');
  });

  it('locks a door it was asked to', () => {
    const b = new MapBuilder(12, 10, '.', 7);
    b.addExit('south', 'outside', ':');
    b.stamp(STAIRWELL, 3, 2, new Random(1));
    b.lockDoor({ x: 5, y: 5 }, 40);
    expect(() => b.lockDoor({ x: 4, y: 4 }, 40)).toThrow(/No door/);
    b.connect(':');
    expect(GridMap.parse(b.toMapDef('house'), 'house').doorAt(5, 5)?.lock).toBe(40);
  });

  it("never names a chest 'o', the rock tile, so a map can have more than 14 chests", () => {
    const b = new MapBuilder(30, 3, '.', 7);
    b.addExit('west', 'outside', ':');
    for (let x = 3; x < 23; x++) b.addChest({ x, y: 0 }, `Crate ${x}`, [['rope', 1]]);
    b.connect(':');
    const map = GridMap.parse(b.toMapDef('crates'), 'crates');
    expect(map.chests).toHaveLength(20);
    expect(map.tiles.flat()).not.toContain('rock');
  });
});
