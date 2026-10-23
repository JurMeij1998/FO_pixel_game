import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import { MATERIALS, materialToRepair } from '../core/condition';
import { getItem } from '../core/items';
import { materialName, repairItem, salvageItem, salvageYield } from '../core/repair';
import { state } from '../state';
import { describeItem } from '../ui/format';
import { ListCursor } from '../ui/listCursor';
import { CHAR_WIDTH, COLORS, DIM_TEXT, HEADER_TEXT, TEXT } from '../ui/theme';
import { addButton, bindCursorKeys, closeOverlay, drawPanel, ListView, PANEL } from '../ui/widgets';
import { repairCostLine, workbenchRows, type WorkbenchRow } from '../ui/workbench';

const LEFT = PANEL.x + 30;
const RIGHT = PANEL.x + 500;
const LIST_TOP = 130;
/** The list's width in characters; its right-hand column (the condition) ends here. */
const LIST_COLUMNS = 40;
/** Rows of gear shown at once (the list scrolls); the inventory of materials goes below them. */
const LIST_ROWS = 9;
const INVENTORY_TOP = LIST_TOP + LIST_ROWS * 24 + 40;
/** The Repair and Salvage buttons, one under the other below the item's details. */
const ACTIONS_TOP = 420;
const ACTION_GAP = 30;

/**
 * A workbench: repair your weapons and armour with scrap metal or leather (core/repair.ts). The
 * list has all the gear you carry that wears, what's equipped first, with what its repair takes;
 * the right shows the chosen item, and below the list (under INVENTORY) the materials you have.
 * W/S (or the arrows) choose, E (or the Repair button) repairs what needs it, X (or Salvage)
 * breaks the item down for a little material (asking once first), Esc closes.
 */
export class WorkbenchScene extends Phaser.Scene {
  private cursor!: ListCursor;
  private list!: ListView;
  private rows: WorkbenchRow[] = [];
  private details!: Phaser.GameObjects.Text;
  private cost!: Phaser.GameObjects.Text;
  /** Only shown for something that needs repairing. */
  private repairButton!: Phaser.GameObjects.Text;
  private salvageButton!: Phaser.GameObjects.Text;
  /** The row whose salvaging was asked about: the next Salvage on it goes ahead. */
  private confirmingSalvage: string | null = null;
  /** One line per repair material, with how much of it you have on the right. */
  private materials: Phaser.GameObjects.Text[] = [];
  private feedback!: Phaser.GameObjects.Text;

  constructor() {
    super('Workbench');
  }

  create(): void {
    drawPanel(this, 'WORKBENCH');
    addButton(this, PANEL.x + PANEL.width - 130, PANEL.y + 18, 'Close', () => closeOverlay(this));

    this.rows = workbenchRows(state.player);
    this.confirmingSalvage = null;
    this.cursor = new ListCursor([this.rows.map((r) => r.key)]);
    this.add.text(LEFT, LIST_TOP - 32, 'YOUR GEAR', HEADER_TEXT);
    this.add.text(LEFT + LIST_COLUMNS * CHAR_WIDTH, LIST_TOP - 32, 'CONDITION', HEADER_TEXT).setOrigin(1, 0);
    this.list = new ListView(this, LEFT, LIST_TOP, LIST_COLUMNS, LIST_ROWS, (key) => {
      this.cursor.focus(0, key);
      this.refresh();
    });
    this.add.text(LEFT, INVENTORY_TOP - 32, 'INVENTORY', HEADER_TEXT);
    this.materials = MATERIALS.map((_, i) => this.add.text(LEFT, INVENTORY_TOP + i * 24, '', TEXT));

    this.details = this.add.text(RIGHT, LIST_TOP - 32, '', { ...TEXT, wordWrap: { width: PANEL.x + PANEL.width - RIGHT - 30 } });
    this.cost = this.add.text(RIGHT, 380, '', TEXT);
    // The actions, one under the other.
    this.repairButton = addButton(this, RIGHT, ACTIONS_TOP, 'Repair', () => this.repair());
    this.salvageButton = addButton(this, RIGHT, ACTIONS_TOP + ACTION_GAP, 'Salvage', () => this.salvage());
    this.feedback = this.add.text(LEFT, PANEL.y + PANEL.height - 40, '', { ...TEXT, wordWrap: { width: PANEL.width - 60 } });

    bindCursorKeys(this, this.cursor, () => this.refresh());
    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-E', (event: KeyboardEvent) => !event.repeat && this.repair());
    keyboard.on('keydown-X', (event: KeyboardEvent) => !event.repeat && this.salvage());
    keyboard.on('keydown-ESC', () => closeOverlay(this));
    this.refresh();
  }

