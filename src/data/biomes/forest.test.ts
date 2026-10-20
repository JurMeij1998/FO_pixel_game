import { describe, expect, it } from 'vitest';
import { Character } from '../../core/character';
import { Combat } from '../../core/combat';
import { generateMap } from '../../core/generation/biome';
import { addPos, DIRECTIONS, type GridPos } from '../../core/grid';
import { GridMap, isBlockingTile } from '../../core/gridMap';
import { FOREST } from './forest';

const EXITS = [{ side: 'west' as const, to: 'wasteland' }];
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1);

/** Tiles reachable on foot from the player start; creatures don't count as obstacles (they move). */
function reachable(map: GridMap): Set<string> {
  const key = (p: GridPos) => `${p.x},${p.y}`;
  const seen = new Set([key(map.playerStart)]);
  const queue = [map.playerStart];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const direction of DIRECTIONS) {
      const next = addPos(current, direction);
      const tile = map.tileAt(next.x, next.y);
      if (!tile || isBlockingTile(tile) || map.chestAt(next.x, next.y) || seen.has(key(next))) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }
  return seen;
}

describe('forest biome', () => {
  it('generates the same map from the same seed', () => {
    expect(generateMap(FOREST, 1234, EXITS)).toEqual(generateMap(FOREST, 1234, EXITS));
    expect(generateMap(FOREST, 1234, EXITS).rows).not.toEqual(generateMap(FOREST, 1235, EXITS).rows);
  });

  it.each(SEEDS)('seed %i: everything can be reached, and nothing sees you arrive', (seed) => {
    const map = GridMap.parse(generateMap(FOREST, seed, EXITS), 'forest');
    expect(map.width).toBe(FOREST.width);
    expect(map.exits.map((e) => e.to)).toEqual(['wasteland']);

    const canReach = reachable(map);
    for (const exit of map.exits) expect(canReach.has(`${exit.x},${exit.y}`)).toBe(true);
    for (const creature of map.creatures) expect(canReach.has(`${creature.pos.x},${creature.pos.y}`)).toBe(true);
    for (const chest of map.chests) {
      const sides = DIRECTIONS.map((d) => addPos(chest, d));
      expect(sides.some((p) => canReach.has(`${p.x},${p.y}`))).toBe(true);
    }

    expect(map.creatures.length).toBeGreaterThan(0);
    const player = new Character('Visitor', {
      strength: 5,
      perception: 5,
      endurance: 5,
      charisma: 5,
      intelligence: 5,
      agility: 5,
      luck: 5,
    });
    player.pos = map.arrivalFrom('wasteland');
    const exit = map.exits[0];
    expect(player.pos).toEqual({ x: exit.x + 1, y: exit.y }); // just inside the west exit, not along the edge
    expect(Combat.spotters(map, player)).toEqual([]);
  });

  it('usually has a logging camp and other structures', () => {
    const chestNames = SEEDS.flatMap((seed) => Object.values(generateMap(FOREST, seed, EXITS).chests).map((c) => c.name));
    const count = (name: string) => chestNames.filter((n) => n === name).length;
    expect(count('Supply Crate')).toBeGreaterThan(SEEDS.length / 3);
    expect(count("Hunter's Footlocker")).toBeGreaterThan(0);
    expect(count('Abandoned Stash')).toBeGreaterThan(0);
  });
});
