import Phaser from 'phaser';
import { createTextures } from '../gfx/textures';
import { playTestArena, playTestShop } from './flow';

/** Generates the textures, then shows the main menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    createTextures(this);
    // In development, http://localhost:5173/?arena (or ?shop) skips the menu and goes straight to
    // the test arena (or the test shop).
    const query = new URLSearchParams(window.location.search);
    if (import.meta.env.DEV && query.has('arena')) playTestArena(this);
    else if (import.meta.env.DEV && query.has('shop')) playTestShop(this);
    else this.scene.start('Menu');
  }
}
