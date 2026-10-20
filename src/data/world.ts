import { generateMap, type ExitRequest } from '../core/generation/biome';
import { GridMap, type MapDef } from '../core/gridMap';
import { hashSeed } from '../core/random';
import { BIOMES, type BiomeId } from './biomes';
import { TEST_ARENA } from './testArena';
import { WASTELAND } from './wasteland';

/** A map in the world: drawn by hand, or generated from a biome with the given exits. */
export type MapSource =
  | { kind: 'fixed'; def: MapDef }
  | { kind: 'generated'; biome: BiomeId; exits: ExitRequest[] };

/**
 * The maps in the world and how they connect. An exit on one map should be matched by an
 * exit back on the other, so the player arrives beside it. Map ids are used in saves, so
 * don't rename them.
 */
export const WORLD: Record<string, MapSource> = {
  wasteland: { kind: 'fixed', def: WASTELAND }, // exit '1' (east) leads to the forest, '2' (south) to the village
  forest: { kind: 'generated', biome: 'forest', exits: [{ side: 'west', to: 'wasteland' }] },
  village: { kind: 'generated', biome: 'village', exits: [{ side: 'north', to: 'wasteland' }] },
  /** For trying out combat UI; development only, see startTestArena() in state.ts. */
  test_arena: { kind: 'fixed', def: TEST_ARENA },
};

export const TEST_ARENA_MAP = 'test_arena';

export const START_MAP = 'wasteland';

/**
 * Builds a map in its starting state. A generated map's seed comes from the world seed and
 * the map id, so every new game gets its own forest, but the same game always gets the same one.
 */
export function buildMap(id: string, worldSeed: number): GridMap {
  const source = WORLD[id];
  if (!source) throw new Error(`Unknown map '${id}'`);
  const def = source.kind === 'fixed' ? source.def : generateMap(BIOMES[source.biome], hashSeed(worldSeed, id), source.exits);
  return GridMap.parse(def, id);
}
