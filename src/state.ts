import { Character } from './core/character';
import type { Combat } from './core/combat';
import type { GridMap } from './core/gridMap';
import { loadGame, saveGame, type GameData } from './core/save';
import { testCharacter } from './data/testArena';
import { buildKnownMap, buildMap, START_MAP, TEST_ARENA_MAP } from './data/world';
import { clearSave, readSave, writeSave } from './storage';

function newGame() {
  const player = new Character('Wanderer', {
    strength: 4,
    perception: 6,
    endurance: 5,
    charisma: 4,
    intelligence: 6,
    agility: 6,
    luck: 5,
  });
  player.backpack.add('knife');
  player.backpack.add('stimpak');
  player.backpack.add('canteen');
  player.backpack.add('bottle_caps', 20);
  player.equip('knife', 'primary');
  player.taggedSkills.add('smallGuns');
  player.taggedSkills.add('meleeWeapons');
  player.hitPoints = 18; // start a bit beaten up, so the stimpaks are useful

  // A fresh seed per new game, so every game gets its own generated maps.
  const worldSeed = Math.floor(Math.random() * 2 ** 31);
  const map = buildMap(START_MAP, worldSeed);
  player.pos = { ...map.playerStart };
  return toState({ player, worldSeed, maps: { [START_MAP]: map }, currentMap: START_MAP });
}

function toState(game: GameData) {
  return { player: game.player, worldSeed: game.worldSeed, maps: game.maps, map: game.maps[game.currentMap] };
}

/** The saved game, or null if there is none or it can't be read. */
function readSavedGame() {
  const saved = readSave();
  if (!saved) return null;
  try {
    return toState(loadGame(saved, buildKnownMap, START_MAP));
  } catch (error) {
    console.warn('Ignoring a save that could not be loaded:', error);
    return null;
  }
}

/**
 * The one running game. Scenes read and change this; the core classes know nothing about Phaser.
 * `map` is the map the player is on; `maps` holds every map visited so far.
 * Starting or loading a game replaces its contents in place, so every importer sees the new game.
 */
export const state = { ...newGame(), combat: null as Combat | null, loadedFromSave: false, sandbox: false };

/** A one-line description of the saved game for the main menu, or null if there is none. */
export function savedGameSummary(): string | null {
  const saved = readSavedGame();
  return saved ? `${saved.player.name}, level ${saved.player.level}, ${saved.map.name}` : null;
}

/** Replaces the running game with the saved one. Returns false if there is no usable save. */
export function loadSavedGame(): boolean {
  const saved = readSavedGame();
  if (!saved) return false;
  Object.assign(state, { ...saved, combat: null, loadedFromSave: true, sandbox: false });
  return true;
}

/** Throws away the save and starts over. */
export function startNewGame(): void {
  clearSave();
  Object.assign(state, { ...newGame(), combat: null, loadedFromSave: false, sandbox: false });
}

/**
 * Drops a sturdy test character into the test arena, where a fight starts straight away.
 * A sandbox: nothing is autosaved, so the real save is never touched.
 */
export function startTestArena(): void {
  const player = testCharacter();
  const worldSeed = Math.floor(Math.random() * 2 ** 31);
  const map = buildMap(TEST_ARENA_MAP, worldSeed);
  player.pos = { ...map.playerStart };
  Object.assign(state, {
    ...toState({ player, worldSeed, maps: { [TEST_ARENA_MAP]: map }, currentMap: TEST_ARENA_MAP }),
    combat: null,
    loadedFromSave: false,
    sandbox: true,
  });
}

/**
 * Moves the player to another map, building it the first time it is visited, and puts them
 * beside the exit that leads back to where they came from.
 */
export function travelTo(mapId: string): GridMap {
  const from = state.map.id;
  const map = (state.maps[mapId] ??= buildMap(mapId, state.worldSeed));
  state.map = map;
  state.player.pos = map.arrivalFrom(from);
  autosave();
  return map;
}

/** Autosaves. Never during combat, so dying sends you back to just before the fight. */
export function autosave(): void {
  if (state.combat || state.sandbox) return;
  writeSave(
    saveGame({ player: state.player, worldSeed: state.worldSeed, maps: state.maps, currentMap: state.map.id }),
  );
}
