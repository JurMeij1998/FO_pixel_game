import type { MapDef } from '../core/gridMap';

// Legend: . dirt   , dry grass   _ floor   # wall   o rock   ~ water
//         P player start   a-z chests   A-Z creatures   1-9 exits (all defined below)
export const WASTELAND: MapDef = {
  name: 'Wasteland',
  rows: [
    'oooooooooooooooooooooooooooooooo',
    'o......,,......o.......,......~o',
    'o.#########....o..,.........~~~o',
    'o.#___a___#.........,.......~~~o',
    'o.#_______#....,.M..........~~~o',
    'o.#_______#..........oo......~~o',
    'o.####_####..,.......oo.......~o',
    'o.....P.......................,1',
    'o..,..........,......,.........o',
    'o.........oo..........#######..o',
    'o...,.....oo..........#__b__#..o',
    'o.....................#_____#..o',
    'o..~~~................###_###..o',
    'o.~~~~~.....,..............,...o',
    'o..~~~..R....c......,..........o',
    'o...R...,..........oo......X...o',
    'o...........................d..o',
    'oooooooooooooooooooooooooooooooo',
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
        ['10mm_pistol', 1],
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
        ['hunting_rifle', 1],
        ['leather_armor', 1],
        ['spear', 1],
        ['ammo_223', 10],
        ['scrap_metal', 15],
      ],
    },
  },
  creatures: {
    R: 'radroach',
    M: 'mole_rat',
    X: 'raider',
  },
  exits: {
    '1': { to: 'forest' },
  },
};
