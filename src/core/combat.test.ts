import { describe, expect, it } from 'vitest';
import { Character } from './character';
import { Combat } from './combat';
import { GridMap } from './gridMap';

// rng() returning 0 means every roll succeeds: always hit, always critical, minimum damage.
const ALWAYS = () => 0;
const NEVER = () => 0.999;

function setup(rows: string[], rng: () => number = ALWAYS) {
  const map = GridMap.parse({ name: 'arena', rows, chests: {}, creatures: { R: 'radroach', X: 'raider' } });
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

  it("refuses a step onto an exit mid-fight, since you can't leave", () => {
    const map = GridMap.parse({
      name: 'door',
      rows: ['#######', '1P..R.#', '#######'],
      chests: {},
      creatures: { R: 'radroach' },
      exits: { '1': { to: 'elsewhere' } },
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
    const result = combat.movePlayer({ x: -1, y: 0 });
    expect(result).toMatchObject({ ok: false });
    expect(player.pos).toEqual({ x: 1, y: 1 });
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

    // The player's turn only starts once the scene has shown the enemy turn.
    expect(combat.isPlayerTurn).toBe(false);
    combat.actionPoints = 0;
    combat.startPlayerTurn();
    expect(combat.isPlayerTurn).toBe(true);
    expect(combat.actionPoints).toBe(player.maxActionPoints);
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

  it('gives XP for kills and reports a level-up', () => {
    const { roach, player, combat } = setup(ARENA);
    player.pos = { x: 3, y: 1 };
    player.experience = 90;
    roach.hitPoints = 1;
    const result = combat.attack(roach);
    expect(player.experience).toBe(90 + roach.def.experience);
    expect(result.ok && result.events[0]).toMatchObject({ newLevel: 2 });
    if (result.ok) expect(result.events[0].type === 'attack' && result.events[0].message).toMatch(/25 XP/);
  });

  it('deals no damage on a miss but still spends the AP', () => {
    const { roach, player, combat } = setup(ARENA, NEVER);
    player.pos = { x: 3, y: 1 };
    const result = combat.attack(roach);
    expect(result.ok && result.events[0]).toMatchObject({ type: 'attack', hit: false });
    expect(roach.hitPoints).toBe(roach.maxHitPoints);
    expect(combat.actionPoints).toBe(player.maxActionPoints - 3);
  });

  it('fires from the magazine and needs a reload once it is empty', () => {
    const { roach, player, combat } = setup(ARENA, NEVER);
    player.backpack.add('10mm_pistol');
    player.backpack.add('ammo_10mm', 1);
    player.equip('10mm_pistol', 'primary');

    const empty = combat.attack(roach);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.message).toMatch(/reload/);

    expect(combat.reload().ok).toBe(true);
    expect(combat.actionPoints).toBe(player.maxActionPoints - 2);
    expect(player.loadedRounds()).toBe(1);
    expect(player.backpack.count('ammo_10mm')).toBe(0);

    expect(combat.attack(roach).ok).toBe(true);
    expect(player.loadedRounds()).toBe(0);
    combat.actionPoints = 10;
    expect(combat.attack(roach).ok).toBe(false);
  });

  it('refuses to reload without the AP', () => {
    const { player, combat } = setup(ARENA);
    player.backpack.add('10mm_pistol');
    player.backpack.add('ammo_10mm', 12);
    player.equip('10mm_pistol', 'primary');
    combat.actionPoints = 1;
    expect(combat.reload().ok).toBe(false);
    expect(player.loadedRounds()).toBe(0);
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

  describe('line of sight', () => {
    // A wall between the player and a raider well within its sight range of 7.
    const WALLED = ['#########', '#P..#..X#', '#...#...#', '#.......#', '#########'];

    it('hides the player from creatures behind a wall', () => {
      const { map, player, combat } = setup(WALLED);
      expect(Combat.spotters(map, player)).toEqual([]);
      expect(combat.participants).toEqual([]);
    });

    it("won't let the player shoot through a wall", () => {
      const { map, player, combat } = setup(WALLED);
      const raider = map.creatures[0];
      player.backpack.add('10mm_pistol');
      player.backpack.add('ammo_10mm', 5);
      player.equip('10mm_pistol', 'primary');
      const result = combat.attack(raider);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/can't see/);
      expect(player.backpack.count('ammo_10mm')).toBe(5);
    });

    it('makes enemies walk around cover until they have a shot', () => {
      const { map, player, combat } = setup(WALLED);
      const raider = map.creatures[0];
      combat.participants.push(raider);

      const firstTurn = combat.endTurn();
      expect(firstTurn.every((e) => e.type === 'move')).toBe(true); // no shots through the wall
      expect(player.hitPoints).toBe(player.maxHitPoints);

      combat.startPlayerTurn();
      const secondTurn = combat.endTurn();
      expect(secondTurn.some((e) => e.type === 'attack')).toBe(true);
      expect(map.hasLineOfSight(raider.pos, player.pos)).toBe(true);
    });

    it('lets enemies lose track of a player hiding behind cover', () => {
      // Raider out of sight range (8 tiles) and behind a wall: it gives up at the end of the turn.
      const { map, combat } = setup(['###########', '#P...#...X#', '###########']);
      combat.participants.push(map.creatures[0]);
      combat.endTurn();
      expect(combat.outcome).toBe('escaped');
    });
  });

  it('treats a reach weapon like the spear as melee, not ranged', () => {
    const { roach, player, combat } = setup(ARENA, ALWAYS);
    player.backpack.add('spear'); // reach 2
    player.equip('spear', 'primary');
    roach.pos = { x: 3, y: 1 }; // 2 tiles away
    const atTwo = combat.hitChance(player, roach);
    roach.pos = { x: 2, y: 1 };
    expect(combat.hitChance(player, roach)).toBe(atTwo); // no range penalty

    roach.pos = { x: 3, y: 1 };
    const result = combat.attack(roach);
    expect(result.ok && result.events[0]).toMatchObject({ ranged: false, sound: 'swing' });
  });

  it('says why an attack is refused', () => {
    const { roach, player, combat } = setup(ARENA);
    player.backpack.add('10mm_pistol');
    player.equip('10mm_pistol', 'primary'); // empty magazine
    expect(combat.attack(roach)).toMatchObject({ ok: false, problem: 'empty' });

    roach.pos = { x: 5, y: 2 };
    player.backpack.add('knife');
    player.equip('knife', 'primary');
    expect(combat.attack(roach)).toMatchObject({ ok: false, problem: 'outOfRange' });
  });

  it('keeps a killed target selected until the scene asks for a new one', () => {
    const map = GridMap.parse({
      name: 'two',
      rows: ['#######', '#.RPR.#', '#######'],
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
    const combat = new Combat(map, player, ALWAYS);
    const first = combat.target!;
    first.hitPoints = 1;
    combat.attack(first);
    expect(combat.target).toBe(first); // still marked while its death is shown
    combat.ensureTarget();
    expect(combat.target).not.toBe(first);
    expect(combat.target?.isDead).toBe(false);
  });

  it("doesn't let a creature forget you while you can still shoot it", () => {
    // Water keeps the radroach (sight 4) from reaching the player, 9 tiles away with a rifle.
    const { roach, player, combat } = setup(['#P~~~~~~~~R#'], NEVER);
    player.backpack.add('hunting_rifle'); // range 10
    player.backpack.add('ammo_223', 5);
    player.equip('hunting_rifle', 'primary');
    player.reload();
    expect(combat.attack(roach).ok).toBe(true);
    combat.endTurn();
    expect(combat.outcome).toBeNull(); // before the fix: "escaped" every turn
    expect(combat.participants).toContain(roach);
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
