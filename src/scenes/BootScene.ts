import Phaser from 'phaser';
import { createTextures } from '../gfx/textures';
import { playTestArena } from './flow';

/** Generates the textures, then shows the main menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    createTextures(this);
    // In development, http://localhost:5173/?arena skips the menu and goes straight to the test arena.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('arena')) playTestArena(this);
    else this.scene.start('Menu');
  }
}
