import type { MapDef } from '../core/gridMap';

// Legend: . dirt   , dry grass   _ floor   # wall   o rock   ~ water
//         P player start   a-z chests (contents below)
export const WASTELAND: MapDef = {
  name: 'Wasteland',
  rows: [
    'oooooooooooooooooooooooooooooooo',
    'o......,,......o.......,......~o',
    'o.#########....o..,.........~~~o',
    'o.#___a___#.........,.......~~~o',
    'o.#_______#....,............~~~o',
    'o.#_______#..........oo......~~o',
    'o.####_####..,.......oo.......~o',
    'o.....P.......................,o',
    'o..,..........,......,.........o',
    'o.........oo..........#######..o',
    'o...,.....oo..........#__b__#..o',
    'o.....................#_____#..o',
    'o..~~~................###_###..o',
    'o.~~~~~.....,..............,...o',
    'o..~~~.......c......,..........o',
    'o.......,..........oo..........o',
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
        ['scrap_metal', 15],
      ],
    },
  },
};
