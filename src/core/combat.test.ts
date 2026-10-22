import { describe, expect, it } from 'vitest';
import { Character } from './character';
import { Combat } from './combat';
import { Creature, getCreatureDef } from './creature';
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
  return { map, player, roach: map.creatures[0], combat: new Combat(map, player, rng, 'normal') };
}

// Player at (1,1), radroach three tiles to the right: within its sight range of 4.
const ARENA = ['#######', '#P..R.#', '#.....#', '#######'];

describe('Combat', () => {
  it("reports the target's health before and after each attack, for the scene to show it landing", () => {
    const { roach, combat } = setup(['#####', '#PR.#', '#####']);
    const hitResult = combat.attack(roach);
    if (!hitResult.ok || hitResult.events[0].type !== 'attack') throw new Error('expected an attack');
    expect(hitResult.events[0].targetHitPoints).toEqual({ before: 8, after: roach.hitPoints });

    // An overkill hit still reports the health the target really had, not before = after + damage.
    roach.hitPoints = 1;
    combat.endTurn();
    combat.startPlayerTurn();
    const killing = combat.attack(roach);
    if (!killing.ok || killing.events[0].type !== 'attack') throw new Error('expected an attack');
    expect(killing.events[0].targetHitPoints).toEqual({ before: 1, after: 0 });
  });

  it("reports unchanged health for a miss", () => {
    const { roach, combat } = setup(['#####', '#PR.#', '#####'], NEVER);
    const result = combat.attack(roach);
    if (!result.ok || result.events[0].type !== 'attack') throw new Error('expected an attack');
    expect(result.events[0].targetHitPoints).toEqual({ before: 8, after: 8 });
  });

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
    const combat = new Combat(map, player, Math.random, 'normal');
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
    const combat = new Combat(map, player, ALWAYS, 'normal');
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
    const combat = new Combat(map, player, Math.random, 'normal');
    const first = combat.target;
    combat.cycleTarget();
    expect(combat.target).not.toBe(first);
    combat.cycleTarget();
    expect(combat.target).toBe(first);
  });
});