  private get selected(): WorkbenchRow | undefined {
    return this.rows.find((r) => r.key === this.cursor.selectedKey);
  }

  private repair(): void {
    const row = this.selected;
    // Nothing to repair (it's perfect): E does nothing, as there's no Repair button either.
    if (!row || materialToRepair(row.itemKey) === 0) return;
    const result = repairItem(state.player, row.target);
    this.feedback.setText(result.message).setColor(result.ok ? COLORS.text : COLORS.warn);
    if (result.ok) playSound('reload');
    this.rows = workbenchRows(state.player);
    // An item in the backpack has a new key once repaired (its condition is in it): keep the cursor on it.
    if (result.ok && 'key' in row.target) {
      const repaired = this.rows.find((r) => 'key' in r.target && r.itemKey === result.repaired);
      this.cursor.update([this.rows.map((r) => r.key)]);
      if (repaired) this.cursor.focus(0, repaired.key);
    }
    this.refresh();
  }

  /** Salvages the chosen item, the second time it's asked for: it's gone for good. */
  private salvage(): void {
    const row = this.selected;
    const salvage = row ? salvageYield(row.itemKey) : null;
    if (!row || !salvage) return;
    if (this.confirmingSalvage !== row.key) {
      this.confirmingSalvage = row.key;
      const name = getItem(row.itemKey).name;
      this.feedback
        .setText(`Salvage the ${name} for ${salvage.amount} ${materialName(salvage.material)}? Press Salvage (X) again to confirm.`)
        .setColor(COLORS.warn);
      return;
    }
    this.confirmingSalvage = null;
    const result = salvageItem(state.player, row.target);
    this.feedback.setText(result.message).setColor(result.ok ? COLORS.text : COLORS.warn);
    if (result.ok) playSound('equip');
    this.rows = workbenchRows(state.player);
    this.refresh();
  }

  private refresh(): void {
    this.cursor.update([this.rows.map((r) => r.key)]);
    // Moving to another item calls off a salvage that was being asked about.
    if (this.confirmingSalvage !== this.cursor.selectedKey) this.confirmingSalvage = null;
    this.list.selectedKey = this.cursor.selectedKey;
    this.list.setRows(this.rows);
    if (this.cursor.selectedKey) this.list.reveal(this.cursor.selectedKey);

    const backpack = state.player.backpack;
    // Laid out like the gear list's rows: name on the left, amount in its right-hand column.
    MATERIALS.forEach((material, i) => {
      const amount = String(backpack.count(material));
      this.materials[i]
        .setText(`  ${getItem(material).name}`.padEnd(LIST_COLUMNS - amount.length) + amount)
        .setColor(amount === '0' ? COLORS.dim : COLORS.text);
    });

    const row = this.selected;
    if (!row) {
      this.details.setText('You carry nothing that needs repairing.').setStyle(DIM_TEXT);
      this.cost.setText('');
      this.repairButton.setVisible(false);
      this.salvageButton.setVisible(false);
      return;
    }
    this.details.setText(describeItem(row.itemKey)).setColor(COLORS.text);
    // Nothing to repair: no cost line and no Repair button (E then just says it's in perfect condition).
    const cost = repairCostLine(row.itemKey);
    this.cost.setText(cost).setColor(COLORS.text);
    this.repairButton.setVisible(cost !== '');
    // Salvage moves up into Repair's place when there's nothing to repair.
    this.salvageButton.setVisible(true).setY(cost !== '' ? ACTIONS_TOP + ACTION_GAP : ACTIONS_TOP);
  }
}
