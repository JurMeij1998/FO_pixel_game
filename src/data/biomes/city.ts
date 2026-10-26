import type { Biome } from '../../core/generation/biome';
import { flipVertical, type MapBuilder, type Prefab } from '../../core/generation/mapBuilder';
import { rollLoot, type LootTable, type SpawnTable } from '../../core/generation/tables';
import {
  blob,
  border,
  creatureSlots,
  farFrom,
  findOpenTile,
  hasRoomAround,
  placeStructure,
  SAFE_SPAWN_DISTANCE,
  scatter,
} from '../../core/generation/terrain';
import { addPos, type GridPos } from '../../core/grid';
import { LOCKS } from '../../core/locks';
import type { Random } from '../../core/random';
import { DOWN_STAIRS, TOWER_HEIGHT, TOWER_WIDTH } from './tower';

// Tiles (see LEGEND in core/gridMap.ts).
const PAVEMENT = '-';
const ASPHALT = '>';
const RUBBLE = '{';
const DIRT = '.';
const GRASS = ',';

const OFFICE_LOOT: LootTable = {
  rolls: [1, 3],
  entries: [
    { itemId: 'bottle_caps', min: 5, max: 25, weight: 4 },
    { itemId: 'ammo_10mm', min: 3, max: 10, weight: 2 },
    { itemId: 'stimpak', min: 1, max: 1, weight: 2 },
    { itemId: 'scrap_metal', min: 1, max: 3, weight: 1 },
    { itemId: 'repair_kit', min: 1, max: 1, weight: 1 },
  ],
};

const HOME_LOOT: LootTable = {
  rolls: [1, 3],
  entries: [
    { itemId: 'bottle_caps', min: 5, max: 20, weight: 4 },
    { itemId: 'canteen', min: 1, max: 1, weight: 2 },
    { itemId: 'leather', min: 1, max: 2, weight: 2 },
    { itemId: 'stimpak', min: 1, max: 1, weight: 1 },
    { itemId: 'knife', min: 1, max: 1, weight: 1 },
    { itemId: 'leather_jacket', min: 1, max: 1, weight: 1 },
  ],
};

const SHOP_LOOT: LootTable = {
  rolls: [2, 4],
  entries: [
    { itemId: 'bottle_caps', min: 15, max: 50, weight: 4 },
    { itemId: 'ammo_10mm', min: 6, max: 16, weight: 3 },
    { itemId: 'canteen', min: 1, max: 1, weight: 2 },
    { itemId: 'ammo_223', min: 4, max: 8, weight: 1 },
    { itemId: 'stimpak', min: 1, max: 1, weight: 1 },
  ],
};

const CLINIC_LOOT: LootTable = {
  rolls: [2, 3],
  entries: [
    { itemId: 'stimpak', min: 1, max: 3, weight: 5 },
    { itemId: 'canteen', min: 1, max: 1, weight: 1 },
    { itemId: 'bottle_caps', min: 5, max: 20, weight: 1 },
  ],
};

const GARAGE_LOOT: LootTable = {
  rolls: [2, 4],
  entries: [
    { itemId: 'scrap_metal', min: 3, max: 8, weight: 5 },
    { itemId: 'repair_kit', min: 1, max: 2, weight: 3 },
    { itemId: 'rope', min: 1, max: 1, weight: 2 },
    { itemId: 'leather', min: 1, max: 3, weight: 1 },
  ],
};

const RAIDER_LOOT: LootTable = {
  rolls: [3, 5],
  entries: [
    { itemId: 'bottle_caps', min: 20, max: 60, weight: 4 },
    { itemId: 'ammo_10mm', min: 10, max: 24, weight: 4 },
    { itemId: 'stimpak', min: 1, max: 2, weight: 3 },
    { itemId: '10mm_pistol', min: 1, max: 1, weight: 1 },
    { itemId: 'leather_armor', min: 1, max: 1, weight: 1 },
    { itemId: 'steel_armor', min: 1, max: 1, weight: 1 },
  ],
};

