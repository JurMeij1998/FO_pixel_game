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
   * What the roof covers: the inside and the walls around it, except the front: the doors and
   * the rest of the wall they're in stay visible, so a door sits in a wall, not in the roof.
   */
  roof: GridPos[];
  /** What the roof is made of, after the walls: wooden shingles on a wooden house, tin on a brick one. */
  material: 'wood' | 'brick';
}

const WALLS: ReadonlySet<TileType> = new Set<TileType>(['wall', 'woodWall']);
/** Bigger than this, it's a walled yard rather than a building. */
const MAX_INTERIOR = 200;

export const tileKey = (p: GridPos): string => `${p.x},${p.y}`;

/**
 * Every area that only walls and doors separate from the rest of the map, and that has at least
 * one door. Inside, anything goes (floor, counters, hay, a chest); the edge of the map doesn't
 * count as a wall, so open ground walled in by rocks or trees isn't a building. Without a door
 * there's no way in, so a walled-in well isn't one either.
 */
export function findBuildings(tiles: readonly (readonly TileType[])[]): Building[] {
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  const tileAt = (p: GridPos) => tiles[p.y]?.[p.x];
  const inside = (p: GridPos) => {
    const tile = tileAt(p);
    return tile !== undefined && tile !== 'door' && !WALLS.has(tile);
  };
  const seen = new Set<string>();
  const buildings: Building[] = [];

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
      buildings.push({ id: tileKey(start), interior, ...roofOver(area, doors, tileAt) });
    }
  }
  return buildings;
}

/**
 * The inside plus every wall touching it, corners included, but not the walls in line with a
 * door (its row, for a door in a wall running left to right; its column otherwise); and which
 * wall material wins.
 */
function roofOver(
  area: GridPos[],
  doors: GridPos[],
  tileAt: (p: GridPos) => TileType | undefined,
): Pick<Building, 'roof' | 'material'> {
  const isWall = (p: GridPos) => WALLS.has(tileAt(p)!);
  const inFront = (q: GridPos) =>
    doors.some((d) => {
      const leftToRight = isWall({ x: d.x - 1, y: d.y }) || isWall({ x: d.x + 1, y: d.y });
      return leftToRight ? q.y === d.y : q.x === d.x;
    });
  const covered = new Map(area.map((p) => [tileKey(p), p]));
  let wood = 0;
  let brick = 0;
  for (const p of area) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const q = { x: p.x + dx, y: p.y + dy };
        const tile = tileAt(q);
        if (!tile || !WALLS.has(tile) || covered.has(tileKey(q))) continue;
        if (inFront(q)) continue;
        covered.set(tileKey(q), q);
        if (tile === 'woodWall') wood++;
        else brick++;
      }
    }
  }
  return { roof: [...covered.values()], material: wood > brick ? 'wood' : 'brick' };
}
