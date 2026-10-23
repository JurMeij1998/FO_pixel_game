import type { Character } from '../core/character';
import { conditionOf, getItem } from '../core/items';
import { repairables, type RepairTarget } from '../core/repair';
import { itemName } from './format';
import type { ListRow } from './widgets';

/** A row of the workbench screen: a weapon to repair, and where it is. */
export interface WorkbenchRow extends ListRow {
  target: RepairTarget;
  /** The weapon's item key (condition included). */
  itemKey: string;
}

/**
 * The workbench screen's list: the weapons in your hands first, then the ones in the backpack
 * by name and condition, each with the scrap metal its repair takes ("ok" when it's perfect).
 * Rows are keyed by where the weapon is, so a repaired one keeps its place.
 */
export function workbenchRows(player: Character): WorkbenchRow[] {
  const all = repairables(player);
  const inHand = all.filter((r) => 'slot' in r.target);
  const packed = all
    .filter((r) => 'key' in r.target)
    .sort((a, b) => getItem(a.key).name.localeCompare(getItem(b.key).name) || conditionOf(b.key) - conditionOf(a.key));
  return [...inHand, ...packed].map(({ target, key, scrap }) => {
    const where = 'slot' in target ? (target.slot === player.activeWeaponSlot ? ' (in hand)' : ' (other hand)') : '';
    return {
      key: 'slot' in target ? `hand:${target.slot}` : `pack:${key}`,
      label: `${itemName(key)}${where}`,
      detail: scrap === 0 ? 'ok' : `${scrap} scrap`,
      target,
      itemKey: key,
    };
  });
}
