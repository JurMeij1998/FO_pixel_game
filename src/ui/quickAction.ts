import type { SoundName } from '../audio/sfx';
import type { Character, EquipSlot, WeaponSlot } from '../core/character';
import { getItem } from '../core/items';
import { failure, type ActionResult } from '../core/result';

/**
 * What E does on the inventory screen with the row the cursor is on: the obvious thing for
 * that item. Pure (no Phaser), so it can be tested; the scene runs it and plays its sound.
 */

export type InventoryRow = { kind: 'backpack'; itemId: string } | { kind: 'slot'; slot: EquipSlot };

export interface QuickAction {
  run: () => ActionResult;
  sound?: SoundName;
}

/**
 * The weapon slot a weapon goes in when you just equip it: the first empty one (primary, then
 * secondary), or primary if both hands are full (what was there goes back in the backpack).
 */
export function weaponSlotFor(player: Character): WeaponSlot {
  if (!player.equippedItem('primary')) return 'primary';
  if (!player.equippedItem('secondary')) return 'secondary';
  return 'primary';
}

/**
 * E on a row: use a stimpak (or anything else usable), equip a weapon (see weaponSlotFor) or
 * wear armour from the backpack; unequip what's in an equipment slot. Items with nothing to
 * do (ammo, caps, junk) get a refusal that says so.
 */
export function quickAction(player: Character, row: InventoryRow): QuickAction {
  if (row.kind === 'slot') {
    const equipped = player.equippedItem(row.slot);
    if (!equipped) return { run: () => failure('Nothing is equipped there.') };
    return { run: () => player.unequip(row.slot), sound: 'equip' };
  }
  const { itemId } = row;
  const item = getItem(itemId);
  if (item.consumable) return { run: () => player.use(itemId), sound: 'stimpak' };
  if (item.category === 'weapon') return { run: () => player.equip(itemId, weaponSlotFor(player)), sound: 'equip' };
  if (item.category === 'armor') return { run: () => player.equip(itemId, 'armor'), sound: 'equip' };
  return { run: () => failure(`There's nothing to do with the ${item.name} here.`) };
}
