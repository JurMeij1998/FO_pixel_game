import type { Character } from './character';
import type { ItemContainer } from './container';
import { valueShare } from './condition';
import { conditionOf, getItem } from './items';
import { failure, success, type ActionResult } from './result';

/** The currency. Traded as money, never as an item. */
export const CAPS = 'bottle_caps';

/**
 * What one unit costs to buy, in caps. Traders sell above an item's value: 36% above at
 * Charisma 1, down to the plain value at 10 (+4% per point below 10). A worn weapon is worth
 * less (core/condition.ts), both ways.
 */
export function buyPrice(itemId: string, charisma: number): number {
  const markup = 1 + 0.04 * (10 - clampCharisma(charisma));
  return Math.max(1, Math.ceil(worth(itemId) * markup));
}

/**
 * What a trader pays for one unit, in caps: 28% of its value at Charisma 1, up to 55% at 10
 * (+3% per point). Always below the buying price, so buying and selling back never pays.
 */
export function sellPrice(itemId: string, charisma: number): number {
  const share = 0.25 + 0.03 * clampCharisma(charisma);
  return Math.round(worth(itemId) * share);
}

/** An item's value in caps, less for a worn weapon. Takes an item key. */
function worth(key: string): number {
  return getItem(key).value * valueShare(conditionOf(key));
}

/** A trader's repairs cost this share of an item's value times how worn it is, before the Charisma markup. */
const REPAIR_SHARE = 0.5;

/**
 * What a trader charges to repair an item to perfect, in caps: half of its value times how
 * worn it is (a broken pistol costs half the pistol's value), with the same Charisma markup as
 * buying. 0 for anything perfect.
 */
export function repairPrice(key: string, charisma: number): number {
  const worn = (100 - conditionOf(key)) / 100;
  if (worn <= 0) return 0;
  const markup = 1 + 0.04 * (10 - clampCharisma(charisma));
  return Math.max(1, Math.ceil(getItem(key).value * worn * REPAIR_SHARE * markup));
}

function clampCharisma(charisma: number): number {
  return Math.max(1, Math.min(10, charisma));
}

/** Caps the player is carrying. */
export function capsOf(container: ItemContainer): number {
  return container.count(CAPS);
}

/**
 * Buys up to `quantity` of an item from the trader's stock: as many as the player can pay
 * for and carry.
 */
export function buyItem(player: Character, stock: ItemContainer, itemId: string, quantity: number): ActionResult {
  const item = getItem(itemId);
  if (itemId === CAPS) return failure("Caps aren't for sale.");
  const available = Math.min(quantity, stock.count(itemId));
  if (available <= 0) return failure(`There is no ${item.name} for sale.`);

  const price = buyPrice(itemId, player.special.charisma);
  const affordable = Math.min(available, Math.floor(capsOf(player.backpack) / price));
  if (affordable === 0) return failure(`You can't afford the ${item.name} (${price} caps).`);
  const amount = Math.min(affordable, player.maxCarryable(itemId));
  if (amount === 0) return failure(`The ${item.name} is too heavy to carry.`);

  const cost = amount * price;
  player.backpack.remove(CAPS, cost);
  stock.add(CAPS, cost);
  stock.remove(itemId, amount);
  player.backpack.add(itemId, amount);
  const what = amount > 1 ? `${amount} ${item.name}` : `the ${item.name}`;
  const short = amount < available ? (amount < affordable ? " You can't carry more." : " You can't afford more.") : '';
  return success(`Bought ${what} for ${cost} caps.${short}`);
}

/** Sells up to `quantity` of an item from the player's pack: as many as the trader can pay for. */
export function sellItem(player: Character, stock: ItemContainer, itemId: string, quantity: number): ActionResult {
  const item = getItem(itemId);
  if (itemId === CAPS) return failure("Caps aren't for sale.");
  const available = Math.min(quantity, player.backpack.count(itemId));
  if (available <= 0) return failure(`You don't have any ${item.name}.`);

  const price = sellPrice(itemId, player.special.charisma);
  if (price === 0) return failure(`The ${item.name} isn't worth anything to them.`);
  const amount = Math.min(available, Math.floor(capsOf(stock) / price));
  if (amount === 0) return failure(`They can't afford the ${item.name} (${price} caps).`);

  const paid = amount * price;
  stock.remove(CAPS, paid);
  player.backpack.add(CAPS, paid);
  player.backpack.remove(itemId, amount);
  stock.add(itemId, amount);
  const what = amount > 1 ? `${amount} ${item.name}` : `the ${item.name}`;
  return success(`Sold ${what} for ${paid} caps.${amount < available ? " They can't afford more." : ''}`);
}
