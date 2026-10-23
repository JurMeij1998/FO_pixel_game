import { describe, expect, it } from 'vitest';
import { LockPuzzle } from './lockPuzzle';
import { Random } from './random';

describe('lock puzzle', () => {
  it('has its pins to press in one order of them all', () => {
    for (const pins of [3, 4, 5]) {
      const puzzle = new LockPuzzle(pins, () => 0.5);
      expect(puzzle.pinCount).toBe(pins);
      expect([...puzzle.order].sort()).toEqual(Array.from({ length: pins }, (_, i) => i));
    }
  });

  it('picks the order at random', () => {
    const rng = new Random(7);
    const orders = new Set(Array.from({ length: 50 }, () => new LockPuzzle(4, () => rng.next()).order.join('')));
    expect(orders.size).toBeGreaterThan(10);
  });

  it('opens once every pin is pressed in its turn', () => {
    const puzzle = new LockPuzzle(4, () => 0.3);
    const [a, b, c, d] = puzzle.order;
    expect(puzzle.press(a)).toBe('set');
    expect(puzzle.press(b)).toBe('set');
    expect(puzzle.press(c)).toBe('set');
    expect(puzzle.isOpen).toBe(false);
    expect(puzzle.press(d)).toBe('open');
    expect(puzzle.isOpen).toBe(true);
    expect(puzzle.press(a)).toBe('open'); // nothing more to do
  });

  it('needs all five pins of a five-pin lock', () => {
    const puzzle = new LockPuzzle(5, () => 0.6);
    for (const pin of puzzle.order.slice(0, 4)) expect(puzzle.press(pin)).toBe('set');
    expect(puzzle.press(puzzle.order[4])).toBe('open');
  });

  it('drops every pin that was in when the wrong one is pressed', () => {
    const puzzle = new LockPuzzle(4, () => 0.3);
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

  it('can get the very first pin wrong too, and ignores a pin already in', () => {
    const puzzle = new LockPuzzle(4, () => 0.9);
    const [a, b] = puzzle.order;
    expect(puzzle.press(b)).toBe('wrong');
    puzzle.press(a);
    expect(puzzle.press(a)).toBe('alreadySet');
    expect(puzzle.setCount).toBe(1);
  });
});
