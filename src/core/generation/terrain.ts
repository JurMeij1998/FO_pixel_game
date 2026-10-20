import { MAX_SIGHT_RANGE } from '../creature';
import { distance, type GridPos } from '../grid';
import { isBlockingTile } from '../gridMap';
import type { Random } from '../random';
import type { MapBuilder, Prefab } from './mapBuilder';

/** Building blocks for biomes. All of them leave locked (structure) tiles alone. */

/**
 * How far creatures are kept from every arrival point: beyond any creature's sight range,
 * with a margin, so nothing attacks the moment the player walks in.
 */
export const SAFE_SPAWN_DISTANCE = MAX_SIGHT_RANGE + 3;

/** Sets each tile matching `where` to `char` with the given probability. */
export function scatter(
  b: MapBuilder,
  char: string,
  probability: number,
  rng: Random,
  where: (x: number, y: number) => boolean = () => true,
): void {
  b.paint(char, (x, y) => where(x, y) && rng.chance(probability));
}

/**
 * Cellular-automaton smoothing: a tile becomes `char` when at least 5 of its 8 neighbours
 * are, and `otherwise` when at most 3 are. A few passes turn random noise into clumps,
 * such as groves of trees with clearings between them. Off-map counts as `char`.
 */
export function smooth(b: MapBuilder, char: string, otherwise: string, passes: number): void {
  for (let pass = 0; pass < passes; pass++) {
    const counts: number[][] = [];
    for (let y = 0; y < b.height; y++) {
      counts.push([]);
      for (let x = 0; x < b.width; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (!b.inBounds(nx, ny) || b.get(nx, ny) === char) n++;
          }
        }
        counts[y].push(n);
      }
    }
    b.paint(char, (x, y) => counts[y][x] >= 5);
    b.paint(otherwise, (x, y) => counts[y][x] <= 3 && b.get(x, y) === char);
  }
}

/** Fills an irregular round patch: a disc whose edge is randomly frayed. `where` limits what it paints over. */
export function blob(
  b: MapBuilder,
  center: GridPos,
  radius: number,
  char: string,
  rng: Random,
  where: (x: number, y: number) => boolean = () => true,
): void {
  b.paint(char, (x, y) => {
    const d = Math.hypot(x - center.x, y - center.y);
    return where(x, y) && (d <= radius - 0.5 || (d <= radius + 0.5 && rng.chance(0.5)));
  });
}

/** Paints a frame `thickness` tiles wide around the edge of the map. */
export function border(b: MapBuilder, char: string, thickness: number): void {
  b.paint(char, (x, y) => x < thickness || y < thickness || x >= b.width - thickness || y >= b.height - thickness);
}

/**
 * Draws a meandering path from `from` to `to`: mostly stepping towards the target, sometimes
 * sideways, so it looks walked rather than ruled. Only walks through unlocked tiles.
 */
export function windingPath(b: MapBuilder, from: GridPos, to: GridPos, char: string, rng: Random): void {
  let { x, y } = from;
  for (let steps = 0; steps < b.width * b.height && (x !== to.x || y !== to.y); steps++) {
    b.set(x, y, char);
    const dx = Math.sign(to.x - x);
    const dy = Math.sign(to.y - y);
    if (rng.chance(0.2)) {
      // Wander sideways for a step.
      if (dx !== 0) y += rng.pick([-1, 1]);
      else x += rng.pick([-1, 1]);
    } else if (dx !== 0 && (dy === 0 || rng.chance(0.5))) {
      x += dx;
    } else {
      y += dy;
    }
    x = Math.max(1, Math.min(b.width - 2, x));
    y = Math.max(1, Math.min(b.height - 2, y));
  }
  b.set(to.x, to.y, char);
}

/**
 * Tries random spots for a prefab and returns the first that fits and satisfies `isGood`,
 * or null if none is found. The prefab is not stamped.
 */
