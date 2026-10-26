import type { Biome } from '../../core/generation/biome';
import type { MapBuilder, Prefab } from '../../core/generation/mapBuilder';
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
import type { Random } from '../../core/random';

// Tiles (see LEGEND in core/gridMap.ts).
const FLOOR = '`';
const WALL = '@';
const BOULDER = 'o';
const WATER = '~';

const MINER_LOOT: LootTable = {
  rolls: [2, 4],
  entries: [
    { itemId: 'scrap_metal', min: 2, max: 5, weight: 4 },
    { itemId: 'bottle_caps', min: 10, max: 30, weight: 3 },
    { itemId: 'rope', min: 1, max: 1, weight: 2 },
    { itemId: 'canteen', min: 1, max: 1, weight: 2 },
    { itemId: 'repair_kit', min: 1, max: 2, weight: 2 },
    { itemId: 'stimpak', min: 1, max: 1, weight: 1 },
    { itemId: 'steel_armor', min: 1, max: 1, weight: 1 },
  ],
};

/** What the radscorpions' victims left behind. */
const NEST_LOOT: LootTable = {
  rolls: [3, 5],
  entries: [
    { itemId: 'bottle_caps', min: 10, max: 40, weight: 4 },
    { itemId: 'ammo_10mm', min: 6, max: 15, weight: 3 },
    { itemId: 'ammo_223', min: 4, max: 10, weight: 2 },
    { itemId: 'stimpak', min: 1, max: 2, weight: 2 },
    { itemId: 'leather_armor', min: 1, max: 1, weight: 1 },
    { itemId: '10mm_pistol', min: 1, max: 1, weight: 1 },
    { itemId: 'hunting_rifle', min: 1, max: 1, weight: 1 },
  ],
};

const REMAINS_LOOT: LootTable = {
  rolls: [1, 3],
  entries: [
    { itemId: 'bottle_caps', min: 3, max: 15, weight: 4 },
    { itemId: 'ammo_10mm', min: 3, max: 8, weight: 2 },
    { itemId: 'stimpak', min: 1, max: 1, weight: 2 },
    { itemId: 'rope', min: 1, max: 1, weight: 1 },
    { itemId: 'canteen', min: 1, max: 1, weight: 1 },
  ],
};

const CAVE_LIFE: SpawnTable = [
  { creatureId: 'radroach', weight: 3 },
  { creatureId: 'mole_rat', weight: 3 },
  { creatureId: 'radscorpion', weight: 2 },
];

// Legend plus: ' ' keep terrain, '$' chest, '&' creature (see Prefab).

/** An abandoned miners' camp: a workbench (!) and a pack left behind, between boulders. */
const MINERS_CAMP: Prefab = {
  name: "miners' camp",
  rows: [
    '`````````',
    '`o`````o`',
    '``!```$``',
    '`````````',
    '`o`````o`',
    '`````````',
  ],
  entrance: { x: 4, y: 5 },
  chest: { name: "Miner's Pack", loot: MINER_LOOT },
};

/** Radscorpions around the bones of what they caught. */
const SCORPION_NEST: Prefab = {
  name: 'radscorpion nest',
  rows: [
    '`````````',
    '``&```&``',
    '````$````',
    '``o```o``',
    '`````````',
  ],
  entrance: { x: 4, y: 4 },
  chest: { name: 'Bones', loot: NEST_LOOT },
  creatures: [{ creatureId: 'radscorpion', weight: 1 }],
};

export const CAVE: Biome = {
  id: 'cave',
  version: 1,
  names: ['Echo Caverns', 'The Deep Vein', 'Shadow Grotto', 'Old Mine Shaft', 'Blackwater Caves'],
  width: 46,
  height: 34,
  baseTile: WALL,
  pathTile: FLOOR,
  dark: true,

  generate(b, { rng, exits }) {
    // Solid rock, hollowed out into rounded caverns: noise smoothed into chambers.
    scatter(b, FLOOR, 0.5, rng, (x, y) => x >= 2 && y >= 2 && x < b.width - 2 && y < b.height - 2);
    smooth(b, WALL, FLOOR, 5);
    border(b, WALL, 2);

    // Every exit is a way in, with room to look around.
    const entries = exits.map((exit) => b.addExit(exit.side, exit.to, FLOOR, exit.look));
    const arrival = entries[0];
    for (const entry of entries) blob(b, entry, 2.5, FLOOR, rng);
    // The room round the entries mustn't open up the edge beside the way out, and connect()
    // mustn't carve a passage along it either.
    border(b, WALL, 1);
    for (let x = 0; x < b.width; x++) for (const y of [0, b.height - 1]) b.lock(x, y);
    for (let y = 0; y < b.height; y++) for (const x of [0, b.width - 1]) b.lock(x, y);

    // A few big chambers, each joined to the first entry by a winding tunnel, so the caves
    // read as one system rather than pockets that connect() bores single-file passages to.
    for (let i = rng.int(3, 5); i > 0; i--) {
      const chamber = { x: rng.int(5, b.width - 6), y: rng.int(5, b.height - 6) };
      blob(b, chamber, rng.int(2, 3), FLOOR, rng);
      tunnel(b, arrival, chamber, rng);
    }

    // Structures, away from the entries and each other, with a tunnel from the first entry.
    const occupied: GridPos[] = [...entries];
    const place = (prefab: Prefab) => {
      const placed = placeStructure(b, prefab, rng, { occupied, spacing: 10, arrivals: entries, clearTo: FLOOR });
      if (placed) tunnel(b, arrival, placed.entrance, rng);
    };
    if (rng.chance(0.7)) place(MINERS_CAMP);
    place(SCORPION_NEST);

    // Sometimes an underground pool, and boulders here and there.
    if (rng.chance(0.6)) {
      const center = findOpenTile(b, rng, (pos) => farFrom(pos, occupied, 6));
      if (center) blob(b, center, rng.int(2, 3), WATER, rng, (x, y) => b.get(x, y) === FLOOR);
    }
    scatter(b, BOULDER, 0.03, rng, (x, y) => b.get(x, y) === FLOOR && farFrom({ x, y }, entries, 3));

    // The remains of those who got lost down here.
    for (let i = rng.int(1, 3); i > 0; i--) {
      const spot = findOpenTile(b, rng, (pos) => farFrom(pos, occupied, 6) && hasRoomAround(b, pos));
      if (!spot) continue;
      b.addChest(spot, 'Remains', rollLoot(REMAINS_LOOT, rng));
      occupied.push(spot);
    }

    // Whatever lives in the dark, out of sight of every entry.
    for (let i = rng.int(5, 8); i > 0; i--) {
      const spot = findOpenTile(b, rng, (pos) => farFrom(pos, entries, SAFE_SPAWN_DISTANCE));
      if (spot) b.addCreature(spot, rng.pickWeighted(CAVE_LIFE).creatureId);
    }
  },
};

/** A winding passage two tiles wide. */
function tunnel(b: MapBuilder, from: GridPos, to: GridPos, rng: Random): void {
  windingPath(b, from, to, FLOOR, rng);
  windingPath(b, { x: from.x + 1, y: from.y }, { x: to.x + 1, y: to.y }, FLOOR, rng);
}
