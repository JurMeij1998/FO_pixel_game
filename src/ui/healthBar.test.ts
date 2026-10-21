import { describe, expect, it } from 'vitest';
import { Character } from '../core/character';
import { healthFill, healthLabel, weaponLine } from './healthBar';

function wanderer(): Character {
  return new Character('Wanderer', {
    strength: 5,
    perception: 5,
    endurance: 5,
    charisma: 5,
    intelligence: 5,
    agility: 5,
    luck: 5,
  });
}

describe('health bar', () => {
  it('fills in proportion to health', () => {
    expect(healthFill(30, 30, 200)).toBe(200);
    expect(healthFill(15, 30, 200)).toBe(100);
    expect(healthFill(10, 30, 200)).toBe(67); // rounded up
  });

  it('still shows the last hit point, and is empty only at 0', () => {
    expect(healthFill(1, 100, 200)).toBeGreaterThan(0);
    expect(healthFill(0, 30, 200)).toBe(0);
  });

  it('never overflows, whatever the numbers', () => {
    expect(healthFill(40, 30, 200)).toBe(200);
    expect(healthFill(-3, 30, 200)).toBe(0);
    expect(healthFill(5, 0, 200)).toBe(0);
  });

  it('shows the numbers as current/max', () => {
    const player = wanderer();
    player.hitPoints = 12;
    expect(healthLabel(player)).toBe(`12/${player.maxHitPoints}`);
  });
});

describe('weapon line', () => {
  it('shows a gun with its magazine and the spare rounds in the pack', () => {
    const player = wanderer();
    player.backpack.add('hunting_rifle');
    player.backpack.add('ammo_223', 13);
    player.equip('hunting_rifle', 'primary');
    expect(weaponLine(player)).toBe('Hunting Rifle 0/5 (+13)');
    player.reload();
    expect(weaponLine(player)).toBe('Hunting Rifle 5/5 (+8)');
  });

  it('shows just the name for a melee weapon, and Fists with nothing in hand', () => {
    const player = wanderer();
    expect(weaponLine(player)).toBe('Fists');
    player.backpack.add('knife');
    player.equip('knife', 'primary');
    expect(weaponLine(player)).toBe('Knife');
  });

  it('follows a weapon swap', () => {
    const player = wanderer();
    player.backpack.add('knife');
    player.backpack.add('10mm_pistol');
    player.equip('knife', 'primary');
    player.equip('10mm_pistol', 'secondary');
    player.swapWeapons();
    expect(weaponLine(player)).toBe('10mm Pistol 0/12 (+0)');
  });
});
