import type { MapDef } from '../gridMap';
import { hashSeed, Random } from '../random';
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
  /**
   * Bump whenever a change to the generator means the same seed gives a different map.
   * Saves remember the version a map was made with and start that map afresh when it
   * differs, rather than laying old saved chests and creatures over a new layout.
   */
  version: number;
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

/** How many seeds to try before giving up: a rare layout can be impossible to connect. */
const ATTEMPTS = 10;

/**
 * Generates a map of the given biome. The same seed and exits always give the same map.
 * If a layout can't be completed (structures walling each other in, say), it tries again
 * with seeds derived from the first, so a bad roll never leaves the player without a map.
 */
export function generateMap(biome: Biome, seed: number, exits: readonly ExitRequest[]): MapDef {
  let lastError: unknown;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const attemptSeed = attempt === 0 ? seed : hashSeed(seed, 'retry', attempt);
    try {
      const rng = new Random(attemptSeed);
      const builder = new MapBuilder(biome.width, biome.height, biome.baseTile, attemptSeed);
      biome.generate(builder, { rng, exits });
      builder.connect(biome.pathTile);
      return builder.toMapDef(rng.pick(biome.names));
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Couldn't generate a ${biome.id} map in ${ATTEMPTS} attempts: ${String(lastError)}`);
}

/** Identifies the generator a map was made with: its biome, version and exits. */
export function generatorFingerprint(biome: Biome, exits: readonly ExitRequest[]): string {
  return `${biome.id}@${biome.version}:${exits.map((e) => `${e.side}>${e.to}`).join(',')}`;
}
