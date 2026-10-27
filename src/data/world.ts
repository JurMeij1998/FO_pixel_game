import { generateMap, generatorFingerprint, type ExitRequest, type StairsRequest } from '../core/generation/biome';
import { GridMap, type MapDef } from '../core/gridMap';
import { hashSeed } from '../core/random';
import { BIOMES, type BiomeId } from './biomes';
import { TEST_ARENA, TEST_SHOP } from './testArena';
import { WASTELAND } from './wasteland';

/**
 * A map in the world: drawn by hand, or generated from a biome with the given exits (on its
 * edges) and stairs (inside, to another floor: each floor is a map of its own).
 */
export type MapSource =
  | { kind: 'fixed'; def: MapDef }
  | { kind: 'generated'; biome: BiomeId; exits: ExitRequest[]; stairs?: StairsRequest[] };

/**
 * The maps in the world and how they connect. An exit on one map should be matched by an
 * exit back on the other, so the player arrives beside it. Map ids are used in saves, so
 * don't rename them.
 */
export const WORLD: Record<string, MapSource> = {
  // Exit '1' (east) leads to the forest, '2' (south) to the village, '3' (north) into the cave, '4' (west) to the city.
  wasteland: { kind: 'fixed', def: WASTELAND },
  forest: { kind: 'generated', biome: 'forest', exits: [{ side: 'west', to: 'wasteland' }] },
  village: { kind: 'generated', biome: 'village', exits: [{ side: 'north', to: 'wasteland' }] },
  cave: { kind: 'generated', biome: 'cave', exits: [{ side: 'south', to: 'wasteland', look: 'cave' }] },
  // The city has two towers: one of three floors, one of two. Each upper floor is a map of its own.
  city: {
    kind: 'generated',
    biome: 'city',
    exits: [{ side: 'east', to: 'wasteland' }],
    stairs: [
      { direction: 'up', to: 'city_tower1_f2' },
      { direction: 'up', to: 'city_tower2_f2' },
    ],
  },
  city_tower1_f2: {
    kind: 'generated',
    biome: 'tower',
    exits: [],
    stairs: [
      { direction: 'down', to: 'city' },
      { direction: 'up', to: 'city_tower1_f3' },
    ],
  },
  city_tower1_f3: { kind: 'generated', biome: 'tower', exits: [], stairs: [{ direction: 'down', to: 'city_tower1_f2' }] },
  city_tower2_f2: { kind: 'generated', biome: 'tower', exits: [], stairs: [{ direction: 'down', to: 'city' }] },
  /** For trying out combat UI; development only, see startTestArena() in state.ts. */
  test_arena: { kind: 'fixed', def: TEST_ARENA },
  /** For trying out dialog and bartering; development only, see startTestShop() in state.ts. */
  test_shop: { kind: 'fixed', def: TEST_SHOP },
};

export const TEST_ARENA_MAP = 'test_arena';
export const TEST_SHOP_MAP = 'test_shop';

export const START_MAP = 'wasteland';

/**
 * Builds a map in its starting state. A generated map's seed comes from the world seed and
 * the map id, so every new game gets its own forest, but the same game always gets the same one.
 */
export function buildMap(id: string, worldSeed: number): GridMap {
  const source = WORLD[id];
  if (!source) throw new Error(`Unknown map '${id}'`);
  if (source.kind === 'fixed') return GridMap.parse(source.def, id);
  const biome = BIOMES[source.biome];
  const stairs = source.stairs ?? [];
  const map = GridMap.parse(generateMap(biome, hashSeed(worldSeed, id), source.exits, stairs), id);
  map.generator = generatorFingerprint(biome, source.exits, stairs);
  return map;
}

/** Like buildMap, but null for a map id the world doesn't have (any more), e.g. from an old save. */
export function buildKnownMap(id: string, worldSeed: number): GridMap | null {
  return WORLD[id] ? buildMap(id, worldSeed) : null;
}
