import { Character } from '../core/character';
import type { MapDef } from '../core/gridMap';

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

/** Sturdy and well equipped, so fights last long enough to watch the UI. 10 Agility gives 10 AP. */
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
  player.equip('knife', 'primary');
  player.equip('10mm_pistol', 'secondary');
  player.swapWeapons(); // pistol in hand
  player.reload();
  player.swapWeapons(); // back to the knife
  return player;
}
