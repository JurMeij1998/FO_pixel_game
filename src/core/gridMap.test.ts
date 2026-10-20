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
});