export function findSpot(
  b: MapBuilder,
  prefab: Prefab,
  rng: Random,
  isGood: (x: number, y: number) => boolean = () => true,
  attempts = 60,
): GridPos | null {
  const width = prefab.rows[0].length;
  const height = prefab.rows.length;
  for (let i = 0; i < attempts; i++) {
    const x = rng.int(2, b.width - width - 2);
    const y = rng.int(2, b.height - height - 2);
    if (b.canStamp(prefab, x, y) && isGood(x, y)) return { x, y };
  }
  return null;
}

/** A random open tile matching `isGood`, or null if none is found. */
/**
 * A random open tile matching `isGood`, or null if none is found. Locked tiles (structures,
 * roads) are skipped unless `useLocked` allows them, e.g. letting creatures roam a street.
 */
export function findOpenTile(
  b: MapBuilder,
  rng: Random,
  isGood: (pos: GridPos) => boolean = () => true,
  attempts = 200,
  useLocked: (pos: GridPos) => boolean = () => false,
): GridPos | null {
  for (let i = 0; i < attempts; i++) {
    const pos = { x: rng.int(1, b.width - 2), y: rng.int(1, b.height - 2) };
    const usable = !b.isLocked(pos.x, pos.y) || useLocked(pos);
    if (b.isOpen(pos.x, pos.y) && usable && isGood(pos)) return pos;
  }
  return null;
}

/** The middle tile of a prefab stamped with its top-left corner at (x, y). */
export function prefabCenter(prefab: Prefab, x: number, y: number): GridPos {
  return { x: x + Math.floor(prefab.rows[0].length / 2), y: y + Math.floor(prefab.rows.length / 2) };
}

/** Where a prefab stamped at (x, y) would put its creatures (its '&' slots). */
export function creatureSlots(prefab: Prefab, x: number, y: number): GridPos[] {
  const slots: GridPos[] = [];
  prefab.rows.forEach((row, dy) => [...row].forEach((char, dx) => char === '&' && slots.push({ x: x + dx, y: y + dy })));
  return slots;
}

export interface PlaceOptions {
  /** Structures already placed (and arrival points): keep at least `spacing` from their centres. */
  occupied: GridPos[];
  spacing: number;
  /** Points the prefab's creatures must stay out of sight of: every arrival point. */
  arrivals: readonly GridPos[];
  /** Ground to clear the spot and a one-tile margin around it to before stamping. */
  clearTo: string;
  /** Any extra condition on the spot (its top-left corner). */
  isGood?: (x: number, y: number) => boolean;
}

/**
 * Finds a spot for a prefab, clears it, stamps it and records it in `occupied`. Returns its
 * entrance and centre, or null if there was no room; the caller lays a trail to it if wanted.
 */
export function placeStructure(
  b: MapBuilder,
  prefab: Prefab,
  rng: Random,
  o: PlaceOptions,
): { entrance: GridPos; center: GridPos } | null {
  const width = prefab.rows[0].length;
  const height = prefab.rows.length;
  const spot = findSpot(b, prefab, rng, (x, y) => {
    if (!farFrom(prefabCenter(prefab, x, y), o.occupied, o.spacing)) return false;
    if (!creatureSlots(prefab, x, y).every((slot) => farFrom(slot, o.arrivals, SAFE_SPAWN_DISTANCE))) return false;
    return o.isGood?.(x, y) ?? true;
  });
  if (!spot) return null;
  b.paint(o.clearTo, (x, y) => x >= spot.x - 1 && x <= spot.x + width && y >= spot.y - 1 && y <= spot.y + height);
  const entrance = b.stamp(prefab, spot.x, spot.y, rng);
  const center = prefabCenter(prefab, spot.x, spot.y);
  o.occupied.push(center);
  return { entrance, center };
}

/** True if no blocking tile is directly next to the position (four directions). */
export function hasRoomAround(b: MapBuilder, pos: GridPos): boolean {
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].every(([dx, dy]) => b.inBounds(pos.x + dx, pos.y + dy) && !isBlockingTile(b.tileAt(pos.x + dx, pos.y + dy)));
}

/** True if `pos` is at least `minimum` tiles from every point in `others`. */
export function farFrom(pos: GridPos, others: readonly GridPos[], minimum: number): boolean {
  return others.every((other) => distance(pos, other) >= minimum);
}
