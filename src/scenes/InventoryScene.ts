import Phaser from 'phaser';
import { playSound, type SoundName } from '../audio/sfx';
import { EQUIP_SLOTS, type EquipSlot } from '../core/character';
import { getItem } from '../core/items';
import type { ActionResult } from '../core/result';
import { state } from '../state';
import { describeItem, itemName, sortedStacks, stackRows } from '../ui/format';
import { ListCursor } from '../ui/listCursor';
import { quickAction, useSound } from '../ui/quickAction';
import { COLORS, HEADER_TEXT, TEXT } from '../ui/theme';
import { addButton, bindCursorKeys, closeOverlay, drawPanel, ListView, PANEL } from '../ui/widgets';

type Selection = { kind: 'backpack'; itemId: string } | { kind: 'slot'; slot: EquipSlot } | null;

const BACKPACK = 0;
const EQUIPMENT = 1;

/**
 * Where the cursor was when the inventory last closed, so it reopens on the same item (or
 * slot). Kept for the session only; if that item has gone since, it opens at the top.
 */
let lastSelection: { column: number; key: string } | null = null;
type Action = { label: string; run: () => ActionResult; sound?: SoundName };

const SLOT_LABELS: Record<EquipSlot, string> = { primary: 'Primary', secondary: 'Secondary', armor: 'Armor' };
const MAX_ACTIONS = 3;

const LEFT = PANEL.x + 30;
const RIGHT = PANEL.x + 490;

/**
 * Fallout-style inventory: backpack on the left, equipment and item details on the right.
 * W/S move the selection up and down, A/D between the backpack and the equipment, and E does
 * the obvious thing with it (ui/quickAction.ts): use, equip, wear or unequip.
 */
export class InventoryScene extends Phaser.Scene {
  private backpack!: ListView;
  private readonly slotTexts = new Map<EquipSlot, Phaser.GameObjects.Text>();
  private stats!: Phaser.GameObjects.Text;
  private details!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;
  private actionButtons: Phaser.GameObjects.Text[] = [];
  private actions: Action[] = [];
  /** The keyboard cursor, which is also the selection: what the details and actions are for. */
  private cursor!: ListCursor;

  constructor() {
    super('Inventory');
  }

