import { describe, expect, it } from 'vitest';
import { ItemContainer } from './container';

describe('ItemContainer', () => {
  it('merges identical items into one stack', () => {
    const bag = new ItemContainer([['stimpak', 2]]);
    bag.add('stimpak', 3);
    expect(bag.items).toEqual([{ itemId: 'stimpak', quantity: 5 }]);
  });

  it('removes a stack once it reaches zero', () => {
    const bag = new ItemContainer([['knife', 1]]);
    expect(bag.remove('knife')).toBe(true);
    expect(bag.isEmpty).toBe(true);
  });

  it('refuses to remove more than it holds', () => {
    const bag = new ItemContainer([['rope', 1]]);
    expect(bag.remove('rope', 2)).toBe(false);
    expect(bag.count('rope')).toBe(1);
  });

  it('sums weight over quantities', () => {
    const bag = new ItemContainer([
      ['scrap_metal', 3], // 6 lb each
      ['knife', 1], // 1 lb
    ]);
    expect(bag.totalWeight()).toBe(19);
  });

  it('rejects unknown items and bad quantities', () => {
    const bag = new ItemContainer();
    expect(() => bag.add('plasma_rifle_of_doom')).toThrow();
    expect(() => bag.add('knife', 0)).toThrow(RangeError);
    expect(() => bag.add('knife', 1.5)).toThrow(RangeError);
  });
});
