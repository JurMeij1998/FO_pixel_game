import { describe, expect, it } from 'vitest';
import { Character } from '../core/character';
import { ENEMY_BAR_WIDTH, enemyBar, healthFill, healthLabel, weaponLine } from './healthBar';

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

describe('enemy health bar', () => {
  it('floats centred just above the creature, a thin line', () => {
    const bar = enemyBar(40, 56, 16, 8, 8); // a sprite centred at (40, 56): its tile spans y 48-63
    expect(bar).toMatchObject({ x: 40 - ENEMY_BAR_WIDTH / 2, width: ENEMY_BAR_WIDTH, height: 1 });
    expect(bar.y + bar.height).toBeLessThan(48);
  });

  it('is all red at full health, and turns black from the right as health is lost', () => {
    expect(enemyBar(40, 56, 16, 24, 24).red).toBe(ENEMY_BAR_WIDTH);
    expect(enemyBar(40, 56, 16, 12, 24).red).toBe(ENEMY_BAR_WIDTH / 2);
    expect(enemyBar(40, 56, 16, 1, 24).red).toBe(1); // the last hit point still shows
  });

  it('stays the same length whatever the health', () => {
    for (const hp of [24, 13, 5, 1]) expect(enemyBar(40, 56, 16, hp, 24).width).toBe(ENEMY_BAR_WIDTH);
  });

  it('sits on whole pixels while the creature is mid-step', () => {
    const bar = enemyBar(40.4, 51.7, 16, 8, 8);
    expect(Number.isInteger(bar.x)).toBe(true);
    expect(Number.isInteger(bar.y)).toBe(true);
  });
});
