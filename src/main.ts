import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { HudScene } from './scenes/HudScene';
import { InventoryScene } from './scenes/InventoryScene';
import { LootScene } from './scenes/LootScene';
import { WorldScene } from './scenes/WorldScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Later scenes draw on top of earlier ones: world, then HUD, then the overlays.
  scene: [BootScene, WorldScene, HudScene, InventoryScene, LootScene, GameOverScene],
});
