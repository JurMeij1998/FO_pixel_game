import Phaser from 'phaser';
import { storeItem, takeAll, takeItem, type Lootable } from '../core/loot';
import type { ActionResult } from '../core/result';
import { state } from '../state';
import { stackRows } from '../ui/format';
import { postMessage } from '../ui/messages';
import { COLORS, HEADER_TEXT, SMALL_TEXT, TEXT } from '../ui/theme';
import { addButton, closeOverlay, drawPanel, ListView, PANEL } from '../ui/widgets';

const LEFT = PANEL.x + 30;
const RIGHT = PANEL.x + 470;

/** Two-column transfer screen between the backpack and a chest or corpse. Click an item to move its whole stack. */
export class LootScene extends Phaser.Scene {
  private lootable!: Lootable;
  private yourItems!: ListView;
  private containerItems!: ListView;
  private yourHeader!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;

  constructor() {
    super('Loot');
  }

  init(data: { lootable: Lootable }): void {
    this.lootable = data.lootable;
  }

  create(): void {
    const player = state.player;

    drawPanel(this, this.lootable.name.toUpperCase());
    addButton(this, PANEL.x + PANEL.width - 130, PANEL.y + 18, 'Close', () => closeOverlay(this));

    this.yourHeader = this.add.text(LEFT, 90, '', HEADER_TEXT);
    this.add.text(RIGHT, 90, 'CONTENTS', HEADER_TEXT);
    this.add.text(LEFT, 500, 'Click an item to move the whole stack.', SMALL_TEXT);

    this.yourItems = new ListView(this, LEFT, 122, 36, 15, (itemId) =>
      this.apply(storeItem(player, this.lootable.contents, itemId)),
    );
    this.containerItems = new ListView(this, RIGHT, 122, 36, 15, (itemId) =>
      this.apply(takeItem(player, this.lootable.contents, itemId)),
    );

    addButton(this, RIGHT, 500, 'Take all', () => this.apply(takeAll(player, this.lootable.contents)));
    this.feedback = this.add.text(LEFT, PANEL.y + PANEL.height - 36, '', TEXT);

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-ESC', () => this.close());
    keyboard.on('keydown-E', () => this.close());
    keyboard.on('keydown-A', () => this.apply(takeAll(player, this.lootable.contents)));

    this.refresh();
  }

  private apply(result: ActionResult): void {
    this.feedback.setText(result.message).setColor(result.ok ? COLORS.text : COLORS.warn);
    this.refresh();
  }

  private refresh(): void {
    const player = state.player;
    this.yourHeader.setText(`YOU  (${player.carriedWeight}/${player.carryCapacity} lb)`);
    this.yourItems.setRows(stackRows(player.backpack.items));
    this.containerItems.setRows(stackRows(this.lootable.contents.items));
  }

  private close(): void {
    if (this.lootable.contents.isEmpty) postMessage(this, `You empty the ${this.lootable.name}.`);
    closeOverlay(this);
  }
}
