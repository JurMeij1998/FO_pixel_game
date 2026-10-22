import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { ListCursor } from './listCursor';
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

export interface MenuOption {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

const MENU_TEXT = { ...TEXT, fontSize: '26px' };
const MENU_SPACING = 46;

/**
 * A centred vertical menu: Up/Down (or W/S) to move, Enter/Space or a click to choose.
 * Key auto-repeat is ignored, so a key still held from the previous screen can't pick an option.
 */
export class MenuList {
  private index: number;
  private readonly texts: Phaser.GameObjects.Text[];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly options: MenuOption[],
  ) {
    this.texts = options.map((option, i) => {
      const text = scene.add.text(x, y + i * MENU_SPACING, '', MENU_TEXT).setOrigin(0.5, 0);
      if (!option.disabled) {
        text
          .setInteractive({ useHandCursor: true })
          .on('pointerover', () => this.highlight(i))
          .on('pointerdown', () => this.choose(i));
      }
      return text;
    });
    this.index = Math.max(0, options.findIndex((o) => !o.disabled));

    const keyboard = scene.input.keyboard!;
    const fresh = (action: () => void) => (event: KeyboardEvent) => {
      if (!event.repeat) action();
    };
    for (const key of ['UP', 'W']) keyboard.on(`keydown-${key}`, fresh(() => this.move(-1)));
    for (const key of ['DOWN', 'S']) keyboard.on(`keydown-${key}`, fresh(() => this.move(1)));
    for (const key of ['ENTER', 'SPACE']) keyboard.on(`keydown-${key}`, fresh(() => this.choose(this.index)));
    this.render();
  }

  setLabel(index: number, label: string): void {
    this.options[index].label = label;
    this.render();
  }

  private move(delta: number): void {
    const count = this.options.length;
    let next = this.index;
    do next = (next + delta + count) % count;
    while (this.options[next].disabled && next !== this.index);
    this.highlight(next);
  }

  private highlight(index: number): void {
    if (index !== this.index) playSound('menuMove');
    this.index = index;
    this.render();
  }

  private choose(index: number): void {
    playSound('menuSelect');
    this.options[index].onSelect();
  }

  private render(): void {
    this.texts.forEach((text, i) => {
      const option = this.options[i];
      const selected = i === this.index;
      text
        .setText(selected ? `> ${option.label} <` : option.label)
        .setColor(option.disabled ? COLORS.dim : selected ? COLORS.bright : COLORS.text);
    });
  }
}

export interface ListRow {
  key: string;
  label: string;
  /** Right-aligned text, such as a weight. */
  detail?: string;
}

/** Modifier keys held during a click. Ctrl also covers Cmd, for Macs. */
export interface ClickModifiers {
  shift: boolean;
  ctrl: boolean;
}

export function modifiersOf(pointer: Phaser.Input.Pointer): ClickModifiers {
  const event = pointer.event as MouseEvent | TouchEvent;
  return { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey };
}

/**
 * A clickable, scrollable column of text rows. The text objects are created once
 * and reused, so it is safe to call setRows() from a row's own click handler.
 */
export class ListView {
  private selected: string | null = null;

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
    onClick: (key: string, modifiers: ClickModifiers) => void,
  ) {
    const width = columns * CHAR_WIDTH;
    for (let i = 0; i < visibleRows; i++) {
      const line = scene.add
        .text(x, y + i * ROW_HEIGHT, '', TEXT)
        .setInteractive(new Phaser.Geom.Rectangle(0, 0, width, ROW_HEIGHT), Phaser.Geom.Rectangle.Contains);
      line.input!.cursor = 'pointer';
      line.on('pointerover', () => line.setColor(COLORS.bright));
      line.on('pointerout', () => this.render());
      line.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        const row = this.rows[this.scroll + i];
        if (row) onClick(row.key, modifiersOf(pointer));
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

  /** The row marked with '>' (and drawn bright), if any. */
  get selectedKey(): string | null {
    return this.selected;
  }

  /** Marks a row with '>', redrawing straight away (also when the rows themselves haven't changed). */
  set selectedKey(key: string | null) {
    if (key === this.selected) return;
    this.selected = key;
    this.render();
  }

  /** Scrolls just far enough to bring the row with this key into view. */
  reveal(key: string): void {
    const index = this.rows.findIndex((row) => row.key === key);
    if (index < 0) return;
    if (index < this.scroll) this.scrollBy(index - this.scroll);
    else if (index >= this.scroll + this.visibleRows) this.scrollBy(index - (this.scroll + this.visibleRows - 1));
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
      const selected = row.key === this.selected;
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

/**
 * Keyboard control for a screen of side-by-side lists: W/S (or Up/Down) move the cursor up and
 * down a list, A/D (or Left/Right) between the lists. Calls `onMove` after every move.
 */
export function bindCursorKeys(scene: Phaser.Scene, cursor: ListCursor, onMove: () => void): void {
  const keyboard = scene.input.keyboard!;
  const move = (moved: boolean) => {
    if (!moved) return;
    playSound('menuMove');
    onMove();
  };
  for (const key of ['W', 'UP']) keyboard.on(`keydown-${key}`, () => move(cursor.moveRow(-1)));
  for (const key of ['S', 'DOWN']) keyboard.on(`keydown-${key}`, () => move(cursor.moveRow(1)));
  for (const key of ['A', 'LEFT']) keyboard.on(`keydown-${key}`, () => move(cursor.moveColumn(-1)));
  for (const key of ['D', 'RIGHT']) keyboard.on(`keydown-${key}`, () => move(cursor.moveColumn(1)));
}

/** Shows the cursor on side-by-side lists: '>' on its row in the list it's in, none in the others. */
export function showCursor(cursor: ListCursor, views: readonly ListView[]): void {
  views.forEach((view, column) => {
    const key = column === cursor.activeColumn ? cursor.selectedKey : null;
    view.selectedKey = key;
    if (key) view.reveal(key);
  });
}
