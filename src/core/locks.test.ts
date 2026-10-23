import { describe, expect, it } from 'vitest';
import { Character } from './character';
import { describeLock, lockedMessage, lockKind, LOCKS, pickProblem, pinsFor, unlock, type Lockable } from './locks';

function picker(perception = 5, agility = 5): Character {
  return new Character('Picker', { strength: 5, perception, endurance: 5, charisma: 5, intelligence: 5, agility, luck: 5 });
}

describe('locks', () => {
  it('start a character on 10 + Perception + Agility Lockpick, raised by skill points', () => {
    const average = picker();
    expect(average.skill('lockpick')).toBe(20);
    expect(picker(8, 9).skill('lockpick')).toBe(27);
    average.skillPoints = 5;
    for (let i = 0; i < 5; i++) average.improveSkill('lockpick');
    expect(average.skill('lockpick')).toBe(LOCKS.easy);
  });

  it('can be tried with at least the skill the lock needs, and stay open once picked', () => {
    const crate: Lockable = { lock: LOCKS.easy };
    expect(pickProblem('crate', crate, picker(10, 10))).toBeNull(); // 30%
    expect(crate.lock).toBe(LOCKS.easy); // trying doesn't open it: the pin puzzle does
    expect(unlock('crate', crate)).toBe('You pick the lock on the crate.');
    expect(crate.lock).toBeNull();
  });

  it("can't even be tried with less, and say what it takes", () => {
    const door: Lockable = { lock: LOCKS.hard };
    expect(pickProblem('door', door, picker())).toBe('This lock is beyond you: it takes Lockpick 60%, and you have 20%.');
    expect(door.lock).toBe(LOCKS.hard);
  });

  it('have no lock to pick once open', () => {
    expect(pickProblem('door', { lock: null }, picker())).toBe("The door isn't locked.");
  });

  it('have more pins the harder they are: 3, 4, then 5', () => {
    expect(pinsFor(10)).toBe(3); // below the easiest kind: still easy
    expect(lockKind(10)).toBe('easy');
    expect(pinsFor(LOCKS.easy)).toBe(3);
    expect(pinsFor(LOCKS.medium)).toBe(4);
    expect(pinsFor(50)).toBe(4);
    expect(pinsFor(LOCKS.hard)).toBe(5);
    expect(pinsFor(LOCKS.expert)).toBe(5);
  });

  it('come in four kinds', () => {
    expect(lockKind(LOCKS.easy)).toBe('easy');
    expect(lockKind(LOCKS.medium)).toBe('medium');
    expect(lockKind(LOCKS.hard)).toBe('hard');
    expect(lockKind(70)).toBe('hard');
    expect(lockKind(LOCKS.expert)).toBe('expert');
  });

  it('describe how hard they are', () => {
    expect(describeLock(LOCKS.easy)).toBe('an easy lock');
    expect(describeLock(LOCKS.medium)).toBe('a medium lock');
    expect(describeLock(50)).toBe('a medium lock');
    expect(describeLock(LOCKS.expert)).toBe('an expert lock');
    expect(describeLock(10)).toBe('an easy lock');
  });

  it('tell you on finding one whether you can pick it', () => {
    expect(lockedMessage('door', { lock: LOCKS.easy }, picker(10, 10))).toBe(
      'The door is locked with an easy lock. Press E to pick it.',
    );
    expect(lockedMessage('door', { lock: LOCKS.medium }, picker())).toBe(
      'The door is locked with a medium lock (Lockpick 40%; you have 20%).',
    );
  });
});
