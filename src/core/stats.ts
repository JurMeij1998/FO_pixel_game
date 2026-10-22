/** Fallout's S.P.E.C.I.A.L. attributes, each from 1 to 10. */
export const SPECIAL_KEYS = [
  'strength',
  'perception',
  'endurance',
  'charisma',
  'intelligence',
  'agility',
  'luck',
] as const;

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

/**
 * Total XP needed to reach a level: 100 for level 2, 300 for 3, 600 for 4, ...
 * Fallout's curve (1000 x level x (level - 1) / 2), scaled down for a small map.
 */
export function experienceForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function hitPointsPerLevel(special: Special): number {
  return 3 + Math.floor(special.endurance / 2);
}

export function skillPointsPerLevel(special: Special): number {
  return 5 + 2 * special.intelligence;
}

export const SPECIAL_NAMES: Record<keyof Special, string> = {
  strength: 'Strength',
  perception: 'Perception',
  endurance: 'Endurance',
  charisma: 'Charisma',
  intelligence: 'Intelligence',
  agility: 'Agility',
  luck: 'Luck',
};

export type Skill = 'smallGuns' | 'meleeWeapons' | 'unarmed' | 'lockpick';
export const SKILLS: readonly Skill[] = ['smallGuns', 'meleeWeapons', 'unarmed', 'lockpick'];
export const SKILL_NAMES: Record<Skill, string> = {
  smallGuns: 'Small Guns',
  meleeWeapons: 'Melee Weapons',
  unarmed: 'Unarmed',
  lockpick: 'Lockpick',
};

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
    case 'lockpick':
      return 10 + special.perception + special.agility;
  }
}

/**
 * What each S.P.E.C.I.A.L. stat does in this game, for the character sheet. Keep these in
 * step with the formulas above (and Character.armorClass / critChance, core/barter.ts).
 */
export const SPECIAL_EFFECTS: Record<keyof Special, string> = {
  strength:
    'Raw physical power. Carry weight: 25 lb plus 25 per point. Max HP: +1 per point. ' +
    'Melee Weapons and Unarmed: +2% per point.',
  perception: 'Awareness and keen senses. Lockpick: +1% per point.',
  endurance: 'Toughness and stamina. Max HP: +2 per point. HP gained per level: 3, plus 1 per 2 points.',
  charisma: 'Presence and charm. Better prices when bartering: you buy for less and sell for more.',
  intelligence: 'Knowledge and wits. Skill points per level: 5, plus 2 per point.',
  agility:
    'Speed and coordination. Action points: 5, plus 1 per 2 points. Armor Class: +1 per point. ' +
    'Small Guns: +4% per point; Melee Weapons and Unarmed: +2% per point; Lockpick: +1% per point.',
  luck: 'Fate and good fortune. Critical hit chance: 1% per point (a critical does double damage).',
};

/** What each skill is for, for the character sheet. */
export const SKILL_EFFECTS: Record<Skill, string> = {
  smallGuns: 'Your chance to hit with pistols and rifles. Based on Agility.',
  meleeWeapons: 'Your chance to hit with knives, spears and other hand-held weapons. Based on Strength and Agility.',
  unarmed: 'Your chance to hit with your fists. Based on Strength and Agility.',
  lockpick:
    'Opening locked doors and chests: you can pick any lock that needs no more than your skill. ' +
    'Based on Perception and Agility.',
};
