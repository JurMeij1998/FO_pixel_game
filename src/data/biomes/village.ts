import type { Biome } from '../../core/generation/biome';
import { flipVertical, type MapBuilder, type Prefab } from '../../core/generation/mapBuilder';
import type { LootTable, SpawnTable } from '../../core/generation/tables';
import { blob, border, farFrom, findOpenTile, findSpot, scatter, windingPath } from '../../core/generation/terrain';
import type { GridPos } from '../../core/grid';
import type { Random } from '../../core/random';

/** Creatures are kept at least this far from the arrival: more than any creature's sight range. */
const SAFE_DISTANCE = 14;

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

const BARN_LOOT: LootTable = {
  rolls: [2, 3],
  entries: [
    { itemId: 'rope', min: 1, max: 1, weight: 3 },
    { itemId: 'scrap_metal', min: 2, max: 5, weight: 3 },
    { itemId: 'bottle_caps', min: 5, max: 15, weight: 2 },
    { itemId: 'spear', min: 1, max: 1, weight: 1 },
    { itemId: 'canteen', min: 1, max: 1, weight: 1 },
  ],
};

/** Whatever roams the streets now the villagers are gone. */
const STREET_LIFE: SpawnTable = [
  { creatureId: 'feral_ghoul', weight: 3 },
  { creatureId: 'wild_dog', weight: 2 },
  { creatureId: 'radroach', weight: 2 },
];

// Legend plus: ' ' keep terrain, '$' chest, '&' creature (see Prefab).
// Every building's door is in its bottom wall, with the entrance (a path tile) just below it;
// flipVertical() turns them around for the other side of the street.

const WOODEN_HOUSE: Prefab = {
  name: 'wooden house',
  rows: [
    '%%%%%%%',
    '%+++++%',
    '%+$+++%',
    '%+++++%',
    '%%%+%%%',
    '   :   ',
  ],
  entrance: { x: 3, y: 5 },
  chest: { name: 'Dresser', loot: HOUSE_LOOT },
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
    '####_####',
    '    :    ',
  ],
  entrance: { x: 4, y: 6 },
  chest: { name: 'Cupboard', loot: HOUSE_LOOT },
};

/** Shelves along the back, a counter, the stockroom crate, and someone looting it. */
const GENERAL_STORE: Prefab = {
  name: 'general store',
  rows: [
    '%%%%%%%%%%%',
    '%]]]]]]]]]%',
    '%+++++++++%',
    '%+$+++++++%',
    '%++]]]++&+%',
    '%+++++++++%',
    '%%%%%+%%%%%',
    '     :     ',
  ],
  entrance: { x: 5, y: 7 },
  chest: { name: 'Stockroom Crate', loot: STORE_LOOT },
  creatures: [
    { creatureId: 'raider', weight: 2 },
    { creatureId: 'feral_ghoul', weight: 1 },
  ],
};

