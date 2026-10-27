import Phaser from 'phaser';
import { questEntries, type QuestEntry } from '../core/quests';
import { state } from '../state';
import { ListCursor } from '../ui/listCursor';
import { isClosed, questRow } from '../ui/questList';
import { CHAR_WIDTH, COLORS, HEADER_TEXT, ROW_HEIGHT, TEXT } from '../ui/theme';
import { addButton, bindCursorKeys, closeOverlay, drawPanel, PANEL } from '../ui/widgets';

const LEFT = PANEL.x + 30;
const RIGHT = PANEL.x + 500;
const LIST_TOP = 130;
/** The list's width in characters; the STATUS column ends here. */
const LIST_COLUMNS = 40;

/**
 * The quests you've taken on, like the workbench's list: QUEST and STATUS on the left (open
 * ones first, finished and failed ones dimmed below them), and on the right what's left to do
 * for the selected one. W/S (or the arrows, or a click) choose; J or Esc closes. Opened with J,
 * which does nothing until you've taken a quest on.
 */
export class QuestsScene extends Phaser.Scene {
  private entries: QuestEntry[] = [];
  private cursor!: ListCursor;
  private rows: Phaser.GameObjects.Text[] = [];
  private title!: Phaser.GameObjects.Text;
  private todo!: Phaser.GameObjects.Text;

  constructor() {
    super('Quests');
  }

  create(): void {
    drawPanel(this, 'QUESTS');
    addButton(this, PANEL.x + PANEL.width - 130, PANEL.y + 18, 'Close', () => closeOverlay(this));

    this.entries = questEntries(state);
    this.cursor = new ListCursor([this.entries.map((e) => e.id)]);
    this.add.text(LEFT, LIST_TOP - 32, 'QUEST', HEADER_TEXT);
    this.add.text(LEFT + LIST_COLUMNS * CHAR_WIDTH, LIST_TOP - 32, 'STATUS', HEADER_TEXT).setOrigin(1, 0);
    this.rows = this.entries.map((entry, i) =>
      this.add
        .text(LEFT, LIST_TOP + i * ROW_HEIGHT, '', TEXT)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.cursor.focus(0, entry.id);
          this.refresh();
        }),
    );
    this.title = this.add.text(RIGHT, LIST_TOP - 32, '', HEADER_TEXT);
    this.todo = this.add.text(RIGHT, LIST_TOP, '', { ...TEXT, wordWrap: { width: PANEL.x + PANEL.width - RIGHT - 30 } });

    bindCursorKeys(this, this.cursor, () => this.refresh());
    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-J', (event: KeyboardEvent) => !event.repeat && closeOverlay(this));
    keyboard.on('keydown-ESC', () => closeOverlay(this));
    this.refresh();
  }

  private refresh(): void {
    const selected = this.cursor.selectedKey;
    this.entries.forEach((entry, i) => {
      const isSelected = entry.id === selected;
      this.rows[i]
        .setText(questRow(entry, LIST_COLUMNS, isSelected))
        .setColor(isSelected ? COLORS.bright : isClosed(entry) ? COLORS.dim : COLORS.text);
    });
    const entry = this.entries.find((e) => e.id === selected);
    this.title.setText(entry ? entry.title.toUpperCase() : '');
    this.todo.setText(entry?.todo ?? '');
  }
}