describe('Combat with people', () => {
  // Gus (G) two tiles from the player; the guard (W) out of sight behind a wall.
  function store(rng: () => number = ALWAYS) {
    const map = GridMap.parse({
      name: 'store',
      rows: ['#########', '#P.G#..W#', '#...#...#', '#.......#', '#########'],
      chests: {},
      creatures: { G: 'shopkeeper', W: 'guard' },
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
    player.backpack.add('knife');
    player.equip('knife', 'primary');
    const [gus, guard] = map.creatures;
    return { map, player, gus, guard, rng };
  }

  it("don't start a fight while they're friendly, even in plain sight", () => {
    const { map, player } = store();
    expect(Combat.spotters(map, player)).toEqual([]);
  });

  it('bring the whole group into the fight once provoked, the guard even out of sight', () => {
    const { map, player, gus, guard, rng } = store();
    const combat = new Combat(map, player, rng, 'normal');
    expect(combat.participants).toEqual([]);
    combat.join(map.provoke(gus));
    expect(combat.participants).toEqual([gus, guard]);
    expect(combat.target).toBe(gus); // the nearest
    expect(map.hasLineOfSight(guard.pos, player.pos)).toBe(false);
  });

  it('never fight while still friendly', () => {
    const { map, player, gus, rng } = store();
    const combat = new Combat(map, player, rng, 'normal');
    combat.join([gus]); // not provoked
    expect(combat.participants).toEqual([]);
    player.pos = { x: 2, y: 1 }; // right next to Gus
    expect(() => combat.attack(gus)).toThrow(/still friendly/);
  });

  it('call people by their name in messages', () => {
    const { map, player, gus, rng } = store();
    const combat = new Combat(map, player, rng, 'normal');
    combat.join(map.provoke(gus));
    player.pos = { x: 2, y: 1 };
    const result = combat.attack(gus);
    expect(result.ok && result.events[0].type === 'attack' && result.events[0].message).toMatch(/^You critically hit Gus for/);
    const events = combat.endTurn();
    const gusSwings = events.find((e) => e.type === 'attack' && e.attacker === gus);
    expect(gusSwings?.type === 'attack' && gusSwings.message).toMatch(/^Gus (critically )?hits you/);
  });

  it('give the guard a far better shot than a raider', () => {
    const { map, player, guard } = store();
    const combat = new Combat(map, player, Math.random, 'normal');
    const raider = new Creature('raider@7,1', getCreatureDef('raider'), { ...guard.pos });
    expect(combat.hitChance(guard, player)).toBeGreaterThan(combat.hitChance(raider, player) + 30);
    expect(guard.attack.ranged).toBe(true);
    expect(guard.contents.count('10mm_pistol')).toBe(1);
  });
});

describe('Line of fire', () => {
  // The player, then Gus, then the guard, in a row; a radroach further down, in the open.
  function lineUp(rng: () => number, weapon: '10mm_pistol' | 'spear' = '10mm_pistol') {
    const map = GridMap.parse({
      name: 'range',
      rows: ['#########', '#P.G.W..#', '#.......#', '#R......#', '#########'],
      chests: {},
      creatures: { G: 'shopkeeper', W: 'guard', R: 'radroach' },
    });
    const player = new Character('Shooter', {
      strength: 5,
      perception: 5,
      endurance: 5,
      charisma: 5,
      intelligence: 5,
      agility: 10,
      luck: 5,
    });
    player.pos = { ...map.playerStart };
    player.backpack.add(weapon);
    player.equip(weapon, 'primary');
    if (weapon === '10mm_pistol') {
      player.backpack.add('ammo_10mm', 12);
      player.reload();
    }
    const [gus, guard, roach] = ['shopkeeper', 'guard', 'radroach'].map((id) => map.creatures.find((c) => c.def.id === id)!);
    return { map, player, gus, guard, roach, combat: new Combat(map, player, rng, 'normal') };
  }

  it('lists the tiles a shot crosses, nearest the shooter first', () => {
    const { map } = lineUp(ALWAYS);
    expect(map.lineOfFire({ x: 1, y: 1 }, { x: 5, y: 1 })).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ]);
    expect(map.lineOfFire({ x: 5, y: 1 }, { x: 1, y: 1 })![0]).toEqual({ x: 4, y: 1 });
    expect(map.lineOfFire({ x: 1, y: 1 }, { x: 1, y: 0 })).toEqual([]); // next to each other
  });

  it("stops your shot at whoever is in the way: Gus catches the bullet meant for the guard", () => {
    const { map, gus, guard, combat } = lineUp(ALWAYS);
    combat.join(map.provoke(guard));
    expect(combat.inTheWay(guard)).toBe(gus);
    const result = combat.attack(guard);
    if (!result.ok || result.events[0].type !== 'attack') throw new Error('expected an attack');
    const shot = result.events[0];
    expect(shot.target).toBe(gus);
    expect(shot.message).toMatch(/^Gus is in the way! You critically hit Gus for/);
    expect(gus.hitPoints).toBeLessThan(gus.maxHitPoints);
    expect(guard.hitPoints).toBe(guard.maxHitPoints);
    expect(combat.target).toBe(guard); // still the one you're aiming at
  });

  it('lets the shot miss the one in the way, without flying on to the target', () => {
    const { map, gus, guard, combat } = lineUp(NEVER);
    combat.join(map.provoke(guard));
    const result = combat.attack(guard);
    if (!result.ok || result.events[0].type !== 'attack') throw new Error('expected an attack');
    expect(result.events[0].message).toBe('Gus is in the way! You miss Gus.');
    expect(gus.hitPoints).toBe(gus.maxHitPoints);
    expect(guard.hitPoints).toBe(guard.maxHitPoints);
  });

  it('turns a friendly bystander you hit against you, with their group', () => {
    const { gus, guard, combat } = lineUp(ALWAYS);
    guard.hostile = true; // only the guard is after you; Gus is still friendly
    combat.join([guard]);
    const result = combat.attack(guard);
    if (!result.ok || result.events[0].type !== 'attack') throw new Error('expected an attack');
    expect(result.events[0].message).toMatch(/Gus turns hostile!$/);
    expect(gus.hostile).toBe(true);
    expect(combat.participants).toContain(gus);
  });

  it('leaves a friendly bystander friendly when the shot misses them', () => {
    const { gus, guard, combat } = lineUp(NEVER);
    guard.hostile = true; // only the guard is after you
    combat.join([guard]);
    combat.attack(guard);
    expect(gus.hostile).toBe(false);
    expect(combat.participants).not.toContain(gus);
  });

  it('turns the group against you when a friendly bystander is killed, and pays the XP', () => {
    const { player, gus, guard, combat } = lineUp(ALWAYS);
    guard.hostile = true;
    combat.join([guard]);
    gus.hitPoints = 1;
    const result = combat.attack(guard);
    if (!result.ok || result.events[0].type !== 'attack') throw new Error('expected an attack');
    expect(result.events[0].killed).toBe(true);
    expect(gus.isDead).toBe(true);
    expect(player.experience).toBe(gus.def.experience);
    expect(combat.livingEnemies).toContain(guard);
    expect(combat.livingEnemies).not.toContain(gus);
  });

  it('brings a hostile bystander into the fight, even one too far away to have seen you', () => {
    const map = GridMap.parse({
      name: 'long range',
      rows: ['############', '#P.....R..X#', '############'],
      chests: {},
      creatures: { R: 'radroach', X: 'raider' },
    });
    const player = new Character('Sniper', {
      strength: 5,
      perception: 5,
      endurance: 5,
      charisma: 5,
      intelligence: 5,
      agility: 10,
      luck: 5,
    });
    player.pos = { ...map.playerStart };
    player.backpack.add('hunting_rifle');
    player.equip('hunting_rifle', 'primary');
    player.backpack.add('ammo_223', 5);
    player.reload();
    const [roach, raider] = map.creatures;
    const combat = new Combat(map, player, NEVER, 'normal');
    expect(combat.participants).toEqual([]); // both too far away to notice you
    combat.join([raider]);
    expect(combat.inTheWay(raider)).toBe(roach);
    combat.attack(raider); // misses the radroach in the way
    expect(combat.participants).toContain(roach);
  });

  it("follows the line of sight's other way round when the shooter's own line is blocked, nearest first", () => {
    // From (0,0) to (3,4) the shooter's Bresenham line runs through (2,2), a wall; the line
    // from the target's end is clear, and passes the radroach before the raider.
    const map = GridMap.parse({
      name: 'corner',
      rows: ['P......', '.......', '.R#....', '..X....', '...M...'],
      chests: {},
      creatures: { R: 'radroach', X: 'raider', M: 'mole_rat' },
    });
    const player = new Character('Shooter', {
      strength: 5,
      perception: 5,
      endurance: 5,
      charisma: 5,
      intelligence: 5,
      agility: 10,
      luck: 5,
    });
    player.pos = { ...map.playerStart };
    player.backpack.add('10mm_pistol');
    player.equip('10mm_pistol', 'primary');
    const [roach, , moleRat] = map.creatures;
    expect(map.lineOfFire({ x: 0, y: 0 }, { x: 3, y: 4 })).toEqual([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 3 },
    ]);
    expect(new Combat(map, player, Math.random, 'normal').inTheWay(moleRat)).toBe(roach);
  });

  it("doesn't stop melee, not even a spear reaching past someone", () => {
    const { map, player, gus, guard, combat } = lineUp(ALWAYS, 'spear');
    player.pos = { x: 1, y: 1 };
    gus.pos = { x: 2, y: 1 };
    guard.pos = { x: 3, y: 1 }; // two tiles away, Gus in between: within the spear's reach
    combat.join(map.provoke(guard));
    expect(combat.inTheWay(guard)).toBeNull();
    const result = combat.attack(guard);
    if (!result.ok || result.events[0].type !== 'attack') throw new Error('expected an attack');
    expect(result.events[0].target).toBe(guard);
    expect(gus.hitPoints).toBe(gus.maxHitPoints);
  });

  it("doesn't protect you: the guard's shots fly past Gus and hit you", () => {
    const { map, player, gus, guard, combat } = lineUp(ALWAYS);
    combat.join(map.provoke(guard)); // Gus walks up first and stands between you and the guard
    gus.hitPoints = 1;
    const before = player.hitPoints;
    const events = combat.endTurn();
    const guardShot = events.find((e) => e.type === 'attack' && e.attacker === guard);
    expect(guardShot?.type === 'attack' && guardShot.target).toBe(player);
    expect(player.hitPoints).toBeLessThan(before);
    expect(gus.hitPoints).toBe(1); // the guard's bullets went past him
  });
});

