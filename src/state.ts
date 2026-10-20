import { Character } from './core/character';
import type { Combat } from './core/combat';
import { GridMap } from './core/gridMap';
import { loadGame, saveGame } from './core/save';
import { WASTELAND } from './data/wasteland';
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

  const map = GridMap.parse(WASTELAND);
  player.pos = { ...map.playerStart };
  return { player, map };
}

/** The saved game, or null if there is none or it can't be read. */
function readSavedGame() {
  const saved = readSave();
  if (!saved) return null;
  try {
    return loadGame(saved, WASTELAND);
  } catch (error) {
    console.warn('Ignoring a save that could not be loaded:', error);
    return null;
  }
}

/**
 * The one running game. Scenes read and change this; the core classes know nothing about Phaser.
 * Starting or loading a game replaces its contents in place, so every importer sees the new game.
 */
export const state = { ...newGame(), combat: null as Combat | null, loadedFromSave: false };

/** A one-line description of the saved game for the main menu, or null if there is none. */
export function savedGameSummary(): string | null {
  const saved = readSavedGame();
  return saved ? `${saved.player.name}, level ${saved.player.level}` : null;
}

/** Replaces the running game with the saved one. Returns false if there is no usable save. */
export function loadSavedGame(): boolean {
  const saved = readSavedGame();
  if (!saved) return false;
  Object.assign(state, { ...saved, combat: null, loadedFromSave: true });
  return true;
}

/** Throws away the save and starts over. */
export function startNewGame(): void {
  clearSave();
  Object.assign(state, { ...newGame(), combat: null, loadedFromSave: false });
}

/** Autosaves. Never during combat, so dying sends you back to just before the fight. */
export function autosave(): void {
  if (!state.combat) writeSave(saveGame(state.player, state.map));
}
