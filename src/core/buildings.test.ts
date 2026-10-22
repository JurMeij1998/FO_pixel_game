import { describe, expect, it } from 'vitest';
import { WASTELAND } from '../data/wasteland';
import { findBuildings, tileKey } from './buildings';
import { GridMap, type MapDef } from './gridMap';

const map = (rows: string[], extra: Partial<MapDef> = {}) => GridMap.parse({ name: 'test', rows, chests: {}, ...extra });

describe('buildings', () => {
  it('are areas closed off by walls and doors', () => {
    const town = map([
      '.........',
      '.#####...',
      '.#___#...',
      '.#___#...',
      '.##/##...',
      '....P....',
    ]);
    expect(town.buildings).toHaveLength(1);
    const [house] = town.buildings;
    expect(house.id).toBe('2,2');
    expect([...house.interior].sort()).toEqual(['2,2', '2,3', '3,2', '3,3', '4,2', '4,3']);
    expect(house.material).toBe('brick');
  });

  it('get a roof over the inside and the walls around it, but not over the front wall with the door', () => {
    const town = map(['.%%%%.', '.%++%.', '.%/%%.', '..P...']);
    const [hut] = town.buildings;
    const roof = new Set(hut.roof.map(tileKey));
    expect(roof.size).toBe(2 + 6); // two floor tiles, the back wall and the sides
    expect(roof.has('1,0')).toBe(true); // a back corner
    expect(roof.has('1,1')).toBe(true); // a side wall
    for (const front of ['1,2', '2,2', '3,2', '4,2']) expect(roof.has(front)).toBe(false); // the door's wall, corners too
    expect(hut.material).toBe('wood');
  });

  it('leave the side wall with the door uncovered, for a door facing sideways', () => {
    const town = map(['......', '.%%%..', '.%+/P.', '.%%%..']);
    const roof = new Set(town.buildings[0].roof.map(tileKey));
    expect(roof.has('3,1')).toBe(false);
    expect(roof.has('3,3')).toBe(false);
    expect(roof.has('1,1')).toBe(true);
  });

  it("count what's inside, counters and chests included", () => {
    const shop = map(['.%%%%%.', '.%]a]%.', '.%+++%.', '.%%/%%.', '...P...'], {
      chests: { a: { name: 'Crate', contents: [] } },
    });
    expect(shop.buildings).toHaveLength(1);
    expect(shop.buildings[0].interior.has('2,1')).toBe(true); // the counter
    expect(shop.buildingAt(3, 1)).toBe(shop.buildings[0]); // the crate
  });

  it('need a door: a walled-in well is no building, nor is a wall with a gap', () => {
    expect(map(['.....', '.###.', '.#~#.', '.###.', '..P..']).buildings).toEqual([]);
    expect(map(['.....', '.###.', '.#_#.', '.#_#.', '..P..']).buildings).toEqual([]);
  });

  it("don't include open ground walled in by the map's edge, rocks or fences", () => {
    // A door in a fence doesn't make a field a building: fences aren't walls.
    expect(map(['||||||', '|,,,,|', '|,,P,|', '||/|||']).buildings).toEqual([]);
    expect(findBuildings([['wall', 'door', 'wall']])).toEqual([]);
  });

  it('are separate rooms when only a door joins them', () => {
    const house = map(['#######', '#__/__#', '###/###', '...P...']);
    expect(house.buildings.map((b) => b.id)).toEqual(['1,1', '4,1']);
  });

  it('are hidden under their roof until the player steps inside', () => {
    const town = map(['.%%%%.', '.%++%.', '.%%/%.', '..P...']);
    expect(town.isHidden(2, 1)).toBe(true);
    expect(town.isHidden(2, 3)).toBe(false); // outside
    expect(town.enter({ x: 2, y: 3 })).toBeNull();
    expect(town.enter({ x: 3, y: 1 })).toBe(town.buildings[0]);
    expect(town.enter({ x: 2, y: 1 })).toBeNull(); // already in it
    expect(town.isHidden(2, 1)).toBe(false);
  });

  it("are found on the real wasteland: Rosa's shack and the locked shed", () => {
    const wasteland = GridMap.parse(WASTELAND, 'wasteland');
    expect(wasteland.buildings).toHaveLength(2);
    expect(wasteland.buildingAt(wasteland.playerStart.x, wasteland.playerStart.y)).toBeDefined();
    const locker = wasteland.chests.find((c) => c.name === 'Metal Locker')!;
    expect(wasteland.isHidden(locker.x, locker.y)).toBe(true);
  });
});
