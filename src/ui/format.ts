import type { ItemStack } from '../core/container';
import { getItem, type ItemDef } from '../core/items';
import type { ListRow } from './widgets';

export function stackLabel(item: ItemDef, quantity: number): string {
  return quantity > 1 ? `${item.name} x${quantity}` : item.name;
}

/** One list row per stack, with the stack's total weight on the right. */
export function stackRows(stacks: ReadonlyArray<Readonly<ItemStack>>): ListRow[] {
  return stacks.map(({ itemId, quantity }) => {
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
