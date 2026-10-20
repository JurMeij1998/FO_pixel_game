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
    visitor.pos = arrival;
    for (const spotter of Combat.spotters(map, visitor)) problems.push(`${spotter.id} can see the arrival from ${way.to}`);
  }
  return problems;
}
