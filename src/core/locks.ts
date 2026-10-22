import type { Character } from './character';
import { failure, success, type ActionResult } from './result';

/**
 * Locks on doors and chests. A lock needs a certain Lockpick skill: with at least that much
 * you pick it, every time; with less you can't, however often you try. Raise the skill (it
 * grows with Perception and Agility, and with skill points) and come back. Pure, so it can be
 * tested; the world scene calls it when you press E at something locked.
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

/** Tries to pick a lock. On success the thing stays unlocked for good. */
export function pickLock(what: string, thing: Lockable, player: Character): ActionResult {
  if (thing.lock === null) return success(`The ${what} isn't locked.`);
  const skill = player.skill('lockpick');
  if (skill < thing.lock) {
    return failure(`This lock is beyond you: it takes Lockpick ${thing.lock}%, and you have ${skill}%.`);
  }
  thing.lock = null;
  return success(`You pick the lock on the ${what}.`);
}
