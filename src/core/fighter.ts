import type { GridPos } from './grid';

/** What an attack sounds like; the audio layer turns this into an actual sound. */
export type AttackSound = 'swing' | 'punch' | 'pistol' | 'rifle' | 'bite';

/** Everything the combat rules need to know about one attack, whatever it comes from. */
export interface Attack {
  name: string;
  damageMin: number;
  damageMax: number;
  apCost: number;
  /** Reach in tiles. More than 1 doesn't make it ranged: a spear reaches 2 tiles. */
  range: number;
  /** Guns and other projectiles: a range penalty to hit, a tracer and a ricochet on a miss. */
  ranged: boolean;
  /** Base chance to hit in percent, before the target's Armor Class is subtracted. */
  hitChance: number;
  /** Item id used up per attack, if any. */
  ammo?: string;
  sound: AttackSound;
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
