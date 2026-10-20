import { Character } from './core/character';
import type { Combat } from './core/combat';
import { GridMap } from './core/gridMap';
import { loadGame, saveGame } from './core/save';
import { WASTELAND } from './data/wasteland';
import { readSave, writeSave } from './storage';

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

/** Continues from the saved game if there is a readable one, otherwise starts fresh. */
function startGame() {
  const saved = readSave();
  if (saved) {
    try {
      return { ...loadGame(saved, WASTELAND), combat: null as Combat | null, loadedFromSave: true };
    } catch (error) {
      console.warn('Ignoring a save that could not be loaded:', error);
    }
  }
  return { ...newGame(), combat: null as Combat | null, loadedFromSave: false };
}

/** The one running game. Scenes read and change this; the core classes know nothing about Phaser. */
export const state = startGame();

/** Autosaves. Never during combat, so dying sends you back to just before the fight. */
export function autosave(): void {
  if (!state.combat) writeSave(saveGame(state.player, state.map));
}
