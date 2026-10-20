import type { Biome } from '../../core/generation/biome';
import { FOREST } from './forest';
import { VILLAGE } from './village';

/**
 * Every kind of generated map. To add one (village, plains, caves...): write a Biome in this
 * folder, using the prefabs, loot tables and terrain helpers in core/generation/, add it here,
 * and give it a place in the world in data/world.ts.
 */
export const BIOMES = {
  forest: FOREST,
  village: VILLAGE,
} satisfies Record<string, Biome>;

export type BiomeId = keyof typeof BIOMES;
