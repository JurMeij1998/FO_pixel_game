import { buyItem, buyPrice, CAPS, capsOf, sellItem, sellPrice } from '../core/barter';
import type { Character } from '../core/character';
import type { ItemContainer } from '../core/container';
import { getItem } from '../core/items';
import { transferQuantity, type TransferAmount } from '../core/loot';
import type { ActionResult } from '../core/result';
import { stackLabel } from './format';
import type { ClickModifiers, ListRow } from './widgets';

/**
 * What the loot and barter screens do with a click, kept free of Phaser so it can be tested.
 */

/** Shift moves the whole stack, Ctrl half of it (Shift wins if both are held), a plain click one item. */
export function amountFor(modifiers: ClickModifiers): TransferAmount {
  if (modifiers.shift) return 'all';
  return modifiers.ctrl ? 'half' : 'one';
}

/** One row per stack, caps left out (they're the money), with the price of one unit on the right. */
export function priceRows(container: ItemContainer, price: (itemId: string) => number): ListRow[] {
  return container.items
    .filter((stack) => stack.itemId !== CAPS)
    .map(({ itemId, quantity }) => ({ key: itemId, label: stackLabel(getItem(itemId), quantity), detail: `${price(itemId)}c` }));
}

/** The barter screen's two lists: your pack with what it sells for, their stock with what it costs. */
export function barterRows(player: Character, stock: ItemContainer): { yours: ListRow[]; theirs: ListRow[] } {
  const charisma = player.special.charisma;
  return {
    yours: priceRows(player.backpack, (id) => sellPrice(id, charisma)),
    theirs: priceRows(stock, (id) => buyPrice(id, charisma)),
  };
}

/** The headers over the two lists: caps and carry weight for you, caps for the trader. */
export function barterHeaders(player: Character, traderName: string, stock: ItemContainer): { yours: string; theirs: string } {
  return {
    yours: `YOU  (${capsOf(player.backpack)} caps, ${player.carriedWeight}/${player.carryCapacity} lb)`,
    theirs: `${traderName.toUpperCase()}  (${capsOf(stock)} caps)`,
  };
}

/** A click on the barter screen: on your list it sells, on theirs it buys, as much as the modifiers say. */
export function barterClick(
  side: 'yours' | 'theirs',
  player: Character,
  stock: ItemContainer,
  itemId: string,
  modifiers: ClickModifiers,
): ActionResult {
  const from = side === 'yours' ? player.backpack : stock;
  const quantity = transferQuantity(from.count(itemId), amountFor(modifiers));
  return side === 'yours' ? sellItem(player, stock, itemId, quantity) : buyItem(player, stock, itemId, quantity);
}
