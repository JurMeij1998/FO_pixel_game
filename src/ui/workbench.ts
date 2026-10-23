import type { Character } from '../core/character';
import { conditionLabel, materialToRepair } from '../core/condition';
import { conditionOf, getItem } from '../core/items';
import { materialName, repairables, type RepairTarget } from '../core/repair';
import type { ListRow } from './widgets';

/** A row of the workbench screen: something to repair, and where it is. */
export interface WorkbenchRow extends ListRow {
  target: RepairTarget;
  /** The item's key (condition included). */
  itemKey: string;
}

/**
 * The workbench screen's list: what you have equipped first (hands, then armour), then the
 * backpack by name and condition, each with its condition on the right ("30%", "broken").
 * Rows are keyed by where the item is, so a repaired one keeps its place.
 */
export function workbenchRows(player: Character): WorkbenchRow[] {
  const all = repairables(player);
  const equipped = all.filter((r) => 'slot' in r.target);
  const packed = all
    .filter((r) => 'key' in r.target)
    .sort((a, b) => getItem(a.key).name.localeCompare(getItem(b.key).name) || conditionOf(b.key) - conditionOf(a.key));
  return [...equipped, ...packed].map(({ target, key }) => {
    const where =
      !('slot' in target) ? ''
      : target.slot === 'armor' ? ' (wearing)'
      : target.slot === player.activeWeaponSlot ? ' (in hand)'
      : ' (other hand)';
    return {
      key: 'slot' in target ? `slot:${target.slot}` : `pack:${key}`,
      label: `${getItem(key).name}${where}`,
      detail: conditionLabel(conditionOf(key)),
      target,
      itemKey: key,
    };
  });
}

/** What repairing an item to perfect takes, for under its details: "Repair costs: 4 leather"; nothing when there's nothing to repair. */
export function repairCostLine(key: string): string {
  const material = getItem(key).durability?.material;
  const amount = materialToRepair(key);
  return material && amount > 0 ? `Repair costs: ${amount} ${materialName(material)}` : '';
}
