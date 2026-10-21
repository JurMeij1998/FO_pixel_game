import type { AttackEvent, CombatEvent } from '../core/combat';
import type { Fighter } from '../core/fighter';

/**
 * Health as the screen shows it. Combat resolves a whole attack or enemy turn at once and the
 * scene then plays it back, so a fighter's real `hitPoints` are already final while the
 * animation is still on its first move. While events play, the health bars show what's been
 * shown so far instead: each fighter's health before the first attack on it, then after each
 * hit as it lands. Pure bookkeeping, no Phaser; the world scene drives it, the HUD reads it.
 */
const held = new Map<Fighter, number>();

/** The health to draw for a fighter: what the screen has shown so far, or their real health. */
export function shownHitPoints(fighter: Fighter): number {
  return held.get(fighter) ?? fighter.hitPoints;
}

/** Before playing events back: holds everyone they hit at their health before the first hit. */
export function holdHealth(events: readonly CombatEvent[]): void {
  for (const event of events) {
    if (event.type === 'attack' && !held.has(event.target)) held.set(event.target, event.targetHitPoints.before);
  }
}

/** As an attack is shown landing: its target's health drops to what the hit left. */
export function showHit(event: AttackEvent): void {
  if (held.has(event.target)) held.set(event.target, event.targetHitPoints.after);
}

/** Once the events have been played: back to everyone's real health. */
export function releaseHealth(): void {
  held.clear();
}