const JUNK_LOOT: LootTable = {
  rolls: [1, 2],
  entries: [
    { itemId: 'scrap_metal', min: 1, max: 3, weight: 3 },
    { itemId: 'bottle_caps', min: 2, max: 10, weight: 2 },
    { itemId: 'rope', min: 1, max: 1, weight: 1 },
    { itemId: 'leather', min: 1, max: 1, weight: 1 },
  ],
};

/** What roams the streets. */
const STREET_LIFE: SpawnTable = [
  { creatureId: 'feral_ghoul', weight: 4 },
  { creatureId: 'wild_dog', weight: 2 },
  { creatureId: 'radroach', weight: 2 },
  { creatureId: 'raider', weight: 1 },
];

// Legend plus: ' ' keep terrain, '$' chest, '&' creature (see Prefab). Every building's door
// (/) is in its bottom wall with the entrance (pavement) just below it; flipVertical() turns
// it around for the other side of the street.

/**
 * The ground floor of an office tower, the size of an upper floor (data/biomes/tower.ts): a
 * lobby with a reception counter and the stairs up (at DOWN_STAIRS, where the floor above has
 * its stairs down), and an office. Its doors are never locked: the stairs must stay in reach.
 */
const TOWER: Prefab = {
  name: 'office tower',
  rows: [
    '####################',
    '#______#___________#',
    '#__$___#___________#',
    '#______/___________#',
    '#______#________{{_#',
    '########_________{_#',
    '#__________________#',
    '#__________________#',
    '#______]]]]________#',
    '#__________________#',
    '#__________________#',
    '#{_________________#',
    '#{{________________#',
    '#########//#########',
    '         -          ',
  ],
  entrance: { x: 9, y: 14 },
  chest: { name: 'Desk', loot: OFFICE_LOOT },
  stairs: DOWN_STAIRS,
};

const APARTMENT: Prefab = {
  name: 'apartment',
  rows: [
    '#########',
    '#___#__$#',
    '#___#___#',
    '#_______#',
    '#_______#',
    '####/####',
    '    -    ',
  ],
  entrance: { x: 4, y: 6 },
  chest: { name: 'Wardrobe', loot: HOME_LOOT },
  doorLock: { lock: LOCKS.medium, chance: 0.3 },
};

const CORNER_SHOP: Prefab = {
  name: 'corner shop',
  rows: [
    '###########',
    '#]]]]]]]]]#',
    '#_________#',
    '#_]]]_]]]_#',
    '#__&___$__#',
    '#####/#####',
    '     -     ',
  ],
  entrance: { x: 5, y: 6 },
  chest: { name: 'Cash Register', loot: SHOP_LOOT },
  doorLock: { lock: LOCKS.easy, chance: 0.3 },
  creatures: [
    { creatureId: 'feral_ghoul', weight: 2 },
    { creatureId: 'radroach', weight: 2 },
  ],
};

const CLINIC: Prefab = {
  name: 'clinic',
  rows: [
    '#########',
    '#]_]_]_$#',
    '#_______#',
    '#__&____#',
    '#_______#',
    '####/####',
    '    -    ',
  ],
  entrance: { x: 4, y: 6 },
  chest: { name: 'Medicine Cabinet', loot: CLINIC_LOOT, lock: LOCKS.easy },
  creatures: [{ creatureId: 'feral_ghoul', weight: 1 }],
};

/** A workshop with a workbench (!) to repair at. Wide doors, never locked. */
const GARAGE: Prefab = {
  name: 'garage',
  rows: [
    '###########',
    '#!___{{_$_#',
    '#_________#',
    '#_________#',
    '#_________#',
    '####///####',
    '     -     ',
  ],
  entrance: { x: 5, y: 6 },
  chest: { name: 'Toolbox', loot: GARAGE_LOOT },
};

