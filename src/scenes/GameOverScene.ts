import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { COLORS, TEXT, TITLE_TEXT } from '../ui/theme';

/** Shown when the player dies. Restarting reloads the page, which resets all state. */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8).setOrigin(0).setInteractive().on('pointerdown', restart);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, 'YOU HAVE DIED', { ...TITLE_TEXT, fontSize: '40px', color: COLORS.warn })
      .setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, 'The wasteland claims another soul.', TEXT).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, 'Press R or click to try again', TEXT).setOrigin(0.5);
    this.input.keyboard!.on('keydown-R', restart);
  }
}

function restart(): void {
  window.location.reload();
}
