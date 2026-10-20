import { Character } from './core/character';
import { GridMap } from './core/gridMap';
import { WASTELAND } from './data/wasteland';

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
  player.hitPoints = 18; // start a bit beaten up, so the stimpaks are useful

  return { player, map: GridMap.parse(WASTELAND) };
}

/** The one running game. Scenes read and change this; the core classes know nothing about Phaser. */
export const state = newGame();
