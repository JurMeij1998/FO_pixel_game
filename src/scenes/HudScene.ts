import Phaser from 'phaser';
import { isMuted } from '../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, WORLD_ZOOM } from '../config';
import { state } from '../state';
import { glowColor } from '../ui/glow';
import { healthFill, healthLabel, weaponLine } from '../ui/healthBar';
import { MESSAGE_EVENT } from '../ui/messages';
import { COLORS, SMALL_TEXT, TEXT } from '../ui/theme';

const LOG_LINES = 3;
/** The message log's panel covers the left half of the bottom of the screen; its text wraps inside it. */
const LOG_PANEL_WIDTH = GAME_WIDTH / 2;
const LOG_WIDTH = LOG_PANEL_WIDTH - 2 * 12;
const LOG_TEXT = { ...TEXT, fontSize: '16px', wordWrap: { width: LOG_WIDTH } };
/** The health bar sits right on the map in the bottom right corner, with the gun line above it. */
const BAR_WIDTH = 240;
const BAR_HEIGHT = 22;
const BAR_X = GAME_WIDTH - 12 - BAR_WIDTH;
const BAR_Y = GAME_HEIGHT - 12 - BAR_HEIGHT;
/** The bar's green border is 2 pixels thick, and shines like the AP gauge's (ui/glow.ts). */
const BORDER = 2;
/** The glint's width: the AP gauge's, which is drawn at the world's zoom, at 1:1. */
const SHINE_WIDTH = 2.5 * WORLD_ZOOM;
/** Health is dark red inside the black box. */
const HEALTH_RED = 0x8a1414;
/** Text straight on the map gets a black outline, so it reads on any ground. */
const ON_MAP = { stroke: '#000000', strokeThickness: 3 };

/**
 * The HUD, drawn at 1:1 over the zoomed world and mostly straight on the map: the message log
 * in the bottom left, the weapon in hand above a health bar in the bottom right, and in a
 * fight a "COMBAT" label in the top left. Your other stats are on the character sheet (C).
 */
export class HudScene extends Phaser.Scene {
  private combatLabel!: Phaser.GameObjects.Text;
  private mutedLabel!: Phaser.GameObjects.Text;
  private weapon!: Phaser.GameObjects.Text;
  /** The bar's black box and red health, redrawn only when health changes. */
  private healthBar!: Phaser.GameObjects.Graphics;
  /** Its border, redrawn every frame to pulse and shine. */
  private healthBorder!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  /** What the bar was last drawn for, so it's only redrawn when that changes. */
  private drawnHealth = '';
  private log!: Phaser.GameObjects.Text;
  private readonly messages: string[] = [];

  constructor() {
    super('Hud');
  }

  create(): void {
    this.messages.length = 0; // the scene object is reused when a game is loaded or started
    this.combatLabel = this.add.text(12, 10, '', { ...TEXT, color: COLORS.warn, fontStyle: 'bold', ...ON_MAP });
    this.mutedLabel = this.add.text(GAME_WIDTH - 12, 10, '[muted]', { ...SMALL_TEXT, ...ON_MAP }).setOrigin(1, 0);

    const logHeight = HUD_BOTTOM;
    this.add.rectangle(0, GAME_HEIGHT - logHeight, LOG_PANEL_WIDTH, logHeight, 0x000000, 0.6).setOrigin(0);
    this.log = this.add.text(12, GAME_HEIGHT - logHeight + 6, '', LOG_TEXT);

    // Right-aligned with the bar, so a long gun name grows to the left instead of off the screen.
    this.weapon = this.add.text(BAR_X + BAR_WIDTH, BAR_Y - 6, '', { ...TEXT, ...ON_MAP }).setOrigin(1, 1);
    this.healthBar = this.add.graphics();
    this.healthBorder = this.add.graphics();
    this.healthText = this.add
      .text(BAR_X + BAR_WIDTH / 2, BAR_Y + BAR_HEIGHT / 2, '', { ...TEXT, fontSize: '16px', ...ON_MAP })
      .setOrigin(0.5);
    this.drawnHealth = '';

    this.game.events.on(MESSAGE_EVENT, this.addMessage, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(MESSAGE_EVENT, this.addMessage, this));

    if (state.sandbox) this.addMessage(`${state.map.name}: nothing here is saved. Esc, then Quit, to leave.`);
    else {
      this.addMessage(
        state.loadedFromSave
          ? 'Welcome back to the wasteland. (Your game saves automatically.)'
          : "You wake up in a stranger's shack. Face the woman and press E to talk.",
      );
      // The keys are listed in the menu, not on screen.
      this.addMessage('Press Esc for the menu and the controls.');
    }
  }

  update(time: number): void {
    const combat = state.combat;
    this.combatLabel
      .setVisible(combat !== null)
      .setText(combat ? `COMBAT - ${combat.isPlayerTurn ? 'YOUR TURN' : 'ENEMY TURN'}` : '');
    this.mutedLabel.setVisible(isMuted());
    this.weapon.setText(weaponLine(state.player));
    this.drawHealth();
    this.drawHealthBorder(time);
  }

  /** The health bar's box: black, with a thin black edge outside the border, and dark red health inside. */
  private drawHealth(): void {
    const p = state.player;
    const label = healthLabel(p);
    if (label === this.drawnHealth) return;
    this.drawnHealth = label;
    const inner = BAR_WIDTH - 2 * (BORDER + 1);
    this.healthBar
      .clear()
      .fillStyle(0x000000)
      .fillRect(BAR_X - 2, BAR_Y - 2, BAR_WIDTH + 4, BAR_HEIGHT + 4)
      .fillStyle(HEALTH_RED)
      .fillRect(BAR_X + BORDER + 1, BAR_Y + BORDER + 1, healthFill(p.hitPoints, p.maxHitPoints, inner), BAR_HEIGHT - 2 * (BORDER + 1));
    this.healthText.setText(label).setColor(p.hitPoints <= p.maxHitPoints / 4 ? COLORS.warn : COLORS.text);
  }

  /**
   * The bar's green border, pulsing and with a glint sweeping across it like the AP gauge's.
   * Drawn a column (top and bottom edges) or a row (the sides) at a time, so each pixel along
   * the diagonal gets its own shade.
   */
  private drawHealthBorder(time: number): void {
    const span = BAR_WIDTH + BAR_HEIGHT;
    const g = this.healthBorder.clear();
    for (let x = 0; x < BAR_WIDTH; x++) {
      g.fillStyle(glowColor(time, x, span, SHINE_WIDTH)).fillRect(BAR_X + x, BAR_Y, 1, BORDER);
      g.fillStyle(glowColor(time, x + BAR_HEIGHT - 1, span, SHINE_WIDTH)).fillRect(BAR_X + x, BAR_Y + BAR_HEIGHT - BORDER, 1, BORDER);
    }
    for (let y = BORDER; y < BAR_HEIGHT - BORDER; y++) {
      g.fillStyle(glowColor(time, y, span, SHINE_WIDTH)).fillRect(BAR_X, BAR_Y + y, BORDER, 1);
      g.fillStyle(glowColor(time, BAR_WIDTH - 1 + y, span, SHINE_WIDTH)).fillRect(BAR_X + BAR_WIDTH - BORDER, BAR_Y + y, BORDER, 1);
    }
  }

  private addMessage(text: string): void {
    this.messages.push(text);
    if (this.messages.length > LOG_LINES) this.messages.shift();
    // Long messages wrap, so show the last few lines rather than the last few messages.
    this.log.setText(this.log.getWrappedText(this.messages.join('\n')).slice(-LOG_LINES));
  }
}
