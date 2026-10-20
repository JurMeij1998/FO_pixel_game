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
