import { describe, expect, it } from 'vitest';
import { LockPuzzle, PIN_COUNT } from './lockPuzzle';
import { Random } from './random';

describe('lock puzzle', () => {
  it('has four pins, to press in one order of all four', () => {
    const puzzle = new LockPuzzle(() => 0.5);
    expect(PIN_COUNT).toBe(4);
    expect([...puzzle.order].sort()).toEqual([0, 1, 2, 3]);
  });

  it('picks the order at random', () => {
    const rng = new Random(7);
    const orders = new Set(Array.from({ length: 50 }, () => new LockPuzzle(() => rng.next()).order.join('')));
    expect(orders.size).toBeGreaterThan(10);
  });

  it('opens once every pin is pressed in its turn', () => {
    const puzzle = new LockPuzzle(() => 0.3);
    const [a, b, c, d] = puzzle.order;
    expect(puzzle.press(a)).toBe('set');
    expect(puzzle.press(b)).toBe('set');
    expect(puzzle.press(c)).toBe('set');
    expect(puzzle.isOpen).toBe(false);
    expect(puzzle.press(d)).toBe('open');
    expect(puzzle.isOpen).toBe(true);
    expect(puzzle.press(a)).toBe('open'); // nothing more to do
  });

  it('drops every pin that was in when the wrong one is pressed', () => {
    const puzzle = new LockPuzzle(() => 0.3);
    const [a, b, c] = puzzle.order;
    puzzle.press(a);
    puzzle.press(b);
    expect(puzzle.setCount).toBe(2);
    expect(puzzle.press(puzzle.order[3])).toBe('wrong');
    expect(puzzle.setCount).toBe(0);
    expect(puzzle.isSet(a)).toBe(false);
    // Starting over works the same way.
    expect(puzzle.press(a)).toBe('set');
    expect(puzzle.press(b)).toBe('set');
    expect(puzzle.press(c)).toBe('set');
  });

  it('always lets the very first pin pressed go in, whichever it is', () => {
    for (let first = 0; first < 4; first++) {
      for (const roll of [0, 0.3, 0.6, 0.99]) {
        const puzzle = new LockPuzzle(() => roll);
        expect(puzzle.press(first)).toBe('set');
        expect(puzzle.order[0]).toBe(first);
        expect([...puzzle.order].sort()).toEqual([0, 1, 2, 3]); // still every pin once
      }
    }
  });

  it('keeps that first pin first after a wrong one, and ignores a pin already in', () => {
    const puzzle = new LockPuzzle(() => 0.9);
    puzzle.press(2);
    const [, b, c] = puzzle.order;
    expect(puzzle.press(c)).toBe('wrong');
    expect(puzzle.press(b)).toBe('wrong'); // after dropping, pin 2 must go in first again
    expect(puzzle.press(2)).toBe('set');
    expect(puzzle.press(2)).toBe('alreadySet');
    expect(puzzle.press(b)).toBe('set');
    expect(puzzle.setCount).toBe(2);
  });
});
