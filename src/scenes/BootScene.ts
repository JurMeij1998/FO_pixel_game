import Phaser from 'phaser';
import { createTextures } from '../gfx/textures';

/** Generates the textures, then starts the world with the HUD on top. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    createTextures(this);
    this.scene.start('World');
    this.scene.launch('Hud');
  }
}
