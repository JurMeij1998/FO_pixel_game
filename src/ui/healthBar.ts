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

/** An enemy's health bar, in world pixels: a thin line above its sprite, red for health left, black for health lost. */
export interface EnemyBar {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The red part, from the left; the rest of the width is black. */
  red: number;
}

export const ENEMY_BAR_WIDTH = 12;
export const ENEMY_BAR_HEIGHT = 1;
/** Pixels between the top of the creature's tile and the bar. */
export const ENEMY_BAR_GAP = 2;

/**
 * Where an enemy's bar goes for a sprite centred at (x, y) in a tile `tileSize` high: centred
 * over it, just above the tile, on whole pixels (the sprite may be mid-step). The bar is always
 * the same length: lost health turns it black from the right.
 */
export function enemyBar(x: number, y: number, tileSize: number, hitPoints: number, max: number): EnemyBar {
  return {
    x: Math.round(x - ENEMY_BAR_WIDTH / 2),
    y: Math.round(y - tileSize / 2) - ENEMY_BAR_GAP - ENEMY_BAR_HEIGHT,
    width: ENEMY_BAR_WIDTH,
    height: ENEMY_BAR_HEIGHT,
    red: healthFill(hitPoints, max, ENEMY_BAR_WIDTH),
  };
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
