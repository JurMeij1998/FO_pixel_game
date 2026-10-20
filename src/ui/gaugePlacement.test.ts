import { describe, expect, it } from 'vitest';
import { choosePlacement, overlap, placementOffsets, type Rect } from './gaugePlacement';

const SIZE = { width: 24, height: 12 };
const OFFSETS = placementOffsets(SIZE.width, SIZE.height, 16);
const ABOVE = 0;
const RIGHT = 1;
const LEFT = 2;
const PLAYER = { x: 100, y: 100 };
const VIEW: Rect = { x: 0, y: 0, width: 400, height: 300 };

/** The 16x16 tile whose top-left corner is at (x, y). */
const tile = (x: number, y: number): Rect => ({ x, y, width: 16, height: 16 });

describe('gauge placement', () => {
  it('floats above the player when nothing is in the way', () => {
    expect(choosePlacement(PLAYER, SIZE, OFFSETS, [], VIEW, ABOVE)).toBe(ABOVE);
  });

  it('moves aside when a chest or creature is right above the player', () => {
    const chestAbove = tile(92, 76); // the tile directly above the player
    const choice = choosePlacement(PLAYER, SIZE, OFFSETS, [chestAbove], VIEW, ABOVE);
    expect(choice).toBe(RIGHT);
  });

  it('avoids several obstacles at once', () => {
    const above = tile(92, 76);
    const right = tile(112, 92);
    expect(choosePlacement(PLAYER, SIZE, OFFSETS, [above, right], VIEW, ABOVE)).toBe(LEFT);
  });

  it('stays where it is unless that spot gets worse', () => {
    // Nothing is in the way anywhere, so the current (right) spot wins over the preferred one.
    expect(choosePlacement(PLAYER, SIZE, OFFSETS, [], VIEW, RIGHT)).toBe(RIGHT);
    // Something appears on the right: now it moves, back to the preferred spot.
    expect(choosePlacement(PLAYER, SIZE, OFFSETS, [tile(112, 92)], VIEW, RIGHT)).toBe(ABOVE);
  });

  it('keeps inside the visible area', () => {
    const atTopEdge = { x: 100, y: 10 }; // no room above
    const choice = choosePlacement(atTopEdge, SIZE, OFFSETS, [], VIEW, ABOVE);
    expect(choice).not.toBe(ABOVE);
  });

  it('measures overlap', () => {
    expect(overlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(25);
    expect(overlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 5, height: 5 })).toBe(0);
  });
});
