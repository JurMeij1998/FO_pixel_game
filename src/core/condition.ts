import { conditionOf, getItem, itemIdOf, itemKey, PERFECT, WORN_AT } from './items';

export { WORN_AT };

/**
 * Condition of weapons and armour (items with `durability`): every attack wears the weapon in
 * hand, every hit taken the armour worn, by their `wear` (percent of their full health). Below
 * 35% they work worse, the more so the lower they get: a gun hits less often, does less
 * damage and its reload can take twice the AP; a melee weapon only does less damage; armour
 * protects less. At 0% a weapon is broken and can't be used, and armour has fallen apart and
 * protects nothing, until repaired at a workbench with their `material` (scrap metal, leather):
 * the more worn, and the better the item, the more it takes. Pure, so it can be tested; a
 * condition travels with the item in its key (see itemKey in core/items.ts).
 */

/** A gun's hit chance falls by up to this much (in percentage points) as it nears 0%. */
const MAX_HIT_PENALTY = 30;
/** What's left of a weapon's damage just before it breaks. */
const MIN_DAMAGE_SHARE = 0.5;
/** A gun's chance of a reload taking double the AP, just before it breaks. */
const MAX_SLOW_RELOAD = 0.5;
/** What's left of armour's protection just before it falls apart. */
const MIN_PROTECTION_SHARE = 0.5;
/** What a broken item is still worth, as a share of its value; a perfect one is worth all of it. */
const BROKEN_VALUE_SHARE = 0.1;
export const SCRAP = 'scrap_metal';
/** The materials repairs use, in the order the workbench lists them. */
export const MATERIALS = [SCRAP, 'leather'] as const;

/** How badly worn, from 0 (at 35% or better) to 1 (at 0%). */
export function wornness(condition: number): number {
  return condition >= WORN_AT ? 0 : (WORN_AT - Math.max(0, condition)) / WORN_AT;
}

export function isBroken(condition: number): boolean {
  return condition <= 0;
}

/** Percentage points off a gun's hit chance; melee weapons' aim doesn't suffer. */
export function hitPenalty(condition: number, ranged: boolean): number {
  return ranged ? Math.round(MAX_HIT_PENALTY * wornness(condition)) : 0;
}

/** The share of its damage a weapon still does. */
export function damageShare(condition: number): number {
  return 1 - (1 - MIN_DAMAGE_SHARE) * wornness(condition);
}

/** The chance a gun's reload takes twice the AP. */
export function slowReloadChance(condition: number): number {
  return MAX_SLOW_RELOAD * wornness(condition);
}

/** The share of its Armor Class and Damage Resist armour still gives: none once it has fallen apart. */
export function protectionShare(condition: number): number {
  return isBroken(condition) ? 0 : 1 - (1 - MIN_PROTECTION_SHARE) * wornness(condition);
}

/** The share of its value an item in this condition is worth when bartering. */
export function valueShare(condition: number): number {
  return BROKEN_VALUE_SHARE + (1 - BROKEN_VALUE_SHARE) * (condition / PERFECT);
}

/**
 * The Repair skill a repair's listed cost is for (an average character's: 3 x Intelligence 5).
 * Every point above it makes repairs cheaper, every point below dearer (see repairShare).
 */
export const BASE_REPAIR_SKILL = 15;

/** The share of an item's listed repair cost a repair takes at this Repair skill: 1 at 15%, half at 65%. */
export function repairShare(skill: number): number {
  return Math.max(0.4, Math.min(1.2, 1 - (skill - BASE_REPAIR_SKILL) / 100));
}

/** A full repair's cost in material for someone with this Repair skill: at least 1. */
function repairCostAt(key: string, skill: number): number {
  const cost = getItem(key).durability?.repairCost ?? 0;
  return cost === 0 ? 0 : Math.max(1, Math.round(cost * repairShare(skill)));
}

/** The key the item has after one use's wear (unchanged for anything that doesn't wear). */
export function afterWear(key: string): string {
  const wear = getItem(key).durability?.wear;
  if (!wear) return key;
  return itemKey(itemIdOf(key), conditionOf(key) - wear);
}

/**
 * How much of its material it takes to repair this item to perfect, at this Repair skill: 0 if
 * it is, or it doesn't wear.
 */
export function materialToRepair(key: string, skill = BASE_REPAIR_SKILL): number {
  return Math.ceil((repairCostAt(key, skill) * (PERFECT - conditionOf(key))) / PERFECT);
}

/**
 * The key the item has after repairing it with this much material: each piece restores 100% /
 * its full repair's cost. Rounded up to the tenth a key holds (not to the nearest), so what's
 * left to repair never rounds up to an extra piece: a broken jacket costing 3 leather becomes
 * 33.4% with 1, and then takes 2 more, not 3.
 */
export function afterRepair(key: string, material: number, skill = BASE_REPAIR_SKILL): string {
  const cost = repairCostAt(key, skill);
  if (!cost) return key;
  const condition = conditionOf(key) + (material * PERFECT) / cost;
  // The small margin keeps an exact tenth that floating point puts just above it (50.0000001) where it is.
  return itemKey(itemIdOf(key), Math.ceil(condition * 10 - 1e-6) / 10);
}

/**
 * How an item's condition reads in lists: "62%", or "broken". Rounded down (but never to 0%
 * while it still works), so a label never reads as past a threshold it hasn't reached: 34.5%
 * shows "34%", already worn, and 49.6% "49%", salvaging for 1.
 */
export function conditionLabel(condition: number): string {
  return isBroken(condition) ? 'broken' : `${Math.max(1, Math.floor(condition))}%`;
}
