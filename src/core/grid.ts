export interface GridPos {
  x: number;
  y: number;
}

/** The four directions you can step in: up, right, down, left. */
export const DIRECTIONS: readonly GridPos[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** Checks untrusted data, such as a loaded save, for the shape of a GridPos. */
export function isGridPos(value: unknown): value is GridPos {
  const pos = value as GridPos;
  return typeof pos === 'object' && pos !== null && Number.isInteger(pos.x) && Number.isInteger(pos.y);
}

export function addPos(a: GridPos, b: GridPos): GridPos {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function samePos(a: GridPos, b: GridPos): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Distance in tiles, counting a diagonal as one step. Used for sight and weapon range,
 * so a melee attack (range 1) reaches all eight neighbours. Walking is still four-way.
 */
export function distance(a: GridPos, b: GridPos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