  create(): void {
    // A scene object is reused each time it is launched, so reset its state here.
    this.slotTexts.clear();
    this.cursor = new ListCursor(this.keys(), BACKPACK);
    if (lastSelection) this.cursor.focus(lastSelection.column, lastSelection.key);

    drawPanel(this, 'INVENTORY');
    addButton(this, PANEL.x + PANEL.width - 130, PANEL.y + 18, 'Close', () => closeOverlay(this));

    this.add.text(LEFT, 90, 'BACKPACK', HEADER_TEXT);
    this.backpack = new ListView(this, LEFT, 122, 38, 17, (itemId) => this.select(BACKPACK, itemId));

    this.add.text(RIGHT, 90, 'EQUIPPED', HEADER_TEXT);
    EQUIP_SLOTS.forEach((slot, i) => {
      const text = this.add.text(RIGHT, 122 + i * 26, '', TEXT).setInteractive({ useHandCursor: true });
      text.on('pointerdown', () => this.select(EQUIPMENT, slot));
      this.slotTexts.set(slot, text);
    });

    this.stats = this.add.text(RIGHT, 215, '', TEXT);
    this.details = this.add.text(RIGHT, 300, '', { ...TEXT, wordWrap: { width: 400 } });
    this.feedback = this.add.text(LEFT, PANEL.y + PANEL.height - 36, '', TEXT);

    this.actionButtons = [];
    for (let i = 0; i < MAX_ACTIONS; i++) {
      this.actionButtons.push(addButton(this, RIGHT, 480 + i * 30, '', () => this.runAction(i)));
    }

    bindCursorKeys(this, this.cursor, () => this.select());
    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-E', (event: KeyboardEvent) => {
      const row = this.selection;
      if (event.repeat || !row) return;
      const action = quickAction(state.player, row);
      this.report(action.run(), action.sound);
    });
    // The keys that open it close it again (not on key repeat, or holding one would flicker it).
    for (const key of ['TAB', 'I']) {
      keyboard.on(`keydown-${key}`, (event: KeyboardEvent) => !event.repeat && closeOverlay(this));
    }
    keyboard.on('keydown-ESC', () => closeOverlay(this));

    this.refresh();
  }

  /** Selects a row (one that was clicked), or just shows where the keyboard moved the cursor. */
  private select(column?: number, key?: string): void {
    if (column !== undefined && key !== undefined) this.cursor.focus(column, key);
    this.feedback.setText('');
    this.refresh();
  }

  /** The backpack's item ids and the equipment slots, as the cursor walks them. */
  private keys(): string[][] {
    return [sortedStacks(state.player.backpack.items).map((s) => s.itemId), [...EQUIP_SLOTS]];
  }

  private get selection(): Selection {
    const key = this.cursor.selectedKey;
    if (key === null) return null;
    return this.cursor.activeColumn === BACKPACK ? { kind: 'backpack', itemId: key } : { kind: 'slot', slot: key as EquipSlot };
  }

  private runAction(index: number): void {
    const action = this.actions[index];
    if (action) this.report(action.run(), action.sound);
  }

  /** Shows what an action did, with its sound if it worked. */
  private report(result: ActionResult, sound?: SoundName): void {
    if (result.ok && sound) playSound(sound);
    this.feedback.setText(result.message).setColor(result.ok ? COLORS.text : COLORS.warn);
    this.refresh();
  }

  private refresh(): void {
    const player = state.player;

    // An item used up, dropped or equipped leaves the backpack: the cursor moves to its neighbour.
    this.cursor.update(this.keys());
    const key = this.cursor.selectedKey;
    lastSelection = key === null ? null : { column: this.cursor.activeColumn, key };

    this.backpack.selectedKey = this.selection?.kind === 'backpack' ? this.selection.itemId : null;
    this.backpack.setRows(stackRows(player.backpack.items));
    if (this.selection?.kind === 'backpack') this.backpack.reveal(this.selection.itemId);

    for (const [slot, text] of this.slotTexts) {
      const item = player.equippedItem(slot);
      const key = player.equippedKey(slot);
      const active = slot === player.activeWeaponSlot ? ' (in hand)' : '';
      const magazine = item?.weapon?.magazineSize;
      const rounds = magazine && slot !== 'armor' ? ` [${player.loadedRounds(slot)}/${magazine}]` : '';
      const selected = this.selection?.kind === 'slot' && this.selection.slot === slot;
      text
        .setText(`${selected ? '>' : ' '} ${SLOT_LABELS[slot].padEnd(10)} ${key ? itemName(key) : '-'}${rounds}${active}`)
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

    const selectedKey = this.selectedKey();
    this.details.setText(selectedKey ? describeItem(selectedKey) : 'Select an item.').setColor(selectedKey ? COLORS.text : COLORS.dim);

    this.actions = this.actionsForSelection();
    this.actionButtons.forEach((button, i) => {
      const action = this.actions[i];
      button.setVisible(action !== undefined);
      if (action) button.setText(`[ ${action.label} ]`);
    });
  }

  /** The selected item's key (its id, with its condition if worn), or null. */
  private selectedKey(): string | null {
    if (!this.selection) return null;
    if (this.selection.kind === 'backpack') return this.selection.itemId;
    return state.player.equippedKey(this.selection.slot);
  }

  private actionsForSelection(): Action[] {
    const player = state.player;
    const selection = this.selection;
    if (!selection) return [];

    if (selection.kind === 'slot') {
      if (!player.equippedItem(selection.slot)) return [];
      const actions: Action[] = [{ label: 'Unequip', run: () => player.unequip(selection.slot), sound: 'equip' }];
      if (selection.slot !== 'armor' && selection.slot !== player.activeWeaponSlot) {
        actions.push({ label: 'Take in hand', run: () => player.swapWeapons(), sound: 'equip' });
      }
      return actions;
    }

    const { itemId } = selection;
    const item = getItem(itemId);
    const actions: Action[] = [];
    if (item.category === 'weapon') {
      actions.push({ label: 'Equip as primary', run: () => player.equip(itemId, 'primary'), sound: 'equip' });
      actions.push({ label: 'Equip as secondary', run: () => player.equip(itemId, 'secondary'), sound: 'equip' });
    } else if (item.category === 'armor') {
      actions.push({ label: 'Wear', run: () => player.equip(itemId, 'armor'), sound: 'equip' });
    } else if (item.consumable) {
      actions.push({ label: 'Use', run: () => player.use(itemId), sound: useSound(item) });
    }
    actions.push({ label: 'Drop one', run: () => player.drop(itemId) });
    return actions;
  }
}
