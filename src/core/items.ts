import type { Skill } from './stats';

/**
 * Static item definitions. Everything else refers to items by their string id;
 * containers only store (id, quantity) pairs.
 */
export type ItemCategory = 'weapon' | 'armor' | 'consumable' | 'ammo' | 'misc';

export interface WeaponStats {
  skill: Skill;
  /** Item id used up per shot; melee weapons have none. */
  ammo?: string;
  damageMin: number;
  damageMax: number;
  /** Action points one attack costs. */
  apCost: number;
  /** Reach in tiles; 1 means melee. */
  range: number;
}

export interface ArmorStats {
  /** Added to the wearer's Armor Class (the chance to be missed). */
  armorClass: number;
  /** Percentage of incoming damage absorbed. */
  damageResist: number;
}

export interface ConsumableStats {
  heal: number;
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
}

const DEFINITIONS: ItemDef[] = [
  {
    id: 'knife',
    name: 'Knife',
    category: 'weapon',
    weight: 1,
    value: 40,
    description: 'A short, sharp blade. Better than your fists.',
    weapon: { skill: 'meleeWeapons', damageMin: 1, damageMax: 6, apCost: 3, range: 1 },
  },
  {
    id: 'spear',
    name: 'Spear',
    category: 'weapon',
    weight: 4,
    value: 80,
    description: 'A sharpened pole with a crude metal tip. Long reach.',
    weapon: { skill: 'meleeWeapons', damageMin: 3, damageMax: 10, apCost: 4, range: 2 },
  },
  {
    id: '10mm_pistol',
    name: '10mm Pistol',
    category: 'weapon',
    weight: 3,
    value: 250,
    description: 'A reliable semi-automatic sidearm. Chambered for 10mm.',
    weapon: { skill: 'smallGuns', ammo: 'ammo_10mm', damageMin: 5, damageMax: 12, apCost: 5, range: 6 },
  },
  {
    id: 'hunting_rifle',
    name: 'Hunting Rifle',
    category: 'weapon',
    weight: 9,
    value: 1000,
    description: 'A bolt-action rifle chambered for .223. Slow, heavy and hard-hitting.',
    weapon: { skill: 'smallGuns', ammo: 'ammo_223', damageMin: 8, damageMax: 20, apCost: 6, range: 10 },
  },
  {
    id: 'leather_jacket',
    name: 'Leather Jacket',
    category: 'armor',
    weight: 5,
    value: 250,
    description: 'A worn black leather jacket. Offers a little protection.',
    armor: { armorClass: 8, damageResist: 20 },
  },
  {
    id: 'leather_armor',
    name: 'Leather Armor',
    category: 'armor',
    weight: 8,
    value: 700,
    description: 'Tanned hides stitched over padding. Solid protection.',
    armor: { armorClass: 15, damageResist: 25 },
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
    id: 'scrap_metal',
    name: 'Scrap Metal',
    category: 'misc',
    weight: 6,
    value: 5,
    description: 'Twisted pieces of pre-war metal. Heavy.',
  },
];

const ITEMS = new Map(DEFINITIONS.map((def) => [def.id, def]));

export function getItem(id: string): ItemDef {
  const def = ITEMS.get(id);
  if (!def) throw new Error(`Unknown item id '${id}'`);
  return def;
}
