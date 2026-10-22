/**
 * Difficulty levels, chosen when creating a character and kept in the save. They only change
 * how dangerous enemies are to you: how often they hit and how hard.
 */
export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_LEVELS: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export interface DifficultyRules {
  name: string;
  description: string;
  /** Damage the player takes is multiplied by this. */
  damageTaken: number;
  /** Added to enemies' chance to hit the player, in percent. */
  enemyHitChance: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyRules> = {
  easy: {
    name: 'Easy',
    description: 'Enemies hit you 10% less often, and you take 25% less damage.',
    damageTaken: 0.75,
    enemyHitChance: -10,
  },
  normal: { name: 'Normal', description: 'The wasteland as it is.', damageTaken: 1, enemyHitChance: 0 },
  hard: {
    name: 'Hard',
    description: 'Enemies hit you 10% more often, and you take 25% more damage.',
    damageTaken: 1.25,
    enemyHitChance: 10,
  },
};

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTY_LEVELS as readonly string[]).includes(value);
}
