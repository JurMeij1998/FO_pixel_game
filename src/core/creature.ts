import { ItemContainer } from './container';
import type { Attack, Fighter } from './fighter';
import type { GridPos } from './grid';

export interface CreatureDef {
  id: string;
  name: string;
  maxHitPoints: number;
  actionPoints: number;
  armorClass: number;
  damageResist: number;
  critChance: number;
  /** Notices the player within this many tiles and starts combat. */
  sightRange: number;
  /** XP the player gets for killing it. */
  experience: number;
  attack: Attack;
  /** What its corpse holds. */
  loot: Array<[itemId: string, quantity: number]>;
}

const DEFINITIONS: CreatureDef[] = [
  {
    id: 'radroach',
    name: 'Radroach',
    maxHitPoints: 8,
    actionPoints: 5,
    armorClass: 3,
    damageResist: 0,
    critChance: 2,
    sightRange: 4,
    experience: 25,
    attack: { name: 'bite', damageMin: 1, damageMax: 4, apCost: 3, range: 1, ranged: false, hitChance: 50, sound: 'bite' },
    loot: [],
  },
  {
    id: 'mole_rat',
    name: 'Mole Rat',
    maxHitPoints: 14,
    actionPoints: 6,
    armorClass: 4,
    damageResist: 0,
    critChance: 3,
    sightRange: 5,
    experience: 40,
    attack: { name: 'bite', damageMin: 2, damageMax: 6, apCost: 4, range: 1, ranged: false, hitChance: 55, sound: 'bite' },
    loot: [],
  },
  {
    id: 'wild_dog',
    name: 'Wild Dog',
    maxHitPoints: 12,
    actionPoints: 8, // fast: closes in and bites in the same turn
    armorClass: 6,
    damageResist: 0,
    critChance: 4,
    sightRange: 6,
    experience: 35,
    attack: { name: 'bite', damageMin: 2, damageMax: 5, apCost: 3, range: 1, ranged: false, hitChance: 55, sound: 'bite' },
    loot: [],
  },
  {
    id: 'feral_ghoul',
    name: 'Feral Ghoul',
    maxHitPoints: 18,
    actionPoints: 7,
    armorClass: 4,
    damageResist: 0,
    critChance: 4,
    sightRange: 6,
    experience: 50,
    attack: { name: 'claws', damageMin: 3, damageMax: 7, apCost: 3, range: 1, ranged: false, hitChance: 55, sound: 'bite' },
    loot: [['bottle_caps', 3]],
  },
  {
    id: 'raider',
    name: 'Raider',
    maxHitPoints: 24,
    actionPoints: 7,
    armorClass: 5,
    damageResist: 10,
    critChance: 5,
    sightRange: 7,
    experience: 100,
    attack: { name: 'pistol', damageMin: 3, damageMax: 9, apCost: 5, range: 6, ranged: true, hitChance: 50, sound: 'pistol' },
    loot: [
      ['bottle_caps', 25],
      ['ammo_10mm', 8],
      ['stimpak', 1],
    ],
  },
];

const CREATURES = new Map(DEFINITIONS.map((def) => [def.id, def]));

/** The farthest any creature can see; map generation keeps spawns beyond it from arrival points. */
export const MAX_SIGHT_RANGE = Math.max(...DEFINITIONS.map((def) => def.sightRange));

export function getCreatureDef(id: string): CreatureDef {
  const def = CREATURES.get(id);
  if (!def) throw new Error(`Unknown creature id '${id}'`);
  return def;
}

/** One creature on the map. Once dead it stays as a lootable corpse. */
export class Creature implements Fighter {
  hitPoints: number;
  /** The corpse's contents; only reachable once it is dead. */
  readonly contents: ItemContainer;

  constructor(
    readonly id: string,
    readonly def: CreatureDef,
    public pos: GridPos,
  ) {
    this.hitPoints = def.maxHitPoints;
    this.contents = new ItemContainer(def.loot);
  }

  get name(): string {
    return this.def.name;
  }

  get isDead(): boolean {
    return this.hitPoints <= 0;
  }

  get maxHitPoints(): number {
    return this.def.maxHitPoints;
  }

  get maxActionPoints(): number {
    return this.def.actionPoints;
  }

  get armorClass(): number {
    return this.def.armorClass;
  }

  get damageResist(): number {
    return this.def.damageResist;
  }

  get critChance(): number {
    return this.def.critChance;
  }

  get attack(): Attack {
    return this.def.attack;
  }
}
