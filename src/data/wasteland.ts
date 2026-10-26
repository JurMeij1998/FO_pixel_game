import type { MapDef } from '../core/gridMap';
import { itemKey } from '../core/items';
import { LOCKS } from '../core/locks';

// Legend: . dirt   , dry grass   _ floor   # wall   o rock   ~ water   / door
//         P player start   a-z chests   A-Z creatures and people   1-9 exits (all defined below)
// A new game starts inside Rosa's shack (top left), with Rosa (F) beside you. The shed with
// the metal locker (right) is locked with an easy lock: a few skill points in Lockpick open it.
// Mags (K) scavenges southeast of the shack, Silas (H) hunts by the water in the northeast; both
// have a quest for you (core/quests.ts).
export const WASTELAND: MapDef = {
  name: 'Wasteland',
  rows: [
    'ooooo3oooooooooooooooooooooooooo',
    'o......,,......o.......,......~o',
    'o.#########....o..,.....H...~~~o',
    'o.#___a___#.........,.......~~~o',
    'o.#_______#....,.M..........~~~o',
    'o.#__FP___#..........oo......~~o',
    'o.####/####..,.......oo.......~o',
    'o.............................,1',
    '4..,..........,......,.........o',
    'o.........oo..........#######..o',
    'o...,.....oo..........#__b__#..o',
    'o.....................#_____#..o',
    'o..~~~................###/###..o',
    'o.~~~~~.....,..K...........,...o',
    'o..~~~..R....c......,..........o',
    'o...R...,..........oo......X...o',
    'o...........................d..o',
    'ooooooooooooooo2oooooooooooooooo',
  ],
  chests: {
    a: {
      name: 'Footlocker',
      contents: [
        ['leather_jacket', 1],
        ['stimpak', 2],
        ['ammo_10mm', 24],
      ],
    },
    b: {
      name: 'Metal Locker',
      contents: [
        [itemKey('10mm_pistol', 55), 1], // weapons left lying around are worn (core/condition.ts)
        ['ammo_10mm', 12],
        ['bottle_caps', 35],
      ],
    },
    c: {
      name: 'Rusty Toolbox',
      contents: [
        ['scrap_metal', 4],
        ['rope', 1],
      ],
    },
    d: {
      name: 'Supply Cache',
      contents: [
        [itemKey('hunting_rifle', 70), 1],
        ['leather_armor', 1],
        [itemKey('spear', 40), 1],
        ['ammo_223', 10],
        ['scrap_metal', 15],
      ],
    },
  },
  creatures: {
    R: 'radroach',
    M: 'mole_rat',
    X: 'raider',
    F: 'rosa',
    K: 'mags', // quests: core/quests.ts
    H: 'silas',
  },
  exits: {
    '1': { to: 'forest' },
    '2': { to: 'village' },
    '3': { to: 'cave', look: 'cave' }, // a cave mouth in the rocks
    '4': { to: 'city' },
  },
  doors: {
    '25,12': { lock: LOCKS.easy },
  },
};
