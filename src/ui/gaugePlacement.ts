/** An axis-aligned rectangle in world pixels; x and y are its top-left corner. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Offset {
  x: number;
  y: number;
}

/**
 * Spots around the player for a floating gauge of the given size, as offsets of the gauge's
 * centre from the player's centre. Listed in order of preference: above first.
 */
export function placementOffsets(width: number, height: number, playerSize: number, gap = 2): Offset[] {
  const dx = playerSize / 2 + gap + width / 2;
  const dy = playerSize / 2 + gap + height / 2;
  return [
    { x: 0, y: -dy }, // above
    { x: dx, y: 0 }, // right
    { x: -dx, y: 0 }, // left
    { x: 0, y: dy }, // below
    { x: dx, y: -dy }, // above right
    { x: -dx, y: -dy }, // above left
    { x: dx, y: dy }, // below right
    { x: -dx, y: dy }, // below left
  ];
}

/** Weights for scoring a spot: covering something matters far more than preference. */
const COVER_WEIGHT = 10;
const OFFSCREEN_WEIGHT = 5;
const PREFERENCE_STEP = 0.5;
/** Staying put is worth this much, so the gauge only moves when its spot really gets worse. */
const STAY_BONUS = 3;

/**
 * Picks where the gauge should float: the spot that covers the least of `obstacles` (chests,
 * creatures, exits...) and stays inside `view`, preferring the current spot and then the
 * earlier offsets. Returns an index into `offsets`.
 */
export function choosePlacement(
  anchor: Offset,
  size: { width: number; height: number },
  offsets: readonly Offset[],
  obstacles: readonly Rect[],
  view: Rect,
  current: number,
): number {
  let best = current;
  let bestScore = Infinity;
  offsets.forEach((offset, i) => {
    const rect = {
      x: anchor.x + offset.x - size.width / 2,
      y: anchor.y + offset.y - size.height / 2,
      width: size.width,
      height: size.height,
    };
    const covered = obstacles.reduce((sum, obstacle) => sum + overlap(rect, obstacle), 0);
    const offscreen = rect.width * rect.height - overlap(rect, view);
    const score =
      covered * COVER_WEIGHT + offscreen * OFFSCREEN_WEIGHT + i * PREFERENCE_STEP - (i === current ? STAY_BONUS : 0);
    if (score < bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

/** The area two rectangles share. */
export function overlap(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}
