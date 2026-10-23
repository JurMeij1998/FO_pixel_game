import { ItemContainer } from './container';
import type { Attack, Fighter } from './fighter';
import { isGridPos, type GridPos } from './grid';
import { getItem, type ItemDef } from './items';
import { failure, success, type ActionResult } from './result';
import * as derived from './stats';
import { SKILL_NAMES, SKILLS, SPECIAL_KEYS, type Skill, type Special } from './stats';

export type WeaponSlot = 'primary' | 'secondary';
/** Chosen at character creation; it sets how the player looks. */
export type Gender = 'male' | 'female';
export type EquipSlot = WeaponSlot | 'armor';
export const EQUIP_SLOTS: readonly EquipSlot[] = ['primary', 'secondary', 'armor'];

const UNARMED = { name: 'Fists', damageMin: 1, damageMax: 3, apCost: 3, range: 1, ranged: false, sound: 'punch' } as const;

/** Everything needed to rebuild a Character, as plain JSON-friendly data. */
export interface CharacterData {
  name: string;
  special: Special;
  taggedSkills: Skill[];
  hitPoints: number;
  pos: GridPos;
  activeWeaponSlot: WeaponSlot;
  equipment: Record<EquipSlot, string | null>;
  backpack: Array<[itemId: string, quantity: number]>;
  // Optional so older saves still load.
  gender?: Gender;
  loadedRounds?: Record<WeaponSlot, number>;
  level?: number;
  experience?: number;
  skillPoints?: number;
  skillBonus?: Record<Skill, number>;
  bonusHitPoints?: number;
}

export class Character implements Fighter {
  readonly backpack = new ItemContainer();
  readonly taggedSkills = new Set<Skill>();
  hitPoints: number;
  pos: GridPos = { x: 0, y: 0 };
  /** The weapon slot currently in hand, like Fallout's two hand slots. */
  activeWeaponSlot: WeaponSlot = 'primary';
  gender: Gender = 'male';

  level = 1;
  experience = 0;
  /** Unspent points from levelling up. */
  skillPoints = 0;
  /** Points spent on each skill, added on top of the base value. */
  readonly skillBonus: Record<Skill, number> = { smallGuns: 0, meleeWeapons: 0, unarmed: 0, lockpick: 0 };
  /** Max HP gained from levelling up. */
  private bonusHitPoints = 0;

  private readonly equipment: Record<EquipSlot, string | null> = {
    primary: null,
    secondary: null,
    armor: null,
  };

  /**
   * Rounds in each equipped gun's magazine. Kept per slot rather than per item because
   * identical items share a stack; rounds go back to the backpack when the gun is unequipped.
   */
  private readonly loaded: Record<WeaponSlot, number> = { primary: 0, secondary: 0 };

  constructor(
    readonly name: string,
    readonly special: Special,
  ) {
    this.hitPoints = this.maxHitPoints;
  }

  toData(): CharacterData {
    return {
      name: this.name,
      gender: this.gender,
      special: { ...this.special },
      taggedSkills: [...this.taggedSkills],
      hitPoints: this.hitPoints,
      pos: { ...this.pos },
      activeWeaponSlot: this.activeWeaponSlot,
      equipment: { ...this.equipment },
      backpack: this.backpack.toData(),
      loadedRounds: { ...this.loaded },
      level: this.level,
      experience: this.experience,
      skillPoints: this.skillPoints,
      skillBonus: { ...this.skillBonus },
      bonusHitPoints: this.bonusHitPoints,
    };
  }

  /**
   * Rebuilds a character from toData() output. The data may come from a corrupt or hand-edited
   * save, so it is checked: invalid data throws, and numbers that are merely out of range are clamped.
   */
  static fromData(data: CharacterData): Character {
    const invalid = (what: string) => new Error(`Invalid ${what} in saved character`);
    if (typeof data?.name !== 'string') throw invalid('name');
    for (const key of SPECIAL_KEYS) {
      const value = data.special?.[key];
      if (!Number.isInteger(value) || value < 1 || value > 10) throw invalid(key);
    }
    if (!Number.isInteger(data.hitPoints)) throw invalid('hit points');
    if (!isGridPos(data.pos)) throw invalid('position');
    if (data.activeWeaponSlot !== 'primary' && data.activeWeaponSlot !== 'secondary') throw invalid('weapon slot');
    if (!Array.isArray(data.taggedSkills) || !data.taggedSkills.every((s) => SKILLS.includes(s))) {
      throw invalid('tagged skills');
    }

    const c = new Character(data.name, { ...data.special });
    // Saves from before character creation had no gender: those players were all male.
    c.gender = data.gender === 'female' ? 'female' : 'male';
    for (const skill of data.taggedSkills) c.taggedSkills.add(skill);
    c.pos = { ...data.pos };
    c.activeWeaponSlot = data.activeWeaponSlot;
    for (const slot of EQUIP_SLOTS) {
      const id = data.equipment[slot];
      if (id) getItem(id); // throws on unknown ids
      c.equipment[slot] = id;
    }
    c.backpack.setData(data.backpack);
    c.level = nonNegativeInteger(data.level, 1) || 1;
    c.experience = nonNegativeInteger(data.experience, 0);
    c.skillPoints = nonNegativeInteger(data.skillPoints, 0);
    for (const skill of SKILLS) c.skillBonus[skill] = nonNegativeInteger(data.skillBonus?.[skill], 0);
    c.bonusHitPoints = nonNegativeInteger(data.bonusHitPoints, 0);
    // A saved player is alive (saves never happen at 0 HP), and can't hold more than its maximum.
    c.hitPoints = Math.max(1, Math.min(c.maxHitPoints, data.hitPoints));
    // Never more rounds in a magazine than it holds, and none in a slot without a gun.
    for (const slot of ['primary', 'secondary'] as const) {
      const magazine = c.equippedItem(slot)?.weapon?.magazineSize ?? 0;
      c.loaded[slot] = Math.min(magazine, nonNegativeInteger(data.loadedRounds?.[slot], 0));
    }
    return c;
  }

