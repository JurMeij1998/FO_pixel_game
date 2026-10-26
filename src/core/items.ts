import type { AttackSound } from './fighter';
import type { Skill } from './stats';

/**
 * Static item definitions. Everything else refers to items by a string: the item's id, or for a
 * worn weapon its id plus its condition ("10mm_pistol@62.5"; see itemKey). Containers store
 * (key, quantity) pairs, so a worn weapon is its own stack, and its condition goes wherever it
 * does: equipped, looted, sold, saved. getItem takes either.
 */
export type ItemCategory = 'weapon' | 'armor' | 'consumable' | 'ammo' | 'misc';

export interface WeaponStats {
  skill: Skill;
  /** Item id used up per shot; melee weapons have none. */
  ammo?: string;
  /** Rounds the weapon holds before it needs reloading. Set for every weapon with ammo. */
  magazineSize?: number;
  damageMin: number;
  damageMax: number;
  /** Action points one attack costs. */
  apCost: number;
  /** Reach in tiles; 1 means melee. */
  range: number;
  sound: AttackSound;
}

/**
 * How an item wears and is repaired (core/condition.ts): weapons with every attack, armour
 * with every hit taken.
 */
export interface Durability {
  /** Condition lost per use (an attack, or a hit taken), in percent of its full health. */
  wear: number;
  /** How much `material` a full repair takes, from broken to perfect; better gear takes more. */
  repairCost: number;
  /** The item a repair uses up: scrap metal for guns, blades and steel, leather for leather. */
  material: string;
}

export interface ArmorStats {
  /** Added to the wearer's Armor Class (the chance to be missed). */
  armorClass: number;
  /** Percentage of incoming damage absorbed. */
  damageResist: number;
}

export interface ConsumableStats {
  /** Hit points it restores. */
  heal?: number;
  /** Patches the most worn piece of equipped gear up to this condition (a repair kit; core/condition.ts). */
  patchUpTo?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  /** Weight of one unit, in lbs. */
  weight: number;
  /** Price of one unit, in caps. */
  value: number;
  description: string;
  weapon?: WeaponStats;
  armor?: ArmorStats;
  consumable?: ConsumableStats;
  /** Set for everything that wears: weapons and armour. */
  durability?: Durability;
}

