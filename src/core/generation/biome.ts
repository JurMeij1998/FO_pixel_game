import type { MapDef } from '../gridMap';
import { Random } from '../random';
import { MapBuilder, type Side } from './mapBuilder';

/** An exit the generated map must have: which edge it is on and which map it leads to. */
export interface ExitRequest {
  side: Side;
  to: string;
}

export interface BiomeContext {
  rng: Random;
  exits: readonly ExitRequest[];
}

/**
 * A type of randomly generated map: forest, village, plains, caves...
 * To add one, write a Biome in data/biomes/ and register it in data/biomes/index.ts.
 */
export interface Biome {
  id: string;
  /** Names to pick from for each generated map, e.g. "Blackroot Woods". */
  names: readonly string[];
  width: number;
  height: number;
  /** The tile everything starts as, before generate() runs. */
  baseTile: string;
  /** The tile used for exits, and for paths carved to connect everything. */
  pathTile: string;
  /**
   * Paints terrain and places structures, chests, creatures and the requested exits (with
   * `builder.addExit`). It doesn't have to make everything reachable; that happens afterwards.
   * Must only use `ctx.rng` for randomness, so the same seed always gives the same map.
   */
  generate(builder: MapBuilder, ctx: BiomeContext): void;
}

/** Generates a map of the given biome. The same seed and exits always give the same map. */
export function generateMap(biome: Biome, seed: number, exits: readonly ExitRequest[]): MapDef {
  const rng = new Random(seed);
  const builder = new MapBuilder(biome.width, biome.height, biome.baseTile);
  biome.generate(builder, { rng, exits });
  builder.connect(biome.pathTile);
  return builder.toMapDef(rng.pick(biome.names));
}
