import { EQUIP_SLOTS, type Character, type EquipSlot } from './character';
import { afterRepair, conditionLabel, materialToRepair } from './condition';
import { conditionOf, getItem } from './items';
import { failure, success, type ActionResult } from './result';

/**
 * Repairing gear at a workbench, with its material from the backpack: scrap metal for weapons
 * and steel armour, leather for leather armour (core/condition.ts says how much each takes).
 * An item is mended as far as the material goes: short of a full repair, every piece still
 * helps. Gear can also be salvaged for a little of that material. What's equipped (both
 * hands, the armour worn) and what's in the backpack can be repaired or salvaged. Pure, so it
 * can be tested; the workbench screen lists it all and calls repairItem and salvageItem.
 */

/** Something to repair: what's in an equipment slot, or an item in the backpack (by its key, condition included). */
export type RepairTarget = { slot: EquipSlot } | { key: string };

export interface Repairable {
  target: RepairTarget;
  /** The item's key: its id, with its condition if it's worn. */
  key: string;
  /** The item a repair uses up (scrap metal, leather). */
  material: string;
  /** How much of it a full repair takes; 0 when it's perfect. */
  amount: number;
}

/** Everything the player has that wears: what's equipped first (hands, then armour), then the backpack. */
export function repairables(player: Character): Repairable[] {
  const list: Repairable[] = [];
  const add = (target: RepairTarget, key: string) => {
    const durability = getItem(key).durability;
    if (durability) list.push({ target, key, material: durability.material, amount: materialToRepair(key) });
  };
  for (const slot of EQUIP_SLOTS) {
    const key = player.equippedKey(slot);
    if (key) add({ slot }, key);
  }
  for (const { itemId: key } of player.backpack.items) add({ key }, key);
  return list;
}

/** "scrap metal", "leather": how a material is named in messages. */
export function materialName(material: string): string {
  return getItem(material).name.toLowerCase();
}

/**
 * Repairs an item with as much of its material as it takes, or as the player has. On success
 * `repaired` is the item's new key (its condition is in it).
 */
export function repairItem(player: Character, target: RepairTarget): ActionResult & { repaired?: string } {
  const key = 'slot' in target ? player.equippedKey(target.slot) : target.key;
  const durability = key ? getItem(key).durability : undefined;
  if (!key || !durability) return failure('There is nothing to repair there.');
  if ('key' in target && player.backpack.count(key) === 0) return failure(`You don't have that ${getItem(key).name}.`);
  const name = getItem(key).name;
  const material = materialName(durability.material);
  const needed = materialToRepair(key);
  if (needed === 0) return failure(`The ${name} is in perfect condition.`);
  const used = Math.min(needed, player.backpack.count(durability.material));
  if (used === 0) return failure(`Repairing the ${name} takes ${needed} ${material}, and you have none.`);

  player.backpack.remove(durability.material, used);
  const repaired = afterRepair(key, used);
  if ('slot' in target) {
    player.replaceEquipped(target.slot, repaired);
  } else {
    player.backpack.remove(key);
    player.backpack.add(repaired);
  }
  const condition = conditionLabel(conditionOf(repaired));
  const message =
    used < needed
      ? `You patch up the ${name} with ${used} ${material}: ${condition}. A full repair takes ${needed}.`
      : `You repair the ${name} with ${used} ${material}: good as new.`;
  return { ...success(message), repaired };
}

/** Below this condition an item salvages for 1 piece of its material, at or above it for 2. */
export const SALVAGE_GOOD_FROM = 50;

/**
 * What salvaging an item gives: a little of the material it's repaired with (scrap metal,
 * leather), 1 piece when it's below 50% and 2 otherwise; null for things that don't wear.
 */
export function salvageYield(key: string): { material: string; amount: number } | null {
  const material = getItem(key).durability?.material;
  if (!material) return null;
  return { material, amount: conditionOf(key) < SALVAGE_GOOD_FROM ? 1 : 2 };
}

/**
 * Breaks an item down for its material, for good. Something equipped comes off first (a gun's
 * rounds go back to the backpack, as when unequipping it).
 */
export function salvageItem(player: Character, target: RepairTarget): ActionResult {
  const key = 'slot' in target ? player.equippedKey(target.slot) : target.key;
  const salvage = key ? salvageYield(key) : null;
  if (!key || !salvage) return failure('There is nothing to salvage there.');
  if ('key' in target && player.backpack.count(key) === 0) return failure(`You don't have that ${getItem(key).name}.`);
  if ('slot' in target) player.unequip(target.slot);
  player.backpack.remove(key);
  player.backpack.add(salvage.material, salvage.amount);
  return success(`You salvage the ${getItem(key).name} for ${salvage.amount} ${materialName(salvage.material)}.`);
}
