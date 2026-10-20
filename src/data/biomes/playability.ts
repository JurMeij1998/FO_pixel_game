import { Character } from '../../core/character';
import { Combat } from '../../core/combat';
import { addPos, DIRECTIONS, type GridPos } from '../../core/grid';
import { isBlockingTile, type GridMap } from '../../core/gridMap';

/**
 * Checks every biome's maps should pass, for use in their tests: returns what's wrong with a
 * generated map, or an empty list if a player can arrive safely and reach everything on it.
 */
export function playabilityProblems(map: GridMap, arrivingFrom: string): string[] {
  const problems: string[] = [];
  const arrival = map.arrivalFrom(arrivingFrom);
  if (!map.exits.some((e) => e.to === arrivingFrom)) problems.push(`no exit back to ${arrivingFrom}`);

  const canReach = reachableFrom(map, arrival);
  const reached = (p: GridPos) => canReach.has(`${p.x},${p.y}`);
  for (const exit of map.exits) if (!reached(exit)) problems.push(`exit to ${exit.to} unreachable`);
  for (const creature of map.creatures) if (!reached(creature.pos)) problems.push(`${creature.id} unreachable`);
  for (const chest of map.chests) {
    if (!DIRECTIONS.some((d) => reached(addPos(chest, d)))) problems.push(`chest ${chest.name} unreachable`);
  }

  const visitor = new Character('Visitor', {
    strength: 5,
    perception: 5,
    endurance: 5,
    charisma: 5,
    intelligence: 5,
    agility: 5,
    luck: 5,
  });
  visitor.pos = arrival;
  for (const spotter of Combat.spotters(map, visitor)) problems.push(`${spotter.id} can see the arrival`);
  return problems;
}

/** Tiles reachable on foot; creatures don't count as obstacles (they move, or die). */
function reachableFrom(map: GridMap, start: GridPos): Set<string> {
  const key = (p: GridPos) => `${p.x},${p.y}`;
  const seen = new Set([key(start)]);
  const queue = [start];
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
