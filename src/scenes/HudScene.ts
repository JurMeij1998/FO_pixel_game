import Phaser from 'phaser';
import { isMuted } from '../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM } from '../config';
import { state } from '../state';
import { MESSAGE_EVENT } from '../ui/messages';
import { COLORS, SMALL_TEXT, TEXT } from '../ui/theme';

const LOG_LINES = 3;
const CONTROLS = 'Arrows/WASD move  E/Space interact  I inventory  C character  Q swap  R reload  Click enemy: attack  Esc menu';
const COMBAT_CONTROLS =
  'Arrows move (1 AP)  F/click attack  Tab target  R reload (2 AP)  I inventory (4 AP)  Q swap  Space end turn';

/** Status bar along the top and the message log along the bottom, drawn at 1:1 over the zoomed world. */
export class HudScene extends Phaser.Scene {
  private status!: Phaser.GameObjects.Text;
  private combatBar!: Phaser.GameObjects.Rectangle;
  private combatText!: Phaser.GameObjects.Text;
  private controls!: Phaser.GameObjects.Text;
  private log!: Phaser.GameObjects.Text;
  private readonly messages: string[] = [];

  constructor() {
    super('Hud');
  }

  create(): void {
    this.messages.length = 0; // the scene object is reused when a game is loaded or started
    this.add.rectangle(0, 0, GAME_WIDTH, 36, 0x000000, 0.7).setOrigin(0);
    this.status = this.add.text(12, 9, '', TEXT);
    this.combatBar = this.add.rectangle(0, 36, GAME_WIDTH, 30, 0x400c08, 0.85).setOrigin(0);
    this.combatText = this.add.text(12, 41, '', { ...TEXT, color: COLORS.warn });

    const logHeight = HUD_BOTTOM;
    this.add.rectangle(0, GAME_HEIGHT - logHeight, GAME_WIDTH, logHeight, 0x000000, 0.6).setOrigin(0);
    this.log = this.add.text(12, GAME_HEIGHT - logHeight + 6, '', TEXT);
    this.controls = this.add.text(12, GAME_HEIGHT - 22, CONTROLS, SMALL_TEXT);

    this.game.events.on(MESSAGE_EVENT, this.addMessage, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(MESSAGE_EVENT, this.addMessage, this));

    if (state.sandbox) this.addMessage('Test arena: nothing here is saved. Esc, then Quit, to leave.');
    else this.addMessage(
      state.loadedFromSave
        ? 'Welcome back to the wasteland. (Your game saves automatically.)'
        : 'You leave the shelter behind and step into the wasteland.',
    );
  }

  update(): void {
    const p = state.player;
    const combat = state.combat;
    const ap = combat ? `${combat.actionPoints}/${p.maxActionPoints}` : `${p.maxActionPoints}`;
    const weapon = p.attack;
    const magazine = p.activeWeapon?.weapon?.magazineSize;
    const ammo = weapon.ammo ? ` ${p.loadedRounds()}/${magazine} (+${p.backpack.count(weapon.ammo)})` : '';
    const level = `Lv ${p.level}${p.skillPoints > 0 ? '+' : ''}`;
    this.status.setText(
      `${level}   HP ${p.hitPoints}/${p.maxHitPoints}   AC ${p.armorClass}   AP ${ap}   ` +
        `Wt ${p.carriedWeight}/${p.carryCapacity}   ${weapon.name}${ammo}${isMuted() ? '   [muted]' : ''}`,
    );
    this.status.setColor(p.hitPoints <= p.maxHitPoints / 4 ? COLORS.warn : COLORS.text);

    this.combatBar.setVisible(combat !== null);
    this.combatText.setVisible(combat !== null);
    this.controls.setText(combat ? COMBAT_CONTROLS : CONTROLS);
    if (!combat) return;

    const turn = combat.isPlayerTurn ? 'YOUR TURN' : 'ENEMY TURN';
    const target = combat.target;
    let targetInfo = 'No target';
    if (target) {
      const problem = combat.isPlayerTurn ? combat.attackProblem(target) : null;
      const odds = problem?.message ?? `${combat.hitChance(p, target)}% to hit`;
      targetInfo = `Target: ${target.name} ${target.hitPoints}/${target.maxHitPoints} HP, ${odds}`;
    }
    this.combatText.setText(`COMBAT - ${turn}   ${targetInfo}`);
  }

  private addMessage(text: string): void {
    this.messages.push(text);
    if (this.messages.length > LOG_LINES) this.messages.shift();
    this.log.setText(this.messages.join('\n'));
  }
}
