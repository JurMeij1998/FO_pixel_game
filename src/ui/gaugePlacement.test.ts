import { describe, expect, it } from 'vitest';
import { choosePlacement, overlap, placementOffsets, type Rect } from './gaugePlacement';

const SIZE = { width: 24, height: 12 };
const PLAYER_SIZE = 16;
const GAP = 5;
const OFFSETS = placementOffsets(SIZE.width, SIZE.height, PLAYER_SIZE, GAP);
const ABOVE = 0;
const PLAYER = { x: 100, y: 100 };
const VIEW: Rect = { x: 0, y: 0, width: 400, height: 300 };

/** The 16x16 tile whose top-left corner is at (x, y). */
const tile = (x: number, y: number): Rect => ({ x, y, width: 16, height: 16 });

/** The gauge's rectangle for a placement. */
const gaugeAt = (index: number, anchor = PLAYER): Rect => ({
  x: anchor.x + OFFSETS[index].x - SIZE.width / 2,
  y: anchor.y + OFFSETS[index].y - SIZE.height / 2,
  ...SIZE,
});

describe('gauge placement', () => {
  it('only offers spots above the player, never level with or below them', () => {
    const playerTop = PLAYER.y - PLAYER_SIZE / 2;
    OFFSETS.forEach((_, i) => {
      const gauge = gaugeAt(i);
      expect(gauge.y + gauge.height).toBeLessThanOrEqual(playerTop - GAP);
    });
  });

  it('floats straight above the player when nothing is in the way', () => {
    expect(choosePlacement(PLAYER, SIZE, OFFSETS, [], VIEW, ABOVE)).toBe(ABOVE);
  });

  it('shifts to another spot above when a chest or creature is right above the player', () => {
    const chestAbove = tile(92, 76); // the tile directly above the player
    const choice = choosePlacement(PLAYER, SIZE, OFFSETS, [chestAbove], VIEW, ABOVE);
    expect(choice).not.toBe(ABOVE);
    expect(overlap(gaugeAt(choice), chestAbove)).toBe(0);
  });

  it('avoids several obstacles at once, still above the player', () => {
    const obstacles = [tile(92, 76), tile(108, 76), tile(76, 76)]; // the whole row above
    const choice = choosePlacement(PLAYER, SIZE, OFFSETS, obstacles, VIEW, ABOVE);
    for (const obstacle of obstacles) expect(overlap(gaugeAt(choice), obstacle)).toBe(0);
  });

  it('stays where it is unless that spot gets worse', () => {
    const shifted = 1;
    // Nothing is in the way anywhere, so the current spot wins over the preferred one.
    expect(choosePlacement(PLAYER, SIZE, OFFSETS, [], VIEW, shifted)).toBe(shifted);
    // Something appears on the part of that spot that sticks out past the preferred one:
    // now it moves, back to the preferred spot.
    const spot = gaugeAt(shifted);
    const preferred = gaugeAt(ABOVE);
    const blocker = { x: preferred.x + preferred.width + 1, y: spot.y, width: 8, height: spot.height };
    expect(overlap(blocker, preferred)).toBe(0);
    expect(choosePlacement(PLAYER, SIZE, OFFSETS, [blocker], VIEW, shifted)).toBe(ABOVE);
  });

  it('stays above the player even at the top of the screen', () => {
    const atTopEdge = { x: 100, y: 10 };
    const choice = choosePlacement(atTopEdge, SIZE, OFFSETS, [], VIEW, ABOVE);
    expect(OFFSETS[choice].y).toBeLessThan(0);
  });

  it('measures overlap', () => {
    expect(overlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(25);
    expect(overlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 5, height: 5 })).toBe(0);
  });
});
