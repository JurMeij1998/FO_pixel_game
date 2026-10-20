import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { clearSave } from '../storage';
import { COLORS, TEXT, TITLE_TEXT } from '../ui/theme';
import { addButton } from '../ui/widgets';

/**
 * Shown when the player dies. Both options reload the page: the game then starts from
 * the autosave (made just before the fight), or from scratch once the save is cleared.
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8).setOrigin(0).setInteractive();
    this.add
      .text(centerX, centerY - 60, 'YOU HAVE DIED', { ...TITLE_TEXT, fontSize: '40px', color: COLORS.warn })
      .setOrigin(0.5);
    this.add.text(centerX, centerY, 'The wasteland claims another soul.', TEXT).setOrigin(0.5);

    addButton(this, centerX - 230, centerY + 50, 'R: Load last save', loadLastSave);
    addButton(this, centerX + 30, centerY + 50, 'N: New game', newGame);

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-R', loadLastSave);
    keyboard.on('keydown-N', newGame);
  }
}

function loadLastSave(): void {
  window.location.reload();
}

function newGame(): void {
  clearSave();
  window.location.reload();
}
