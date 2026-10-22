import { describe, expect, it } from 'vitest';
import { WASTELAND } from '../data/wasteland';
import { GridMap } from './gridMap';

describe('GridMap', () => {
  const tiny = GridMap.parse({
    name: 'tiny',
    rows: ['#####', '#P.a#', '#~,_#', '#####'],
    chests: { a: { name: 'Box', contents: [['knife', 1]] } },
  });

  it('parses tiles, the player start and chests', () => {
    expect(tiny.width).toBe(5);
    expect(tiny.height).toBe(4);
    expect(tiny.playerStart).toEqual({ x: 1, y: 1 });
    expect(tiny.tileAt(1, 2)).toBe('water');
    expect(tiny.chestAt(3, 1)?.contents.count('knife')).toBe(1);
  });

  it('puts markers on walkable neighbouring ground', () => {
    expect(tiny.tileAt(1, 1)).toBe('dirt'); // P has a wall on its left, so it takes the dirt on its right
    expect(tiny.tileAt(3, 1)).toBe('dirt'); // chest a is right of dirt
  });

  it('parses exits and puts arriving players beside the exit back', () => {
    const map = GridMap.parse({
      name: 'crossroads',
      rows: ['#####', '1.P.2', '#####'],
      chests: {},
      exits: { '1': { to: 'west-map' }, '2': { to: 'east-map' } },
    });
    expect(map.exits).toEqual([
      { x: 0, y: 1, to: 'west-map' },
      { x: 4, y: 1, to: 'east-map' },
    ]);
    expect(map.isWalkable(0, 1)).toBe(true);
    expect(map.exitAt(4, 1)?.to).toBe('east-map');
    expect(map.arrivalFrom('east-map')).toEqual({ x: 3, y: 1 });
    expect(map.arrivalFrom('nowhere')).toEqual(map.playerStart);
    expect(() => GridMap.parse({ name: 'bad', rows: ['P1'], chests: {} })).toThrow(/no exit/);
    expect(() => GridMap.parse({ name: 'lost', rows: ['P.'], chests: {}, exits: { '1': { to: 'x' } } })).toThrow(
      /exit '1' is not placed/,
    );
  });

  it('treats trees and wooden walls as cover, but not log piles or bushes', () => {
    const map = GridMap.parse({ name: 'woods', rows: ['P.^..', '..=..', '..%..', '.."..'], chests: {} });
    expect(map.hasLineOfSight({ x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false); // tree
    expect(map.hasLineOfSight({ x: 0, y: 1 }, { x: 4, y: 1 })).toBe(true); // logs
    expect(map.hasLineOfSight({ x: 0, y: 2 }, { x: 4, y: 2 })).toBe(false); // wooden wall
    expect(map.hasLineOfSight({ x: 0, y: 3 }, { x: 4, y: 3 })).toBe(true); // bush
    expect(map.isWalkable(2, 1)).toBe(false);
    expect(map.isWalkable(2, 3)).toBe(true);
  });

  it('blocks walls, water, chests and out-of-bounds tiles', () => {
    expect(tiny.isWalkable(2, 1)).toBe(true);
    expect(tiny.isWalkable(0, 0)).toBe(false);
    expect(tiny.isWalkable(1, 2)).toBe(false);
    expect(tiny.isWalkable(3, 1)).toBe(false);
    expect(tiny.isWalkable(-1, 1)).toBe(false);
    expect(tiny.isWalkable(5, 1)).toBe(false);
  });

  it('blocks line of sight with walls and rocks, but not water', () => {
    const map = GridMap.parse({
      name: 'sight',
      rows: ['.......', '.P.#...', '.......', '.~~~...', '...o...'],
      chests: {},
    });
    expect(map.hasLineOfSight({ x: 1, y: 1 }, { x: 5, y: 1 })).toBe(false); // wall at (3,1)
    expect(map.hasLineOfSight({ x: 5, y: 1 }, { x: 1, y: 1 })).toBe(false); // and the other way
    expect(map.hasLineOfSight({ x: 1, y: 1 }, { x: 5, y: 2 })).toBe(true); // passes below the wall
    expect(map.hasLineOfSight({ x: 0, y: 3 }, { x: 5, y: 3 })).toBe(true); // over water
    expect(map.hasLineOfSight({ x: 1, y: 4 }, { x: 5, y: 4 })).toBe(false); // rock at (3,4)
    expect(map.hasLineOfSight({ x: 2, y: 1 }, { x: 3, y: 1 })).toBe(true); // the end tiles don't count
  });

  it('blocks sight through the gap where two walls meet at a corner', () => {
    const map = GridMap.parse({ name: 'corner', rows: ['P#', '#.'], chests: {} });
    expect(map.hasLineOfSight({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false);

    const open = GridMap.parse({ name: 'half-open', rows: ['P#', '..'], chests: {} });
    expect(open.hasLineOfSight({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(true); // one side is open
  });

  it('loots the corpse in front of you, or else the one you stand on', () => {
    const map = GridMap.parse({ name: 'field', rows: ['PRX.'], chests: {}, creatures: { R: 'radroach', X: 'raider' } });
    const [roach, raider] = map.creatures;
    const right = { x: 1, y: 0 };
    expect(map.corpseToLoot({ x: 1, y: 0 }, right)).toBeUndefined(); // both still alive
    roach.hitPoints = 0;
    raider.hitPoints = 0;
    // Standing on the radroach, facing the raider: the one in front wins.
    expect(map.corpseToLoot({ x: 1, y: 0 }, right)).toBe(raider);
    // Standing on the radroach, facing away from anything: the one underfoot.
    expect(map.corpseToLoot({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(roach);
    // Standing on bare ground with nothing in front: none.
    expect(map.corpseToLoot({ x: 3, y: 0 }, right)).toBeUndefined();
  });

  it("doesn't let an emptied corpse in front hide a full one underfoot", () => {
    const map = GridMap.parse({ name: 'field', rows: ['PXX.'], chests: {}, creatures: { X: 'raider' } });
    const [underfoot, inFront] = map.creatures;
    underfoot.hitPoints = 0;
    inFront.hitPoints = 0;
    inFront.contents.clear(); // already looted
    const right = { x: 1, y: 0 };
    expect(map.corpseToLoot({ x: 1, y: 0 }, right)).toBe(underfoot);
    underfoot.contents.clear(); // both empty: the one in front, as before
    expect(map.corpseToLoot({ x: 1, y: 0 }, right)).toBe(inFront);
  });

  it('prefers the corpse that still has loot when several share a tile', () => {
    const map = GridMap.parse({
      name: 'pile',
      rows: ['PRX'],
      chests: {},
      creatures: { R: 'radroach', X: 'raider' },
    });
    const [roach, raider] = map.creatures;
    roach.hitPoints = 0;
    raider.hitPoints = 0;
    raider.pos = { ...roach.pos }; // the raider died on top of the radroach
    expect(map.corpseAt(1, 0)).toBe(raider);
    raider.contents.clear();
    expect(map.corpseAt(1, 0)).toBe(roach);
  });

  it('identifies creatures by where they spawn', () => {
    const map = GridMap.parse({ name: 'ids', rows: ['PR.R'], chests: {}, creatures: { R: 'radroach' } });
    expect(map.creatures.map((c) => c.id)).toEqual(['radroach@1,0', 'radroach@3,0']);
  });

  describe('people', () => {
    // Gus (G) behind a counter, a guard (W) beside the player, a radroach (R), and the store's crate (a).
    const shop = () =>
      GridMap.parse({
        name: 'shop',
        rows: ['.G.a', '.]..', 'WP..', '...R'],
        chests: { a: { name: 'Stockroom Crate', contents: [['rope', 1]], owner: 'store' } },
        creatures: { G: 'shopkeeper', W: 'guard', R: 'radroach' },
      });
    const people = (map: GridMap) => {
      const [gus, guard, roach] = ['shopkeeper', 'guard', 'radroach'].map((id) => map.creatures.find((c) => c.def.id === id)!);
      return { gus, guard, roach };
    };

    it('start friendly (creatures hostile), and block the way like any creature', () => {
      const map = shop();
      const { gus, guard, roach } = people(map);
      expect([gus.hostile, guard.hostile, roach.hostile]).toEqual([false, false, true]);
      expect(map.isWalkable(1, 0)).toBe(false);
      expect(map.chests[0].owner).toBe('store');
    });

    it('can be talked to face to face or across a counter, but not across open ground', () => {
      const map = shop();
      const { gus, guard } = people(map);
      expect(map.personFacing({ x: 1, y: 2 }, { x: 0, y: -1 })).toBe(gus); // across the counter
      expect(map.personFacing({ x: 1, y: 2 }, { x: -1, y: 0 })).toBe(guard); // right beside
      expect(map.personFacing({ x: 2, y: 2 }, { x: 0, y: -1 })).toBeUndefined(); // dirt, not a counter, in between
      expect(map.personFacing({ x: 3, y: 2 }, { x: 0, y: 1 })).toBeUndefined(); // a radroach won't talk
    });

    it("can't be talked to once hostile or dead", () => {
      const map = shop();
      const { gus, guard } = people(map);
      guard.hostile = true;
      gus.hitPoints = 0;
      expect(map.personFacing({ x: 1, y: 2 }, { x: -1, y: 0 })).toBeUndefined();
      expect(map.personFacing({ x: 1, y: 2 }, { x: 0, y: -1 })).toBeUndefined();
    });

    it('turn hostile together when one of their group is provoked', () => {
      const map = shop();
      const { gus, guard } = people(map);
      expect(map.provoke(gus)).toEqual([gus, guard]);
      expect([gus.hostile, guard.hostile]).toEqual([true, true]);
      expect(map.provoke(guard)).toEqual([]); // already hostile: nobody new
    });

    it("leave the dead out, and don't drag other creatures in", () => {
      const map = shop();
      const { gus, guard, roach } = people(map);
      gus.hitPoints = 0;
      roach.hostile = false; // even a friendly one from another group stays out of it
      expect(map.provoke(guard)).toEqual([guard]);
      expect(roach.hostile).toBe(false);
    });

    it("notice theft from their group's chest while any of them is alive and friendly", () => {
      const map = shop();
      const { gus, guard } = people(map);
      expect(map.noticeTheft(undefined)).toEqual([]); // unowned: no one cares
      expect(map.noticeTheft('someone_else')).toEqual([]);
      expect(map.noticeTheft(map.chests[0].owner)).toEqual([gus, guard]);
      expect(map.noticeTheft('store')).toEqual([]); // already hostile
    });

    it('let you take what you like once the whole group is dead', () => {
      const map = shop();
      const { gus, guard } = people(map);
      gus.hitPoints = 0;
      guard.hitPoints = 0;
      expect(map.noticeTheft('store')).toEqual([]);
    });
  });

  it('rejects malformed maps', () => {
    expect(() => GridMap.parse({ name: 'ragged', rows: ['P..', '..'], chests: {} })).toThrow(/row 1/);
    expect(() => GridMap.parse({ name: 'nostart', rows: ['...'], chests: {} })).toThrow(/player start/);
    expect(() => GridMap.parse({ name: 'nochest', rows: ['P.a'], chests: {} })).toThrow(/no chest/);
    expect(() => GridMap.parse({ name: 'odd', rows: ['P.?'], chests: {} })).toThrow(/unknown character/);
  });

  it('parses the real wasteland map', () => {
    const map = GridMap.parse(WASTELAND);
    expect(map.chests).toHaveLength(4);
    expect(map.isWalkable(map.playerStart.x, map.playerStart.y)).toBe(true);
  });

  it('starts a new game inside the shack, with Rosa right beside you to talk to', () => {
    const map = GridMap.parse(WASTELAND);
    const rosa = map.creatures.find((c) => c.def.id === 'rosa')!;
    expect(rosa.hostile).toBe(false);
    expect(map.personFacing(map.playerStart, { x: -1, y: 0 })).toBe(rosa);
    expect(map.tileAt(map.playerStart.x, map.playerStart.y)).toBe('floor');
    // The footlocker she tells you about is in the shack with you, and isn't anyone's.
    const footlocker = map.chests.find((c) => c.name === 'Footlocker')!;
    expect(footlocker.owner).toBeUndefined();
    expect(map.reachableFrom(map.playerStart).has(`${footlocker.x},${footlocker.y + 1}`)).toBe(true);
  });
});
