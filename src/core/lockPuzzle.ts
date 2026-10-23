/**
 * Picking a lock, as a puzzle: the lock has a few pins (more for a harder lock; see pinsFor in
 * core/locks.ts) that must be pressed in, in one order, different every time you set to it. A
 * pin pressed in its turn stays in; any other pin and every pin that was in drops back out,
 * and you start over (knowing what you've learned). Once all of them are in, the lock opens.
 * Pure, so it can be tested; the lockpicking screen (scenes/LockpickScene.ts) draws it and
 * passes on your presses.
 */

/** What pressing a pin did: it went in, it was the wrong one (all pins dropped), it was in already, or it opened the lock. */
export type PinPress = 'set' | 'wrong' | 'alreadySet' | 'open';

export class LockPuzzle {
  /** The order the pins (0 to pinCount - 1) must go in. */
  readonly order: readonly number[];
  private readonly pressed: number[] = [];

  /** `rng` returns values in [0, 1); injectable so tests are deterministic. */
  constructor(
    readonly pinCount: number,
    rng: () => number,
  ) {
    // Fisher-Yates: every order equally likely.
    const order = Array.from({ length: pinCount }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    this.order = order;
  }

  isSet(pin: number): boolean {
    return this.pressed.includes(pin);
  }

  /** How many pins are in. */
  get setCount(): number {
    return this.pressed.length;
  }

  get isOpen(): boolean {
    return this.pressed.length === this.pinCount;
  }

  press(pin: number): PinPress {
    if (this.isOpen) return 'open';
    if (this.isSet(pin)) return 'alreadySet';
    if (pin !== this.order[this.pressed.length]) {
      this.pressed.length = 0;
      return 'wrong';
    }
    this.pressed.push(pin);
    return this.isOpen ? 'open' : 'set';
  }
}
