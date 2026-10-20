import { describe, expect, it } from 'vitest';
import { Character } from './character';
import { Combat } from './combat';
import { GridMap } from './gridMap';

// rng() returning 0 means every roll succeeds: always hit, always critical, minimum damage.
const ALWAYS = () => 0;
const NEVER = () => 0.999;

function setup(rows: string[], rng: () => number = ALWAYS) {
  const map = GridMap.parse({ name: 'arena', rows, chests: {}, creatures: { R: 'radroach' } });
  const player = new Character('Tester', {
    strength: 5,
    perception: 5,
    endurance: 5,
    charisma: 5,
    intelligence: 5,
    agility: 5,
    luck: 5,
  });
  player.pos = { ...map.playerStart };
  player.backpack.add('knife');
  player.equip('knife', 'primary');
  return { map, player, roach: map.creatures[0], combat: new Combat(map, player, rng) };
}

// Player at (1,1), radroach three tiles to the right: within its sight range of 4.
const ARENA = ['#######', '#P..R.#', '#.....#', '#######'];

describe('Combat', () => {
  it('starts with the creatures that can see the player', () => {
    const { map, player, roach, combat } = setup(ARENA);
    expect(Combat.spotters(map, player)).toEqual([roach]);
    expect(combat.participants).toEqual([roach]);
    expect(combat.target).toBe(roach);
    expect(combat.isPlayerTurn).toBe(true);
    expect(combat.actionPoints).toBe(player.maxActionPoints);
  });

  it('charges 1 AP per step and refuses blocked steps', () => {
    const { player, combat } = setup(ARENA);
    expect(combat.movePlayer({ x: 1, y: 0 }).ok).toBe(true);
    expect(player.pos).toEqual({ x: 2, y: 1 });
    expect(combat.actionPoints).toBe(player.maxActionPoints - 1);
    expect(combat.movePlayer({ x: 0, y: -1 }).ok).toBe(false); // wall
  });

  it('refuses attacks out of range', () => {
    const { roach, combat } = setup(ARENA);
    const result = combat.attack(roach);
    expect(result.ok).toBe(false);
  });

  it('lets the enemy close in and attack on its turn', () => {
    const { roach, player, combat } = setup(ARENA);
    const events = combat.endTurn();
    expect(events.map((e) => e.type)).toEqual(['move', 'move', 'attack']);
    expect(roach.pos).toEqual({ x: 2, y: 1 });
    expect(player.hitPoints).toBeLessThan(player.maxHitPoints);
    expect(combat.isPlayerTurn).toBe(true);
  });

  it('ends in victory when the last enemy dies, leaving a corpse', () => {
    const { map, roach, player, combat } = setup(ARENA);
    player.pos = { x: 3, y: 1 };
    roach.hitPoints = 1;
    const result = combat.attack(roach);
    expect(result.ok).toBe(true);
    expect(roach.isDead).toBe(true);
    expect(combat.outcome).toBe('victory');
    expect(map.corpseAt(4, 1)).toBe(roach);
    expect(map.isWalkable(4, 1)).toBe(true);
  });

  it('deals no damage on a miss but still spends the AP', () => {
    const { roach, player, combat } = setup(ARENA, NEVER);
    player.pos = { x: 3, y: 1 };
    const result = combat.attack(roach);
    expect(result.ok && result.events[0]).toMatchObject({ type: 'attack', hit: false });
    expect(roach.hitPoints).toBe(roach.maxHitPoints);
    expect(combat.actionPoints).toBe(player.maxActionPoints - 3);
  });

  it('uses up ammo and refuses to fire without it', () => {
    const { roach, player, combat } = setup(ARENA, NEVER);
    player.backpack.add('10mm_pistol');
    player.backpack.add('ammo_10mm', 1);
    player.equip('10mm_pistol', 'primary');
    expect(combat.attack(roach).ok).toBe(true);
    expect(player.backpack.count('ammo_10mm')).toBe(0);
    combat.actionPoints = 10;
    const result = combat.attack(roach);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/ammo/);
  });

  it('ends in defeat when the player dies', () => {
    const { player, combat } = setup(ARENA);
    player.hitPoints = 1;
    combat.endTurn();
    expect(player.hitPoints).toBe(0);
    expect(combat.outcome).toBe('defeat');
    expect(combat.isPlayerTurn).toBe(false);
  });

  it('lets the player escape when enemies lose track', () => {
    // The roach starts 20 tiles away and only walks 5 per turn.
    const { roach, combat } = setup(['#P' + '.'.repeat(19) + 'R#']);
    combat.participants.push(roach);
    combat.endTurn();
    expect(combat.outcome).toBe('escaped');
  });

  it('clamps hit chance and penalises long shots', () => {
    const { roach, player, combat } = setup(ARENA);
    player.backpack.add('hunting_rifle');
    player.equip('hunting_rifle', 'primary');
    const close = combat.hitChance(player, roach); // 3 tiles away
    roach.pos = { x: 5, y: 2 };
    expect(combat.hitChance(player, roach)).toBeLessThan(close);

    player.special.agility = 1; // small guns 9%, minus AC and range: clamped to 5%
    expect(combat.hitChance(player, roach)).toBe(5);
  });

  it('cycles between targets', () => {
    const map = GridMap.parse({
      name: 'two',
      rows: ['#######', '#.R.P.R', '#######'],
      chests: {},
      creatures: { R: 'radroach' },
    });
    const player = new Character('Tester', {
      strength: 5,
      perception: 5,
      endurance: 5,
      charisma: 5,
      intelligence: 5,
      agility: 5,
      luck: 5,
    });
    player.pos = { ...map.playerStart };
    const combat = new Combat(map, player);
    const first = combat.target;
    combat.cycleTarget();
    expect(combat.target).not.toBe(first);
    combat.cycleTarget();
    expect(combat.target).toBe(first);
  });
});