/** A burnt-out shell: broken walls, no roof, nothing left. */
const SHELL: Prefab = {
  name: 'burnt-out shell',
  rows: [
    '#.##{.##',
    '#_{____#',
    '.___{__.',
    '#______#',
    '##_.##{#',
    '   -    ',
  ],
  entrance: { x: 3, y: 5 },
};

/** A ruin raiders have made their den, with their stash. Stands in a back lot, not on a street. */
const RAIDER_DEN: Prefab = {
  name: 'raider den',
  rows: [
    '##.#####.#',
    '#___&____#',
    '.__{{__$_#',
    '#_&______.',
    '###.######',
    '   -      ',
  ],
  entrance: { x: 3, y: 5 },
  chest: { name: 'Raider Stash', loot: RAIDER_LOOT, lock: LOCKS.medium },
  creatures: [{ creatureId: 'raider', weight: 1 }],
};

/** Buildings that line the streets. Each `unique` one appears at most once per city. */
const STREET_BUILDINGS: Array<{ prefab: Prefab; weight: number; unique?: boolean }> = [
  { prefab: APARTMENT, weight: 4 },
  { prefab: CORNER_SHOP, weight: 2 },
  { prefab: SHELL, weight: 2 },
  { prefab: CLINIC, weight: 1, unique: true },
  { prefab: GARAGE, weight: 1, unique: true },
];

/** A stretch of street front to line with buildings: doors facing north (flipped) or south (as drawn). */
interface Frontage {
  x0: number;
  x1: number;
  /** The row the entrances are on: the block's edge along the street. */
  entranceRow: number;
  facing: 'north' | 'south';
}

