import { Character, type CharacterData } from './character';
import { isDifficulty, type Difficulty } from './difficulty';
import { isGridPos, type GridPos } from './grid';
import type { GridMap } from './gridMap';
import { hashSeed } from './random';

/** Bump when the format changes; loadGame upgrades older versions it knows about. */
export const SAVE_VERSION = 2;

type Entries = Array<[itemId: string, quantity: number]>;

/** What can change on a map: the rest is rebuilt from its definition (or its seed, if generated). */
interface MapState {
  /** The generator a generated map was made with (missing in older saves; null for hand-made maps). */
  generator?: string | null;
  /** `locked` is missing in older saves: the chest then keeps its lock (if it has one). */
  chests: Record<string, { opened: boolean; contents: Entries; locked?: boolean }>;
  /** `hostile` is missing in older saves; creatures then keep their starting disposition. */
  creatures: Record<string, { hitPoints: number; pos: GridPos; contents: Entries; hostile?: boolean }>;
  /** Doors by position ("x,y"); missing in older saves, whose doors then start closed (and locked, if they have a lock). */
  doors?: Record<string, { open: boolean; locked: boolean }>;
  /** The buildings the player has been inside (core/buildings.ts ids); missing in older saves. */
  entered?: string[];
}

/** A saved game, as plain JSON. */
export interface SaveData {
  version: number;
  /** Seeds every generated map, so they come out the same each time they are rebuilt. */
  worldSeed: number;
  currentMap: string;
  /** Missing in saves from before difficulty levels: those games were all on normal. */
  difficulty?: Difficulty;
  player: CharacterData;
  /** Only the maps that have been visited. */
  maps: Record<string, MapState>;
}

/** Version 1 saves had a single map, the wasteland, with its state at the top level. */
interface SaveDataV1 extends MapState {
  version: 1;
  player: CharacterData;
}

/** The parts of a running game that a save covers. */
export interface GameData {
  player: Character;
  worldSeed: number;
  difficulty: Difficulty;
  /** Every visited map, by id. */
  maps: Record<string, GridMap>;
  currentMap: string;
}

/** Builds a map in its starting state; supplied by the caller so this file doesn't depend on the world data. */
/** Builds a map in its starting state, or returns null if the world has no map by that id (any more). */
export type MapBuilderFn = (id: string, worldSeed: number) => GridMap | null;

export function saveGame(game: GameData): SaveData {
  const maps: SaveData['maps'] = {};
  for (const [id, map] of Object.entries(game.maps)) maps[id] = mapState(map);
  return {
    version: SAVE_VERSION,
    worldSeed: game.worldSeed,
    currentMap: game.currentMap,
    difficulty: game.difficulty,
    player: game.player.toData(),
    maps,
  };
}

/**
 * Rebuilds the game from a save. Throws if the save is from an unknown version, its player
 * data is invalid, or it refers to a map that doesn't exist. Chests and creatures that the
 * save doesn't mention (because they were added to a map later) keep their starting state.
 */
export function loadGame(data: unknown, buildMap: MapBuilderFn, startMap: string): GameData {
  const save = upgrade(data);
  if (!Number.isInteger(save.worldSeed)) throw new Error('Invalid world seed in save');
  if (typeof save.currentMap !== 'string' || !save.maps?.[save.currentMap]) throw new Error('Invalid current map in save');

  const maps: Record<string, GridMap> = {};
  for (const [id, state] of Object.entries(save.maps)) {
    // A map the world no longer has (removed in a later version) is simply left out.
    const map = buildMap(id, save.worldSeed);
    if (!map) continue;
    // A generated map whose generator has changed since the save comes out as a different
    // layout; its saved chests and creatures would land in the wrong places, so it starts afresh.
    if ((state.generator ?? null) === map.generator) applyMapState(map, state);
    maps[id] = map;
  }

  const player = Character.fromData(save.player);
  let currentMap = save.currentMap;
  if (!maps[currentMap]) {
    const start = buildMap(startMap, save.worldSeed);
    if (!start) throw new Error(`Unknown start map '${startMap}'`);
    maps[startMap] ??= start;
    currentMap = startMap;
    player.pos = { ...maps[startMap].playerStart };
  }
  // If the map has changed since the save, the saved spot may now be a wall, or walled off from
  // the rest of the map; put the player back at its start, which is always connected.
  const current = maps[currentMap];
  const standable = current.isWalkable(player.pos.x, player.pos.y) || current.exitAt(player.pos.x, player.pos.y);
  const connected = current.reachableFrom(current.playerStart).has(`${player.pos.x},${player.pos.y}`);
  if (!standable || !connected) player.pos = { ...current.playerStart };
  const difficulty = isDifficulty(save.difficulty) ? save.difficulty : 'normal';
  return { player, worldSeed: save.worldSeed, difficulty, maps, currentMap };
}

