import Phaser from 'phaser';
import { createTextures } from '../gfx/textures';

/** Generates the textures, then shows the main menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    createTextures(this);
    this.scene.start('Menu');
  }
}
