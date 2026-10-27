import type { Biome } from '../../core/generation/biome';
import { flipVertical, type MapBuilder, type Prefab } from '../../core/generation/mapBuilder';
import type { LootTable, SpawnTable } from '../../core/generation/tables';
import {
  blob,
  border,
  creatureSlots,
  farFrom,
  findOpenTile,
  placeStructure,
  prefabCenter,
  SAFE_SPAWN_DISTANCE,
  scatter,
  windingPath,
} from '../../core/generation/terrain';
import type { GridPos } from '../../core/grid';
import { LOCKS } from '../../core/locks';
import type { Random } from '../../core/random';

// Tiles (see LEGEND in core/gridMap.ts).
/** Overgrown ground: the village has been abandoned long enough for the green to take over. */
const GROUND = ';';
const DIRT = '.';
const PATH = ':';
const TREE = '^';
const BUSH = '"';

const HOUSE_LOOT: LootTable = {
  rolls: [1, 3],
  entries: [
    { itemId: 'bottle_caps', min: 5, max: 25, weight: 4 },
    { itemId: 'ammo_10mm', min: 3, max: 8, weight: 2 },
    { itemId: 'canteen', min: 1, max: 1, weight: 2 },
    { itemId: 'stimpak', min: 1, max: 1, weight: 1 },
    { itemId: 'rope', min: 1, max: 1, weight: 1 },
    { itemId: 'knife', min: 1, max: 1, weight: 1 },
    { itemId: 'scrap_metal', min: 1, max: 2, weight: 1 },
    { itemId: 'leather', min: 1, max: 2, weight: 1 },
    { itemId: 'repair_kit', min: 1, max: 1, weight: 1 },
  ],
};

const STORE_LOOT: LootTable = {
  rolls: [3, 5],
  entries: [
    { itemId: 'stimpak', min: 1, max: 3, weight: 4 },
    { itemId: 'ammo_10mm', min: 10, max: 24, weight: 4 },
    { itemId: 'bottle_caps', min: 30, max: 80, weight: 3 },
    { itemId: 'ammo_223', min: 4, max: 10, weight: 2 },
    { itemId: '10mm_pistol', min: 1, max: 1, weight: 1 },
    { itemId: 'leather_jacket', min: 1, max: 1, weight: 1 },
    { itemId: 'leather_armor', min: 1, max: 1, weight: 1 },
    { itemId: 'canteen', min: 1, max: 1, weight: 1 },
  ],
};

const CLINIC_LOOT: LootTable = {
  rolls: [1, 2],
  entries: [
    { itemId: 'stimpak', min: 1, max: 2, weight: 3 },
    { itemId: 'bottle_caps', min: 5, max: 20, weight: 1 },
  ],
};

const BARN_LOOT: LootTable = {
  rolls: [2, 3],
  entries: [
    { itemId: 'rope', min: 1, max: 1, weight: 3 },
    { itemId: 'scrap_metal', min: 2, max: 5, weight: 3 },
    { itemId: 'bottle_caps', min: 5, max: 15, weight: 2 },
    { itemId: 'spear', min: 1, max: 1, weight: 1 },
    { itemId: 'canteen', min: 1, max: 1, weight: 1 },
    { itemId: 'leather', min: 1, max: 3, weight: 2 },
    { itemId: 'repair_kit', min: 1, max: 1, weight: 1 },
  ],
};

/** Whatever roams the streets now the villagers are gone. */
const STREET_LIFE: SpawnTable = [
  { creatureId: 'feral_ghoul', weight: 3 },
  { creatureId: 'wild_dog', weight: 2 },
  { creatureId: 'radroach', weight: 2 },
];

// Legend plus: ' ' keep terrain, '$' chest, '&' creature, A-Z a resident (see Prefab).
// Every building's door (/) is in its bottom wall, with the entrance (a path tile) just below
// it; flipVertical() turns them around for the other side of the street. Some houses were
// locked up when their owners left.

