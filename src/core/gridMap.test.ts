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

  it('puts markers on the ground to their left', () => {
    expect(tiny.tileAt(1, 1)).toBe('wall'); // P is right of a wall
    expect(tiny.tileAt(3, 1)).toBe('dirt'); // chest a is right of dirt
  });

  it('blocks walls, water, chests and out-of-bounds tiles', () => {
    expect(tiny.isWalkable(2, 1)).toBe(true);
    expect(tiny.isWalkable(0, 0)).toBe(false);
    expect(tiny.isWalkable(1, 2)).toBe(false);
    expect(tiny.isWalkable(3, 1)).toBe(false);
    expect(tiny.isWalkable(-1, 1)).toBe(false);
    expect(tiny.isWalkable(5, 1)).toBe(false);
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
