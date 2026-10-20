/**
 * A seeded pseudo-random number generator (mulberry32). The same seed always gives the same
 * sequence, which is what lets a generated map be rebuilt from its seed instead of being saved.
 * Map generation must only ever use one of these, never Math.random.
 */
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** A number in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** A whole number from min to max, both included. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with the given probability (0 to 1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from an empty list');
    return items[Math.floor(this.next() * items.length)];
  }

  /** Picks an item with a probability proportional to its weight. */
  pickWeighted<T extends { weight: number }>(items: readonly T[]): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    if (total <= 0) throw new Error('Cannot pick from items without weight');
    let roll = this.next() * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll < 0) return item;
    }
    return items[items.length - 1];
  }
}

/** Mixes strings and numbers into a 32-bit seed (FNV-1a), e.g. a world seed plus a map id. */
export function hashSeed(...parts: Array<string | number>): number {
  let hash = 2166136261;
  for (const char of parts.join('|')) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
