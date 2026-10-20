import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { loadSavedGame, startNewGame, state } from '../state';
import { COLORS, TEXT, TITLE_TEXT } from '../ui/theme';
import { MenuList } from '../ui/widgets';
import { playTestArena, quitToMenu, startPlaying } from './flow';

/** Shown when the player dies. The last save was made just before the fight. */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8).setOrigin(0).setInteractive();
    this.add
      .text(centerX, centerY - 110, 'YOU HAVE DIED', { ...TITLE_TEXT, fontSize: '40px', color: COLORS.warn })
      .setOrigin(0.5);
    this.add.text(centerX, centerY - 55, 'The wasteland claims another soul.', TEXT).setOrigin(0.5);

    new MenuList(this, centerX, centerY - 5, [
      ...(state.sandbox ? [{ label: 'Restart test arena', onSelect: () => playTestArena(this) }] : []),
      {
        label: 'Load last save',
        onSelect: () => {
          if (!loadSavedGame()) startNewGame();
          startPlaying(this);
        },
      },
      {
        label: 'New game',
        onSelect: () => {
          startNewGame();
          startPlaying(this);
        },
      },
      { label: 'Main menu', onSelect: () => quitToMenu(this) },
    ]);
  }
}
