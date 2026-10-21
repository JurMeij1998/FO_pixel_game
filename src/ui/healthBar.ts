import type { Character } from '../core/character';

/**
 * The parts of the health bar and the gun line above it that aren't drawing, kept free of
 * Phaser so they can be tested.
 */

/**
 * How many pixels of a bar `width` wide are filled for `hitPoints` out of `max`. Rounded up,
 * so a single hit point left still shows; empty only at 0.
 */
export function healthFill(hitPoints: number, max: number, width: number): number {
  if (max <= 0 || hitPoints <= 0) return 0;
  return Math.min(width, Math.ceil((width * hitPoints) / max));
}

/** "41/41": the numbers shown inside the bar. */
export function healthLabel(player: Character): string {
  return `${player.hitPoints}/${player.maxHitPoints}`;
}

/**
 * The weapon in hand, for the line above the health bar: a gun's name with the rounds in its
 * magazine out of what it holds, and the spare rounds in the backpack ("Hunting Rifle 5/5 (+10)");
 * just the name for a melee weapon, or "Fists" with nothing in hand.
 */
export function weaponLine(player: Character): string {
  const attack = player.attack;
  const magazine = player.activeWeapon?.weapon?.magazineSize;
  if (!attack.ammo || magazine === undefined) return attack.name;
  return `${attack.name} ${player.loadedRounds()}/${magazine} (+${player.backpack.count(attack.ammo)})`;
}
