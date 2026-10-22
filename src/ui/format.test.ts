import { describe, expect, it } from 'vitest';
import { sortedStacks, stackRows } from './format';

describe('item lists', () => {
  it('are sorted by category, Fallout 2 style: weapons, armour, aid, ammo, the rest', () => {
    const stacks = [
      { itemId: 'bottle_caps', quantity: 20 },
      { itemId: 'ammo_10mm', quantity: 12 },
      { itemId: 'stimpak', quantity: 1 },
      { itemId: 'leather_jacket', quantity: 1 },
      { itemId: 'knife', quantity: 1 },
    ];
    expect(sortedStacks(stacks).map((s) => s.itemId)).toEqual(['knife', 'leather_jacket', 'stimpak', 'ammo_10mm', 'bottle_caps']);
  });

  it('are sorted by name within a category', () => {
    const weapons = [
      { itemId: 'spear', quantity: 1 },
      { itemId: 'hunting_rifle', quantity: 1 },
      { itemId: 'knife', quantity: 1 },
      { itemId: '10mm_pistol', quantity: 1 },
    ];
    expect(sortedStacks(weapons).map((s) => s.itemId)).toEqual(['10mm_pistol', 'hunting_rifle', 'knife', 'spear']);
  });

  it("leave the container's own order alone", () => {
    const stacks = [
      { itemId: 'rope', quantity: 1 },
      { itemId: 'knife', quantity: 1 },
    ];
    expect(stackRows(stacks).map((r) => r.key)).toEqual(['knife', 'rope']);
    expect(stacks.map((s) => s.itemId)).toEqual(['rope', 'knife']);
  });
});
