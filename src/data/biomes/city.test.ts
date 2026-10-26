import { describe, expect, it } from 'vitest';
import { generateAttempt, generateMap, type ExitRequest, type StairsRequest } from '../../core/generation/biome';
import { GridMap } from '../../core/gridMap';
import { CITY } from './city';
import { playabilityProblems, workbenches } from './playability';
import { TOWER_HEIGHT, TOWER_WIDTH } from './tower';

const EXITS: ExitRequest[] = [{ side: 'east', to: 'wasteland' }];
const STAIRS: StairsRequest[] = [
  { direction: 'up', to: 'tower1' },
  { direction: 'up', to: 'tower2' },
];
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 1021 + 9);
/** A city takes about a tenth of a second to build, so tests going over many of them get more time. */
const MANY_CITIES = 20_000;

/** The world's layout today, plus layouts the city may get later. */
const LAYOUTS: Record<string, [ExitRequest[], StairsRequest[]]> = {
  'east, two towers': [EXITS, STAIRS],
  'east and north, one tower': [[...EXITS, { side: 'north', to: 'plains' }], STAIRS.slice(0, 1)],
  'west and south, three towers': [
    [
      { side: 'west', to: 'forest' },
      { side: 'south', to: 'village' },
    ],
    [...STAIRS, { direction: 'up', to: 'tower3' }],
  ],
};

describe('city biome', () => {
  it('generates the same map from the same seed', () => {
    expect(generateMap(CITY, 8, EXITS, STAIRS)).toEqual(generateMap(CITY, 8, EXITS, STAIRS));
    expect(generateMap(CITY, 8, EXITS, STAIRS).rows).not.toEqual(generateMap(CITY, 9, EXITS, STAIRS).rows);
  });

  describe.each(Object.entries(LAYOUTS))('with %s', (_name, [exits, stairs]) => {
    it.each(SEEDS)('seed %i: everything can be reached, and nothing sees you arrive by any exit or stairs', (seed) => {
      const map = GridMap.parse(generateAttempt(CITY, seed, exits, stairs), 'city');
      expect(map.creatures.length).toBeGreaterThan(3);
      const ways = [...exits, ...stairs].map((e) => e.to).sort();
      expect(map.exits.map((e) => e.to).sort()).toEqual(ways);
      expect(playabilityProblems(map)).toEqual([]);
    });
  });

  it('puts every stairs up inside a tower as big as the floors above, where you arrive from them', () => {
    for (const seed of SEEDS.slice(0, 15)) {
      const map = GridMap.parse(generateMap(CITY, seed, EXITS, STAIRS), 'city');
      for (const way of STAIRS) {
        const stairs = map.exits.find((e) => e.to === way.to)!;
        expect(stairs.look).toBe('stairsUp');
        const arrival = map.arrivalFrom(way.to);
        const lobby = map.buildingAt(arrival.x, arrival.y)!;
        expect(lobby).toBeDefined();
        // The lobby and the office beside it fill the tower's footprint, inside its outer walls.
        const xs = [...lobby.roof].map((p) => p.x);
        expect(Math.max(...xs) - Math.min(...xs) + 1).toBe(TOWER_WIDTH);
        const ys = [...lobby.roof].map((p) => p.y);
        expect(Math.max(...ys) - Math.min(...ys) + 1).toBeLessThanOrEqual(TOWER_HEIGHT);
      }
    }
  }, MANY_CITIES);

  it('is a grid of streets lined with buildings', () => {
    for (const seed of SEEDS.slice(0, 15)) {
      const map = GridMap.parse(generateMap(CITY, seed, EXITS, STAIRS), 'city');
      const streetRows = map.tiles.filter((row) => row.filter((t) => t === 'asphalt').length > map.width * 0.8);
      expect(streetRows.length).toBeGreaterThanOrEqual(4); // two streets across, two tiles wide
      expect(map.buildings.length).toBeGreaterThanOrEqual(8);
      expect(map.chests.length).toBeGreaterThanOrEqual(8);
    }
  }, MANY_CITIES);

  it('has at most one garage, whose workbench you can reach', () => {
    for (const seed of SEEDS) {
      const map = GridMap.parse(generateMap(CITY, seed, EXITS, STAIRS), 'city');
      const benches = workbenches(map);
      expect(benches.length).toBeLessThanOrEqual(1);
      for (const bench of benches) expect(bench.reachable).toBe(true);
    }
  }, MANY_CITIES);
});