describe('Someone nearly defenseless', () => {
  // Rosa (F) right next to the player, a radroach (R) out of sight behind the wall.
  function shack(rng: () => number = ALWAYS) {
    const map = GridMap.parse({
      name: 'shack',
      rows: ['#######', '#FP.#R#', '#...#.#', '#######'],
      chests: {},
      creatures: { F: 'rosa', R: 'radroach' },
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
    player.backpack.add('knife');
    player.equip('knife', 'primary');
    const [rosa, roach] = map.creatures;
    return { map, player, rosa, roach, rng };
  }

  it("doesn't start a fight while friendly, but does once she's been provoked", () => {
    const { map, player, rosa } = shack();
    expect(Combat.spotters(map, player)).toEqual([]);
    map.provoke(rosa);
    expect(Combat.spotters(map, player)).toEqual([rosa]);
  });

  it('takes on the fight: it goes on after your turn, until she is down or you get away', () => {
    const { map, player, rosa, rng } = shack();
    map.provoke(rosa);
    const combat = new Combat(map, player, rng, 'normal');
    expect(combat.attack(rosa).ok).toBe(true);
    expect(rosa.isDead).toBe(false); // the knife does 1-6; she has 12 HP
    expect(combat.outcome).toBeNull();
    combat.endTurn();
    combat.startPlayerTurn();
    expect(combat.outcome).toBeNull();
    expect(combat.isPlayerTurn).toBe(true);
  });

  it('fights back with nothing more than a slap', () => {
    const { map, player, rosa, rng } = shack();
    map.provoke(rosa);
    const combat = new Combat(map, player, rng, 'normal');
    const before = player.hitPoints;
    const events = combat.endTurn();
    const slaps = events.filter((e) => e.type === 'attack' && e.attacker === rosa);
    expect(slaps).toHaveLength(1); // 4 AP per slap, 5 AP a turn
    expect(before - player.hitPoints).toBeLessThanOrEqual(2); // 1 damage, 2 on a critical
    expect(combat.hitChance(rosa, player)).toBeLessThan(30);
  });

  it('gives no XP, and says none', () => {
    const { map, player, rosa, rng } = shack();
    map.provoke(rosa);
    rosa.hitPoints = 1;
    const combat = new Combat(map, player, rng, 'normal');
    const result = combat.attack(rosa);
    if (!result.ok || result.events[0].type !== 'attack') throw new Error('expected an attack');
    expect(result.events[0].killed).toBe(true);
    expect(result.events[0].message).not.toMatch(/XP/);
    expect(player.experience).toBe(0);
  });
});

describe('Difficulty', () => {
  // A raider right next to the player; every roll succeeds.
  function fight(difficulty: 'easy' | 'normal' | 'hard', rng: () => number = ALWAYS) {
    const map = GridMap.parse({ name: 'pit', rows: ['#####', '#PX.#', '#####'], chests: {}, creatures: { X: 'raider' } });
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
    const [raider] = map.creatures;
    return { player, raider, combat: new Combat(map, player, rng, difficulty) };
  }

  it("changes how often enemies hit you, but not how often you hit them", () => {
    const easy = fight('easy');
    const normal = fight('normal');
    const hard = fight('hard');
    expect(easy.combat.hitChance(easy.raider, easy.player)).toBe(normal.combat.hitChance(normal.raider, normal.player) - 10);
    expect(hard.combat.hitChance(hard.raider, hard.player)).toBe(normal.combat.hitChance(normal.raider, normal.player) + 10);
    expect(easy.combat.hitChance(easy.player, easy.raider)).toBe(normal.combat.hitChance(normal.player, normal.raider));
  });

  it('changes small hits too, rounding only once', () => {
    // A radroach bite of 2 (rng 0.25 picks 1 + floor(0.25 * 4) = 2), no critical, no armour.
    const bite = (difficulty: 'easy' | 'normal' | 'hard') => {
      const map = GridMap.parse({ name: 'nest', rows: ['####', '#PR#', '####'], chests: {}, creatures: { R: 'radroach' } });
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
      // Rolls in order: to hit (0 = hit), critical (0.99 = no), damage (0.25).
      const rolls = [0, 0.99, 0.25];
      const combat = new Combat(map, player, () => rolls.shift() ?? 0.99, difficulty);
      const before = player.hitPoints;
      combat.endTurn();
      return before - player.hitPoints;
    };
    expect(bite('normal')).toBe(2);
    expect(bite('easy')).toBe(2); // 1.5 rounds to 2
    expect(bite('hard')).toBe(3); // 2.5 rounds to 3
  });

  it('applies the difficulty after armour, so armour and difficulty both count', () => {
    const { player, raider, combat } = fight('hard');
    player.backpack.add('leather_armor');
    player.equip('leather_armor', 'armor'); // DR 25
    const before = player.hitPoints;
    combat.endTurn(); // 6 damage, 25% absorbed: 4.5, then x1.25 on hard: 5.625, rounded once: 6
    expect(before - player.hitPoints).toBe(6);
    void raider;
  });

  it('changes how much damage you take', () => {
    const taken = (difficulty: 'easy' | 'normal' | 'hard') => {
      const { player, combat } = fight(difficulty);
      const before = player.hitPoints;
      combat.endTurn(); // the raider shoots: always hits, critical, minimum damage
      return before - player.hitPoints;
    };
    // Raider: 3 damage minimum, doubled on a critical: 6.
    expect(taken('normal')).toBe(6);
    expect(taken('easy')).toBe(5); // 6 x 0.75, rounded
    expect(taken('hard')).toBe(8); // 6 x 1.25, rounded
  });
});
