import { describe, expect, it } from 'vitest';
import { generateMap, generatorFingerprint, type Biome } from './biome';

/** A tiny biome that fails on its first seed, as a layout that can't be completed would. */
function flakyBiome(failures: number): Biome & { attempts: number } {
  const biome = {
    id: 'flaky',
    version: 1,
    names: ['Flaky Flats'],
    width: 12,
    height: 8,
    baseTile: '.',
    pathTile: ':',
    attempts: 0,
    generate(b: Parameters<Biome['generate']>[0], { exits }: Parameters<Biome['generate']>[1]) {
      biome.attempts++;
      if (biome.attempts <= failures) throw new Error('walled in');
      for (const exit of exits) b.addExit(exit.side, exit.to, ':');
    },
  };
  return biome;
}

describe('generateMap', () => {
  it('tries other seeds when a layout fails, instead of giving up', () => {
    const biome = flakyBiome(2);
    const def = generateMap(biome, 1, [{ side: 'west', to: 'home' }]);
    expect(biome.attempts).toBe(3);
    expect(def.rows.join('')).toContain('1'); // the exit made it
  });

  it('gives a clear error when every attempt fails', () => {
    expect(() => generateMap(flakyBiome(100), 1, [{ side: 'west', to: 'home' }])).toThrow(/Couldn't generate a flaky map/);
  });

  it('fingerprints the generator by biome, version and exits', () => {
    const biome = flakyBiome(0);
    const exits = [{ side: 'west' as const, to: 'home' }];
    expect(generatorFingerprint(biome, exits)).toBe(generatorFingerprint(biome, exits));
    expect(generatorFingerprint({ ...biome, version: 2 }, exits)).not.toBe(generatorFingerprint(biome, exits));
    expect(generatorFingerprint(biome, [...exits, { side: 'east', to: 'away' }])).not.toBe(generatorFingerprint(biome, exits));
  });
});
