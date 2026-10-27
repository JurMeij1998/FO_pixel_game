import type { Biome } from '../../core/generation/biome';
import { rollLoot, type LootTable, type SpawnTable } from '../../core/generation/tables';
import { findOpenTile, scatter } from '../../core/generation/terrain';
import type { GridPos } from '../../core/grid';
import { LOCKS } from '../../core/locks';
import type { Random } from '../../core/random';

/**
 * An upper floor of one of the city's tall buildings: a map of its own, the size of the
 * building's footprint, reached by stairs (see StairsRequest). The outer walls are the map's
 * edge, so beyond them there's nothing (drawn black). A corridor runs across the middle with
 * the stairs at its west end; rooms with doors open off it on both sides. Every room is its own
 * building, roofed until you step in, so you find out what's in a room by opening its door.
 *
 * Creatures only ever stand in rooms, behind closed doors: the floor is too small to keep them
 * SAFE_SPAWN_DISTANCE from the stairs, and a closed door blocks sight just as well.
 */
export const TOWER_WIDTH = 20;
export const TOWER_HEIGHT = 14;
/** Where the stairs are on an upper floor; the city's tower prefab has its stairs up at DOWN_STAIRS too. */
export const DOWN_STAIRS: GridPos = { x: 1, y: 6 };
export const UP_STAIRS: GridPos = { x: 1, y: 7 };

// Tiles (see LEGEND in core/gridMap.ts).
const WALL = '#';
const FLOOR = '_';
const PLANKS = '+';
const DOOR = '/';
const SHELF = ']';
const RUBBLE = '{';

const CORRIDOR_ROWS = [6, 7];
/** The two rows of rooms: their inside rows, and the wall row (towards the corridor) their doors are in. */
const ROOM_ROWS = [
  { top: 1, bottom: 4, doorRow: 5 },
  { top: 9, bottom: 12, doorRow: 8 },
];

const OFFICE_LOOT: LootTable = {
  rolls: [1, 3],
  entries: [
    { itemId: 'bottle_caps', min: 5, max: 25, weight: 4 },
    { itemId: 'ammo_10mm', min: 3, max: 10, weight: 2 },
    { itemId: 'stimpak', min: 1, max: 1, weight: 2 },
    { itemId: 'scrap_metal', min: 1, max: 3, weight: 2 },
    { itemId: 'repair_kit', min: 1, max: 1, weight: 1 },
    { itemId: 'canteen', min: 1, max: 1, weight: 1 },
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
    { itemId: 'ammo_10mm', min: 3, max: 8, weight: 1 },
  ],
};

/** The top floor's safe: the best loot in the building, behind a hard lock. */
const SAFE_LOOT: LootTable = {
  rolls: [3, 4],
  entries: [
    { itemId: 'bottle_caps', min: 40, max: 120, weight: 4 },
    { itemId: 'stimpak', min: 1, max: 3, weight: 3 },
    { itemId: 'ammo_223', min: 8, max: 16, weight: 2 },
    { itemId: 'ammo_10mm', min: 10, max: 24, weight: 2 },
    { itemId: 'hunting_rifle', min: 1, max: 1, weight: 1 },
    { itemId: 'steel_armor', min: 1, max: 1, weight: 1 },
  ],
};

const SQUATTERS: SpawnTable = [
  { creatureId: 'feral_ghoul', weight: 3 },
  { creatureId: 'radroach', weight: 2 },
  { creatureId: 'raider', weight: 1 },
];

/** Offices (concrete floors, bookcases) or flats (floorboards). */
const STYLES = [
  { floor: FLOOR, chests: ['Desk', 'Filing Cabinet'], loot: OFFICE_LOOT, shelves: true },
  { floor: PLANKS, chests: ['Dresser', 'Wardrobe'], loot: HOME_LOOT, shelves: false },
];

interface Room {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** The tile just inside its door, kept clear. */
  inside: GridPos;
}

