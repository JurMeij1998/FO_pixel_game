import { describe, expect, it } from 'vitest';
import { Character } from './character';
import { canPick, describeLock, lockedMessage, LOCKS, unlock, type Lockable } from './locks';

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
    expect(average.skill('lockpick')).toBe(LOCKS.simple);
  });

  it('can be tried with at least the skill the lock needs, and stay open once picked', () => {
    const crate: Lockable = { lock: LOCKS.simple };
    expect(canPick('crate', crate, picker(10, 10)).ok).toBe(true); // 30%
    expect(crate.lock).toBe(LOCKS.simple); // trying doesn't open it: the pin puzzle does
    expect(unlock('crate', crate)).toBe('You pick the lock on the crate.');
    expect(crate.lock).toBeNull();
  });

  it("can't even be tried with less, and say what it takes", () => {
    const door: Lockable = { lock: LOCKS.good };
    expect(canPick('door', door, picker())).toMatchObject({
      ok: false,
      message: 'This lock is beyond you: it takes Lockpick 60%, and you have 20%.',
    });
    expect(door.lock).toBe(LOCKS.good);
  });

  it('have no lock to pick once open', () => {
    expect(canPick('door', { lock: null }, picker())).toMatchObject({ ok: false, message: "The door isn't locked." });
  });

  it('describe how hard they are', () => {
    expect(describeLock(LOCKS.simple)).toBe('a simple lock');
    expect(describeLock(LOCKS.average)).toBe('an average lock');
    expect(describeLock(50)).toBe('an average lock');
    expect(describeLock(LOCKS.hard)).toBe('a hard lock');
    expect(describeLock(10)).toBe('a simple lock');
  });

  it('tell you on finding one whether you can pick it', () => {
    expect(lockedMessage('door', { lock: LOCKS.simple }, picker(10, 10))).toBe(
      'The door is locked with a simple lock. Press E to pick it.',
    );
    expect(lockedMessage('door', { lock: LOCKS.average }, picker())).toBe(
      'The door is locked with an average lock (Lockpick 40%; you have 20%).',
    );
  });
});
