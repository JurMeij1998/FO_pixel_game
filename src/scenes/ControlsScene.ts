import Phaser from 'phaser';
import { CONTROL_ROWS } from '../ui/controls';
import { HEADER_TEXT, SMALL_TEXT, TEXT } from '../ui/theme';
import { addButton, drawPanel, PANEL } from '../ui/widgets';

/** Characters per column; at 16px Courier (9.6 px a character) the table fits the panel. */
const COLUMNS = [22, 36, 26];
const TABLE_TEXT = { ...TEXT, fontSize: '16px' };

/** A table of every key binding, opened from the main menu or the pause menu. */
export class ControlsScene extends Phaser.Scene {
  private returnTo = 'Menu';

  constructor() {
    super('Controls');
  }

  init(data: { returnTo: string }): void {
    this.returnTo = data.returnTo;
  }

  create(): void {
    drawPanel(this, 'CONTROLS');
    addButton(this, PANEL.x + PANEL.width - 130, PANEL.y + 18, 'Close', () => this.close());

    const left = PANEL.x + 30;
    const row = (cells: string[]) => cells.map((cell, i) => cell.padEnd(COLUMNS[i])).join('');
    this.add.text(left, 100, row(['KEY', 'EXPLORING', 'IN COMBAT']), { ...HEADER_TEXT, fontSize: '16px' });
    this.add.text(left, 130, CONTROL_ROWS.map(row).join('\n'), { ...TABLE_TEXT, lineSpacing: 4 });
    this.add.text(left, PANEL.y + PANEL.height - 36, 'Esc or Enter to go back', SMALL_TEXT);

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-ESC', () => this.close());
    keyboard.on('keydown-ENTER', (event: KeyboardEvent) => {
      if (!event.repeat) this.close();
    });
  }

  private close(): void {
    this.scene.resume(this.returnTo);
    this.scene.stop();
  }
}
