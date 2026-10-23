import { conditionOf, getItem, itemIdOf, itemKey, PERFECT } from './items';

/**
 * Weapon condition: every attack wears the weapon in hand by its `wear` (percent of its full
 * health). At 35% or below it works worse, the more so the lower it gets: a gun hits less
 * often, does less damage and its reload can take twice the AP; a melee weapon only does less
 * damage. At 0% it's broken and can't be used until it's repaired at a workbench, with scrap
 * metal: the more worn the weapon, and the better it is, the more scrap. Pure, so it can be
 * tested; a condition travels with the item in its key (see itemKey in core/items.ts).
 */

/** At or below this condition a weapon starts to work worse. */
export const WORN_AT = 35;
/** A gun's hit chance falls by up to this much (in percentage points) as it nears 0%. */
const MAX_HIT_PENALTY = 30;
/** What's left of a weapon's damage just before it breaks. */
const MIN_DAMAGE_SHARE = 0.5;
/** A gun's chance of a reload taking double the AP, just before it breaks. */
const MAX_SLOW_RELOAD = 0.5;
/** What a broken weapon is still worth, as a share of its value; a perfect one is worth all of it. */
const BROKEN_VALUE_SHARE = 0.1;
export const SCRAP = 'scrap_metal';

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

/** The share of its value an item in this condition is worth when bartering. */
export function valueShare(condition: number): number {
  return BROKEN_VALUE_SHARE + (1 - BROKEN_VALUE_SHARE) * (condition / PERFECT);
}

/** The key the weapon has after one attack's wear (unchanged for anything that doesn't wear). */
export function afterWear(key: string): string {
  const wear = getItem(key).weapon?.wear;
  if (!wear) return key;
  return itemKey(itemIdOf(key), conditionOf(key) - wear);
}

/** Scrap metal it takes to repair this weapon to perfect: 0 if it is, or it isn't a weapon. */
export function scrapToRepair(key: string): number {
  const cost = getItem(key).weapon?.repairCost ?? 0;
  return Math.ceil((cost * (PERFECT - conditionOf(key))) / PERFECT);
}

/** The key the weapon has after repairing it with this much scrap: each piece restores 100% / repairCost. */
export function afterRepair(key: string, scrap: number): string {
  const cost = getItem(key).weapon?.repairCost;
  if (!cost) return key;
  return itemKey(itemIdOf(key), conditionOf(key) + (scrap * PERFECT) / cost);
}

/** How a weapon's condition reads in lists: "62%", or "broken". */
export function conditionLabel(condition: number): string {
  return isBroken(condition) ? 'broken' : `${Math.ceil(condition)}%`;
}
