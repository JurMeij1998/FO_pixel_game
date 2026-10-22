import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import type { Creature } from '../core/creature';
import type { ActionResult } from '../core/result';
import { state } from '../state';
import { COLORS, HEADER_TEXT, TEXT } from '../ui/theme';
import { ListCursor } from '../ui/listCursor';
import { barterClick, barterDetail, barterHeaders, barterRows } from '../ui/trade';
import { addButton, bindCursorKeys, drawPanel, ListView, PANEL, showCursor, type ClickModifiers, type ListRow } from '../ui/widgets';

const LEFT = PANEL.x + 30;
const RIGHT = PANEL.x + 470;

/**
 * Trading with a trader: your pack on the left with what each item sells for, their stock on
 * the right with what it costs. A click sells or buys straight away (see ui/trade.ts); caps
 * change hands at once. Prices depend on your Charisma (core/barter.ts). W/S and A/D move a
 * cursor through the two lists, and E sells or buys the item it's on (Shift+E the whole
 * stack); its description and price show under the lists. Esc goes back to the conversation.
 */
export class BarterScene extends Phaser.Scene {
  private trader!: Creature;
  private yourItems!: ListView;
  private theirItems!: ListView;
  private cursor!: ListCursor;
  /** Set once closing; Phaser only stops the scene on the next frame (see LootScene). */
  private closed = false;
  private yourHeader!: Phaser.GameObjects.Text;
  private theirHeader!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;
  /** The selected item's description and price, under the lists. */
  private details!: Phaser.GameObjects.Text;

  constructor() {
    super('Barter');
  }

  init(data: { trader: Creature }): void {
    this.trader = data.trader;
    this.closed = false;
  }

  create(): void {
    const player = state.player;
    const stock = this.trader.contents;

    drawPanel(this, `BARTER WITH ${this.trader.name.toUpperCase()}`);
    addButton(this, PANEL.x + PANEL.width - 130, PANEL.y + 18, 'Done', () => this.close());

    this.yourHeader = this.add.text(LEFT, 90, '', HEADER_TEXT);
    this.theirHeader = this.add.text(RIGHT, 90, '', HEADER_TEXT);

    // Ten rows each, leaving room underneath for the selected item's details.
    this.yourItems = new ListView(this, LEFT, 122, 36, 10, (itemId, modifiers) => this.trade(0, itemId, modifiers));
    this.theirItems = new ListView(this, RIGHT, 122, 36, 10, (itemId, modifiers) => this.trade(1, itemId, modifiers));
    this.details = this.add.text(LEFT, 380, '', { ...TEXT, wordWrap: { width: PANEL.width - 60 } });
    this.feedback = this.add.text(LEFT, PANEL.y + PANEL.height - 36, '', TEXT);

    const rows = barterRows(player, stock);
    // The cursor starts hidden, so an E pressed out of habit (E used to close this screen) buys or
    // sells nothing until you choose an item; the first W/S/A/D shows it on the trader's stock.
    this.cursor = new ListCursor(keysOf(rows.yours, rows.theirs), 1, { hidden: true });
    bindCursorKeys(this, this.cursor, () => this.refresh());
    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-ESC', () => this.close());
    keyboard.on('keydown-E', (event: KeyboardEvent) => {
      const key = this.cursor.selectedKey;
      if (!event.repeat && key) this.trade(this.cursor.activeColumn, key, { shift: event.shiftKey, ctrl: false });
    });

    this.refresh();
  }

  /** Sells an item from your pack (column 0), or buys one from the trader's stock. */
  private trade(column: number, itemId: string, modifiers: ClickModifiers): void {
    if (this.closed) return;
    this.cursor.focus(column, itemId);
    this.apply(barterClick(column === 0 ? 'yours' : 'theirs', state.player, this.trader.contents, itemId, modifiers));
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
    const key = this.cursor.selectedKey;
    const side = this.cursor.activeColumn === 0 ? 'yours' : 'theirs';
    this.details.setText(key ? barterDetail(state.player, this.trader.name, side, key) : '');
  }

  /** Back to the conversation, which was put to sleep while trading. */
  private close(): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.wake('Dialog');
    this.scene.stop();
  }
}

/** The item ids in each list, left to right, as the cursor walks them. */
function keysOf(...lists: ListRow[][]): string[][] {
  return lists.map((rows) => rows.map((row) => row.key));
}
