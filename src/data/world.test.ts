import { describe, expect, it } from 'vitest';
import { playabilityProblems } from './biomes/playability';
import { buildMap, TEST_ARENA_MAP, TEST_SHOP_MAP, WORLD } from './world';

const MAPS = Object.keys(WORLD).filter((id) => id !== TEST_ARENA_MAP && id !== TEST_SHOP_MAP);
const WORLD_SEEDS = [1, 2024, 987654321];

describe('the world', () => {
  it.each(WORLD_SEEDS)('world seed %i: every exit leads to a map with a way back, where you arrive beside it', (seed) => {
    const maps = Object.fromEntries(MAPS.map((id) => [id, buildMap(id, seed)]));
    for (const id of MAPS) {
      for (const exit of maps[id].exits) {
        expect(MAPS).toContain(exit.to);
        const there = maps[exit.to];
        const back = there.exits.find((e) => e.to === id);
        expect(back, `${exit.to} has no way back to ${id}`).toBeDefined();
        const arrival = there.arrivalFrom(id);
        expect(Math.abs(arrival.x - back!.x) + Math.abs(arrival.y - back!.y)).toBe(1);
      }
    }
  });

  it.each(WORLD_SEEDS)('world seed %i: every generated map is playable', (seed) => {
    for (const id of MAPS) {
      if (WORLD[id].kind !== 'generated') continue;
      expect(playabilityProblems(buildMap(id, seed)), id).toEqual([]);
    }
  });

  it('gives stairs the stairs look, both ways', () => {
    const city = buildMap('city', 5);
    const up = city.exits.filter((e) => e.look === 'stairsUp').map((e) => e.to).sort();
    expect(up).toEqual(['city_tower1_f2', 'city_tower2_f2']);
    expect(buildMap('city_tower1_f2', 5).exits.find((e) => e.to === 'city')?.look).toBe('stairsDown');
    expect(buildMap('city_tower1_f2', 5).exits.find((e) => e.to === 'city_tower1_f3')?.look).toBe('stairsUp');
  });

  it('reaches the cave through a cave mouth in the wasteland', () => {
    expect(buildMap('wasteland', 1).exits.find((e) => e.to === 'cave')?.look).toBe('cave');
    expect(buildMap('cave', 1).dark).toBe(true);
    expect(buildMap('wasteland', 1).dark).toBe(false);
  });

  it('keeps the fingerprint of maps without stairs as it was, so their saves still fit', () => {
    expect(buildMap('forest', 1).generator).toMatch(/^forest@\d+:west>wasteland$/);
    expect(buildMap('city_tower1_f3', 1).generator).toMatch(/^tower@\d+:;down>city_tower1_f2$/);
  });
});
