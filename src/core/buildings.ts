import { addPos, DIRECTIONS, type GridPos } from './grid';
import type { TileType } from './gridMap';

/**
 * Buildings, found from the tiles alone: an area closed off by walls and doors, away from the
 * map's edge. Until you've been inside, a roof hides what's in it. Pure, so it can be tested.
 */
export interface Building {
  /** The first inside tile in reading order, as "x,y": stable, so saves can say which ones you've entered. */
  id: string;
  /** The tiles inside, as "x,y" keys. */
  interior: ReadonlySet<string>;
  /**
   * What the roof covers: the inside and the walls around it, except the front: a door that
   * leads outside, and the rest of the wall it's in, stay visible, so the door sits in a wall,
   * not in the roof. A door between two rooms is under both rooms' roofs, like the wall it's in.
   */
  roof: GridPos[];
  /** What the roof is made of, after the walls: wooden shingles on a wooden house, tin on a brick one. */
  material: 'wood' | 'brick';
}

type Tiles = readonly (readonly TileType[])[];

const WALLS: ReadonlySet<TileType> = new Set<TileType>(['wall', 'woodWall']);
/** Bigger than this, it's a walled yard rather than a building. */
const MAX_INTERIOR = 200;

export const tileKey = (p: GridPos): string => `${p.x},${p.y}`;

/**
 * Whether the door at `p` sits in a wall running left to right (a wall on its left or right),
 * rather than one running up and down. Its sprite is drawn for the first and turned for the second.
 */
export function inWallLeftToRight(tiles: Tiles, p: GridPos): boolean {
  const isWall = (x: number) => WALLS.has(tiles[p.y]?.[x] as TileType);
  return isWall(p.x - 1) || isWall(p.x + 1);
}

/**
 * Every area that only walls and doors separate from the rest of the map, and that has at least
 * one door. Inside, anything goes (floor, counters, hay, a chest); the edge of the map doesn't
 * count as a wall, so open ground walled in by rocks or trees isn't a building. Without a door
 * there's no way in, so a walled-in well isn't one either.
 */
export function findBuildings(tiles: Tiles): Building[] {
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  const tileAt = (p: GridPos) => tiles[p.y]?.[p.x];
  const inside = (p: GridPos) => {
    const tile = tileAt(p);
    return tile !== undefined && tile !== 'door' && !WALLS.has(tile);
  };
  const seen = new Set<string>();
  const areas: Array<{ id: string; area: GridPos[]; interior: Set<string>; doors: GridPos[] }> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = { x, y };
      if (seen.has(tileKey(start)) || !inside(start)) continue;
      // Flood the area this tile belongs to, through everything but walls and doors.
      const area: GridPos[] = [start];
      const interior = new Set([tileKey(start)]);
      seen.add(tileKey(start));
      let touchesEdge = false;
      const doors: GridPos[] = [];
      for (let i = 0; i < area.length; i++) {
        const p = area[i];
        if (p.x === 0 || p.y === 0 || p.x === width - 1 || p.y === height - 1) touchesEdge = true;
        for (const direction of DIRECTIONS) {
          const next = addPos(p, direction);
          if (tileAt(next) === 'door') doors.push(next);
          if (!inside(next) || seen.has(tileKey(next))) continue;
          seen.add(tileKey(next));
          interior.add(tileKey(next));
          area.push(next);
        }
      }
      if (touchesEdge || doors.length === 0 || area.length > MAX_INTERIOR) continue;
      areas.push({ id: tileKey(start), area, interior, doors });
    }
  }

  // A door between two rooms (each side inside a different building) is an inner door; any
  // other leads outside (even straight into another building's door).
  const roomOf = new Map(areas.flatMap((a) => [...a.interior].map((k) => [k, a.id] as const)));
  const leadsOutside = (door: GridPos) => {
    const rooms = new Set(DIRECTIONS.map((d) => roomOf.get(tileKey(addPos(door, d)))).filter((id) => id !== undefined));
    return rooms.size < 2;
  };
  return areas.map(({ id, area, interior, doors }) => ({
    id,
    interior,
    ...roofOver(area, doors.filter(leadsOutside), tiles),
  }));
}

/**
 * What of a building's roof is on, given the buildings already entered: all of it, except the
 * walls and doors it shares with a room you've been in. From inside a room you see all of its
 * walls, the doors to the rooms next door among them; their roofs only hide what's inside.
 */
export function roofShown(building: Building, entered: readonly Building[]): GridPos[] {
  const seen = new Set(entered.filter((b) => b !== building).flatMap((b) => b.roof.map(tileKey)));
  return building.roof.filter((p) => building.interior.has(tileKey(p)) || !seen.has(tileKey(p)));
}

/**
 * The inside plus every wall and door touching it, corners included, but not the front: the
 * walls and doors in line with a door leading outside (its row, for a door in a wall running
 * left to right; its column otherwise). And which wall material wins.
 */
function roofOver(area: GridPos[], frontDoors: GridPos[], tiles: Tiles): Pick<Building, 'roof' | 'material'> {
  const inFront = (q: GridPos) =>
    frontDoors.some((d) => (inWallLeftToRight(tiles, d) ? q.y === d.y : q.x === d.x));
  const covered = new Map(area.map((p) => [tileKey(p), p]));
  let wood = 0;
  let brick = 0;
  for (const p of area) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const q = { x: p.x + dx, y: p.y + dy };
        const tile = tiles[q.y]?.[q.x];
        if (!tile || !(WALLS.has(tile) || tile === 'door') || covered.has(tileKey(q))) continue;
        if (inFront(q)) continue;
        covered.set(tileKey(q), q);
        if (tile === 'woodWall') wood++;
        else if (tile === 'wall') brick++;
      }
    }
  }
  return { roof: [...covered.values()], material: wood > brick ? 'wood' : 'brick' };
}
