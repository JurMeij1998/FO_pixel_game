import { Character, type Gender } from './character';
import type { Difficulty } from './difficulty';
import { failure, success, type ActionResult } from './result';
import { SPECIAL_KEYS, type Special } from './stats';

/**
 * Character creation, before a new game starts: a name, a gender, the S.P.E.C.I.A.L. stats and
 * the difficulty. Every stat starts at 5 and there are 8 more points to spend; lowering a stat
 * below 5 frees its points for others. Pure, so it can be tested; the creation screen edits a
 * CharacterBuild and hands it to the new game.
 */

export const BASE_STAT = 5;
export const EXTRA_POINTS = 8;
export const MIN_STAT = 1;
export const MAX_STAT = 10;
export const MAX_NAME_LENGTH = 16;
/** Letters, digits, spaces, hyphens and apostrophes. */
const NAME_CHARACTER = /^[A-Za-z0-9 '-]$/;

export interface CharacterBuild {
  name: string;
  gender: Gender;
  special: Special;
  difficulty: Difficulty;
}

export function newBuild(): CharacterBuild {
  const special = Object.fromEntries(SPECIAL_KEYS.map((key) => [key, BASE_STAT])) as unknown as Special;
  return { name: 'Wanderer', gender: 'male', special, difficulty: 'normal' };
}

/** Points still to spend: the 8 extra ones, plus any freed by lowering stats below 5. */
export function pointsLeft(special: Special): number {
  const spent = SPECIAL_KEYS.reduce((sum, key) => sum + special[key] - BASE_STAT, 0);
  return EXTRA_POINTS - spent;
}

/** Raises a stat by one, if there's a point to spend and it isn't at 10 yet. */
export function raiseStat(build: CharacterBuild, key: keyof Special): boolean {
  if (pointsLeft(build.special) <= 0 || build.special[key] >= MAX_STAT) return false;
  build.special[key]++;
  return true;
}

/** Lowers a stat by one (freeing a point), down to 1. */
export function lowerStat(build: CharacterBuild, key: keyof Special): boolean {
  if (build.special[key] <= MIN_STAT) return false;
  build.special[key]--;
  return true;
}

/** Adds a typed character to the name, if it's one a name can hold and there's room. */
export function typeIntoName(build: CharacterBuild, char: string): boolean {
  if (!NAME_CHARACTER.test(char) || build.name.length >= MAX_NAME_LENGTH) return false;
  // No leading space, and no double spaces.
  if (char === ' ' && (build.name.length === 0 || build.name.endsWith(' '))) return false;
  build.name += char;
  return true;
}

export function eraseFromName(build: CharacterBuild): boolean {
  if (build.name.length === 0) return false;
  build.name = build.name.slice(0, -1);
  return true;
}

/** Whether the build is ready to play: it needs a name, and every point spent. */
export function checkBuild(build: CharacterBuild): ActionResult {
  if (build.name.trim().length === 0) return failure('Give your character a name.');
  const left = pointsLeft(build.special);
  if (left > 0) return failure(`You still have ${left} point${left === 1 ? '' : 's'} to spend.`);
  return success('Ready.');
}

/** The character a build makes, before the starting gear is handed out. */
export function createCharacter(build: CharacterBuild): Character {
  const character = new Character(build.name.trim(), { ...build.special });
  character.gender = build.gender;
  return character;
}
