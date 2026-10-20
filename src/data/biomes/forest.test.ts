import { describe, expect, it } from 'vitest';
import { generateMap } from '../../core/generation/biome';
import { GridMap } from '../../core/gridMap';
import { FOREST } from './forest';
import { playabilityProblems } from './playability';

const EXITS = [{ side: 'west' as const, to: 'wasteland' }];
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1);

describe('forest biome', () => {
  it('generates the same map from the same seed', () => {
    expect(generateMap(FOREST, 1234, EXITS)).toEqual(generateMap(FOREST, 1234, EXITS));
    expect(generateMap(FOREST, 1234, EXITS).rows).not.toEqual(generateMap(FOREST, 1235, EXITS).rows);
  });

  it.each(SEEDS)('seed %i: everything can be reached, and nothing sees you arrive', (seed) => {
    const map = GridMap.parse(generateMap(FOREST, seed, EXITS), 'forest');
    expect(map.width).toBe(FOREST.width);
    expect(map.creatures.length).toBeGreaterThan(0);
    expect(playabilityProblems(map, 'wasteland')).toEqual([]);

    const exit = map.exits[0];
    expect(map.arrivalFrom('wasteland')).toEqual({ x: exit.x + 1, y: exit.y }); // just inside the west exit
  });

  it('usually has a logging camp and other structures', () => {
    const chestNames = SEEDS.flatMap((seed) => Object.values(generateMap(FOREST, seed, EXITS).chests).map((c) => c.name));
    const count = (name: string) => chestNames.filter((n) => n === name).length;
    expect(count('Supply Crate')).toBeGreaterThan(SEEDS.length / 3);
    expect(count("Hunter's Footlocker")).toBeGreaterThan(0);
    expect(count('Abandoned Stash')).toBeGreaterThan(0);
  });
});
