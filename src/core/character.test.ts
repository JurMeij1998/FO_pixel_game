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

  it('levels up with enough XP, gaining HP and skill points', () => {
    const c = makeCharacter({ endurance: 6, intelligence: 7 });
    const maxBefore = c.maxHitPoints;
    c.hitPoints = 10;

    expect(c.gainExperience(99)).toBe(0);
    expect(c.level).toBe(1);
    expect(c.gainExperience(1)).toBe(1); // 100 XP reaches level 2
    expect(c.level).toBe(2);
    expect(c.maxHitPoints).toBe(maxBefore + 6); // 3 + END/2
    expect(c.hitPoints).toBe(16);
    expect(c.skillPoints).toBe(19); // 5 + 2 * INT
    expect(c.experienceForNextLevel).toBe(300);
  });

  it('can gain several levels at once', () => {
    const c = makeCharacter();
    expect(c.gainExperience(650)).toBe(3);
    expect(c.level).toBe(4);
  });

  it('spends skill points, tagged skills twice as fast', () => {
    const c = makeCharacter();
    c.taggedSkills.add('smallGuns');
    c.skillPoints = 2;
    const guns = c.skill('smallGuns');
    const melee = c.skill('meleeWeapons');
    c.improveSkill('smallGuns');
    c.improveSkill('meleeWeapons');
    expect(c.skill('smallGuns')).toBe(guns + 2);
    expect(c.skill('meleeWeapons')).toBe(melee + 1);
    expect(c.improveSkill('unarmed').ok).toBe(false);
  });

  describe('magazines', () => {
    function gunner(rounds: number): Character {
      const c = makeCharacter();
      c.backpack.add('10mm_pistol'); // magazine of 12
      if (rounds > 0) c.backpack.add('ammo_10mm', rounds);
      c.equip('10mm_pistol', 'primary');
      return c;
    }

    it('starts empty and reloads from the backpack', () => {
      const c = gunner(20);
      expect(c.loadedRounds()).toBe(0);
      expect(c.reload().ok).toBe(true);
      expect(c.loadedRounds()).toBe(12);
      expect(c.backpack.count('ammo_10mm')).toBe(8);
      expect(c.reload().ok).toBe(false); // already full
    });

    it('loads what it can when ammo runs short', () => {
      const c = gunner(5);
      c.reload();
      expect(c.loadedRounds()).toBe(5);
      expect(c.backpack.count('ammo_10mm')).toBe(0);
      expect(c.spendRound()).toBe(true);
      expect(c.loadedRounds()).toBe(4);
      expect(c.reload().ok).toBe(false); // nothing left to load
    });

    it('returns loaded rounds to the backpack when the gun is unequipped or replaced', () => {
      const c = gunner(12);
      c.reload();
      c.unequip('primary');
      expect(c.backpack.count('ammo_10mm')).toBe(12);

      c.equip('10mm_pistol', 'primary');
      c.reload();
      c.backpack.add('knife');
      c.equip('knife', 'primary');
      expect(c.backpack.count('ammo_10mm')).toBe(12);
      expect(c.loadedRounds()).toBe(0);
    });

    it('has nothing to reload for melee weapons', () => {
      const c = makeCharacter();
      c.backpack.add('knife');
      c.equip('knife', 'primary');
      expect(c.reload().ok).toBe(false);
    });
  });

  it('computes how many more items fit', () => {
    const c = makeCharacter({ strength: 1 }); // 50 lb capacity
    c.backpack.add('scrap_metal', 5); // 30 lb
    expect(c.maxCarryable('scrap_metal')).toBe(3);
    expect(c.maxCarryable('stimpak')).toBe(Infinity);
  });
});
