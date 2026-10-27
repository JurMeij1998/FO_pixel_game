import type { ExitLook, MapDef } from '../gridMap';
import { hashSeed, Random } from '../random';
import { MapBuilder, type Side } from './mapBuilder';

/** An exit the generated map must have: which edge it is on and which map it leads to. */
export interface ExitRequest {
  side: Side;
  to: string;
  /** How it's drawn (a signpost unless given); doesn't change the layout. */
  look?: ExitLook;
}

/**
 * Stairs the generated map must have, inside a building: to the floor above or below, which
 * is a map of its own (with its own id, so it saves and is travelled to like any other).
 * Only biomes with multi-storey buildings place them (city, tower).
 */
export interface StairsRequest {
  direction: 'up' | 'down';
  to: string;
}

export interface BiomeContext {
  rng: Random;
  exits: readonly ExitRequest[];
  stairs: readonly StairsRequest[];
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
  /** Underground: only the area around the player is lit (see MapDef.dark). */
  dark?: boolean;
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
export function generateMap(
  biome: Biome,
  seed: number,
  exits: readonly ExitRequest[],
  stairs: readonly StairsRequest[] = [],
): MapDef {
  let lastError: unknown;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      return generateAttempt(biome, attempt === 0 ? seed : hashSeed(seed, 'retry', attempt), exits, stairs);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Couldn't generate a ${biome.id} map in ${ATTEMPTS} attempts: ${String(lastError)}`);
}

/**
 * One try at generating a map from exactly this seed: throws if the layout can't be completed.
 * generateMap() retries with other seeds then; tests use this to check that's rare.
 */
export function generateAttempt(
  biome: Biome,
  seed: number,
  exits: readonly ExitRequest[],
  stairs: readonly StairsRequest[] = [],
): MapDef {
  const rng = new Random(seed);
  const builder = new MapBuilder(biome.width, biome.height, biome.baseTile, seed);
  biome.generate(builder, { rng, exits, stairs });
  // A biome that ignores some of the exits or stairs asked of it would strand the player.
  const placed = builder.exitDestinations();
  const missing = [...exits, ...stairs].filter((e) => !placed.includes(e.to));
  if (missing.length > 0) throw new Error(`${biome.id} didn't place the way to ${missing.map((e) => e.to).join(', ')}`);
  builder.connect(biome.pathTile);
  const def = builder.toMapDef(rng.pick(biome.names));
  if (biome.dark) def.dark = true;
  return def;
}

/**
 * Identifies the generator a map was made with: its biome, version, exits and stairs. (Stairs
 * are only listed when there are any, so maps without them keep the fingerprint they had.)
 */
export function generatorFingerprint(
  biome: Biome,
  exits: readonly ExitRequest[],
  stairs: readonly StairsRequest[] = [],
): string {
  const ways = `${biome.id}@${biome.version}:${exits.map((e) => `${e.side}>${e.to}`).join(',')}`;
  return stairs.length === 0 ? ways : `${ways};${stairs.map((s) => `${s.direction}>${s.to}`).join(',')}`;
}