const WOODEN_HOUSE: Prefab = {
  name: 'wooden house',
  rows: [
    '%%%%%%%',
    '%+++++%',
    '%+$+++%',
    '%+++++%',
    '%%%/%%%',
    '   :   ',
  ],
  entrance: { x: 3, y: 5 },
  chest: { name: 'Dresser', loot: HOUSE_LOOT },
  doorLock: { lock: LOCKS.easy, chance: 0.3 },
};

/** Two back rooms opening onto a front room. */
const BRICK_HOUSE: Prefab = {
  name: 'brick house',
  rows: [
    '#########',
    '#___#___#',
    '#_$_#___#',
    '#_______#',
    '#_______#',
    '####/####',
    '    :    ',
  ],
  entrance: { x: 4, y: 6 },
  chest: { name: 'Cupboard', loot: HOUSE_LOOT },
  doorLock: { lock: LOCKS.medium, chance: 0.3 },
};

/**
 * A small shop, 3 by 4 inside: bookcases along the back, Gus (G) behind his counter, and the
 * stockroom crate behind it too, through the gap in the counter. You talk to Gus across the
 * counter from the shop floor. Taking from the crate is stealing from the store, and it's
 * locked with a hard lock: picking it is breaking in, and turns the store against you too.
 * The guard (W) stands outside, beside the door; the shop is open, so the door isn't locked
 * (but it is the store's).
 */
export const GENERAL_STORE: Prefab = {
  name: 'general store',
  rows: [
    '%%%%%',
    '%]]]%',
    '%G+$%',
    '%]+]%',
    '%+++%',
    '%%/%%',
    '  :W ',
  ],
  entrance: { x: 2, y: 6 },
  chest: { name: 'Stockroom Crate', loot: STORE_LOOT, owner: 'store', lock: LOCKS.hard },
  owner: 'store',
  residents: { G: 'shopkeeper', W: 'guard' },
};

/**
 * Doc Mendez's clinic, a brick house with the doctor (D) inside. The medicine cabinet is his
 * (the clinic's): taking from it, or picking its lock, turns him hostile. Open, so the door is
 * never locked.
 */
export const CLINIC: Prefab = {
  name: 'clinic',
  rows: [
    '#######',
    '#__$__#',
    '#_D___#',
    '#_____#',
    '###/###',
    '   :   ',
  ],
  entrance: { x: 3, y: 5 },
  chest: { name: 'Medicine Cabinet', loot: CLINIC_LOOT, owner: 'clinic', lock: LOCKS.medium },
  owner: 'clinic',
  residents: { D: 'doctor' },
};

/** Hay bales, a feed bin, a workbench (!) to repair weapons at, and vermin. Wide double doors, never locked. */
const BARN: Prefab = {
  name: 'barn',
  rows: [
    '%%%%%%%%%%%%%',
    '%+++++!+++++%',
    '%+[[+++++[[+%',
    '%+[[++&++[[+%',
    '%+++++++++++%',
    '%+[[+++++$++%',
    '%+++++&+++++%',
    '%%%%%///%%%%%',
    '     :::     ',
  ],
  entrance: { x: 6, y: 8 },
  chest: { name: 'Feed Bin', loot: BARN_LOOT },
  creatures: [
    { creatureId: 'radroach', weight: 3 },
    { creatureId: 'feral_ghoul', weight: 1 },
  ],
};

/** A fenced field, with mole rats at the crops. */
const FARM_FIELD: Prefab = {
  name: 'farm field',
  rows: [
    '|||||||||||',
    '|*********|',
    '|**&******|',
    '|*********|',
    '|******&**|',
    '|*********|',
    '|||||:|||||',
    '     :     ',
  ],
  entrance: { x: 5, y: 7 },
  creatures: [{ creatureId: 'mole_rat', weight: 1 }],
};

/** The village well. */
const WELL: Prefab = {
  name: 'well',
  rows: [
    '.....',
    '.###.',
    '.#~#.',
    '.###.',
    '.....',
  ],
  entrance: { x: 2, y: 4 },
};