export const CITY: Biome = {
  id: 'city',
  version: 1,
  names: ['Old Ashford', 'Fallen Heights', 'Rust City', 'New Babel Ruins', 'Greyhaven'],
  width: 74,
  height: 54,
  baseTile: PAVEMENT,
  pathTile: PAVEMENT,

  generate(b, { rng, exits, stairs }) {
    if (stairs.some((s) => s.direction !== 'up')) throw new Error('City stairs only lead up');
    // Collapsed buildings all round, so the city's edge is a ragged heap of rubble.
    border(b, RUBBLE, 2);
    scatter(b, RUBBLE, 0.3, rng, (x, y) => distanceFromEdge(b, x, y) === 2);

    // A grid of streets two tiles wide: two across, two down, making three by three blocks.
    // Blocks are at least a tower wide, and the top and bottom ones a tower deep.
    const xs = splitInto(b.width - 4, TOWER_WIDTH, rng).map((n) => n + 2);
    const ys = splitInto(b.height - 4, TOWER_HEIGHT + 1, rng).map((n) => n + 2);
    for (const x of xs) road(b, { x, y: 2 }, { x: x + 1, y: b.height - 3 });
    for (const y of ys) road(b, { x: 2, y }, { x: b.width - 3, y: y + 1 });
    const columns: Array<[number, number]> = [
      [2, xs[0] - 1],
      [xs[0] + 2, xs[1] - 1],
      [xs[1] + 2, b.width - 3],
    ];
    const rows: Array<[number, number]> = [
      [2, ys[0] - 1],
      [ys[0] + 2, ys[1] - 1],
      [ys[1] + 2, b.height - 3],
    ];

    // A road in from every exit to the nearest street.
    const entries = exits.map((exit) => b.addExit(exit.side, exit.to, PAVEMENT, exit.look));
    for (const [i, exit] of exits.entries()) {
      const entry = entries[i];
      const street =
        exit.side === 'west' ? { x: xs[0], y: entry.y }
        : exit.side === 'east' ? { x: xs[1] + 1, y: entry.y }
        : exit.side === 'north' ? { x: entry.x, y: ys[0] }
        : { x: entry.x, y: ys[1] + 1 };
      road(b, entry, street);
    }

    // Each block's street fronts: the top row of blocks faces the street below it, the
    // bottom row the street above, and the middle row both.
    const fronts: Frontage[] = [];
    for (const [x0, x1] of columns) {
      rows.forEach(([y0, y1], row) => {
        if (row < 2) fronts.push({ x0, x1, entranceRow: y1, facing: 'south' });
        if (row > 0) fronts.push({ x0, x1, entranceRow: y0, facing: 'north' });
      });
    }

    // The towers first, each on a whole front of its own in the top or bottom row of blocks
    // (only those are deep enough), with its stairs up to the floor above. The top row comes
    // first: facing south, as drawn, the floor plan and the stairs line up with the floors
    // above (data/biomes/tower.ts). A tower facing north is mirrored, which doesn't matter for
    // play; it only happens when roads in from other exits leave no room in the top row.
    const facingSouth = fronts.filter((f) => f.entranceRow === rows[0][1]);
    const facingNorth = fronts.filter((f) => f.entranceRow === rows[2][0]);
    const arrivals: GridPos[] = [...entries];
    for (const way of stairs) {
      const front = takeTowerFront(b, rng, facingSouth) ?? takeTowerFront(b, rng, facingNorth);
      if (!front) throw new Error('No room for another tower');
      fronts.splice(fronts.indexOf(front.front), 1);
      b.addStairs(front.stairs, 'up', way.to);
      arrivals.push(front.stairs);
    }

    const used = new Set<Prefab>();
    for (const front of fronts) lineFront(b, rng, front, arrivals, used);

    // Back lots behind the buildings: burnt-out shells, heaps of rubble, bare earth, and now
    // and then a raiders' den.
    const occupied: GridPos[] = [...arrivals];
    if (rng.chance(0.7)) {
      placeStructure(b, RAIDER_DEN, rng, { occupied, spacing: 8, arrivals, clearTo: PAVEMENT });
    }
    for (let i = rng.int(1, 3); i > 0; i--) {
      placeStructure(b, rng.chance(0.5) ? SHELL : flipVertical(SHELL), rng, { occupied, spacing: 8, arrivals, clearTo: PAVEMENT });
    }
    for (let i = rng.int(3, 6); i > 0; i--) {
      const center = findOpenTile(b, rng, (pos) => farFrom(pos, occupied, 5));
      if (center) blob(b, center, rng.int(1, 2), RUBBLE, rng, (x, y) => b.get(x, y) === PAVEMENT);
    }
    for (let i = rng.int(5, 9); i > 0; i--) {
      const center = { x: rng.int(3, b.width - 4), y: rng.int(3, b.height - 4) };
      blob(b, center, rng.int(1, 3), rng.pick([DIRT, GRASS]), rng, (x, y) => b.get(x, y) === PAVEMENT);
    }
    scatter(b, RUBBLE, 0.05, rng, (x, y) => b.get(x, y) !== ASPHALT && farFrom({ x, y }, arrivals, 3));

    // Maybe a dumpster worth a look. (At most one: with every street front full of buildings
    // with chests, the city already has 24, and a map holds 25.)
    for (let i = rng.int(0, 1); i > 0; i--) {
      const spot = findOpenTile(b, rng, (pos) => hasRoomAround(b, pos) && farFrom(pos, occupied, 4));
      if (spot) b.addChest(spot, 'Dumpster', rollLoot(JUNK_LOOT, rng));
    }

    // Whatever roams the streets, out of sight of every way in. Streets are locked (nothing is
    // built on them), so they're allowed explicitly.
    const onStreet = (pos: GridPos) => b.get(pos.x, pos.y) === ASPHALT;
    for (let i = rng.int(6, 9); i > 0; i--) {
      const spot = findOpenTile(b, rng, (pos) => farFrom(pos, arrivals, SAFE_SPAWN_DISTANCE), 200, onStreet);
      if (spot) b.addCreature(spot, rng.pickWeighted(STREET_LIFE).creatureId);
    }
  },
};

/**
 * Splits `length` tiles into three blocks of at least `min` tiles with two 2-tile streets
 * between them, roughly evenly; returns where the streets start.
 */
