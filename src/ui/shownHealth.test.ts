import { afterEach, describe, expect, it } from 'vitest';
import { Character } from '../core/character';
import type { AttackEvent } from '../core/combat';
import { Creature, getCreatureDef } from '../core/creature';
import { holdHealth, releaseHealth, showHit, shownHitPoints } from './shownHealth';

const player = new Character('Tester', {
  strength: 5,
  perception: 5,
  endurance: 5,
  charisma: 5,
  intelligence: 5,
  agility: 5,
  luck: 5,
});

const radroach = () => new Creature('radroach@0,0', getCreatureDef('radroach'), { x: 0, y: 0 });

/** An attack as Combat reports it: the target's health already applied. */
function attack(target: Creature | Character, before: number, after: number): AttackEvent {
  target.hitPoints = after;
  return {
    type: 'attack',
    attacker: player,
    target,
    ranged: false,
    sound: 'swing',
    hit: before !== after,
    critical: false,
    damage: before - after,
    killed: after === 0,
    targetHitPoints: { before, after },
    message: '',
    newLevel: null,
  };
}

describe('shown health', () => {
  afterEach(() => releaseHealth());

  it('is the real health when nothing is being played back', () => {
    const roach = radroach();
    roach.hitPoints = 5;
    expect(shownHitPoints(roach)).toBe(5);
  });

  it("holds a whole turn's hits back until each one is shown landing", () => {
    // The enemies hit you twice in their turn, 30 -> 24 -> 20, all applied before the playback.
    const first = attack(player, 30, 24);
    const second = attack(player, 24, 20);
    holdHealth([first, second]);
    expect(player.hitPoints).toBe(20);
    expect(shownHitPoints(player)).toBe(30);
    showHit(first);
    expect(shownHitPoints(player)).toBe(24);
    showHit(second);
    expect(shownHitPoints(player)).toBe(20);
    releaseHealth();
    expect(shownHitPoints(player)).toBe(20);
  });

  it('keeps a killed creature alive on screen until the killing blow is shown', () => {
    const roach = radroach();
    const kill = attack(roach, 8, 0);
    holdHealth([kill]);
    expect(roach.isDead).toBe(true);
    expect(shownHitPoints(roach)).toBe(8);
    showHit(kill);
    expect(shownHitPoints(roach)).toBe(0);
  });
});
