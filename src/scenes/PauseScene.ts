import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { state } from '../state';
import { COLORS, SMALL_TEXT, TITLE_TEXT } from '../ui/theme';
import { closeOverlay, MenuList } from '../ui/widgets';
import { quitToMenu, showControls } from './flow';

const WIDTH = 460;
const HEIGHT = 320;

/** Esc in the world: resume, look up the controls, or go back to the main menu. */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    const centerX = GAME_WIDTH / 2;
    const top = (GAME_HEIGHT - HEIGHT) / 2;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65).setOrigin(0).setInteractive();
    this.add
      .rectangle(centerX, GAME_HEIGHT / 2, WIDTH, HEIGHT, COLORS.panel)
      .setStrokeStyle(2, COLORS.border);
    this.add.text(centerX, top + 40, 'PAUSED', TITLE_TEXT).setOrigin(0.5);

    new MenuList(this, centerX, top + 90, [
      { label: 'Resume', onSelect: () => closeOverlay(this) },
      { label: 'Controls', onSelect: () => showControls(this) },
      { label: 'Quit to main menu', onSelect: () => quitToMenu(this) },
    ]);

    const note = state.combat ? 'Quitting now loses this fight: the game was saved before it.' : 'Your game is saved.';
    this.add.text(centerX, top + HEIGHT - 30, note, SMALL_TEXT).setOrigin(0.5);

    this.input.keyboard!.on('keydown-ESC', () => closeOverlay(this));
  }
}
