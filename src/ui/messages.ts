import type Phaser from 'phaser';

/** Game-wide event carrying one line for the HUD message log. */
export const MESSAGE_EVENT = 'message';

export function postMessage(scene: Phaser.Scene, text: string): void {
  scene.game.events.emit(MESSAGE_EVENT, text);
}
