import { Character } from '../core/character';
import { MapBuilder, type Prefab } from '../core/generation/mapBuilder';
import { border } from '../core/generation/terrain';
import type { MapDef } from '../core/gridMap';
import { LOCKS } from '../core/locks';
import { Random } from '../core/random';
import { GENERAL_STORE } from './biomes/village';

/**
 * A small room for trying out combat UI (such as the AP gauge): a fight starts as soon as you
 * arrive, and the start is boxed in so floating UI has to work around things. Chests sit
 * directly above (b) and below (c) the start, a radroach three tiles to the right, more
 * creatures further out, and an exit signpost. Bottom right, a small brick shack with a good
 * lock (60%) on its door, which the test character (66% Lockpick) can pick, mid-fight or after,
 * and a strongbox (d) inside under its roof. Only reachable in development; never saved.
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
    '#..............#####.#',
    '#...oo.......o.#_d_#.#',
    '#...oo.........#___#.#',
    '#..............##/##.#',
    '#.........R..........#',
    '###########1##########',
  ],
  chests: {
    a: { name: 'Spare Ammo', contents: [['ammo_10mm', 60], ['ammo_223', 20]] },
    b: { name: 'Crate Above', contents: [['stimpak', 5]] },
    c: { name: 'Crate Below', contents: [['scrap_metal', 2]] },
    d: { name: 'Strongbox', contents: [['stimpak', 2], ['bottle_caps', 50]] },
  },
  creatures: {
    R: 'radroach',
    M: 'mole_rat',
  },
  exits: {
    '1': { to: 'wasteland' },
  },
  doors: {
    '17,11': { lock: LOCKS.hard },
  },
};

/** A one-room shack whose door has an expert lock (80%): beyond the test character's 66% Lockpick. */
const LOCKED_SHACK: Prefab = {
  name: 'locked shack',
  rows: [
    '%%%%%',
    '%+$+%',
    '%+++%',
    '%%/%%',
    '  :  ',
  ],
  entrance: { x: 2, y: 4 },
  chest: { name: 'Footlocker', loot: { rolls: [1, 1], entries: [{ itemId: 'bottle_caps', min: 20, max: 20, weight: 1 }] } },
  doorLock: { lock: LOCKS.expert, chance: 1 },
};

/**
 * A brick house of two rooms: the front room opens onto the yard, the back room (with a
 * cupboard) only through a door between the two. For trying out roofs over inner doors.
 */
const TWO_ROOM_HOUSE: Prefab = {
  name: 'two-room house',
  rows: [
    '######',
    '#__/_#',
    '#__#$#',
    '##/###',
    '  :   ',
  ],
  entrance: { x: 2, y: 4 },
  chest: { name: 'Cupboard', loot: { rolls: [1, 1], entries: [{ itemId: 'stimpak', min: 1, max: 1, weight: 1 }] } },
};

/**
 * The village store in a small yard, for trying out talking, bartering, stealing and
 * provoking. It's stamped from the same prefab as in the village (GENERAL_STORE), so it can't
 * drift from it: Gus behind his counter, the store's crate behind it (a hard lock, which the
 * test character can pick, but which turns Gus and the guard hostile), the guard by the door. Left of the store, a shack with an expert lock
 * the test character can't pick, to see that refusal; right of it, a two-room house with a door
 * between the rooms. You start on the shop floor facing Gus across the counter. Only reachable
 * in development; never saved.
 */
export const TEST_SHOP: MapDef = buildTestShop();

function buildTestShop(): MapDef {
  const b = new MapBuilder(20, 12, '.', 1);
  border(b, '^', 1);
  const store = { x: 7, y: 2 };
  const entrance = b.stamp(GENERAL_STORE, store.x, store.y, new Random(1));
  b.stamp(LOCKED_SHACK, 1, 3, new Random(1));
  b.stamp(TWO_ROOM_HOUSE, 13, 2, new Random(1));
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
 * The hunting rifle is in hand, loaded; the pistol (loaded too) is in the other hand. Lockpick
 * 66%, enough for the store's crate (a hard lock) but not an expert one.
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
  player.skillBonus.lockpick = 40;
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
