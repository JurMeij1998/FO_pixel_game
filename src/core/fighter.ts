import type { GridPos } from './grid';

/** Everything the combat rules need to know about one attack, whatever it comes from. */
export interface Attack {
  name: string;
  damageMin: number;
  damageMax: number;
  apCost: number;
  /** Reach in tiles; 1 means melee. */
  range: number;
  /** Base chance to hit in percent, before the target's Armor Class is subtracted. */
  hitChance: number;
  /** Item id used up per attack, if any. */
  ammo?: string;
}

/** Anything that can take part in combat: the player or a creature. */
export interface Fighter {
  readonly name: string;
  pos: GridPos;
  hitPoints: number;
  readonly maxHitPoints: number;
  readonly maxActionPoints: number;
  readonly armorClass: number;
  /** Percentage of incoming damage absorbed. */
  readonly damageResist: number;
  /** Percent chance that a hit is a critical (double damage). */
  readonly critChance: number;
  readonly attack: Attack;
}
