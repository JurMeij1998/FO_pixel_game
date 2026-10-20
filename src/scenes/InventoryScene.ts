import Phaser from 'phaser';
import { EQUIP_SLOTS, type EquipSlot } from '../core/character';
import { getItem, type ItemDef } from '../core/items';
import type { ActionResult } from '../core/result';
import { state } from '../state';
import { describeItem, stackRows } from '../ui/format';
import { COLORS, HEADER_TEXT, TEXT } from '../ui/theme';
import { addButton, closeOverlay, drawPanel, ListView, PANEL } from '../ui/widgets';

type Selection = { kind: 'backpack'; itemId: string } | { kind: 'slot'; slot: EquipSlot } | null;
type Action = { label: string; run: () => ActionResult };

const SLOT_LABELS: Record<EquipSlot, string> = { primary: 'Primary', secondary: 'Secondary', armor: 'Armor' };
const MAX_ACTIONS = 3;

const LEFT = PANEL.x + 30;
const RIGHT = PANEL.x + 490;

/** Fallout-style inventory: backpack on the left, equipment and item details on the right. */
export class InventoryScene extends Phaser.Scene {
  private backpack!: ListView;
  private readonly slotTexts = new Map<EquipSlot, Phaser.GameObjects.Text>();
  private stats!: Phaser.GameObjects.Text;
  private details!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;
  private actionButtons: Phaser.GameObjects.Text[] = [];
  private actions: Action[] = [];
  private selection: Selection = null;

  constructor() {
    super('Inventory');
  }

  create(): void {
    // A scene object is reused each time it is launched, so reset its state here.
    this.selection = null;
    this.slotTexts.clear();

    drawPanel(this, 'INVENTORY');
    addButton(this, PANEL.x + PANEL.width - 130, PANEL.y + 18, 'Close', () => closeOverlay(this));

    this.add.text(LEFT, 90, 'BACKPACK', HEADER_TEXT);
    this.backpack = new ListView(this, LEFT, 122, 38, 17, (itemId) => this.select({ kind: 'backpack', itemId }));

    this.add.text(RIGHT, 90, 'EQUIPPED', HEADER_TEXT);
    EQUIP_SLOTS.forEach((slot, i) => {
      const text = this.add.text(RIGHT, 122 + i * 26, '', TEXT).setInteractive({ useHandCursor: true });
      text.on('pointerdown', () => this.select({ kind: 'slot', slot }));
      this.slotTexts.set(slot, text);
    });

    this.stats = this.add.text(RIGHT, 215, '', TEXT);
    this.details = this.add.text(RIGHT, 300, '', { ...TEXT, wordWrap: { width: 400 } });
    this.feedback = this.add.text(LEFT, PANEL.y + PANEL.height - 36, '', TEXT);

    this.actionButtons = [];
    for (let i = 0; i < MAX_ACTIONS; i++) {
      this.actionButtons.push(addButton(this, RIGHT, 480 + i * 30, '', () => this.runAction(i)));
    }

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-I', () => closeOverlay(this));
    keyboard.on('keydown-ESC', () => closeOverlay(this));

    this.refresh();
  }

  private select(selection: Selection): void {
    this.selection = selection;
    this.feedback.setText('');
    this.refresh();
  }

  private runAction(index: number): void {
    const action = this.actions[index];
    if (!action) return;
    const result = action.run();
    this.feedback.setText(result.message).setColor(result.ok ? COLORS.text : COLORS.warn);
    this.refresh();
  }

  private refresh(): void {
    const player = state.player;

    // Clear the selection if the item it points at is gone (used up, dropped, equipped).
    if (this.selection?.kind === 'backpack' && player.backpack.count(this.selection.itemId) === 0) {
      this.selection = null;
    }

    this.backpack.selectedKey = this.selection?.kind === 'backpack' ? this.selection.itemId : null;
    this.backpack.setRows(stackRows(player.backpack.items));

    for (const [slot, text] of this.slotTexts) {
      const item = player.equippedItem(slot);
      const active = slot === player.activeWeaponSlot ? ' (in hand)' : '';
      const selected = this.selection?.kind === 'slot' && this.selection.slot === slot;
      text
        .setText(`${selected ? '>' : ' '} ${SLOT_LABELS[slot].padEnd(10)} ${item?.name ?? '-'}${active}`)
        .setColor(selected ? COLORS.bright : COLORS.text);
    }

    const overweight = player.carriedWeight > player.carryCapacity;
    this.stats.setText(
      [
        `HP     ${player.hitPoints}/${player.maxHitPoints}`,
        `AC     ${player.armorClass}`,
        `Weight ${player.carriedWeight}/${player.carryCapacity} lb`,
      ].join('\n'),
    );
    this.stats.setColor(overweight ? COLORS.warn : COLORS.text);

    const item = this.selectedItem();
    this.details.setText(item ? describeItem(item) : 'Select an item.').setColor(item ? COLORS.text : COLORS.dim);

    this.actions = this.actionsForSelection();
    this.actionButtons.forEach((button, i) => {
      const action = this.actions[i];
      button.setVisible(action !== undefined);
      if (action) button.setText(`[ ${action.label} ]`);
    });
  }

  private selectedItem(): ItemDef | null {
    if (!this.selection) return null;
    if (this.selection.kind === 'backpack') return getItem(this.selection.itemId);
    return state.player.equippedItem(this.selection.slot);
  }

  private actionsForSelection(): Action[] {
    const player = state.player;
    const selection = this.selection;
    if (!selection) return [];

    if (selection.kind === 'slot') {
      if (!player.equippedItem(selection.slot)) return [];
      const actions: Action[] = [{ label: 'Unequip', run: () => player.unequip(selection.slot) }];
      if (selection.slot !== 'armor' && selection.slot !== player.activeWeaponSlot) {
        actions.push({ label: 'Take in hand', run: () => player.swapWeapons() });
      }
      return actions;
    }

    const { itemId } = selection;
    const item = getItem(itemId);
    const actions: Action[] = [];
    if (item.category === 'weapon') {
      actions.push({ label: 'Equip as primary', run: () => player.equip(itemId, 'primary') });
      actions.push({ label: 'Equip as secondary', run: () => player.equip(itemId, 'secondary') });
    } else if (item.category === 'armor') {
      actions.push({ label: 'Wear', run: () => player.equip(itemId, 'armor') });
    } else if (item.consumable) {
      actions.push({ label: 'Use', run: () => player.use(itemId) });
    }
    actions.push({ label: 'Drop one', run: () => player.drop(itemId) });
    return actions;
  }
}
