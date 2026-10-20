import { describe, expect, it } from 'vitest';
import { Character } from './character';
import type { Special } from './stats';

const AVERAGE: Special = {
  strength: 5,
  perception: 5,
  endurance: 5,
  charisma: 5,
  intelligence: 5,
  agility: 5,
  luck: 5,
};

function makeCharacter(overrides: Partial<Special> = {}): Character {
  return new Character('Test', { ...AVERAGE, ...overrides });
}

describe('Character', () => {
  it('derives stats with the Fallout formulas', () => {
    const c = makeCharacter({ strength: 4, endurance: 6, agility: 7 });
    expect(c.carryCapacity).toBe(125);
    expect(c.maxHitPoints).toBe(31);
    expect(c.maxActionPoints).toBe(8);
    expect(c.hitPoints).toBe(31);
  });

  it('equips a weapon out of the backpack', () => {
    const c = makeCharacter();
    c.backpack.add('knife');
    expect(c.equip('knife', 'primary').ok).toBe(true);
    expect(c.equippedItem('primary')?.id).toBe('knife');
    expect(c.backpack.count('knife')).toBe(0);
    expect(c.activeWeapon?.id).toBe('knife');
  });

  it('puts the previously equipped item back when swapping', () => {
    const c = makeCharacter();
    c.backpack.add('knife');
    c.backpack.add('spear');
    c.equip('knife', 'primary');
    c.equip('spear', 'primary');
    expect(c.equippedItem('primary')?.id).toBe('spear');
    expect(c.backpack.count('knife')).toBe(1);
  });

  it('only accepts items that fit the slot', () => {
    const c = makeCharacter();
    c.backpack.add('leather_jacket');
    c.backpack.add('knife');
    expect(c.equip('leather_jacket', 'primary').ok).toBe(false);
    expect(c.equip('knife', 'armor').ok).toBe(false);
    expect(c.equip('leather_jacket', 'armor').ok).toBe(true);
    expect(c.armorClass).toBe(5 + 8);
  });

  it('cannot equip what it does not carry', () => {
    expect(makeCharacter().equip('knife', 'primary').ok).toBe(false);
  });

  it('counts equipped items towards carried weight', () => {
    const c = makeCharacter();
    c.backpack.add('hunting_rifle'); // 9 lb
    c.backpack.add('leather_armor'); // 8 lb
    c.equip('hunting_rifle', 'secondary');
    c.equip('leather_armor', 'armor');
    expect(c.carriedWeight).toBe(17);
  });

  it('swaps between the two weapon slots', () => {
    const c = makeCharacter();
    c.backpack.add('knife');
    c.equip('knife', 'secondary');
    expect(c.activeWeapon).toBeNull();
    c.swapWeapons();
    expect(c.activeWeaponSlot).toBe('secondary');
    expect(c.activeWeapon?.id).toBe('knife');
  });

  it('heals with a stimpak, capped at max HP', () => {
    const c = makeCharacter();
    c.backpack.add('stimpak', 2);
    expect(c.use('stimpak').ok).toBe(false); // already at full health

    c.hitPoints = c.maxHitPoints - 5;
    const result = c.use('stimpak');
    expect(result.ok).toBe(true);
    expect(result.message).toContain('heal 5 HP');
    expect(c.hitPoints).toBe(c.maxHitPoints);
    expect(c.backpack.count('stimpak')).toBe(1);
  });

  it('attacks with fists when the hand is empty, using tagged skills', () => {
    const c = makeCharacter();
    expect(c.attack).toMatchObject({ name: 'Fists', hitChance: 30 + 2 * (5 + 5) });

    c.backpack.add('10mm_pistol');
    c.equip('10mm_pistol', 'primary');
    c.taggedSkills.add('smallGuns');
    expect(c.attack).toMatchObject({ name: '10mm Pistol', ammo: 'ammo_10mm', apCost: 5, hitChance: 5 + 4 * 5 + 20 });
  });

  it('computes how many more items fit', () => {
    const c = makeCharacter({ strength: 1 }); // 50 lb capacity
    c.backpack.add('scrap_metal', 5); // 30 lb
    expect(c.maxCarryable('scrap_metal')).toBe(3);
    expect(c.maxCarryable('stimpak')).toBe(Infinity);
  });
});