export const TOWER: Biome = {
  id: 'tower',
  version: 1,
  names: ['Upper Floor'],
  width: TOWER_WIDTH,
  height: TOWER_HEIGHT,
  baseTile: WALL,
  pathTile: FLOOR,

  generate(b, { rng, exits, stairs }) {
    const down = stairs.filter((s) => s.direction === 'down');
    const up = stairs.filter((s) => s.direction === 'up');
    if (exits.length > 0 || down.length !== 1 || up.length > 1) {
      throw new Error('A tower floor has one way down, at most one up, and no other exits');
    }
    const style = rng.pick(STYLES);

    // The corridor, then the rooms off it, each with a door onto it.
    b.paint(FLOOR, (x, y) => CORRIDOR_ROWS.includes(y) && x >= 1 && x <= b.width - 2);
    const rooms: Room[] = [];
    for (const row of ROOM_ROWS) {
      for (const [x0, x1] of splitIntoRooms(1, b.width - 2, rng)) {
        b.paint(style.floor, (x, y) => x >= x0 && x <= x1 && y >= row.top && y <= row.bottom);
        // Never in line with the stairs (x = 1): stepping out of the room would take them.
        const door = { x: rng.int(Math.max(x0, 2), x1), y: row.doorRow };
        b.set(door.x, door.y, DOOR);
        const inside = { x: door.x, y: row.doorRow === row.bottom + 1 ? row.bottom : row.top };
        rooms.push({ x0, x1, y0: row.top, y1: row.bottom, inside });
      }
    }
    // Walls and doors stay as built: connect() goes through the doors, never through a wall.
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) if (b.get(x, y) === WALL || b.get(x, y) === DOOR) b.lock(x, y);
    }

    b.addStairs(DOWN_STAIRS, 'down', down[0].to);
    if (up.length > 0) b.addStairs(UP_STAIRS, 'up', up[0].to);

    const inRoom = (room: Room) => (p: GridPos) =>
      p.x >= room.x0 && p.x <= room.x1 && p.y >= room.y0 && p.y <= room.y1 && !(p.x === room.inside.x && p.y === room.inside.y);
    const spotIn = (room: Room) => findOpenTile(b, rng, inRoom(room), 400);

    for (const room of rooms) {
      // Bookcases along an office's back wall, and fallen ceiling here and there.
      if (style.shelves && rng.chance(0.4)) {
        const back = room.inside.y === room.y1 ? room.y0 : room.y1;
        scatter(b, SHELF, 0.5, rng, (x, y) => y === back && x >= room.x0 && x <= room.x1 && x !== room.inside.x);
      }
      if (rng.chance(0.3)) scatter(b, RUBBLE, 0.15, rng, (x, y) => inRoom(room)({ x, y }));
      // Some rooms were locked when people left.
      if (rng.chance(0.25)) b.lockDoor(doorOf(room), rng.chance(0.7) ? LOCKS.easy : LOCKS.medium);
    }

    // The top floor has the building's safe, in one of its rooms, which is never empty of squatters.
    const guarded = rng.int(0, rooms.length - 1);
    if (up.length === 0) {
      const spot = spotIn(rooms[guarded]);
      if (spot) b.addChest(spot, 'Wall Safe', rollLoot(SAFE_LOOT, rng), undefined, LOCKS.hard);
    }
    for (const room of rooms) {
      if (!rng.chance(0.55)) continue;
      const spot = spotIn(room);
      if (spot) b.addChest(spot, rng.pick(style.chests), rollLoot(style.loot, rng));
    }

    // Squatters in some rooms; always at least one somewhere.
    const occupiedRooms = rooms.filter((_room, i) => i === guarded || rng.chance(0.35));
    for (const room of occupiedRooms) {
      const spot = spotIn(room);
      if (spot) b.addCreature(spot, rng.pickWeighted(SQUATTERS).creatureId);
    }
  },
};

/** The door of a room: in the wall between it and the corridor, above or below the tile just inside. */
function doorOf(room: Room): GridPos {
  return { x: room.inside.x, y: room.inside.y === room.y1 ? room.y1 + 1 : room.y0 - 1 };
}

/** Splits the columns from `first` to `last` into rooms 3 to 6 wide (the last one may be wider), a wall between each. */
function splitIntoRooms(first: number, last: number, rng: Random): Array<[number, number]> {
  const rooms: Array<[number, number]> = [];
  let start = first;
  while (start <= last) {
    let end = start + rng.int(3, 6) - 1;
    if (last - (end + 1) < 3) end = last; // no room left for another one after the wall
    rooms.push([start, end]);
    start = end + 2;
  }
  return rooms;
}
