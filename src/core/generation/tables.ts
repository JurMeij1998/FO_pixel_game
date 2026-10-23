import { getItem, itemKey } from '../items';
import type { Random } from '../random';

/** One kind of item a container can hold, with how many and how likely it is. */
export interface LootEntry {
  itemId: string;
  min: number;
  max: number;
  /** Relative chance of being picked on each roll. */
  weight: number;
}

/** What a generated chest can contain: `rolls` picks from `entries`, duplicates add up. */
export interface LootTable {
  rolls: [min: number, max: number];
  entries: LootEntry[];
}

/** Found weapons come worn: each one gets its own condition, between these (in percent). */
export const FOUND_CONDITION: [min: number, max: number] = [15, 85];

/** Rolls a chest's contents, as (item key, quantity) pairs: a found weapon's key carries its condition. */
export function rollLoot(table: LootTable, rng: Random): Array<[itemKey: string, quantity: number]> {
  const totals = new Map<string, number>();
  const add = (key: string, quantity: number) => totals.set(key, (totals.get(key) ?? 0) + quantity);
  const rolls = rng.int(...table.rolls);
  for (let i = 0; i < rolls; i++) {
    const entry = rng.pickWeighted(table.entries);
    const quantity = rng.int(entry.min, entry.max);
    if (!getItem(entry.itemId).weapon) add(entry.itemId, quantity);
    else for (let n = 0; n < quantity; n++) add(itemKey(entry.itemId, rng.int(...FOUND_CONDITION)), 1);
  }
  return [...totals];
}

/** Which creatures can appear somewhere, by relative chance. */
export type SpawnTable = Array<{ creatureId: string; weight: number }>;

export function rollCreature(table: SpawnTable, rng: Random): string {
  return rng.pickWeighted(table).creatureId;
}
