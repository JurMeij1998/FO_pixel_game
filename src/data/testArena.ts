import { Character } from '../core/character';
import { MapBuilder } from '../core/generation/mapBuilder';
import { border } from '../core/generation/terrain';
import type { MapDef } from '../core/gridMap';
import { Random } from '../core/random';
import { GENERAL_STORE } from './biomes/village';

/**
 * A small room for trying out combat UI (such as the AP gauge): a fight starts as soon as you
 * arrive, and the start is boxed in so floating UI has to work around things. Chests sit
 * directly above (b) and below (c) the start, a radroach three tiles to the right, more
 * creatures further out, and an exit signpost. Only reachable in development; never saved.
 */
export const TEST_ARENA: MapDef = {
  name: 'Test Arena',
  rows: [
    '######################',
    '#....................#',
    '#..a.........~~~.....#',
    '#............~~~..M..#',
    '#....................#',
    '#.......b............#',
    '#.......P..R.........#',
    '#.......c............#',
    '#....................#',
    '#...oo.......o.......#',
    '#...oo...........R...#',
    '#....................#',
    '#....................#',
    '###########1##########',
  ],
  chests: {
    a: { name: 'Spare Ammo', contents: [['ammo_10mm', 60], ['ammo_223', 20]] },
    b: { name: 'Crate Above', contents: [['stimpak', 5]] },
    c: { name: 'Crate Below', contents: [['scrap_metal', 2]] },
  },
  creatures: {
    R: 'radroach',
    M: 'mole_rat',
  },
  exits: {
    '1': { to: 'wasteland' },
  },
};

/**
 * The village store in a small yard, for trying out talking, bartering, stealing and
 * provoking. It's stamped from the same prefab as in the village (GENERAL_STORE), so it can't
 * drift from it: Gus behind his counter, the store's crate behind it, the guard by the door.
 * You start on the shop floor facing Gus across the counter. Only reachable in development;
 * never saved.
 */
export const TEST_SHOP: MapDef = buildTestShop();

function buildTestShop(): MapDef {
  const b = new MapBuilder(20, 12, '.', 1);
  border(b, '^', 1);
  const store = { x: 7, y: 2 };
  const entrance = b.stamp(GENERAL_STORE, store.x, store.y, new Random(1));
  const exit = b.addExit('south', 'wasteland', ':');
  // A path from the door down to the exit: down, across, and down again.
  const pathY = exit.y - 1;
  for (let y = entrance.y; y <= pathY; y++) b.set(entrance.x, y, ':');
  for (let x = Math.min(entrance.x, exit.x); x <= Math.max(entrance.x, exit.x); x++) b.set(x, pathY, ':');
  // The shop floor right in front of Gus's counter (see the prefab's rows).
  b.start = { x: store.x + 1, y: store.y + 4 };
  b.connect(':');
  return b.toMapDef('Test Shop');
}

/**
 * Sturdy and well equipped, so fights last long enough to watch the UI. 10 Agility gives 10 AP.
 * The hunting rifle is in hand, loaded; the pistol (loaded too) is in the other hand.
 */
export function testCharacter(): Character {
  const player = new Character('Tester', {
    strength: 6,
    perception: 6,
    endurance: 10,
    charisma: 5,
    intelligence: 5,
    agility: 10,
    luck: 5,
  });
  player.taggedSkills.add('smallGuns');
  player.taggedSkills.add('meleeWeapons');
  for (const [itemId, quantity] of [
    ['knife', 1],
    ['10mm_pistol', 1],
    ['spear', 1],
    ['hunting_rifle', 1],
    ['ammo_10mm', 48],
    ['ammo_223', 15],
    ['stimpak', 10],
  ] as const) {
    player.backpack.add(itemId, quantity);
  }
  player.equip('hunting_rifle', 'primary');
  player.equip('10mm_pistol', 'secondary');
  player.reload(); // the rifle, in hand
  player.swapWeapons();
  player.reload(); // the pistol
  player.swapWeapons(); // back to the rifle
  return player;
}
