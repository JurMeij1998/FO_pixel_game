import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import { SCRAP, scrapToRepair } from '../core/condition';
import { repairWeapon } from '../core/repair';
import { state } from '../state';
import { describeItem } from '../ui/format';
import { ListCursor } from '../ui/listCursor';
import { COLORS, DIM_TEXT, HEADER_TEXT, TEXT } from '../ui/theme';
import { addButton, bindCursorKeys, closeOverlay, drawPanel, ListView, PANEL } from '../ui/widgets';
import { workbenchRows, type WorkbenchRow } from '../ui/workbench';

const LEFT = PANEL.x + 30;
const RIGHT = PANEL.x + 500;
const LIST_TOP = 130;

/**
 * A workbench: repair your weapons with scrap metal (core/repair.ts). The list has every weapon
 * you carry, in hand first, with what its repair takes; the right shows the chosen one and the
 * scrap you have. W/S (or the arrows) choose, E (or the Repair button) repairs, Esc closes.
 */
export class WorkbenchScene extends Phaser.Scene {
  private cursor!: ListCursor;
  private list!: ListView;
  private rows: WorkbenchRow[] = [];
  private details!: Phaser.GameObjects.Text;
  private cost!: Phaser.GameObjects.Text;
  private scrap!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;

  constructor() {
    super('Workbench');
  }

  create(): void {
    drawPanel(this, 'WORKBENCH');
    addButton(this, PANEL.x + PANEL.width - 130, PANEL.y + 18, 'Close', () => closeOverlay(this));

    this.rows = workbenchRows(state.player);
    this.cursor = new ListCursor([this.rows.map((r) => r.key)]);
    this.add.text(LEFT, LIST_TOP - 32, 'YOUR WEAPONS', HEADER_TEXT);
    this.list = new ListView(this, LEFT, LIST_TOP, 40, 14, (key) => {
      this.cursor.focus(0, key);
      this.refresh();
    });
    this.scrap = this.add.text(LEFT, LIST_TOP + 14 * 24 + 20, '', TEXT);

    this.details = this.add.text(RIGHT, LIST_TOP - 32, '', { ...TEXT, wordWrap: { width: PANEL.x + PANEL.width - RIGHT - 30 } });
    this.cost = this.add.text(RIGHT, 380, '', TEXT);
    addButton(this, RIGHT, 420, 'Repair', () => this.repair());
    this.feedback = this.add.text(LEFT, PANEL.y + PANEL.height - 40, '', { ...TEXT, wordWrap: { width: PANEL.width - 60 } });

    bindCursorKeys(this, this.cursor, () => this.refresh());
    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-E', (event: KeyboardEvent) => !event.repeat && this.repair());
    keyboard.on('keydown-ESC', () => closeOverlay(this));
    this.refresh();
  }

  private get selected(): WorkbenchRow | undefined {
    return this.rows.find((r) => r.key === this.cursor.selectedKey);
  }

  private repair(): void {
    const row = this.selected;
    if (!row) return;
    const result = repairWeapon(state.player, row.target);
    this.feedback.setText(result.message).setColor(result.ok ? COLORS.text : COLORS.warn);
    if (result.ok) playSound('reload');
    this.rows = workbenchRows(state.player);
    // A weapon in the backpack has a new key once repaired (its condition is in it): keep the cursor on it.
    if (result.ok && 'key' in row.target) {
      const repaired = this.rows.find((r) => 'key' in r.target && r.itemKey === result.repaired);
      this.cursor.update([this.rows.map((r) => r.key)]);
      if (repaired) this.cursor.focus(0, repaired.key);
    }
    this.refresh();
  }

  private refresh(): void {
    this.cursor.update([this.rows.map((r) => r.key)]);
    this.list.selectedKey = this.cursor.selectedKey;
    this.list.setRows(this.rows);
    if (this.cursor.selectedKey) this.list.reveal(this.cursor.selectedKey);

    const have = state.player.backpack.count(SCRAP);
    this.scrap.setText(`Scrap metal: ${have}`).setColor(have > 0 ? COLORS.text : COLORS.dim);

    const row = this.selected;
    if (!row) {
      this.details.setText('You carry no weapons to repair.').setStyle(DIM_TEXT);
      this.cost.setText('');
      return;
    }
    this.details.setText(describeItem(row.itemKey)).setColor(COLORS.text);
    const needed = scrapToRepair(row.itemKey);
    const text =
      needed === 0 ? 'In perfect condition.'
      : have >= needed ? `A full repair takes ${needed} scrap metal.`
      : have > 0 ? `A full repair takes ${needed} scrap metal: you have ${have}, enough to patch it up.`
      : `A full repair takes ${needed} scrap metal, and you have none.`;
    this.cost.setText(text).setColor(needed === 0 || have > 0 ? COLORS.text : COLORS.warn);
  }
}
