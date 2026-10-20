import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM } from '../config';
import { state } from '../state';
import { MESSAGE_EVENT } from '../ui/messages';
import { COLORS, SMALL_TEXT, TEXT } from '../ui/theme';

const LOG_LINES = 3;
const CONTROLS = 'Arrows/WASD move   E/Space interact   I inventory   Q swap weapon   Click enemy: attack';
const COMBAT_CONTROLS =
  'Arrows move (1 AP)   F/click attack   Tab next target   Space end turn   I inventory (4 AP)   Q swap';

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

    this.addMessage('You leave the shelter behind and step into the wasteland.');
  }

  update(): void {
    const p = state.player;
    const combat = state.combat;
    const ap = combat ? `${combat.actionPoints}/${p.maxActionPoints}` : `${p.maxActionPoints}`;
    const weapon = p.attack;
    const ammo = weapon.ammo ? ` (${p.backpack.count(weapon.ammo)})` : '';
    this.status.setText(
      `HP ${p.hitPoints}/${p.maxHitPoints}   AC ${p.armorClass}   AP ${ap}   ` +
        `Weight ${p.carriedWeight}/${p.carryCapacity} lb   ${weapon.name}${ammo}`,
    );
    this.status.setColor(p.hitPoints <= p.maxHitPoints / 4 ? COLORS.warn : COLORS.text);

    this.combatBar.setVisible(combat !== null);
    this.combatText.setVisible(combat !== null);
    this.controls.setText(combat ? COMBAT_CONTROLS : CONTROLS);
    if (!combat) return;

    const turn = combat.isPlayerTurn ? 'YOUR TURN' : 'ENEMY TURN';
    const target = combat.target;
    const targetInfo = target
      ? `Target: ${target.name} ${target.hitPoints}/${target.maxHitPoints} HP, ` +
        `${combat.hitChance(p, target)}% to hit`
      : 'No target';
    this.combatText.setText(`COMBAT - ${turn}   ${targetInfo}`);
  }

  private addMessage(text: string): void {
    this.messages.push(text);
    if (this.messages.length > LOG_LINES) this.messages.shift();
    this.log.setText(this.messages.join('\n'));
  }
}
