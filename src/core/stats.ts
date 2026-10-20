/** Fallout's S.P.E.C.I.A.L. attributes, each from 1 to 10. */
export interface Special {
  strength: number;
  perception: number;
  endurance: number;
  charisma: number;
  intelligence: number;
  agility: number;
  luck: number;
}

// Derived statistics, using the Fallout 1/2 formulas.

export function carryCapacity(special: Special): number {
  return 25 + 25 * special.strength;
}

export function maxHitPoints(special: Special): number {
  return 15 + special.strength + 2 * special.endurance;
}

export function maxActionPoints(special: Special): number {
  return 5 + Math.floor(special.agility / 2);
}

export type Skill = 'smallGuns' | 'meleeWeapons' | 'unarmed';

/** Tagged skills start 20 points higher, as in Fallout 2. */
export const TAG_BONUS = 20;

/** Starting skill value in percent, before tagging. */
export function baseSkill(special: Special, skill: Skill): number {
  switch (skill) {
    case 'smallGuns':
      return 5 + 4 * special.agility;
    case 'meleeWeapons':
      return 20 + 2 * (special.agility + special.strength);
    case 'unarmed':
      return 30 + 2 * (special.agility + special.strength);
  }
}
