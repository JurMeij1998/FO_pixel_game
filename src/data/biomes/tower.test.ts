import { describe, expect, it } from 'vitest';
import { generateAttempt, generateMap, type StairsRequest } from '../../core/generation/biome';
import { GridMap } from '../../core/gridMap';
import { LOCKS } from '../../core/locks';
import { playabilityProblems } from './playability';
import { DOWN_STAIRS, TOWER, UP_STAIRS } from './tower';

const MIDDLE: StairsRequest[] = [
  { direction: 'down', to: 'city' },
  { direction: 'up', to: 'roof' },
];
const TOP: StairsRequest[] = [{ direction: 'down', to: 'city' }];
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 3571 + 5);

describe('tower biome (upper floors)', () => {
  it('generates the same floor from the same seed', () => {
    expect(generateMap(TOWER, 3, [], MIDDLE)).toEqual(generateMap(TOWER, 3, [], MIDDLE));
    expect(generateMap(TOWER, 3, [], MIDDLE).rows).not.toEqual(generateMap(TOWER, 4, [], MIDDLE).rows);
  });

  describe.each([
    ['a middle floor', MIDDLE],
    ['the top floor', TOP],
  ] as const)('%s', (_name, stairs) => {
    it.each(SEEDS)('seed %i: everything can be reached, and nothing sees you come up or down the stairs', (seed) => {
      const map = GridMap.parse(generateAttempt(TOWER, seed, [], stairs), 'floor');
      expect(map.width).toBe(TOWER.width);
      expect(map.creatures.length).toBeGreaterThan(0);
      expect(playabilityProblems(map)).toEqual([]);
    });
  });

  it('puts the stairs at the west end of the corridor, and you arrive beside them', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const map = GridMap.parse(generateMap(TOWER, seed, [], MIDDLE), 'floor');
      const down = map.exits.find((e) => e.to === 'city')!;
      const up = map.exits.find((e) => e.to === 'roof')!;
      expect([down.x, down.y, down.look]).toEqual([DOWN_STAIRS.x, DOWN_STAIRS.y, 'stairsDown']);
      expect([up.x, up.y, up.look]).toEqual([UP_STAIRS.x, UP_STAIRS.y, 'stairsUp']);
      expect(map.arrivalFrom('city')).toEqual({ x: DOWN_STAIRS.x + 1, y: DOWN_STAIRS.y });
      expect(map.arrivalFrom('roof')).toEqual({ x: UP_STAIRS.x + 1, y: UP_STAIRS.y });
    }
  });

  it('has rooms off the corridor, each a building with a door, roofed until you go in', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const map = GridMap.parse(generateMap(TOWER, seed, [], MIDDLE), 'floor');
      const arrival = map.arrivalFrom('city');
      const corridor = map.buildingAt(arrival.x, arrival.y);
      expect(corridor).toBeDefined(); // the walls are the map's edge, so the corridor is enclosed too
      const rooms = map.buildings.filter((b) => b !== corridor);
      expect(rooms.length).toBeGreaterThanOrEqual(4);
      // Creatures are only ever in rooms, never out in the corridor.
      for (const creature of map.creatures) {
        expect(map.buildingAt(creature.pos.x, creature.pos.y)).not.toBe(corridor);
        expect(map.isHidden(creature.pos.x, creature.pos.y)).toBe(true);
      }
    }
  });

  it('keeps a hard-locked safe on the top floor only', () => {
    for (const seed of SEEDS) {
      const top = GridMap.parse(generateMap(TOWER, seed, [], TOP), 'floor');
      const safes = top.chests.filter((c) => c.name === 'Wall Safe');
      expect(safes).toHaveLength(1);
      expect(safes[0].lock).toBe(LOCKS.hard);
      const middle = GridMap.parse(generateMap(TOWER, seed, [], MIDDLE), 'floor');
      expect(middle.chests.some((c) => c.name === 'Wall Safe')).toBe(false);
    }
  });

  it('refuses edge exits, and needs exactly one way down', () => {
    expect(() => generateAttempt(TOWER, 1, [{ side: 'north', to: 'x' }], TOP)).toThrow();
    expect(() => generateAttempt(TOWER, 1, [], [{ direction: 'up', to: 'x' }])).toThrow();
  });
});
