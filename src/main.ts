import Phaser from 'phaser';
import { toggleMuted } from './audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { BarterScene } from './scenes/BarterScene';
import { CharacterScene } from './scenes/CharacterScene';
import { ControlsScene } from './scenes/ControlsScene';
import { CreationScene } from './scenes/CreationScene';
import { DialogScene } from './scenes/DialogScene';
import { GameOverScene } from './scenes/GameOverScene';
import { HudScene } from './scenes/HudScene';
import { InventoryScene } from './scenes/InventoryScene';
import { LockpickScene } from './scenes/LockpickScene';
import { WorkbenchScene } from './scenes/WorkbenchScene';
import { LootScene } from './scenes/LootScene';
import { MenuScene } from './scenes/MenuScene';
import { PauseScene } from './scenes/PauseScene';
import { QuestsScene } from './scenes/QuestsScene';
import { WorldScene } from './scenes/WorldScene';
import { isTextEntry } from './ui/creationKeys';

// M toggles sound on every screen, so it is handled once here rather than in each scene; not
// while typing a name, where M is a letter.
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM' && !event.repeat && !isTextEntry()) toggleMuted();
});

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
  // Later scenes draw on top of earlier ones: world, then HUD, then the overlays, then Controls
  // (which can open over the pause menu).
  scene: [
    BootScene,
    MenuScene,
    CreationScene,
    WorldScene,
    HudScene,
    InventoryScene,
    LootScene,
    LockpickScene,
    WorkbenchScene,
    DialogScene,
    BarterScene,
    CharacterScene,
    QuestsScene,
    PauseScene,
    GameOverScene,
    ControlsScene,
  ],
});
