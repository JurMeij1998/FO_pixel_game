import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import type { Creature } from '../core/creature';
import { OwnStash, storeItem, takeAll, takeItem, transferQuantity, type Lootable } from '../core/loot';
import type { ActionResult } from '../core/result';
import { state } from '../state';
import { stackRows } from '../ui/format';
import { postMessage } from '../ui/messages';
import { COLORS, HEADER_TEXT, TEXT } from '../ui/theme';
import { ListCursor } from '../ui/listCursor';
import { amountFor } from '../ui/trade';
import { addButton, bindCursorKeys, closeOverlay, drawPanel, ListView, PANEL, showCursor, type ClickModifiers } from '../ui/widgets';

const LEFT = PANEL.x + 30;
const RIGHT = PANEL.x + 470;

/**
 * Two-column transfer screen between the backpack and a chest or corpse; see amountFor() for
 * what a click moves. W/S and A/D move a cursor through the two lists, and E moves the item
 * it's on to the other side (Shift+E the whole stack). Space takes everything and closes it;
 * Esc just closes it.
 */
export class LootScene extends Phaser.Scene {
  private lootable!: Lootable;
  /** Called after the screen has closed, when taking something turned its owners hostile. */
  private onTheft?: (angered: Creature[]) => void;
  /** What you put in yourself this visit, which you may take back without stealing. */
  private stash = new OwnStash();
  /** Whether it was already empty when opened, so closing doesn't claim you emptied it. */
  private wasEmpty = false;
  /**
   * Set once the screen is on its way out. Phaser only stops a scene on the next frame, so
   * this, not isActive(), tells whether something already closed it (being caught stealing).
   */
  private closed = false;
  private yourItems!: ListView;
  private containerItems!: ListView;
  private cursor!: ListCursor;
  private yourHeader!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;

  constructor() {
    super('Loot');
  }

  init(data: { lootable: Lootable; onTheft?: (angered: Creature[]) => void }): void {
    this.lootable = data.lootable;
    this.onTheft = data.onTheft;
    this.stash = new OwnStash();
    this.closed = false;
    this.wasEmpty = data.lootable.contents.isEmpty;
  }

  create(): void {
    drawPanel(this, this.lootable.name.toUpperCase());
    addButton(this, PANEL.x + PANEL.width - 130, PANEL.y + 18, 'Close', () => this.close());

    this.yourHeader = this.add.text(LEFT, 90, '', HEADER_TEXT);
    this.add.text(RIGHT, 90, 'CONTENTS', HEADER_TEXT);

    this.yourItems = new ListView(this, LEFT, 122, 36, 15, (itemId, modifiers) => this.move(0, itemId, modifiers));
    this.containerItems = new ListView(this, RIGHT, 122, 36, 15, (itemId, modifiers) => this.move(1, itemId, modifiers));

    addButton(this, RIGHT, 500, 'Take all (Space)', () => this.takeAllAndClose());
    this.feedback = this.add.text(LEFT, PANEL.y + PANEL.height - 36, '', TEXT);

    this.cursor = new ListCursor(this.keys(), 1);
    bindCursorKeys(this, this.cursor, () => this.refresh());
    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-ESC', () => this.close());
    // Not on key repeat, so holding the E that opened the chest doesn't also empty it.
    keyboard.on('keydown-E', (event: KeyboardEvent) => {
      const key = this.cursor.selectedKey;
      if (!event.repeat && key) this.move(this.cursor.activeColumn, key, { shift: event.shiftKey, ctrl: false });
    });
    keyboard.on('keydown-SPACE', (event: KeyboardEvent) => {
      // Ignore auto-repeat, so holding the Space that opened the chest doesn't also loot it.
      if (!event.repeat) this.takeAllAndClose();
    });

    this.refresh();
  }

  /** Moves an item to the other side: from your pack (column 0) into the chest, or out of it. */
  private move(column: number, itemId: string, modifiers: ClickModifiers): void {
    const player = state.player;
    const contents = this.lootable.contents;
    this.cursor.focus(column, itemId);
    if (column === 0) {
      const quantity = transferQuantity(player.backpack.count(itemId), amountFor(modifiers));
      const result = storeItem(player, contents, itemId, quantity);
      if (result.ok) this.stash.stored(itemId, quantity);
      this.apply(result);
    } else {
      const quantity = transferQuantity(contents.count(itemId), amountFor(modifiers));
      this.take(() => takeItem(player, contents, itemId, quantity));
    }
  }

  /**
   * Takes everything that fits and closes the screen; what happened goes to the message log.
   * If nothing could be taken (it's empty, or it's all too heavy) the screen stays open, saying why.
   */
  private takeAllAndClose(): void {
    const result = this.take(() => takeAll(state.player, this.lootable.contents));
    if (!result.ok || this.closed) return; // refused, or caught stealing (already closed)
    // Emptying it says so on closing; otherwise say what was left behind.
    if (!this.lootable.contents.isEmpty) postMessage(this, result.message);
    this.close();
  }

  /**
   * Taking something out. From something that belongs to someone, that's stealing (unless you
   * put it there yourself): if they notice, the screen closes and the fight is on (what was
   * taken stays taken).
   */
  private take(transfer: () => ActionResult): ActionResult {
    const contents = this.lootable.contents;
    const before = contents.items.map(({ itemId, quantity }) => [itemId, quantity] as const);
    const result = transfer();
    this.apply(result);
    if (!result.ok) return result;
    let stolen = 0;
    for (const [itemId, quantity] of before) stolen += this.stash.took(itemId, quantity - contents.count(itemId));
    if (stolen === 0) return result;
    const angered = state.map.noticeTheft(this.lootable.owner);
    if (angered.length === 0) return result;
    this.closed = true;
    closeOverlay(this);
    this.onTheft?.(angered);
    return result;
  }

  private apply(result: ActionResult): void {
    if (result.ok) playSound('pickup');
    this.feedback.setText(result.message).setColor(result.ok ? COLORS.text : COLORS.warn);
    this.refresh();
  }

  private refresh(): void {
    const player = state.player;
    this.yourHeader.setText(`YOU  (${player.carriedWeight}/${player.carryCapacity} lb)`);
    this.yourItems.setRows(stackRows(player.backpack.items));
    this.containerItems.setRows(stackRows(this.lootable.contents.items));
    this.cursor.update(this.keys());
    showCursor(this.cursor, [this.yourItems, this.containerItems]);
  }

  /** The item ids in each list, left to right, as the cursor walks them. */
  private keys(): string[][] {
    return [state.player.backpack.items, this.lootable.contents.items].map((items) => items.map((s) => s.itemId));
  }

  private close(): void {
    if (this.closed) return;
    this.closed = true;
    if (!this.wasEmpty && this.lootable.contents.isEmpty) postMessage(this, `You empty the ${this.lootable.name}.`);
    closeOverlay(this);
  }
}