function upgrade(data: unknown): SaveData {
  const save = data as SaveData | SaveDataV1 | null;
  if (save?.version === SAVE_VERSION) return save as SaveData;
  if (save?.version === 1) {
    const { player, chests, creatures } = save as SaveDataV1;
    // Any fixed seed will do: the wasteland isn't generated, and the forest is new to this player.
    return { version: SAVE_VERSION, worldSeed: hashSeed('version 1 save'), currentMap: 'wasteland', player, maps: { wasteland: { chests, creatures } } };
  }
  throw new Error(`Unsupported save version ${save?.version}`);
}

function mapState(map: GridMap): MapState {
  const state: MapState = { generator: map.generator, chests: {}, creatures: {}, doors: {}, entered: [...map.entered] };
  for (const chest of map.chests) {
    state.chests[chest.id] = { opened: chest.opened, contents: chest.contents.toData(), locked: chest.lock !== null };
  }
  for (const door of map.doors) state.doors![`${door.x},${door.y}`] = { open: door.open, locked: door.lock !== null };
  for (const c of map.creatures) {
    state.creatures[c.id] = { hitPoints: c.hitPoints, pos: { ...c.pos }, contents: c.contents.toData(), hostile: c.hostile };
  }
  return state;
}

function applyMapState(map: GridMap, state: MapState): void {
  for (const chest of map.chests) {
    const saved = state.chests?.[chest.id];
    if (!saved) continue;
    chest.opened = saved.opened === true;
    chest.contents.setData(saved.contents);
    // Only ever from locked to unlocked: a save can't put a lock on a chest that has none.
    if (saved.locked === false) chest.lock = null;
  }
  for (const door of map.doors) {
    const saved = state.doors?.[`${door.x},${door.y}`];
    if (!saved) continue;
    door.open = saved.open === true;
    if (saved.locked === false) door.lock = null;
  }
  const buildings = new Set(map.buildings.map((b) => b.id));
  for (const id of Array.isArray(state.entered) ? state.entered : []) {
    if (buildings.has(id)) map.entered.add(id);
  }
  map.creatures.forEach((creature, index) => {
    // Older saves keyed creatures by their order on the map ("radroach_0") instead of their spawn tile.
    const saved = state.creatures?.[creature.id] ?? state.creatures?.[`${creature.def.id}_${index}`];
    if (!saved) return;
    if (!Number.isInteger(saved.hitPoints) || !isGridPos(saved.pos)) throw new Error(`Invalid creature '${creature.id}'`);
    creature.hitPoints = Math.max(0, Math.min(creature.maxHitPoints, saved.hitPoints));
    creature.pos = { ...saved.pos };
    creature.contents.setData(saved.contents);
    // Only ever from friendly to hostile: a save can't make a monster friendly.
    if (saved.hostile === true) creature.hostile = true;
  });
  // A creature (or corpse) saved before a doorway got its door stands in it: the door must be
  // open, or it would be shut on them, blocking sight and the way, and never open again. Its
  // lock too: someone got through it, and a door can't be open and locked at once.
  for (const door of map.doors) {
    if (!map.creatures.some((c) => c.pos.x === door.x && c.pos.y === door.y)) continue;
    door.open = true;
    door.lock = null;
  }
}
