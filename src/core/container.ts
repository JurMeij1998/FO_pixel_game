import { getItem } from './items';

export interface ItemStack {
  readonly itemId: string;
  quantity: number;
}

/**
 * An unlimited bag of item stacks: a backpack, a chest, a corpse.
 * Weight limits are the carrier's concern (see Character), not the container's.
 * Identical items always share one stack, like in Fallout 1/2.
 */
export class ItemContainer {
  private readonly stacks: ItemStack[] = [];

  constructor(initial: ReadonlyArray<readonly [itemId: string, quantity: number]> = []) {
    for (const [itemId, quantity] of initial) this.add(itemId, quantity);
  }

  get items(): ReadonlyArray<Readonly<ItemStack>> {
    return this.stacks;
  }

  get isEmpty(): boolean {
    return this.stacks.length === 0;
  }

  count(itemId: string): number {
    return this.stacks.find((stack) => stack.itemId === itemId)?.quantity ?? 0;
  }

  add(itemId: string, quantity = 1): void {
    assertQuantity(quantity);
    getItem(itemId); // throws on unknown ids
    const stack = this.stacks.find((s) => s.itemId === itemId);
    if (stack) stack.quantity += quantity;
    else this.stacks.push({ itemId, quantity });
  }

  /** Returns false, and changes nothing, if there aren't that many. */
  remove(itemId: string, quantity = 1): boolean {
    assertQuantity(quantity);
    const index = this.stacks.findIndex((s) => s.itemId === itemId);
    if (index < 0 || this.stacks[index].quantity < quantity) return false;
    this.stacks[index].quantity -= quantity;
    if (this.stacks[index].quantity === 0) this.stacks.splice(index, 1);
    return true;
  }

  totalWeight(): number {
    return this.stacks.reduce((sum, s) => sum + getItem(s.itemId).weight * s.quantity, 0);
  }
}

function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError(`Invalid item quantity ${quantity}`);
  }
}