const DEFINITIONS: ItemDef[] = [
  {
    id: 'knife',
    name: 'Knife',
    category: 'weapon',
    weight: 1,
    value: 40,
    description: 'A short, sharp blade. Better than your fists.',
    weapon: { skill: 'meleeWeapons', damageMin: 1, damageMax: 6, apCost: 3, range: 1, sound: 'swing' },
    durability: { wear: 0.5, repairCost: 2, material: 'scrap_metal' },
  },
  {
    id: 'spear',
    name: 'Spear',
    category: 'weapon',
    weight: 4,
    value: 80,
    description: 'A sharpened pole with a crude metal tip. Long reach.',
    weapon: { skill: 'meleeWeapons', damageMin: 3, damageMax: 10, apCost: 4, range: 2, sound: 'swing' },
    durability: { wear: 0.8, repairCost: 4, material: 'scrap_metal' },
  },
  {
    id: '10mm_pistol',
    name: '10mm Pistol',
    category: 'weapon',
    weight: 3,
    value: 250,
    description: 'A reliable semi-automatic sidearm. Chambered for 10mm.',
    weapon: {
      skill: 'smallGuns',
      ammo: 'ammo_10mm',
      magazineSize: 12,
      damageMin: 5,
      damageMax: 12,
      apCost: 5,
      range: 6,
      sound: 'pistol',
    },
    durability: { wear: 1.5, repairCost: 8, material: 'scrap_metal' },
  },
  {
    id: 'hunting_rifle',
    name: 'Hunting Rifle',
    category: 'weapon',
    weight: 9,
    value: 1000,
    description: 'A bolt-action rifle chambered for .223. Slow, heavy and hard-hitting.',
    weapon: {
      skill: 'smallGuns',
      ammo: 'ammo_223',
      magazineSize: 5,
      damageMin: 8,
      damageMax: 20,
      apCost: 6,
      range: 10,
      sound: 'rifle',
    },
    durability: { wear: 2.5, repairCost: 15, material: 'scrap_metal' },
  },
  {
    id: 'leather_jacket',
    name: 'Leather Jacket',
    category: 'armor',
    weight: 5,
    value: 250,
    description: 'A worn black leather jacket. Offers a little protection.',
    armor: { armorClass: 8, damageResist: 20 },
    durability: { wear: 2, repairCost: 3, material: 'leather' },
  },
  {
    id: 'leather_armor',
    name: 'Leather Armor',
    category: 'armor',
    weight: 8,
    value: 700,
    description: 'Tanned hides stitched over padding. Solid protection.',
    armor: { armorClass: 15, damageResist: 25 },
    durability: { wear: 1.5, repairCost: 5, material: 'leather' },
  },
  {
    id: 'steel_armor',
    name: 'Steel Armor',
    category: 'armor',
    weight: 30,
    value: 1800,
    description: 'Plates of salvaged steel riveted onto a leather harness. Heavy, and very tough.',
    armor: { armorClass: 20, damageResist: 40 },
    durability: { wear: 0.8, repairCost: 12, material: 'scrap_metal' },
  },
  {
    id: 'stimpak',
    name: 'Stimpak',
    category: 'consumable',
    weight: 0,
    value: 175,
    description: 'A healing chemical injected straight into the bloodstream.',
    consumable: { heal: 15 },
  },
  {
    id: 'repair_kit',
    name: 'Repair Kit',
    category: 'consumable',
    weight: 2,
    value: 60,
    description: 'Tape, wire, rivets and a few tools. Patches worn gear up enough to keep it working.',
    consumable: { patchUpTo: 35 },
  },
  {
    id: 'ammo_10mm',
    name: '10mm Rounds',
    category: 'ammo',
    weight: 0,
    value: 2,
    description: 'Jacketed hollow-point rounds for 10mm weapons.',
  },
  {
    id: 'ammo_223',
    name: '.223 Rounds',
    category: 'ammo',
    weight: 0,
    value: 4,
    description: 'Rifle cartridges. Hit hard, travel far.',
  },
  {
    id: 'bottle_caps',
    name: 'Bottle Caps',
    category: 'misc',
    weight: 0,
    value: 1,
    description: 'The currency of the wasteland.',
  },
  {
    id: 'canteen',
    name: 'Canteen',
    category: 'misc',
    weight: 2,
    value: 10,
    description: 'A dented metal canteen. Empty.',
  },
  {
    id: 'rope',
    name: 'Rope',
    category: 'misc',
    weight: 2,
    value: 15,
    description: 'Fifty feet of frayed but sturdy rope.',
  },
  {
    id: 'leather',
    name: 'Leather',
    category: 'misc',
    weight: 1,
    value: 8,
    description: 'A tanned scrap of hide. Good for patching up leather armour.',
  },
  {
    id: 'scrap_metal',
    name: 'Scrap Metal',
    category: 'misc',
    weight: 6,
    value: 5,
    description: 'Twisted pieces of pre-war metal. Heavy.',
  },
];

const ITEMS = new Map(DEFINITIONS.map((def) => [def.id, def]));

/** Takes an item id or an item key ("10mm_pistol@62.5"): either way, the item it is. */
export function getItem(key: string): ItemDef {
  const def = ITEMS.get(itemIdOf(key));
  if (!def) throw new Error(`Unknown item id '${key}'`);
  return def;
}

/** Condition in percent: 100 is perfect, 0 broken. Only weapons and armour wear (they have `durability`). */
export const PERFECT = 100;
const CONDITION_MARK = '@';

/**
 * The key for an item in some condition: its id when perfect (so perfect ones stack, and items
 * that don't wear never change), else id@condition, condition rounded to a tenth and clamped.
 */
export function itemKey(itemId: string, condition: number): string {
  const rounded = Math.round(Math.max(0, Math.min(PERFECT, condition)) * 10) / 10;
  return rounded >= PERFECT ? itemId : `${itemId}${CONDITION_MARK}${rounded}`;
}

export function itemIdOf(key: string): string {
  const at = key.indexOf(CONDITION_MARK);
  return at < 0 ? key : key.slice(0, at);
}

/** A key's condition: what follows the @, or perfect without one (or with nonsense after it, from a bad save). */
export function conditionOf(key: string): number {
  const at = key.indexOf(CONDITION_MARK);
  if (at < 0) return PERFECT;
  const value = Number(key.slice(at + 1));
  return Number.isFinite(value) ? Math.max(0, Math.min(PERFECT, value)) : PERFECT;
}
