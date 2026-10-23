import type { Character, WeaponSlot } from './character';
import { afterRepair, conditionLabel, SCRAP, scrapToRepair } from './condition';
import { conditionOf, getItem } from './items';
import { failure, success, type ActionResult } from './result';

/**
 * Repairing weapons at a workbench, with scrap metal from the backpack (core/condition.ts says
 * how much each takes). A weapon is mended as far as the scrap goes: short of a full repair,
 * every piece still helps. Weapons in either hand and in the backpack can be repaired. Pure, so
 * it can be tested; the workbench screen lists them and calls repairWeapon.
 */

/** A weapon to repair: the one in a hand, or one in the backpack (by its key, condition included). */
export type RepairTarget = { slot: WeaponSlot } | { key: string };

export interface Repairable {
  target: RepairTarget;
  /** The weapon's key: its id, with its condition if it's worn. */
  key: string;
  /** Scrap metal a full repair takes; 0 when it's perfect. */
  scrap: number;
}

/** Every weapon the player has, in hand first, then in the backpack. */
export function repairables(player: Character): Repairable[] {
  const list: Repairable[] = [];
  for (const slot of ['primary', 'secondary'] as const) {
    const key = player.equippedKey(slot);
    if (key) list.push({ target: { slot }, key, scrap: scrapToRepair(key) });
  }
  for (const { itemId: key } of player.backpack.items) {
    if (getItem(key).weapon) list.push({ target: { key }, key, scrap: scrapToRepair(key) });
  }
  return list;
}

/**
 * Repairs a weapon with as much of the player's scrap metal as it takes, or as there is. On
 * success `repaired` is the weapon's new key (its condition is in it).
 */
export function repairWeapon(player: Character, target: RepairTarget): ActionResult & { repaired?: string } {
  const key = 'slot' in target ? player.equippedKey(target.slot) : target.key;
  if (!key || !getItem(key).weapon) return failure('There is nothing to repair there.');
  if ('key' in target && player.backpack.count(key) === 0) return failure(`You don't have that ${getItem(key).name}.`);
  const name = getItem(key).name;
  const needed = scrapToRepair(key);
  if (needed === 0) return failure(`The ${name} is in perfect condition.`);
  const scrap = Math.min(needed, player.backpack.count(SCRAP));
  if (scrap === 0) return failure(`Repairing the ${name} takes ${needed} scrap metal, and you have none.`);

  player.backpack.remove(SCRAP, scrap);
  const repaired = afterRepair(key, scrap);
  if ('slot' in target) {
    player.replaceEquipped(target.slot, repaired);
  } else {
    player.backpack.remove(key);
    player.backpack.add(repaired);
  }
  const condition = conditionLabel(conditionOf(repaired));
  const message =
    scrap < needed
      ? `You patch up the ${name} with ${scrap} scrap metal: ${condition}. A full repair takes ${needed}.`
      : `You repair the ${name} with ${scrap} scrap metal: good as new.`;
  return { ...success(message), repaired };
}