/**
 * Buildings that line the street. Each `unique` one appears at most once per village; the
 * `required` ones (the store and the clinic, for the people in them) exactly once.
 */
const STREET_BUILDINGS: Array<{ prefab: Prefab; weight: number; unique?: boolean; required?: boolean }> = [
  { prefab: WOODEN_HOUSE, weight: 4 },
  { prefab: BRICK_HOUSE, weight: 3 },
  { prefab: GENERAL_STORE, weight: 0, unique: true, required: true },
  { prefab: CLINIC, weight: 0, unique: true, required: true },
  { prefab: BARN, weight: 1, unique: true },
];

export const VILLAGE: Biome = {
  id: 'village',
  version: 7,
  names: ['Dusty Hollow', 'New Plenty', 'Rustwater', 'Cinder Creek', 'Harmony Flats', 'Last Stop'],
  width: 48,
  height: 34,
  baseTile: GROUND,
  pathTile: PATH,

  generate(b, { rng, exits }) {
    // Woods around the outskirts, thinning out towards the village.
    border(b, TREE, 2);
    scatter(b, TREE, 0.35, rng, (x, y) => distanceFromEdge(b, x, y) < 5);
    for (let i = rng.int(4, 7); i > 0; i--) {
      const center = { x: rng.int(4, b.width - 5), y: rng.int(4, b.height - 5) };
      blob(b, center, rng.int(2, 3), DIRT, rng, (x, y) => b.get(x, y) === GROUND);
    }

    const entries = exits.map((exit) => b.addExit(exit.side, exit.to, PATH));

    // The main street: two tiles wide, right across the village, with a road in from every exit.
    const streetY = rng.int(Math.floor(b.height * 0.4), Math.floor(b.height * 0.55));
    const west = 4;
    const east = b.width - 5;
    road(b, { x: west, y: streetY }, { x: east, y: streetY + 1 });
    for (const entry of entries) roadToStreet(b, entry, streetY, west, east);

    const occupied: GridPos[] = [...entries];
    const built = lineStreet(b, rng, streetY, west, east, entries, occupied);
    if (!built.has(GENERAL_STORE)) throw new Error('No room on the street for the general store');
    if (!built.has(CLINIC)) throw new Error('No room on the street for the clinic');

    // A well near the street, a field or two further out, each with a trail from the street.
    // Doors face the street: as drawn (door at the bottom) north of it, flipped south of it.
    const place = (prefab: Prefab, isGood: (center: GridPos) => boolean) => {
      const height = prefab.rows.length;
      const sides = [
        { prefab, onItsSide: (y: number) => y + height <= streetY },
        { prefab: flipVertical(prefab), onItsSide: (y: number) => y >= streetY + 2 },
      ];
      if (rng.chance(0.5)) sides.reverse();
      for (const side of sides) {
        const placed = placeStructure(b, side.prefab, rng, {
          occupied,
          spacing: 7,
          arrivals: entries,
          clearTo: GROUND,
          isGood: (x, y) => side.onItsSide(y) && isGood(prefabCenter(side.prefab, x, y)),
        });
        if (!placed) continue;
        const { entrance } = placed;
        windingPath(b, entrance, { x: entrance.x, y: entrance.y < streetY ? streetY - 1 : streetY + 2 }, PATH, rng);
        return;
      }
    };
    if (rng.chance(0.7)) place(WELL, (center) => Math.abs(center.y - streetY) < 12);
    for (let i = rng.int(1, 2); i > 0; i--) place(FARM_FIELD, () => true);
    // No room for the barn on the street? Then it stands out by the fields.
    if (!built.has(BARN)) place(BARN, () => true);

    // Overgrowth on the open ground.
    scatter(b, BUSH, 0.03, rng, (x, y) => b.get(x, y) === GROUND);
    scatter(b, TREE, 0.015, rng, (x, y) => b.get(x, y) === GROUND);

    // The village's new inhabitants, in the streets and around, out of sight of every exit.
    // Roads are locked (nothing is built on them), so they're allowed explicitly.
    const onRoad = (pos: GridPos) => b.get(pos.x, pos.y) === PATH;
    for (let i = rng.int(3, 6); i > 0; i--) {
      const spot = findOpenTile(b, rng, (pos) => farFrom(pos, entries, SAFE_SPAWN_DISTANCE), 200, onRoad);
      if (spot) b.addCreature(spot, rng.pickWeighted(STREET_LIFE).creatureId);
    }
  },
};

