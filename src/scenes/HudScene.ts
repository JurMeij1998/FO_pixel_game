import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { state } from '../state';
import { MESSAGE_EVENT } from '../ui/messages';
import { SMALL_TEXT, TEXT } from '../ui/theme';

const LOG_LINES = 3;
const CONTROLS = 'Arrows/WASD move   E/Space interact   I inventory   Q swap weapon';

/** Status bar along the top and the message log along the bottom, drawn at 1:1 over the zoomed world. */
export class HudScene extends Phaser.Scene {
  private status!: Phaser.GameObjects.Text;
  private log!: Phaser.GameObjects.Text;
  private readonly messages: string[] = [];

  constructor() {
    super('Hud');
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, 36, 0x000000, 0.7).setOrigin(0);
    this.status = this.add.text(12, 9, '', TEXT);

    const logHeight = LOG_LINES * 21 + 34;
    this.add.rectangle(0, GAME_HEIGHT - logHeight, GAME_WIDTH, logHeight, 0x000000, 0.6).setOrigin(0);
    this.log = this.add.text(12, GAME_HEIGHT - logHeight + 6, '', TEXT);
    this.add.text(12, GAME_HEIGHT - 22, CONTROLS, SMALL_TEXT);

    this.game.events.on(MESSAGE_EVENT, this.addMessage, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(MESSAGE_EVENT, this.addMessage, this));

    this.addMessage('You leave the shelter behind and step into the wasteland.');
  }

  update(): void {
    const p = state.player;
    const weapon = p.activeWeapon?.name ?? 'Unarmed';
    this.status.setText(
      `HP ${p.hitPoints}/${p.maxHitPoints}   AC ${p.armorClass}   AP ${p.maxActionPoints}   ` +
        `Weight ${p.carriedWeight}/${p.carryCapacity} lb   Weapon: ${weapon}`,
    );
  }

  private addMessage(text: string): void {
    this.messages.push(text);
    if (this.messages.length > LOG_LINES) this.messages.shift();
    this.log.setText(this.messages.join('\n'));
  }
}
