import { conditionLabel, isBroken, WORN_AT } from '../core/condition';
import type { ItemStack } from '../core/container';
import { conditionOf, getItem, PERFECT, type ItemCategory } from '../core/items';
import type { ListRow } from './widgets';

/** The order lists show items in, as in Fallout 2: weapons, armour, aid, ammo, then the rest. */
const CATEGORY_ORDER: readonly ItemCategory[] = ['weapon', 'armor', 'consumable', 'ammo', 'misc'];

/**
 * Stacks in the order every list shows them: by category (see CATEGORY_ORDER), then by name,
 * then the best condition first. Containers keep items in the order they were added; only the
 * lists are sorted.
 */
export function sortedStacks<T extends Readonly<ItemStack>>(stacks: readonly T[]): T[] {
  const rank = (stack: T) => CATEGORY_ORDER.indexOf(getItem(stack.itemId).category);
  return [...stacks].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      getItem(a.itemId).name.localeCompare(getItem(b.itemId).name) ||
      conditionOf(b.itemId) - conditionOf(a.itemId),
  );
}

/** An item's name as lists show it, from its key: with its condition if it's worn ("10mm Pistol (62%)"). */
export function itemName(key: string): string {
  const condition = conditionOf(key);
  const name = getItem(key).name;
  return condition < PERFECT ? `${name} (${conditionLabel(condition)})` : name;
}

export function stackLabel(key: string, quantity: number): string {
  return quantity > 1 ? `${itemName(key)} x${quantity}` : itemName(key);
}

/** One list row per stack, sorted (see sortedStacks), with the stack's total weight on the right. */
export function stackRows(stacks: ReadonlyArray<Readonly<ItemStack>>): ListRow[] {
  return sortedStacks(stacks).map(({ itemId, quantity }) => {
    const item = getItem(itemId);
    return { key: itemId, label: stackLabel(itemId, quantity), detail: `${item.weight * quantity} lb` };
  });
}

/** The details pane's text for an item, from its key: a weapon's condition, and what wear does to it, included. */
export function describeItem(key: string): string {
  const item = getItem(key);
  const lines = [item.name.toUpperCase(), item.description, ''];
  if (item.weapon) {
    const w = item.weapon;
    lines.push(`Damage ${w.damageMin}-${w.damageMax}   AP ${w.apCost}   Range ${w.range}`);
    if (w.ammo) lines.push(`Ammo: ${getItem(w.ammo).name}   Magazine ${w.magazineSize}`);
    const condition = conditionOf(key);
    const state = isBroken(condition)
      ? ': repair it at a workbench'
      : condition <= WORN_AT
        ? `: badly worn, ${w.ammo ? 'it hits less often, less hard, and can be slow to reload' : 'it hits less hard'}`
        : '';
    lines.push(`Condition ${conditionLabel(condition)}${state}`);
  }
  if (item.armor) lines.push(`AC +${item.armor.armorClass}   DR ${item.armor.damageResist}%`);
  if (item.consumable) lines.push(`Heals ${item.consumable.heal} HP`);
  lines.push(`Weight ${item.weight} lb   Value ${item.value} caps`);
  return lines.join('\n');
}
