import { describe, expect, it } from 'vitest';
import { generateMap, type ExitRequest } from '../../core/generation/biome';
import { GridMap } from '../../core/gridMap';
import { FOREST } from './forest';
import { playabilityProblems } from './playability';

const EXITS: ExitRequest[] = [{ side: 'west', to: 'wasteland' }];
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1);

/** The world's layout today, plus layouts the forest may get later (more exits). */
const LAYOUTS: Record<string, ExitRequest[]> = {
  'west only': EXITS,
  'west and east': [...EXITS, { side: 'east', to: 'plains' }],
  'two on the west side': [...EXITS, { side: 'west', to: 'caves' }],
};

describe('forest biome', () => {
  it('generates the same map from the same seed', () => {
    expect(generateMap(FOREST, 1234, EXITS)).toEqual(generateMap(FOREST, 1234, EXITS));
    expect(generateMap(FOREST, 1234, EXITS).rows).not.toEqual(generateMap(FOREST, 1235, EXITS).rows);
  });

  describe.each(Object.entries(LAYOUTS))('with exits %s', (_name, exits) => {
    it.each(SEEDS)('seed %i: everything can be reached, and nothing sees you arrive through any exit', (seed) => {
      const map = GridMap.parse(generateMap(FOREST, seed, exits), 'forest');
      expect(map.width).toBe(FOREST.width);
      expect(map.creatures.length).toBeGreaterThan(0);
      expect(map.exits.map((e) => e.to).sort()).toEqual(exits.map((e) => e.to).sort()); // none lost or merged (listed top to bottom)
      expect(playabilityProblems(map)).toEqual([]);
    });
  });

  it('arrives just inside the exit, not along the edge', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const map = GridMap.parse(generateMap(FOREST, seed, EXITS), 'forest');
      const exit = map.exits[0];
      expect(map.arrivalFrom('wasteland')).toEqual({ x: exit.x + 1, y: exit.y });
    }
  });

  it("keeps an exit where it was when another one is added (each exit has its own random numbers)", () => {
    const one = GridMap.parse(generateMap(FOREST, 77, EXITS), 'forest');
    const two = GridMap.parse(generateMap(FOREST, 77, LAYOUTS['west and east']), 'forest');
    expect(two.exits.find((e) => e.to === 'wasteland')).toEqual(one.exits[0]);
  });

  it('usually has a logging camp and other structures', () => {
    const chestNames = SEEDS.flatMap((seed) => Object.values(generateMap(FOREST, seed, EXITS).chests).map((c) => c.name));
    const count = (name: string) => chestNames.filter((n) => n === name).length;
    expect(count('Supply Crate')).toBeGreaterThan(SEEDS.length / 3);
    expect(count("Hunter's Footlocker")).toBeGreaterThan(0);
    expect(count('Abandoned Stash')).toBeGreaterThan(0);
  });
});
