import { describe, expect, it } from 'vitest';
import { generateMap } from '../../core/generation/biome';
import { flipVertical } from '../../core/generation/mapBuilder';
import { GridMap } from '../../core/gridMap';
import { playabilityProblems } from './playability';
import { VILLAGE } from './village';

const EXITS = [{ side: 'north' as const, to: 'wasteland' }];
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 104729 + 3);

describe('village biome', () => {
  it('generates the same map from the same seed', () => {
    expect(generateMap(VILLAGE, 99, EXITS)).toEqual(generateMap(VILLAGE, 99, EXITS));
    expect(generateMap(VILLAGE, 99, EXITS).rows).not.toEqual(generateMap(VILLAGE, 100, EXITS).rows);
  });

  it.each(SEEDS)('seed %i: everything can be reached, and nothing sees you arrive', (seed) => {
    const map = GridMap.parse(generateMap(VILLAGE, seed, EXITS), 'village');
    expect(map.creatures.length).toBeGreaterThan(0);
    expect(playabilityProblems(map, 'wasteland')).toEqual([]);
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
