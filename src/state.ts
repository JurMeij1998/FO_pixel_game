import type { Character } from './core/character';
import type { Combat } from './core/combat';
import { createCharacter, newBuild, type CharacterBuild } from './core/creation';
import type { GridMap } from './core/gridMap';
import { loadGame, saveGame, type GameData } from './core/save';
import { testCharacter } from './data/testArena';
import { buildKnownMap, buildMap, START_MAP, TEST_ARENA_MAP, TEST_SHOP_MAP } from './data/world';
import { clearSave, readSave, writeSave } from './storage';

/** A new game for the character made at character creation (or a default one, before that). */
function newGame(build: CharacterBuild = newBuild()) {
  const player = createCharacter(build);
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
  return toState({ player, worldSeed, difficulty: build.difficulty, maps: { [START_MAP]: map }, currentMap: START_MAP });
}

function toState(game: GameData) {
  return {
    player: game.player,
    worldSeed: game.worldSeed,
    difficulty: game.difficulty,
    maps: game.maps,
    map: game.maps[game.currentMap],
  };
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

/**
 * Puts a default game in memory without touching the save: what the menu sits on top of when
 * there's no saved game to load.
 */
export function resetToDefaultGame(): void {
  Object.assign(state, { ...newGame(), combat: null, loadedFromSave: false, sandbox: false });
}

/** Throws away the save and starts over, with the character made at character creation. */
export function startNewGame(build: CharacterBuild): void {
  clearSave();
  Object.assign(state, { ...newGame(build), combat: null, loadedFromSave: false, sandbox: false });
}

/**
 * Drops a sturdy test character into the test arena, where a fight starts straight away.
 * A sandbox: nothing is autosaved, so the real save is never touched.
 */
export function startTestArena(): void {
  startSandbox(TEST_ARENA_MAP, testCharacter());
}

/** Drops the test character, with caps to spend, into the test shop. A sandbox, like the arena. */
export function startTestShop(): void {
  const player = testCharacter();
  player.backpack.add('bottle_caps', 1000);
  startSandbox(TEST_SHOP_MAP, player);
}

function startSandbox(mapId: string, player: Character): void {
  const worldSeed = Math.floor(Math.random() * 2 ** 31);
  const map = buildMap(mapId, worldSeed);
  player.pos = { ...map.playerStart };
  Object.assign(state, {
    ...toState({ player, worldSeed, difficulty: 'normal', maps: { [mapId]: map }, currentMap: mapId }),
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
    saveGame({
      player: state.player,
      worldSeed: state.worldSeed,
      difficulty: state.difficulty,
      maps: state.maps,
      currentMap: state.map.id,
    }),
  );
}
