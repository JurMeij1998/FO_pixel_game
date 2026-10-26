import { describe, expect, it } from 'vitest';
import { generateAttempt, generateMap, type ExitRequest } from '../../core/generation/biome';
import { GridMap } from '../../core/gridMap';
import { CAVE } from './cave';
import { playabilityProblems, workbenches } from './playability';

const EXITS: ExitRequest[] = [{ side: 'south', to: 'wasteland', look: 'cave' }];
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 6271 + 11);

/** The world's layout today, plus layouts the cave may get later: other sides, a second way out. */
const LAYOUTS: Record<string, ExitRequest[]> = {
  'south only': EXITS,
  'entered from the east': [{ side: 'east', to: 'forest' }],
  'south and north': [...EXITS, { side: 'north', to: 'plains' }],
};

describe('cave biome', () => {
  it('generates the same map from the same seed', () => {
    expect(generateMap(CAVE, 42, EXITS)).toEqual(generateMap(CAVE, 42, EXITS));
    expect(generateMap(CAVE, 42, EXITS).rows).not.toEqual(generateMap(CAVE, 43, EXITS).rows);
  });

  describe.each(Object.entries(LAYOUTS))('with exits %s', (_name, exits) => {
    it.each(SEEDS)('seed %i: everything can be reached, and nothing sees you arrive through any exit', (seed) => {
      // The first try already works: retries (other seeds) are for rare bad rolls, not the norm.
      const map = GridMap.parse(generateAttempt(CAVE, seed, exits), 'cave');
      expect(map.creatures.length).toBeGreaterThan(0);
      expect(map.exits.map((e) => e.to).sort()).toEqual(exits.map((e) => e.to).sort());
      expect(playabilityProblems(map)).toEqual([]);
    });
  });

  it('is dark, walled in by rock, and its exits look like cave mouths', () => {
    for (const seed of SEEDS) {
      const map = GridMap.parse(generateMap(CAVE, seed, EXITS), 'cave');
      expect(map.dark).toBe(true);
      expect(map.exits[0].look).toBe('cave');
      const edge = map.tiles.flatMap((row, y) => row.filter((_t, x) => x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1));
      expect(edge.filter((t) => t !== 'caveWall').length).toBe(1); // just the way out
    }
  });

  it('has radscorpions, and usually a miners camp with a workbench you can reach', () => {
    const maps = SEEDS.map((seed) => GridMap.parse(generateMap(CAVE, seed, EXITS), 'cave'));
    for (const map of maps) {
      expect(map.creatures.some((c) => c.def.id === 'radscorpion')).toBe(true); // the nest, at least
      expect(map.chests.filter((c) => c.name === 'Bones')).toHaveLength(1);
      for (const bench of workbenches(map)) expect(bench.reachable).toBe(true);
    }
    const camps = maps.filter((map) => map.chests.some((c) => c.name === "Miner's Pack"));
    expect(camps.length).toBeGreaterThan(SEEDS.length / 2);
    expect(camps.every((map) => workbenches(map).length === 1)).toBe(true);
  });

  it('is mostly rock: a cave, not an open field', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const map = GridMap.parse(generateMap(CAVE, seed, EXITS), 'cave');
      const walls = map.tiles.flat().filter((t) => t === 'caveWall').length;
      expect(walls / (map.width * map.height)).toBeGreaterThan(0.35);
    }
  });
});
