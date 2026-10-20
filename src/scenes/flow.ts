import type Phaser from 'phaser';
import { loadSavedGame, startNewGame } from '../state';

/**
 * Switching between the menus and the game. The game scenes build themselves from `state`
 * in create(), so (re)starting them is all it takes to show a different game.
 */

/** Starts the world and HUD for whatever game is in `state`, and closes the calling scene. */
export function startPlaying(from: Phaser.Scene): void {
  from.scene.stop('Hud');
  from.scene.launch('Hud');
  from.scene.start('World'); // restarts it if it was running or paused
}

/** Leaves the game for the main menu. Anything since the last autosave (such as a fight in progress) is dropped. */
export function quitToMenu(from: Phaser.Scene): void {
  if (!loadSavedGame()) startNewGame();
  from.scene.stop('Hud');
  from.scene.stop('World');
  from.scene.start('Menu');
}

/** Shows the controls on top of the calling scene, which resumes when they close. */
export function showControls(from: Phaser.Scene): void {
  from.scene.pause();
  from.scene.launch('Controls', { returnTo: from.scene.key });
}