/** Paints a straight road covering the rectangle between two corners, and locks it so nothing is built on it. */
function road(b: MapBuilder, from: GridPos, to: GridPos): void {
  const [x0, x1] = [Math.min(from.x, to.x), Math.max(from.x, to.x)];
  const [y0, y1] = [Math.min(from.y, to.y), Math.max(from.y, to.y)];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      b.set(x, y, PATH);
      b.lock(x, y);
    }
  }
}

/**
 * A road from an exit's inside tile to the street, whichever edge the exit is on: across to
 * the street's extent first (only needed for west and east exits), then up or down to it.
 */
function roadToStreet(b: MapBuilder, entry: GridPos, streetY: number, west: number, east: number): void {
  const x = Math.max(west, Math.min(east, entry.x));
  road(b, entry, { x, y: entry.y });
  road(b, { x, y: entry.y }, { x, y: entry.y < streetY ? streetY : streetY + 1 });
}

/**
 * Fills both sides of the street with buildings, doors facing it: north of the street the
 * prefabs as drawn, south of it flipped. Spots a road runs through are skipped, and a building
 * with creatures inside only goes where none of them could see an exit. The required buildings
 * go in first chance they get from a random spot on a random side. Returns the prefabs used.
 */
function lineStreet(
  b: MapBuilder,
  rng: Random,
  streetY: number,
  west: number,
  east: number,
  entries: readonly GridPos[],
  occupied: GridPos[],
): Set<Prefab> {
  const used = new Set<Prefab>();
  const sides = rng.chance(0.5) ? (['north', 'south'] as const) : (['south', 'north'] as const);
  // On the first side, the required buildings come after this many others; on the second, straight away.
  const requiredAfter = rng.int(0, 2);
  for (const side of sides) {
    let x = west + rng.int(0, 2);
    let placed = 0;
    while (x < east) {
      const oriented = (prefab: Prefab) => (side === 'north' ? prefab : flipVertical(prefab));
      const topFor = (prefab: Prefab) => (side === 'north' ? streetY - prefab.rows.length : streetY + 2);
      const safeHere = (prefab: Prefab) =>
        creatureSlots(oriented(prefab), x, topFor(prefab)).every((slot) => farFrom(slot, entries, SAFE_SPAWN_DISTANCE));
      // Only buildings that still fit before the street's end: a wide barn doesn't end the row
      // when a house would have fitted.
      const fits = (prefab: Prefab) => x + prefab.rows[0].length - 1 <= east;
      const missing = STREET_BUILDINGS.filter((o) => o.required && !used.has(o.prefab));
      const due = missing.length > 0 && (side !== sides[0] || placed >= requiredAfter);
      const options = (due ? missing : STREET_BUILDINGS).filter(
        (o) => !(o.unique && used.has(o.prefab)) && o.weight + (due ? 1 : 0) > 0 && fits(o.prefab) && safeHere(o.prefab),
      );
      if (options.length === 0) break;
      const choice = due ? options[0] : rng.pickWeighted(options);
      const prefab = oriented(choice.prefab);
      const top = topFor(choice.prefab);
      if (!b.canStamp(prefab, x, top, 1)) {
        x++;
        continue;
      }
      b.stamp(prefab, x, top, rng);
      used.add(choice.prefab);
      placed++;
      occupied.push(prefabCenter(prefab, x, top));
      x += prefab.rows[0].length + rng.int(1, 3);
    }
  }
  return used;
}

function distanceFromEdge(b: MapBuilder, x: number, y: number): number {
  return Math.min(x, y, b.width - 1 - x, b.height - 1 - y);
}
