import type { Biome } from '../../core/generation/biome';
import type { Prefab } from '../../core/generation/mapBuilder';
import { rollLoot, type LootTable, type SpawnTable } from '../../core/generation/tables';
import {
  blob,
  border,
  farFrom,
  findOpenTile,
  hasRoomAround,
  placeStructure,
  SAFE_SPAWN_DISTANCE,
  scatter,
  smooth,
  windingPath,
} from '../../core/generation/terrain';
import type { GridPos } from '../../core/grid';
import { LOCKS } from '../../core/locks';

// Tiles (see LEGEND in core/gridMap.ts).
const FLOOR = ';';
const TREE = '^';
const BUSH = '"';
const PATH = ':';
const DIRT = '.';
const GRASS = ',';
const WATER = '~';

const CAMP_LOOT: LootTable = {
  rolls: [3, 5],
  entries: [
    { itemId: 'bottle_caps', min: 15, max: 50, weight: 4 },
    { itemId: 'ammo_10mm', min: 8, max: 20, weight: 4 },
    { itemId: 'stimpak', min: 1, max: 2, weight: 3 },
    { itemId: 'scrap_metal', min: 1, max: 4, weight: 2 },
    { itemId: 'rope', min: 1, max: 1, weight: 2 },
    { itemId: 'spear', min: 1, max: 1, weight: 1 },
    { itemId: '10mm_pistol', min: 1, max: 1, weight: 1 },
    { itemId: 'leather_armor', min: 1, max: 1, weight: 1 },
  ],
};

const HUNTER_LOOT: LootTable = {
  rolls: [2, 4],
  entries: [
    { itemId: 'ammo_223', min: 4, max: 10, weight: 4 },
    { itemId: 'stimpak', min: 1, max: 1, weight: 2 },
    { itemId: 'canteen', min: 1, max: 1, weight: 2 },
    { itemId: 'bottle_caps', min: 5, max: 20, weight: 2 },
    { itemId: 'knife', min: 1, max: 1, weight: 1 },
    { itemId: 'leather_jacket', min: 1, max: 1, weight: 1 },
    { itemId: 'hunting_rifle', min: 1, max: 1, weight: 1 },
  ],
};

const STASH_LOOT: LootTable = {
  rolls: [1, 3],
  entries: [
    { itemId: 'bottle_caps', min: 5, max: 25, weight: 4 },
    { itemId: 'ammo_10mm', min: 4, max: 10, weight: 3 },
    { itemId: 'stimpak', min: 1, max: 1, weight: 2 },
    { itemId: 'scrap_metal', min: 1, max: 2, weight: 2 },
    { itemId: 'rope', min: 1, max: 1, weight: 1 },
    { itemId: 'canteen', min: 1, max: 1, weight: 1 },
  ],
};

const WILDLIFE: SpawnTable = [
  { creatureId: 'mole_rat', weight: 3 },
  { creatureId: 'wild_dog', weight: 3 },
  { creatureId: 'radroach', weight: 2 },
];

// Legend plus: ' ' keep terrain, '$' chest, '&' creature (see Prefab). Doors are '/'.

/** A raider-held logging camp: a cabin with the supply crate, log piles, and guards. */
const LOGGING_CAMP: Prefab = {
  name: 'logging camp',
  rows: [
    '.............',
    '.%%%%%%..==..',
    '.%++++%......',
    '.%+$++%..==..',
    '.%++++%......',
    '.%%/%%%..&...',
    '.............',
    '..==.....&...',
    '.............',
  ],
  entrance: { x: 3, y: 6 },
  chest: { name: 'Supply Crate', loot: CAMP_LOOT },
  creatures: [
    { creatureId: 'raider', weight: 3 },
    { creatureId: 'wild_dog', weight: 1 }, // a guard dog
  ],
};

