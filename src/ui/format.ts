import type { ItemStack } from '../core/container';
import { getItem, type ItemCategory, type ItemDef } from '../core/items';
import type { ListRow } from './widgets';

/** The order lists show items in, as in Fallout 2: weapons, armour, aid, ammo, then the rest. */
const CATEGORY_ORDER: readonly ItemCategory[] = ['weapon', 'armor', 'consumable', 'ammo', 'misc'];

/**
 * Stacks in the order every list shows them: by category (see CATEGORY_ORDER), then by name.
 * Containers keep items in the order they were added; only the lists are sorted.
 */
export function sortedStacks<T extends Readonly<ItemStack>>(stacks: readonly T[]): T[] {
  const rank = (stack: T) => CATEGORY_ORDER.indexOf(getItem(stack.itemId).category);
  return [...stacks].sort(
    (a, b) => rank(a) - rank(b) || getItem(a.itemId).name.localeCompare(getItem(b.itemId).name),
  );
}

export function stackLabel(item: ItemDef, quantity: number): string {
  return quantity > 1 ? `${item.name} x${quantity}` : item.name;
}

/** One list row per stack, sorted (see sortedStacks), with the stack's total weight on the right. */
export function stackRows(stacks: ReadonlyArray<Readonly<ItemStack>>): ListRow[] {
  return sortedStacks(stacks).map(({ itemId, quantity }) => {
    const item = getItem(itemId);
    return { key: itemId, label: stackLabel(item, quantity), detail: `${item.weight * quantity} lb` };
  });
}

export function describeItem(item: ItemDef): string {
  const lines = [item.name.toUpperCase(), item.description, ''];
  if (item.weapon) {
    const w = item.weapon;
    lines.push(`Damage ${w.damageMin}-${w.damageMax}   AP ${w.apCost}   Range ${w.range}`);
    if (w.ammo) lines.push(`Ammo: ${getItem(w.ammo).name}   Magazine ${w.magazineSize}`);
  }
  if (item.armor) lines.push(`AC +${item.armor.armorClass}   DR ${item.armor.damageResist}%`);
  if (item.consumable) lines.push(`Heals ${item.consumable.heal} HP`);
  lines.push(`Weight ${item.weight} lb   Value ${item.value} caps`);
  return lines.join('\n');
}
