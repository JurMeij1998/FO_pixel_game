import Phaser from 'phaser';
import { isMuted } from '../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from '../config';
import { capitalize } from '../core/creature';
import { state } from '../state';
import { healthFill, healthLabel, weaponLine } from '../ui/healthBar';
import { MESSAGE_EVENT } from '../ui/messages';
import { COLORS, SMALL_TEXT, TEXT } from '../ui/theme';

const LOG_LINES = 3;
/** The combat ribbon: two lines in the top right corner, inside the status bar's height. */
const RIBBON_TEXT = { ...SMALL_TEXT, color: COLORS.warn, lineSpacing: 2 };
const RIBBON_PADDING = 10;
/** The message log's panel covers the left half of the bottom of the screen; its text wraps inside it. */
const LOG_PANEL_WIDTH = GAME_WIDTH / 2;
const LOG_WIDTH = LOG_PANEL_WIDTH - 2 * 12;
const LOG_TEXT = { ...TEXT, fontSize: '16px', wordWrap: { width: LOG_WIDTH } };
/** The health bar sits right on the map in the bottom right corner, with the gun line above it. */
const BAR_WIDTH = 240;
const BAR_HEIGHT = 22;
const BAR_X = GAME_WIDTH - 12 - BAR_WIDTH;
const BAR_Y = GAME_HEIGHT - 12 - BAR_HEIGHT;
/** Health is dark red inside the same black, green-bordered box as the dialog. */
const HEALTH_RED = 0x8a1414;
/** Text straight on the map gets a black outline, so it reads on any ground. */
const ON_MAP = { stroke: '#000000', strokeThickness: 3 };

/**
 * Status bar along the top, and along the bottom the message log with, in the bottom right
 * corner, the weapon in hand above a health bar. Drawn at 1:1 over the zoomed world.
 */
export class HudScene extends Phaser.Scene {
  private status!: Phaser.GameObjects.Text;
  private weapon!: Phaser.GameObjects.Text;
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  /** What the bar was last drawn for, so it's only redrawn when that changes. */
  private drawnHealth = '';
  private combatBar!: Phaser.GameObjects.Graphics;
  private combatText!: Phaser.GameObjects.Text;
  private log!: Phaser.GameObjects.Text;
  private readonly messages: string[] = [];

  constructor() {
    super('Hud');
  }

  create(): void {
    this.messages.length = 0; // the scene object is reused when a game is loaded or started
    this.add.rectangle(0, 0, GAME_WIDTH, HUD_TOP, 0x000000, 0.7).setOrigin(0);
    this.status = this.add.text(12, 9, '', TEXT);
    // In a fight, a red ribbon in the top right corner, next to the status line.
    this.combatBar = this.add.graphics();
    this.combatText = this.add.text(GAME_WIDTH - RIBBON_PADDING, HUD_TOP / 2, '', RIBBON_TEXT).setOrigin(1, 0.5);

    const logHeight = HUD_BOTTOM;
    this.add.rectangle(0, GAME_HEIGHT - logHeight, LOG_PANEL_WIDTH, logHeight, 0x000000, 0.6).setOrigin(0);
    this.log = this.add.text(12, GAME_HEIGHT - logHeight + 6, '', LOG_TEXT);

    // Right-aligned with the bar, so a long gun name grows to the left instead of off the screen.
    this.weapon = this.add.text(BAR_X + BAR_WIDTH, BAR_Y - 6, '', { ...TEXT, ...ON_MAP }).setOrigin(1, 1);
    this.healthBar = this.add.graphics();
    this.healthText = this.add
      .text(BAR_X + BAR_WIDTH / 2, BAR_Y + BAR_HEIGHT / 2, '', { ...TEXT, fontSize: '16px', stroke: '#000000', strokeThickness: 3 })
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

  update(): void {
    const p = state.player;
    const combat = state.combat;
    const ap = combat ? `${combat.actionPoints}/${p.maxActionPoints}` : `${p.maxActionPoints}`;
    const level = `Lv ${p.level}${p.skillPoints > 0 ? '+' : ''}`;
    // HP and the weapon in hand are in the bottom right, by the health bar.
    this.status.setText(
      `${level}   AC ${p.armorClass}   AP ${ap}   Wt ${p.carriedWeight}/${p.carryCapacity}${isMuted() ? '   [muted]' : ''}`,
    );
    this.weapon.setText(weaponLine(p));
    this.drawHealth();

    this.combatBar.setVisible(combat !== null);
    this.combatText.setVisible(combat !== null);
    if (!combat) return;

    const turn = combat.isPlayerTurn ? 'YOUR TURN' : 'ENEMY TURN';
    const target = combat.target;
    let targetInfo = 'No target';
    if (target) {
      const problem = combat.isPlayerTurn ? combat.attackProblem(target) : null;
      const inTheWay = problem ? null : combat.inTheWay(target);
      const blocked = inTheWay && `${capitalize(inTheWay.theName)} is in the way`;
      const odds = problem?.message ?? blocked ?? `${combat.hitChance(p, target)}% to hit`;
      targetInfo = `Target: ${target.name} ${target.hitPoints}/${target.maxHitPoints} HP, ${odds}`;
    }
    this.combatText.setText(`COMBAT - ${turn}\n${targetInfo}`);
    // The ribbon is as wide as its text, out to the right edge of the screen.
    const width = this.combatText.width + 2 * RIBBON_PADDING;
    this.combatBar.clear().fillStyle(0x400c08, 0.9).fillRect(GAME_WIDTH - width, 0, width, HUD_TOP);
  }

  /** The health bar: black, with a green border (and a thin black edge outside it), dark red health inside. */
  private drawHealth(): void {
    const p = state.player;
    const label = healthLabel(p);
    if (label === this.drawnHealth) return;
    this.drawnHealth = label;
    const inner = BAR_WIDTH - 6;
    this.healthBar
      .clear()
      .fillStyle(0x000000)
      .fillRect(BAR_X - 2, BAR_Y - 2, BAR_WIDTH + 4, BAR_HEIGHT + 4)
      .lineStyle(2, COLORS.border)
      .strokeRect(BAR_X + 1, BAR_Y + 1, BAR_WIDTH - 2, BAR_HEIGHT - 2)
      .fillStyle(HEALTH_RED)
      .fillRect(BAR_X + 3, BAR_Y + 3, healthFill(p.hitPoints, p.maxHitPoints, inner), BAR_HEIGHT - 6);
    this.healthText.setText(label).setColor(p.hitPoints <= p.maxHitPoints / 4 ? COLORS.warn : COLORS.text);
  }

  private addMessage(text: string): void {
    this.messages.push(text);
    if (this.messages.length > LOG_LINES) this.messages.shift();
    // Long messages wrap, so show the last few lines rather than the last few messages.
    this.log.setText(this.log.getWrappedText(this.messages.join('\n')).slice(-LOG_LINES));
  }
}
