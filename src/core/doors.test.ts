import { describe, expect, it } from 'vitest';
import { WASTELAND } from '../data/wasteland';
import { Character } from './character';
import { Combat } from './combat';
import { GridMap } from './gridMap';
import { LOCKS } from './locks';

// A hut with a door at (2, 2), the player outside below it.
const HUT = ['.%%%%.', '.%++%.', '.%/%%.', '..P...', '......'];

function player(map: GridMap): Character {
  const p = new Character('Tester', { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 });
  p.pos = { ...map.playerStart };
  return p;
}

describe('doors', () => {
  it('start closed, blocking the way and the view', () => {
    const map = GridMap.parse({ name: 'hut', rows: HUT, chests: {} });
    const door = map.doorAt(2, 2)!;
    expect(door).toMatchObject({ open: false, lock: null });
    expect(map.isWalkable(2, 2)).toBe(false);
    expect(map.hasLineOfSight({ x: 2, y: 3 }, { x: 2, y: 1 })).toBe(false);
    expect(map.openDoor(door).ok).toBe(true);
    expect(map.isWalkable(2, 2)).toBe(true);
    expect(map.hasLineOfSight({ x: 2, y: 3 }, { x: 2, y: 1 })).toBe(true);
  });

  it('hide you from whoever is behind them, until opened', () => {
    // A raider inside the hut, the player right outside its door.
    const map = GridMap.parse({ name: 'hut', rows: ['.%%%%.', '.%X+%.', '.%/%%.', '..P...'], chests: {}, creatures: { X: 'raider' } });
    const p = player(map);
    expect(Combat.spotters(map, p)).toEqual([]);
    map.openDoor(map.doorAt(2, 2)!);
    expect(Combat.spotters(map, p)).toEqual(map.creatures);
  });

  it('count as a way through when checking what can be reached', () => {
    const map = GridMap.parse({ name: 'hut', rows: HUT, chests: {} });
    expect(map.reachableFrom(map.playerStart).has('2,1')).toBe(true);
  });

  it("close only with nothing in the doorway, and can't be opened twice", () => {
    const map = GridMap.parse({ name: 'hut', rows: HUT, chests: {} });
    const door = map.doorAt(2, 2)!;
    map.openDoor(door);
    expect(map.openDoor(door)).toMatchObject({ ok: false, message: 'The door is already open.' });
    expect(map.closeDoor(door, { x: 2, y: 2 })).toMatchObject({ ok: false, message: 'Something is in the way.' });
    expect(map.closeDoor(door, { x: 2, y: 3 }).ok).toBe(true);
    expect(map.closeDoor(door, { x: 2, y: 3 })).toMatchObject({ ok: false, message: 'The door is already closed.' });
  });

  it("don't open while locked", () => {
    const map = GridMap.parse({ name: 'hut', rows: HUT, chests: {}, doors: { '2,2': { lock: LOCKS.medium } } });
    const door = map.doorAt(2, 2)!;
    expect(door.lock).toBe(LOCKS.medium);
    expect(map.openDoor(door)).toMatchObject({ ok: false, message: 'The door is locked.' });
    door.lock = null; // picked
    expect(map.openDoor(door).ok).toBe(true);
  });

  it('reject a lock that is not on a door', () => {
    expect(() => GridMap.parse({ name: 'hut', rows: HUT, chests: {}, doors: { '1,1': { lock: 25 } } })).toThrow(/not on a door/);
  });

  describe('belonging to someone', () => {
    // A house with a locked door, and its owners: a shopkeeper inside, a guard outside.
    const owned = () =>
      GridMap.parse({
        name: 'house',
        rows: ['.%%%%.', '.%G+%.', '.%/%%.', '..PW..', '......'],
        chests: {},
        creatures: { G: 'shopkeeper', W: 'guard' },
        doors: { '2,2': { lock: LOCKS.easy, owner: 'store' } },
      });

    it('turn their owners hostile when you pick the lock, as theft does', () => {
      const map = owned();
      const door = map.doorAt(2, 2)!;
      expect(door.owner).toBe('store');
      const angered = map.noticeLockpicking(door);
      expect(angered.map((c) => c.def.id).sort()).toEqual(['guard', 'shopkeeper']);
      expect(map.creatures.every((c) => c.hostile)).toBe(true);
    });

    it('are anyone\'s to pick once the owners are dead', () => {
      const map = owned();
      for (const c of map.creatures) c.hitPoints = 0;
      expect(map.noticeLockpicking(map.doorAt(2, 2)!)).toEqual([]);
    });

    it('anger no one when they belong to no one', () => {
      const map = GridMap.parse({ name: 'hut', rows: HUT, chests: {}, doors: { '2,2': { lock: LOCKS.easy } } });
      expect(map.noticeLockpicking(map.doorAt(2, 2)!)).toEqual([]);
    });
  });

  it('give chests their lock', () => {
    const map = GridMap.parse({
      name: 'shed',
      rows: ['#####', '#Pa_#', '#####'],
      chests: { a: { name: 'Safe', contents: [], lock: LOCKS.expert } },
    });
    expect(map.chests[0].lock).toBe(LOCKS.expert);
  });

  it('are on the wasteland: an open shack, and a shed with an easy lock', () => {
    const map = GridMap.parse(WASTELAND, 'wasteland');
    expect(map.doors).toHaveLength(2);
    expect(map.doors.map((d) => d.lock).sort()).toEqual([LOCKS.easy, null]);
  });

  describe('in combat', () => {
    const fightAtTheHut = (creatureId: string, locked = false) => {
      // The creature waits inside, behind the door; a narrow corridor keeps it from going round.
      const map = GridMap.parse({
        name: 'hut',
        rows: ['#####', '#.X.#', '##/##', '#...#', '#.P.#', '#####'],
        chests: {},
        creatures: { X: creatureId },
        doors: locked ? { '2,2': { lock: LOCKS.easy } } : undefined,
      });
      const p = player(map);
      const combat = new Combat(map, p, () => 0.99, 'normal'); // every attack misses
      const [creature] = map.creatures;
      combat.join([creature]);
      return { map, p, combat, creature, door: map.doorAt(2, 2)! };
    };

    it('open for the price of a step when you walk into them', () => {
      const { combat, door } = fightAtTheHut('radroach');
      combat.movePlayer({ x: 0, y: -1 }); // next to the door
      const before = combat.actionPoints;
      const result = combat.movePlayer({ x: 0, y: -1 });
      expect(result.ok).toBe(true);
      expect(result.ok && result.events[0]).toMatchObject({ type: 'door', door });
      expect(door.open).toBe(true);
      expect(combat.actionPoints).toBe(before - 1);
    });

    it("stay shut when locked: you're told so, and it costs nothing", () => {
      const { combat, door } = fightAtTheHut('radroach', true);
      combat.movePlayer({ x: 0, y: -1 });
      const before = combat.actionPoints;
      expect(combat.movePlayer({ x: 0, y: -1 })).toMatchObject({ ok: false, message: 'The door is locked.' });
      expect(door.open).toBe(false);
      expect(combat.actionPoints).toBe(before);
    });

    it('are opened by raiders and people coming for you', () => {
      const { combat, door, creature } = fightAtTheHut('raider');
      const events = combat.endTurn();
      expect(events.some((e) => e.type === 'door' && e.fighter === creature)).toBe(true);
      expect(door.open).toBe(true);
    });

    it('keep animals out, and everyone out when locked', () => {
      const roach = fightAtTheHut('radroach');
      expect(roach.combat.endTurn().some((e) => e.type === 'door')).toBe(false);
      expect(roach.door.open).toBe(false);
      const raider = fightAtTheHut('raider', true);
      expect(raider.combat.endTurn().some((e) => e.type === 'door')).toBe(false);
      expect(raider.door.open).toBe(false);
    });
  });
});