/** Hay bales, a feed bin, and vermin. Wide doors. */
const BARN: Prefab = {
  name: 'barn',
  rows: [
    '%%%%%%%%%%%%%',
    '%+++++++++++%',
    '%+[[+++++[[+%',
    '%+[[++&++[[+%',
    '%+++++++++++%',
    '%+[[+++++$++%',
    '%+++++&+++++%',
    '%%%%%+++%%%%%',
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

/** Buildings that line the street. Each `unique` one appears at most once per village. */
const STREET_BUILDINGS: Array<{ prefab: Prefab; weight: number; unique?: boolean }> = [
  { prefab: WOODEN_HOUSE, weight: 4 },
  { prefab: BRICK_HOUSE, weight: 3 },
  { prefab: GENERAL_STORE, weight: 2, unique: true },
  { prefab: BARN, weight: 1, unique: true },
];

export const VILLAGE: Biome = {
  id: 'village',
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

    const entries = exits.map((exit) => b.addExit(exit.side, exit.to, rng, PATH));
    const arrival = entries[0];

    // The main street: two tiles wide, right across the village, with a road in from the arrival.
    const streetY = rng.int(Math.floor(b.height * 0.4), Math.floor(b.height * 0.55));
    const west = 4;
    const east = b.width - 5;
    road(b, { x: west, y: streetY }, { x: east, y: streetY + 1 });
    road(b, arrival, { x: arrival.x, y: arrival.y < streetY ? streetY : streetY + 1 });

    const occupied: GridPos[] = [...entries];
    const built = lineStreet(b, rng, streetY, west, east, arrival, occupied);

    // A well near the street, a field or two further out, each with a trail from the street.
    // Fields have mole rats, so they stay out of sight of the arrival.
    const nearStreet = (pos: GridPos) => Math.abs(pos.y - streetY) < 12;
    const awayFromArrival = (pos: GridPos) => farFrom(pos, [arrival], SAFE_DISTANCE);
    // Doors face the street: as drawn (door at the bottom) north of it, flipped south of it.
    const place = (prefab: Prefab, isGood: (center: GridPos) => boolean) => {
      const width = prefab.rows[0].length;
      const height = prefab.rows.length;
      const center = (x: number, y: number) => ({ x: x + Math.floor(width / 2), y: y + Math.floor(height / 2) });
      const sides = [
        { prefab, onItsSide: (y: number) => y + height <= streetY },
        { prefab: flipVertical(prefab), onItsSide: (y: number) => y >= streetY + 2 },
      ];
      if (rng.chance(0.5)) sides.reverse();
      for (const side of sides) {
        const spot = findSpot(
          b,
          side.prefab,
          rng,
          (x, y) => side.onItsSide(y) && farFrom(center(x, y), occupied, 7) && isGood(center(x, y)),
        );
        if (!spot) continue;
        b.paint(GROUND, (x, y) => x >= spot.x - 1 && x <= spot.x + width && y >= spot.y - 1 && y <= spot.y + height);
        const entrance = b.stamp(side.prefab, spot.x, spot.y, rng);
        windingPath(b, entrance, { x: entrance.x, y: entrance.y < streetY ? streetY - 1 : streetY + 2 }, PATH, rng);
        occupied.push(center(spot.x, spot.y));
        return;
      }
    };
    if (rng.chance(0.7)) place(WELL, nearStreet);
    for (let i = rng.int(1, 2); i > 0; i--) place(FARM_FIELD, awayFromArrival);
    // No room for the barn on the street? Then it stands out by the fields.
    if (!built.has(BARN)) place(BARN, awayFromArrival);

    // Overgrowth on the open ground.
    scatter(b, BUSH, 0.03, rng, (x, y) => b.get(x, y) === GROUND);
    scatter(b, TREE, 0.015, rng, (x, y) => b.get(x, y) === GROUND);

    // The street's new inhabitants, out of sight of the arrival.
    for (let i = rng.int(3, 6); i > 0; i--) {
      const spot = findOpenTile(b, rng, awayFromArrival);
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
 * Fills both sides of the street with buildings, doors facing it: north of the street the
 * prefabs as drawn, south of it flipped. Spots the arrival road runs through are skipped, and
 * buildings with creatures inside aren't put where those creatures could see the arrival.
 * Returns the prefabs it used.
 */
function lineStreet(
  b: MapBuilder,
  rng: Random,
  streetY: number,
  west: number,
  east: number,
  arrival: GridPos,
  occupied: GridPos[],
): Set<Prefab> {
  const used = new Set<Prefab>();
  for (const side of ['north', 'south'] as const) {
    let x = west + rng.int(0, 2);
    while (x < east) {
      const nearArrival = !farFrom({ x, y: streetY }, [arrival], SAFE_DISTANCE);
      const options = STREET_BUILDINGS.filter(
        (o) => !(o.unique && used.has(o.prefab)) && !(nearArrival && o.prefab.creatures),
      );
      const choice = rng.pickWeighted(options);
      const prefab = side === 'north' ? choice.prefab : flipVertical(choice.prefab);
      const width = prefab.rows[0].length;
      const height = prefab.rows.length;
      const top = side === 'north' ? streetY - height : streetY + 2;
      if (x + width - 1 > east) break;
      if (!b.canStamp(prefab, x, top, 1)) {
        x++;
        continue;
      }
      b.stamp(prefab, x, top, rng);
      used.add(choice.prefab);
      occupied.push({ x: x + Math.floor(width / 2), y: top + Math.floor(height / 2) });
      x += width + rng.int(1, 3);
    }
  }
  return used;
}

function distanceFromEdge(b: MapBuilder, x: number, y: number): number {
  return Math.min(x, y, b.width - 1 - x, b.height - 1 - y);
}
