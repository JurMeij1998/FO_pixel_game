import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import type { Creature } from '../core/creature';
import { OwnStash, storeItem, takeAll, takeItem, transferQuantity, type Lootable } from '../core/loot';
import type { ActionResult } from '../core/result';
import { state } from '../state';
import { stackRows } from '../ui/format';
import { postMessage } from '../ui/messages';
import { COLORS, HEADER_TEXT, SMALL_TEXT, TEXT } from '../ui/theme';
import { ListCursor } from '../ui/listCursor';
import { amountFor } from '../ui/trade';
import { addButton, bindCursorKeys, closeOverlay, drawPanel, ListView, PANEL, showCursor } from '../ui/widgets';

const LEFT = PANEL.x + 30;
const RIGHT = PANEL.x + 470;

/**
 * Two-column transfer screen between the backpack and a chest or corpse; see amountFor() for
 * what a click moves. W/S and A/D move a cursor through the two lists.
 */
export class LootScene extends Phaser.Scene {
  private lootable!: Lootable;
  /** Called after the screen has closed, when taking something turned its owners hostile. */
  private onTheft?: (angered: Creature[]) => void;
  /** What you put in yourself this visit, which you may take back without stealing. */
  private stash = new OwnStash();
  /** Whether it was already empty when opened, so closing doesn't claim you emptied it. */
  private wasEmpty = false;
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
    this.wasEmpty = data.lootable.contents.isEmpty;
  }

  create(): void {
    const player = state.player;

    drawPanel(this, this.lootable.name.toUpperCase());
    addButton(this, PANEL.x + PANEL.width - 130, PANEL.y + 18, 'Close', () => this.close());

    this.yourHeader = this.add.text(LEFT, 90, '', HEADER_TEXT);
    this.add.text(RIGHT, 90, 'CONTENTS', HEADER_TEXT);
    this.add.text(LEFT, 500, 'Click: move 1   Ctrl+click: half   Shift+click: all', SMALL_TEXT);

    this.yourItems = new ListView(this, LEFT, 122, 36, 15, (itemId, modifiers) => {
      this.cursor.focus(0, itemId);
      const quantity = transferQuantity(player.backpack.count(itemId), amountFor(modifiers));
      const result = storeItem(player, this.lootable.contents, itemId, quantity);
      if (result.ok) this.stash.stored(itemId, quantity);
      this.apply(result);
    });
    this.containerItems = new ListView(this, RIGHT, 122, 36, 15, (itemId, modifiers) => {
      this.cursor.focus(1, itemId);
      const quantity = transferQuantity(this.lootable.contents.count(itemId), amountFor(modifiers));
      this.take(() => takeItem(player, this.lootable.contents, itemId, quantity));
    });

    addButton(this, RIGHT, 500, 'Take all (Space)', () => this.take(() => takeAll(player, this.lootable.contents)));
    this.feedback = this.add.text(LEFT, PANEL.y + PANEL.height - 36, '', TEXT);

    this.cursor = new ListCursor(this.keys(), 1);
    bindCursorKeys(this, this.cursor, () => this.refresh());
    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-ESC', () => this.close());
    keyboard.on('keydown-E', () => this.close());
    keyboard.on('keydown-SPACE', (event: KeyboardEvent) => {
      // Ignore auto-repeat, so holding the Space that opened the chest doesn't also loot it.
      if (!event.repeat) this.take(() => takeAll(player, this.lootable.contents));
    });

    this.refresh();
  }

  /**
   * Taking something out. From something that belongs to someone, that's stealing (unless you
   * put it there yourself): if they notice, the screen closes and the fight is on (what was
   * taken stays taken).
   */
  private take(transfer: () => ActionResult): void {
    const contents = this.lootable.contents;
    const before = contents.items.map(({ itemId, quantity }) => [itemId, quantity] as const);
    const result = transfer();
    this.apply(result);
    if (!result.ok) return;
    let stolen = 0;
    for (const [itemId, quantity] of before) stolen += this.stash.took(itemId, quantity - contents.count(itemId));
    if (stolen === 0) return;
    const angered = state.map.noticeTheft(this.lootable.owner);
    if (angered.length === 0) return;
    closeOverlay(this);
    this.onTheft?.(angered);
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
    if (!this.wasEmpty && this.lootable.contents.isEmpty) postMessage(this, `You empty the ${this.lootable.name}.`);
    closeOverlay(this);
  }
}