function splitInto(length: number, min: number, rng: Random): [number, number] {
  const blocks = length - 4;
  if (blocks < 3 * min) throw new Error(`${length} tiles is too small for three blocks of ${min}`);
  const first = rng.int(min, Math.max(min, Math.floor(blocks / 3) + 1));
  const second = rng.int(min, Math.min(blocks - first - min, Math.floor(blocks / 3) + 2));
  return [first, first + 2 + second];
}

/** Paints a straight road covering the rectangle between two corners, and locks it so nothing is built on it. */
function road(b: MapBuilder, from: GridPos, to: GridPos): void {
  const [x0, x1] = [Math.min(from.x, to.x), Math.max(from.x, to.x)];
  const [y0, y1] = [Math.min(from.y, to.y), Math.max(from.y, to.y)];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      b.set(x, y, ASPHALT);
      b.lock(x, y);
    }
  }
}

/** The prefab turned to face its street, and the row its top goes on. */
function oriented(prefab: Prefab, front: Frontage): { prefab: Prefab; top: number } {
  return front.facing === 'south'
    ? { prefab, top: front.entranceRow - prefab.rows.length + 1 }
    : { prefab: flipVertical(prefab), top: front.entranceRow };
}

/** Stamps a tower on one of the fronts, if one has room; returns that front and where the stairs go. */
function takeTowerFront(b: MapBuilder, rng: Random, fronts: Frontage[]): { front: Frontage; stairs: GridPos } | null {
  const candidates = fronts.filter((f) => f.x1 - f.x0 + 1 >= TOWER_WIDTH);
  while (candidates.length > 0) {
    const front = candidates.splice(rng.int(0, candidates.length - 1), 1)[0];
    fronts.splice(fronts.indexOf(front), 1);
    const { prefab, top } = oriented(TOWER, front);
    if (prefab.rows.length !== TOWER_HEIGHT + 1) throw new Error('The tower must match the floors above');
    const offsets = Array.from({ length: front.x1 - front.x0 - TOWER_WIDTH + 2 }, (_, i) => front.x0 + i);
    const start = rng.int(0, offsets.length - 1);
    for (let i = 0; i < offsets.length; i++) {
      const x = offsets[(start + i) % offsets.length];
      if (!b.canStamp(prefab, x, top, 1)) continue;
      b.stamp(prefab, x, top, rng);
      return { front, stairs: addPos({ x, y: top }, prefab.stairs!) };
    }
  }
  return null;
}

/**
 * Lines a street front with buildings, doors to the street, west to east with gaps between
 * them and now and then an empty lot. Spots a road runs through are skipped, and a building
 * with creatures inside only goes where none of them could see a way in. `used` collects the
 * prefabs built so far in the whole city, for the unique ones.
 */
function lineFront(b: MapBuilder, rng: Random, front: Frontage, arrivals: readonly GridPos[], used: Set<Prefab>): void {
  let x = front.x0 + rng.int(0, 2);
  while (x < front.x1) {
    if (rng.chance(0.15)) {
      x += rng.int(3, 6); // an empty lot
      continue;
    }
    const options = STREET_BUILDINGS.filter((o) => {
      if (o.unique && used.has(o.prefab)) return false;
      const { prefab, top } = oriented(o.prefab, front);
      if (x + prefab.rows[0].length - 1 > front.x1) return false;
      return creatureSlots(prefab, x, top).every((slot) => farFrom(slot, arrivals, SAFE_SPAWN_DISTANCE));
    });
    if (options.length === 0) break;
    const choice = rng.pickWeighted(options);
    const { prefab, top } = oriented(choice.prefab, front);
    if (!b.canStamp(prefab, x, top, 1)) {
      x++;
      continue;
    }
    b.stamp(prefab, x, top, rng);
    used.add(choice.prefab);
    x += prefab.rows[0].length + rng.int(1, 3);
  }
}

function distanceFromEdge(b: MapBuilder, x: number, y: number): number {
  return Math.min(x, y, b.width - 1 - x, b.height - 1 - y);
}