  get maxHitPoints(): number {
    return derived.maxHitPoints(this.special) + this.bonusHitPoints;
  }

  /** Total XP at which the next level is reached. */
  get experienceForNextLevel(): number {
    return derived.experienceForLevel(this.level + 1);
  }

  /** Adds XP and levels up as often as it allows. Returns the number of levels gained. */
  gainExperience(amount: number): number {
    this.experience += amount;
    let gained = 0;
    while (this.experience >= this.experienceForNextLevel) {
      this.level++;
      gained++;
      const hitPoints = derived.hitPointsPerLevel(this.special);
      this.bonusHitPoints += hitPoints;
      this.hitPoints += hitPoints;
      this.skillPoints += derived.skillPointsPerLevel(this.special);
    }
    return gained;
  }

  /** Spends one skill point. Tagged skills improve twice as fast, as in Fallout. */
  improveSkill(skill: Skill): ActionResult {
    if (this.skillPoints === 0) return failure('You have no skill points to spend.');
    const gain = this.taggedSkills.has(skill) ? 2 : 1;
    this.skillPoints--;
    this.skillBonus[skill] += gain;
    return success(`${SKILL_NAMES[skill]} +${gain}%.`);
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

  get damageResist(): number {
    return this.equippedItem('armor')?.armor?.damageResist ?? 0;
  }

  /** In Fallout, Luck is the base critical chance. */
  get critChance(): number {
    return this.special.luck;
  }

  skill(skill: Skill): number {
    const tag = this.taggedSkills.has(skill) ? derived.TAG_BONUS : 0;
    return derived.baseSkill(this.special, skill) + tag + this.skillBonus[skill];
  }

  /** The attack made with the weapon in hand, or with fists if that hand is empty. */
  get attack(): Attack {
    const weapon = this.activeWeapon;
    if (!weapon?.weapon) return { ...UNARMED, hitChance: this.skill('unarmed') };
    const { skill, ...stats } = weapon.weapon;
    return { name: weapon.name, ...stats, ranged: skill === 'smallGuns', hitChance: this.skill(skill) };
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
    if (previous) {
      this.unload(slot);
      this.backpack.add(previous);
    }
    this.equipment[slot] = itemId;
    if (item.weapon?.ammo) return success(`Equipped the ${item.name}. It's empty: press R to reload.`);
    return success(`Equipped the ${item.name}.`);
  }

  unequip(slot: EquipSlot): ActionResult {
    const id = this.equipment[slot];
    if (!id) return failure('Nothing is equipped there.');
    this.unload(slot);
    this.equipment[slot] = null;
    this.backpack.add(id);
    return success(`Unequipped the ${getItem(id).name}.`);
  }

  /** Rounds in the magazine of the gun in that slot (0 for melee weapons and empty hands). */
  loadedRounds(slot: WeaponSlot = this.activeWeaponSlot): number {
    return this.loaded[slot];
  }

  /** Fills the magazine of the gun in hand from the backpack, as far as the ammo goes. */
  reload(): ActionResult {
    const slot = this.activeWeaponSlot;
    const item = this.equippedItem(slot);
    const weapon = item?.weapon;
    if (!item || !weapon?.ammo || !weapon.magazineSize) return failure("That doesn't need reloading.");
    const missing = weapon.magazineSize - this.loaded[slot];
    if (missing === 0) return failure(`The ${item.name} is already fully loaded.`);
    const amount = Math.min(missing, this.backpack.count(weapon.ammo));
    if (amount === 0) return failure(`You have no ${getItem(weapon.ammo).name} left.`);

    this.backpack.remove(weapon.ammo, amount);
    this.loaded[slot] += amount;
    return success(`You reload the ${item.name} (${this.loaded[slot]}/${weapon.magazineSize}).`);
  }

  /** Uses one round from the gun in hand. Returns false if the magazine is empty. */
  spendRound(): boolean {
    const slot = this.activeWeaponSlot;
    if (this.loaded[slot] === 0) return false;
    this.loaded[slot]--;
    return true;
  }

  /** Puts the rounds of a weapon slot's magazine back into the backpack. */
  private unload(slot: EquipSlot): void {
    if (slot === 'armor' || this.loaded[slot] === 0) return;
    const ammo = this.equippedItem(slot)?.weapon?.ammo;
    if (ammo) this.backpack.add(ammo, this.loaded[slot]);
    this.loaded[slot] = 0;
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

/** A whole number of at least 0 from untrusted data, or the fallback if it isn't one. */
function nonNegativeInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : fallback;
}

function fitsSlot(item: ItemDef, slot: EquipSlot): boolean {
  return slot === 'armor' ? item.category === 'armor' : item.category === 'weapon';
}
