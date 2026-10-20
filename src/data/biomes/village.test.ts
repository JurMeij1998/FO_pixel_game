import { describe, expect, it } from 'vitest';
import { generateMap, type ExitRequest } from '../../core/generation/biome';
import { flipVertical } from '../../core/generation/mapBuilder';
import { GridMap } from '../../core/gridMap';
import { playabilityProblems } from './playability';
import { VILLAGE } from './village';

const EXITS: ExitRequest[] = [{ side: 'north', to: 'wasteland' }];
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 104729 + 3);

/** The world's layout today, plus layouts the village may get later: other sides, more exits. */
const LAYOUTS: Record<string, ExitRequest[]> = {
  'north only': EXITS,
  'entered from the west': [{ side: 'west', to: 'forest' }],
  'north and south': [...EXITS, { side: 'south', to: 'plains' }],
};

describe('village biome', () => {
  it('generates the same map from the same seed', () => {
    expect(generateMap(VILLAGE, 99, EXITS)).toEqual(generateMap(VILLAGE, 99, EXITS));
    expect(generateMap(VILLAGE, 99, EXITS).rows).not.toEqual(generateMap(VILLAGE, 100, EXITS).rows);
  });

  describe.each(Object.entries(LAYOUTS))('with exits %s', (_name, exits) => {
    it.each(SEEDS)('seed %i: everything can be reached, and nothing sees you arrive through any exit', (seed) => {
      const map = GridMap.parse(generateMap(VILLAGE, seed, exits), 'village');
      expect(map.creatures.length).toBeGreaterThan(0);
      expect(map.exits.map((e) => e.to).sort()).toEqual(exits.map((e) => e.to).sort());
      expect(playabilityProblems(map)).toEqual([]);
    });
  });

  it('runs a road from every exit to the main street', () => {
    for (const exits of Object.values(LAYOUTS)) {
      const map = GridMap.parse(generateMap(VILLAGE, 5, exits), 'village');
      for (const exit of map.exits) {
        // From just inside the exit, follow path tiles; the street is the long run of path across the map.
        const onPath = map.reachableFrom(map.arrivalFrom(exit.to));
        const streetRow = map.tiles.findIndex((row) => row.filter((t) => t === 'path').length > map.width * 0.7);
        expect(streetRow).toBeGreaterThan(0);
        expect(onPath.has(`${Math.floor(map.width / 2)},${streetRow}`)).toBe(true);
      }
    }
  });

  it('has creatures out in the streets too', () => {
    const onStreet = SEEDS.slice(0, 20).filter((seed) => {
      const map = GridMap.parse(generateMap(VILLAGE, seed, EXITS), 'village');
      return map.creatures.some((c) => map.tileAt(c.pos.x, c.pos.y) === 'path');
    });
    expect(onStreet.length).toBeGreaterThan(5);
  });

  it('builds a proper village: several homes, and usually a store and a barn', () => {
    const villages = SEEDS.map((seed) => Object.values(generateMap(VILLAGE, seed, EXITS).chests).map((c) => c.name));
    for (const chests of villages) {
      const homes = chests.filter((n) => n === 'Dresser' || n === 'Cupboard').length;
      expect(homes).toBeGreaterThanOrEqual(4);
      expect(chests.filter((n) => n === 'Stockroom Crate').length).toBeLessThanOrEqual(1);
      expect(chests.filter((n) => n === 'Feed Bin').length).toBeLessThanOrEqual(1);
    }
    expect(villages.filter((c) => c.includes('Stockroom Crate')).length).toBeGreaterThan(SEEDS.length / 2);
    expect(villages.filter((c) => c.includes('Feed Bin')).length).toBeGreaterThan(SEEDS.length / 3);
  });
});

describe('flipVertical', () => {
  it('turns a prefab upside down, entrance included', () => {
    const flipped = flipVertical({ name: 'hut', rows: ['%%%', '%$%', '%+%', ' : '], entrance: { x: 1, y: 3 } });
    expect(flipped.rows).toEqual([' : ', '%+%', '%$%', '%%%']);
    expect(flipped.entrance).toEqual({ x: 1, y: 0 });
  });
});
