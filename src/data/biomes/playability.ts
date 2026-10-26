import { Character } from '../../core/character';
import { Combat } from '../../core/combat';
import { addPos, DIRECTIONS, type GridPos } from '../../core/grid';
import type { GridMap } from '../../core/gridMap';

/**
 * Checks every biome's maps should pass, for use in their tests: returns what's wrong with a
 * generated map, or an empty list if a player can arrive safely through every exit and reach
 * everything on it.
 */
export function playabilityProblems(map: GridMap): string[] {
  const problems: string[] = [];
  if (map.exits.length === 0) problems.push('no exits');
  const visitor = new Character('Visitor', {
    strength: 5,
    perception: 5,
    endurance: 5,
    charisma: 5,
    intelligence: 5,
    agility: 5,
    luck: 5,
  });

  for (const way of map.exits) {
    // Arriving from that exit's map puts the player just inside it.
    const arrival = map.arrivalFrom(way.to);
    const canReach = map.reachableFrom(arrival);
    const reached = (p: GridPos) => canReach.has(`${p.x},${p.y}`);
    for (const exit of map.exits) if (!reached(exit)) problems.push(`from ${way.to}: exit to ${exit.to} unreachable`);
    for (const creature of map.creatures) if (!reached(creature.pos)) problems.push(`from ${way.to}: ${creature.id} unreachable`);
    for (const chest of map.chests) {
      if (!DIRECTIONS.some((d) => reached(addPos(chest, d)))) problems.push(`from ${way.to}: chest ${chest.name} unreachable`);
    }
    for (const person of map.creatures.filter((c) => c.canTalk)) {
      // Someone has to be able to talk to them: from next to them, or across a counter.
      const spots = [...canReach].map((key) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
      });
      const talkable = spots.some((spot) => DIRECTIONS.some((d) => map.personFacing(spot, d) === person));
      if (!talkable) problems.push(`from ${way.to}: no one can talk to ${person.id}`);
    }
    visitor.pos = arrival;
    for (const spotter of Combat.spotters(map, visitor)) problems.push(`${spotter.id} can see the arrival from ${way.to}`);
  }
  return problems;
}

/** Every workbench on the map, and whether a tile beside it can be walked to from the start. */
export function workbenches(map: GridMap): Array<{ x: number; y: number; reachable: boolean }> {
  const reachable = map.reachableFrom(map.playerStart);
  const found: Array<{ x: number; y: number; reachable: boolean }> = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.tileAt(x, y) !== 'workbench') continue;
      const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reachable.has(`${x + dx},${y + dy}`));
      found.push({ x, y, reachable: beside });
    }
  }
  return found;
}
