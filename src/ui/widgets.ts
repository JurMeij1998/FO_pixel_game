import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { CHAR_WIDTH, COLORS, DIM_TEXT, ROW_HEIGHT, TEXT, TITLE_TEXT } from './theme';

export const PANEL = { x: 30, y: 30, width: 900, height: 580 };

/** Dims the world behind an overlay scene and draws the framed panel with its title. */
export function drawPanel(scene: Phaser.Scene, title: string): void {
  // The backdrop is interactive so clicks don't fall through to anything behind it.
  scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65).setOrigin(0).setInteractive();
  scene.add
    .rectangle(PANEL.x, PANEL.y, PANEL.width, PANEL.height, COLORS.panel)
    .setOrigin(0)
    .setStrokeStyle(2, COLORS.border);
  scene.add.text(PANEL.x + 30, PANEL.y + 16, title, TITLE_TEXT);
}

/** Stops an overlay scene and hands control back to the world. */
export function closeOverlay(scene: Phaser.Scene): void {
  scene.scene.resume('World');
  scene.scene.stop();
}

export function addButton(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void) {
  const button = scene.add.text(x, y, `[ ${label} ]`, TEXT).setInteractive({ useHandCursor: true });
  button.on('pointerover', () => button.setColor(COLORS.bright));
  button.on('pointerout', () => button.setColor(COLORS.text));
  button.on('pointerdown', onClick);
  return button;
}

export interface ListRow {
  key: string;
  label: string;
  /** Right-aligned text, such as a weight. */
  detail?: string;
}

/**
 * A clickable, scrollable column of text rows. The text objects are created once
 * and reused, so it is safe to call setRows() from a row's own click handler.
 */
export class ListView {
  selectedKey: string | null = null;

  private rows: readonly ListRow[] = [];
  private scroll = 0;
  private readonly lines: Phaser.GameObjects.Text[] = [];
  private readonly moreAbove: Phaser.GameObjects.Text;
  private readonly moreBelow: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly columns: number,
    private readonly visibleRows: number,
    onClick: (key: string) => void,
  ) {
    const width = columns * CHAR_WIDTH;
    for (let i = 0; i < visibleRows; i++) {
      const line = scene.add
        .text(x, y + i * ROW_HEIGHT, '', TEXT)
        .setInteractive(new Phaser.Geom.Rectangle(0, 0, width, ROW_HEIGHT), Phaser.Geom.Rectangle.Contains);
      line.input!.cursor = 'pointer';
      line.on('pointerover', () => line.setColor(COLORS.bright));
      line.on('pointerout', () => this.render());
      line.on('pointerdown', () => {
        const row = this.rows[this.scroll + i];
        if (row) onClick(row.key);
      });
      this.lines.push(line);
    }

    this.moreAbove = scene.add.text(x + width, y, '▲', DIM_TEXT);
    this.moreBelow = scene.add.text(x + width, y + (visibleRows - 1) * ROW_HEIGHT, '▼', DIM_TEXT);
    const onWheel = (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      const inside = pointer.x >= x && pointer.x <= x + width && pointer.y >= y && pointer.y <= y + visibleRows * ROW_HEIGHT;
      if (inside) this.scrollBy(Math.sign(dy));
    };
    scene.input.on('wheel', onWheel);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.off('wheel', onWheel));
  }

  setRows(rows: readonly ListRow[]): void {
    this.rows = rows;
    this.scrollBy(0); // re-clamp after the list shrank
  }

  private scrollBy(delta: number): void {
    const maxScroll = Math.max(0, this.rows.length - this.visibleRows);
    this.scroll = Phaser.Math.Clamp(this.scroll + delta, 0, maxScroll);
    this.render();
  }

  private render(): void {
    this.lines.forEach((line, i) => {
      const row = this.rows[this.scroll + i];
      line.input!.enabled = row !== undefined;
      if (!row) {
        const isEmptyHint = this.rows.length === 0 && i === 0;
        line.setText(isEmptyHint ? '  (empty)' : '').setColor(COLORS.dim);
        return;
      }
      const selected = row.key === this.selectedKey;
      line.setText(this.formatRow(row, selected)).setColor(selected ? COLORS.bright : COLORS.text);
    });
    this.moreAbove.setVisible(this.scroll > 0);
    this.moreBelow.setVisible(this.scroll + this.visibleRows < this.rows.length);
  }

  /** The font is monospace, so padding with spaces lines the details up in a column. */
  private formatRow(row: ListRow, selected: boolean): string {
    const detail = row.detail ? ` ${row.detail}` : '';
    const width = this.columns - 2 - detail.length;
    const label = row.label.length > width ? `${row.label.slice(0, width - 1)}…` : row.label.padEnd(width);
    return `${selected ? '>' : ' '} ${label}${detail}`;
  }
}
