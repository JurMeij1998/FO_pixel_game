import type { Character } from './character';
import { failure, success, type ActionResult } from './result';

/**
 * Locks on doors and chests. A lock needs a certain Lockpick skill: with at least that much
 * you can set to work on it (the pin puzzle in core/lockPuzzle.ts); with less you can't even
 * try. Raise the skill (it grows with Perception and Agility, and with skill points) and come
 * back. Pure, so it can be tested; the world scene calls it when you press E at something locked.
 */

/** Lockpick skill (in percent) each kind of lock needs. A new character has 10 + PE + AG. */
export const LOCKS = {
  simple: 25,
  average: 40,
  good: 60,
  hard: 80,
} as const;

/** Anything that can be locked: `lock` is the Lockpick skill it needs, or null once it's open to anyone. */
export interface Lockable {
  lock: number | null;
}

/** "a simple lock", "a good lock"...: the hardest kind it is at least as hard as. */
export function describeLock(lock: number): string {
  const kinds = Object.entries(LOCKS) as Array<[keyof typeof LOCKS, number]>;
  const kind = kinds.filter(([, needed]) => lock >= needed).pop()?.[0] ?? 'simple';
  return `${kind === 'average' ? 'an' : 'a'} ${kind} lock`;
}

/** What you're told when you find something locked: how hard it is, and whether you can pick it. */
export function lockedMessage(what: string, thing: Lockable, player: Character): string {
  if (thing.lock === null) return `The ${what} isn't locked.`;
  const skill = player.skill('lockpick');
  const kind = describeLock(thing.lock);
  if (skill >= thing.lock) return `The ${what} is locked with ${kind}. Press E to pick it.`;
  return `The ${what} is locked with ${kind} (Lockpick ${thing.lock}%; you have ${skill}%).`;
}

/** Whether the player has the skill to try picking this lock: if not, the message says what it takes. */
export function canPick(what: string, thing: Lockable, player: Character): ActionResult {
  if (thing.lock === null) return failure(`The ${what} isn't locked.`);
  const skill = player.skill('lockpick');
  if (skill < thing.lock) {
    return failure(`This lock is beyond you: it takes Lockpick ${thing.lock}%, and you have ${skill}%.`);
  }
  return success(`You set to work on the lock.`);
}

/** The lock has been picked (its puzzle solved): it stays open for good. Returns what to tell the player. */
export function unlock(what: string, thing: Lockable): string {
  thing.lock = null;
  return `You pick the lock on the ${what}.`;
}
