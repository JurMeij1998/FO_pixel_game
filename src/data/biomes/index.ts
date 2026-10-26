import type { Biome } from '../../core/generation/biome';
import { CAVE } from './cave';
import { CITY } from './city';
import { FOREST } from './forest';
import { TOWER } from './tower';
import { VILLAGE } from './village';

/**
 * Every kind of generated map. To add one (village, plains, caves...): write a Biome in this
 * folder, using the prefabs, loot tables and terrain helpers in core/generation/, add it here,
 * and give it a place in the world in data/world.ts.
 */
export const BIOMES = {
  forest: FOREST,
  village: VILLAGE,
  cave: CAVE,
  city: CITY,
  /** An upper floor of one of the city's towers, reached by stairs. */
  tower: TOWER,
} satisfies Record<string, Biome>;

export type BiomeId = keyof typeof BIOMES;
