import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import type { Creature } from '../core/creature';
import type { ActionResult } from '../core/result';
import { state } from '../state';
import { COLORS, HEADER_TEXT, SMALL_TEXT, TEXT } from '../ui/theme';
import { ListCursor } from '../ui/listCursor';
import { barterClick, barterHeaders, barterRows } from '../ui/trade';
import { addButton, bindCursorKeys, drawPanel, ListView, PANEL, showCursor, type ListRow } from '../ui/widgets';

const LEFT = PANEL.x + 30;
const RIGHT = PANEL.x + 470;

/**
 * Trading with a trader: your pack on the left with what each item sells for, their stock on
 * the right with what it costs. A click sells or buys straight away (see ui/trade.ts); caps
 * change hands at once. Prices depend on your Charisma (core/barter.ts). W/S and A/D move a
 * cursor through the two lists. Closing it goes back to the conversation.
 */
export class BarterScene extends Phaser.Scene {
  private trader!: Creature;
  private yourItems!: ListView;
  private theirItems!: ListView;
  private cursor!: ListCursor;
  private yourHeader!: Phaser.GameObjects.Text;
  private theirHeader!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;

  constructor() {
    super('Barter');
  }

  init(data: { trader: Creature }): void {
    this.trader = data.trader;
  }

  create(): void {
    const player = state.player;
    const stock = this.trader.contents;

    drawPanel(this, `BARTER WITH ${this.trader.name.toUpperCase()}`);
    addButton(this, PANEL.x + PANEL.width - 130, PANEL.y + 18, 'Done', () => this.close());

    this.yourHeader = this.add.text(LEFT, 90, '', HEADER_TEXT);
    this.theirHeader = this.add.text(RIGHT, 90, '', HEADER_TEXT);
    this.add.text(LEFT, 500, 'Click: trade 1   Ctrl+click: half   Shift+click: all', SMALL_TEXT);

    this.yourItems = new ListView(this, LEFT, 122, 36, 15, (itemId, modifiers) => {
      this.cursor.focus(0, itemId);
      this.apply(barterClick('yours', player, stock, itemId, modifiers));
    });
    this.theirItems = new ListView(this, RIGHT, 122, 36, 15, (itemId, modifiers) => {
      this.cursor.focus(1, itemId);
      this.apply(barterClick('theirs', player, stock, itemId, modifiers));
    });
    this.feedback = this.add.text(LEFT, PANEL.y + PANEL.height - 36, '', TEXT);

    const rows = barterRows(player, stock);
    this.cursor = new ListCursor(keysOf(rows.yours, rows.theirs), 1);
    bindCursorKeys(this, this.cursor, () => this.refresh());
    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-ESC', () => this.close());
    keyboard.on('keydown-E', () => this.close());

    this.refresh();
  }

  private apply(result: ActionResult): void {
    if (result.ok) playSound('pickup');
    this.feedback.setText(result.message).setColor(result.ok ? COLORS.text : COLORS.warn);
    this.refresh();
  }

  private refresh(): void {
    const stock = this.trader.contents;
    const headers = barterHeaders(state.player, this.trader.name, stock);
    const rows = barterRows(state.player, stock);
    this.yourHeader.setText(headers.yours);
    this.theirHeader.setText(headers.theirs);
    this.yourItems.setRows(rows.yours);
    this.theirItems.setRows(rows.theirs);
    this.cursor.update(keysOf(rows.yours, rows.theirs));
    showCursor(this.cursor, [this.yourItems, this.theirItems]);
  }

  /** Back to the conversation, which was put to sleep while trading. */
  private close(): void {
    this.scene.wake('Dialog');
    this.scene.stop();
  }
}

/** The item ids in each list, left to right, as the cursor walks them. */
function keysOf(...lists: ListRow[][]): string[][] {
  return lists.map((rows) => rows.map((row) => row.key));
}
