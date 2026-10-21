import type { Character } from './character';
import type { ItemContainer } from './container';
import { getItem } from './items';
import { failure, success, type ActionResult } from './result';

/** Anything the loot screen can open: a chest, a corpse. */
export interface Lootable {
  readonly name: string;
  readonly contents: ItemContainer;
  /** The group it belongs to, if any: taking from it is stealing (see GridMap.noticeTheft). */
  readonly owner?: string;
}

/**
 * What the player put into someone else's container during one visit to the loot screen:
 * taking that back out again isn't stealing.
 */
export class OwnStash {
  private readonly own = new Map<string, number>();

  stored(itemId: string, quantity: number): void {
    this.own.set(itemId, (this.own.get(itemId) ?? 0) + quantity);
  }

  /** Records that `quantity` of an item was taken out; returns how many of those weren't the player's own. */
  took(itemId: string, quantity: number): number {
    const mine = Math.min(this.own.get(itemId) ?? 0, quantity);
    this.own.set(itemId, (this.own.get(itemId) ?? 0) - mine);
    return quantity - mine;
  }
}

/** How much of a stack one transfer moves: a single item, half the stack (rounded up), or all of it. */
export type TransferAmount = 'one' | 'half' | 'all';

export function transferQuantity(stackSize: number, amount: TransferAmount): number {
  switch (amount) {
    case 'one':
      return Math.min(1, stackSize);
    case 'half':
      return Math.ceil(stackSize / 2);
    case 'all':
      return stackSize;
  }
}

/** Moves up to `quantity` items from `source` into the player's backpack, as far as the carry limit allows. */
export function takeItem(
  player: Character,
  source: ItemContainer,
  itemId: string,
  quantity = source.count(itemId),
): ActionResult {
  const item = getItem(itemId);
  const available = Math.min(quantity, source.count(itemId));
  if (available === 0) return failure(`There is no ${item.name} here.`);

  const amount = Math.min(available, player.maxCarryable(itemId));
  if (amount === 0) return failure(`The ${item.name} is too heavy to carry.`);

  source.remove(itemId, amount);
  player.backpack.add(itemId, amount);
  if (amount < available) return success(`Took ${amount} of ${available} ${item.name}. You can't carry more.`);
  return success(amount > 1 ? `Took ${amount} ${item.name}.` : `Took the ${item.name}.`);
}

/** Moves items from the player's backpack into `target`. Containers have no weight limit. */
export function storeItem(
  player: Character,
  target: ItemContainer,
  itemId: string,
  quantity = player.backpack.count(itemId),
): ActionResult {
  const item = getItem(itemId);
  if (quantity <= 0 || !player.backpack.remove(itemId, quantity)) return failure(`You don't have that many.`);
  target.add(itemId, quantity);
  return success(quantity > 1 ? `Stored ${quantity} ${item.name}.` : `Stored the ${item.name}.`);
}

/** Takes every stack that fits, skipping the ones that are too heavy. */
export function takeAll(player: Character, source: ItemContainer): ActionResult {
  if (source.isEmpty) return failure("It's empty.");

  let took = 0;
  let leftBehind = false;
  for (const { itemId, quantity } of [...source.items]) {
    const amount = Math.min(quantity, player.maxCarryable(itemId));
    if (amount > 0) {
      source.remove(itemId, amount);
      player.backpack.add(itemId, amount);
      took += amount;
    }
    if (amount < quantity) leftBehind = true;
  }

  if (took === 0) return failure("You can't carry any more.");
  return success(leftBehind ? 'You took what you could carry.' : 'You took everything.');
}