/** An empty hunter's cabin with a footlocker. */
const HUNTERS_CABIN: Prefab = {
  name: "hunter's cabin",
  rows: [
    '.......',
    '.%%%%%.',
    '.%+$+%.',
    '.%+++%.',
    '.%%/%%.',
    '.......',
  ],
  entrance: { x: 3, y: 5 },
  chest: { name: "Hunter's Footlocker", loot: HUNTER_LOOT },
  // The hunter locked up before leaving, more often than not.
  doorLock: { lock: LOCKS.simple, chance: 0.6 },
};

/** Logs around an old fire, with someone's stash left behind. */
const CAMPSITE: Prefab = {
  name: 'campsite',
  rows: [
    '.....',
    '.=.=.',
    '..$..',
    '.=.=.',
    '.....',
  ],
  entrance: { x: 2, y: 4 },
  chest: { name: 'Abandoned Stash', loot: STASH_LOOT },
};

export const FOREST: Biome = {
  id: 'forest',
  version: 3,
  names: ['Blackroot Woods', 'Whispering Pines', 'Deadwood Forest', 'The Old Growth', 'Ashen Timberland', 'Hollow Pines'],
  width: 44,
  height: 32,
  baseTile: FLOOR,
  pathTile: PATH,

  generate(b, { rng, exits }) {
    // Groves: random trees, smoothed into clumps with clearings between them.
    scatter(b, TREE, 0.5, rng);
    smooth(b, TREE, FLOOR, 4);
    border(b, TREE, 2);
    // Patches of bare dirt and grass on the forest floor.
    for (let i = rng.int(4, 7); i > 0; i--) {
      const center = { x: rng.int(3, b.width - 4), y: rng.int(3, b.height - 4) };
      blob(b, center, rng.int(2, 4), rng.pick([DIRT, GRASS]), rng, (x, y) => b.get(x, y) === FLOOR);
    }

    // Every exit is a way in: each gets room to look around, and creatures stay out of sight of all of them.
    const entries = exits.map((exit) => b.addExit(exit.side, exit.to, PATH));
    const arrival = entries[0];
    for (const entry of entries) blob(b, entry, 2.5, FLOOR, rng);

    // Structures: each kept away from the entries and from each other, with a trail from the first entry.
    const occupied: GridPos[] = [...entries];
    const place = (prefab: Prefab) => {
      const placed = placeStructure(b, prefab, rng, { occupied, spacing: 12, arrivals: entries, clearTo: FLOOR });
      if (placed) windingPath(b, arrival, placed.entrance, PATH, rng);
    };
    if (rng.chance(0.75)) place(LOGGING_CAMP);
    if (rng.chance(0.6)) place(HUNTERS_CABIN);
    for (let i = rng.int(1, 2); i > 0; i--) place(CAMPSITE);

    // Sometimes a pond, which never floods a trail.
    if (rng.chance(0.5)) {
      const center = findOpenTile(b, rng, (pos) => farFrom(pos, occupied, 7));
      if (center) blob(b, center, rng.int(2, 3), WATER, rng, (x, y) => b.get(x, y) !== PATH);
    }

    scatter(b, BUSH, 0.06, rng, (x, y) => b.get(x, y) === FLOOR);

    // A stash or two tucked away in the woods.
    for (let i = rng.int(0, 2); i > 0; i--) {
      const spot = findOpenTile(b, rng, (pos) => farFrom(pos, occupied, 6) && hasRoomAround(b, pos));
      if (!spot) continue;
      b.addChest(spot, 'Hidden Stash', rollLoot(STASH_LOOT, rng));
      occupied.push(spot);
    }

    // Wildlife, kept out of sight of every entry so nothing attacks the moment you walk in.
    for (let i = rng.int(4, 7); i > 0; i--) {
      const spot = findOpenTile(b, rng, (pos) => farFrom(pos, entries, SAFE_SPAWN_DISTANCE));
      if (spot) b.addCreature(spot, rng.pickWeighted(WILDLIFE).creatureId);
    }
  },
};
