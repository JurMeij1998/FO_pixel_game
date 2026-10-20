import { ItemContainer } from './container';
import { getItem, type ItemDef } from './items';
import { failure, success, type ActionResult } from './result';
import * as derived from './stats';
import type { Special } from './stats';

export type WeaponSlot = 'primary' | 'secondary';
export type EquipSlot = WeaponSlot | 'armor';
export const EQUIP_SLOTS: readonly EquipSlot[] = ['primary', 'secondary', 'armor'];

export class Character {
  readonly backpack = new ItemContainer();
  hitPoints: number;
  /** The weapon slot currently in hand, like Fallout's two hand slots. */
  activeWeaponSlot: WeaponSlot = 'primary';

  private readonly equipment: Record<EquipSlot, string | null> = {
    primary: null,
    secondary: null,
    armor: null,
  };

  constructor(
    readonly name: string,
    readonly special: Special,
  ) {
    this.hitPoints = this.maxHitPoints;
  }

  get maxHitPoints(): number {
    return derived.maxHitPoints(this.special);
  }

  get maxActionPoints(): number {
    return derived.maxActionPoints(this.special);
  }

  get carryCapacity(): number {
    return derived.carryCapacity(this.special);
  }

  /** Base AC is Agility, plus whatever armor is worn. */
  get armorClass(): number {
    return this.special.agility + (this.equippedItem('armor')?.armor?.armorClass ?? 0);
  }

  /** Equipped items count towards the carry weight too. */
  get carriedWeight(): number {
    let weight = this.backpack.totalWeight();
    for (const slot of EQUIP_SLOTS) weight += this.equippedItem(slot)?.weight ?? 0;
    return weight;
  }

  get activeWeapon(): ItemDef | null {
    return this.equippedItem(this.activeWeaponSlot);
  }

  equippedItem(slot: EquipSlot): ItemDef | null {
    const id = this.equipment[slot];
    return id ? getItem(id) : null;
  }

  /** How many more of this item fit under the carry limit. */
  maxCarryable(itemId: string): number {
    const weight = getItem(itemId).weight;
    if (weight === 0) return Infinity;
    return Math.max(0, Math.floor((this.carryCapacity - this.carriedWeight) / weight));
  }

  /** Moves an item from the backpack into a slot; whatever was in that slot goes back to the backpack. */
  equip(itemId: string, slot: EquipSlot): ActionResult {
    const item = getItem(itemId);
    if (this.backpack.count(itemId) === 0) return failure(`You don't have a ${item.name}.`);
    if (!fitsSlot(item, slot)) return failure(`The ${item.name} doesn't go in that slot.`);

    const previous = this.equipment[slot];
    this.backpack.remove(itemId);
    if (previous) this.backpack.add(previous);
    this.equipment[slot] = itemId;
    return success(`Equipped the ${item.name}.`);
  }

  unequip(slot: EquipSlot): ActionResult {
    const id = this.equipment[slot];
    if (!id) return failure('Nothing is equipped there.');
    this.equipment[slot] = null;
    this.backpack.add(id);
    return success(`Unequipped the ${getItem(id).name}.`);
  }

  swapWeapons(): ActionResult {
    this.activeWeaponSlot = this.activeWeaponSlot === 'primary' ? 'secondary' : 'primary';
    const weapon = this.activeWeapon;
    return success(weapon ? `You ready the ${weapon.name}.` : 'You ready your fists.');
  }

  use(itemId: string): ActionResult {
    const item = getItem(itemId);
    if (this.backpack.count(itemId) === 0) return failure(`You don't have a ${item.name}.`);
    if (!item.consumable) return failure(`You can't use the ${item.name}.`);
    if (this.hitPoints >= this.maxHitPoints) return failure('You are already at full health.');

    this.backpack.remove(itemId);
    const healed = Math.min(item.consumable.heal, this.maxHitPoints - this.hitPoints);
    this.hitPoints += healed;
    return success(`You use the ${item.name} and heal ${healed} HP.`);
  }

  /** Throws one away. There are no piles on the ground yet, so it is gone for good. */
  drop(itemId: string): ActionResult {
    const item = getItem(itemId);
    if (!this.backpack.remove(itemId)) return failure(`You don't have a ${item.name}.`);
    return success(`Dropped the ${item.name}.`);
  }
}

function fitsSlot(item: ItemDef, slot: EquipSlot): boolean {
  return slot === 'armor' ? item.category === 'armor' : item.category === 'weapon';
}
