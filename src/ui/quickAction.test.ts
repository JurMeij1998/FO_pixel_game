import { describe, expect, it } from 'vitest';
import { Character } from '../core/character';
import { quickAction, weaponSlotFor } from './quickAction';

function survivor(): Character {
  const player = new Character('Survivor', {
    strength: 5,
    perception: 5,
    endurance: 5,
    charisma: 5,
    intelligence: 5,
    agility: 5,
    luck: 5,
  });
  for (const id of ['knife', 'spear', '10mm_pistol', 'leather_jacket', 'stimpak', 'ammo_10mm', 'bottle_caps']) {
    player.backpack.add(id);
  }
  return player;
}

const fromPack = (itemId: string) => ({ kind: 'backpack' as const, itemId });

describe('E in the inventory', () => {
  it('uses a stimpak', () => {
    const player = survivor();
    player.hitPoints = 5;
    const action = quickAction(player, fromPack('stimpak'));
    expect(action.run().ok).toBe(true);
    expect(player.hitPoints).toBeGreaterThan(5);
    expect(player.backpack.count('stimpak')).toBe(0);
    expect(action.sound).toBe('stimpak');
  });

  it('equips a weapon in the first free hand: primary, then secondary', () => {
    const player = survivor();
    quickAction(player, fromPack('knife')).run();
    expect(player.equippedItem('primary')?.id).toBe('knife');
    quickAction(player, fromPack('10mm_pistol')).run();
    expect(player.equippedItem('secondary')?.id).toBe('10mm_pistol');
  });

  it('with both hands full, swaps out the weapon in hand: the primary one by default', () => {
    const player = survivor();
    player.equip('knife', 'primary');
    player.equip('10mm_pistol', 'secondary');
    expect(weaponSlotFor(player)).toBe('primary');
    const result = quickAction(player, fromPack('spear')).run();
    expect(result.message).toBe('Equipped the Spear in your primary hand.');
    expect(player.equippedItem('primary')?.id).toBe('spear');
    expect(player.equippedItem('secondary')?.id).toBe('10mm_pistol');
    expect(player.backpack.count('knife')).toBe(1); // back in the pack
  });

  it('with both hands full and the secondary weapon in hand, swaps out that one', () => {
    const player = survivor();
    player.equip('knife', 'primary');
    player.equip('10mm_pistol', 'secondary');
    player.swapWeapons(); // the pistol in hand
    const result = quickAction(player, fromPack('spear')).run();
    expect(result.message).toBe('Equipped the Spear in your secondary hand.');
    expect(player.equippedItem('secondary')?.id).toBe('spear');
    expect(player.equippedItem('primary')?.id).toBe('knife'); // left alone
    expect(player.attack.name).toBe('Spear'); // and it's what you're holding now
    expect(player.backpack.count('10mm_pistol')).toBe(1);
  });

  it('fills the secondary slot when only that one is free', () => {
    const player = survivor();
    player.equip('spear', 'primary');
    const result = quickAction(player, fromPack('knife')).run();
    expect(result.message).toBe('Equipped the Knife in your secondary hand.');
    expect(player.equippedItem('secondary')?.id).toBe('knife');
    expect(player.equippedItem('primary')?.id).toBe('spear');
  });

  it("keeps a gun's reload hint after saying which hand", () => {
    const result = quickAction(survivor(), fromPack('10mm_pistol')).run();
    expect(result.message).toBe("Equipped the 10mm Pistol in your primary hand. It's empty: press R to reload.");
  });

  it('wears armour', () => {
    const player = survivor();
    quickAction(player, fromPack('leather_jacket')).run();
    expect(player.equippedItem('armor')?.id).toBe('leather_jacket');
  });

  it('unequips what is in a slot, and says so when the slot is empty', () => {
    const player = survivor();
    player.equip('knife', 'primary');
    expect(quickAction(player, { kind: 'slot', slot: 'primary' }).run().ok).toBe(true);
    expect(player.equippedItem('primary')).toBeNull();
    expect(player.backpack.count('knife')).toBe(1);
    expect(quickAction(player, { kind: 'slot', slot: 'armor' }).run()).toMatchObject({ ok: false });
  });

  it('does nothing with ammo or caps, and says so', () => {
    const player = survivor();
    expect(quickAction(player, fromPack('ammo_10mm')).run()).toMatchObject({ ok: false, message: expect.stringMatching(/nothing to do/) });
    expect(quickAction(player, fromPack('bottle_caps')).run().ok).toBe(false);
    expect(player.backpack.count('ammo_10mm')).toBe(1);
  });
});
