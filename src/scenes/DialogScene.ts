import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import { Conversation } from '../core/dialog';
import type { Creature } from '../core/creature';
import { questDialogWorld } from '../core/quests';
import { state } from '../state';
import { BOX_PADDING, BOX_WIDTH, BOX_X, dialogBoxLayout, ReplyMenu, speechText } from '../ui/dialogBox';
import { postMessage } from '../ui/messages';
import { COLORS, TEXT } from '../ui/theme';
import { closeOverlay } from '../ui/widgets';

/** The same green-on-black as the AP gauge: a black box with a green border, and green text. */
const GREEN = COLORS.border;
const BOX_TEXT = { ...TEXT, color: COLORS.text, lineSpacing: 4, wordWrap: { width: BOX_WIDTH - 2 * BOX_PADDING } };
/** A quest taken on or handed in, under the line: brighter, so it stands out. */
const NOTICE_TEXT = { ...BOX_TEXT, color: COLORS.bright };
/** Between the line and the notice under it. */
const NOTICE_GAP = 8;

/** What the world gives the dialog: who you're talking to, and how to start a fight with them. */
export interface DialogData {
  person: Creature;
  /** Called after the dialog has closed, when you choose *Attack*. */
  onAttack: () => void;
}

/**
 * Talking to someone: what they say, as a subtitle in a box along the bottom of the screen, with
 * your replies listed underneath and a '>' in front of the one selected. Up/Down (or W/S, or
 * the mouse) to pick, Enter/Space/E or a click to answer, a number key to answer straight away
 * (1 for the first reply), Esc to walk away. The world stays paused while you talk.
 * Layout and selection live in ui/dialogBox.ts; this scene draws them and handles input.
 */
export class DialogScene extends Phaser.Scene {
  private person!: Creature;
  private onAttack!: () => void;
  private menu!: ReplyMenu;
  private conversation!: Conversation;
  private box!: Phaser.GameObjects.Graphics;
  private speech!: Phaser.GameObjects.Text;
  private notice!: Phaser.GameObjects.Text;
  private replies: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Dialog');
  }

  init(data: DialogData): void {
    this.person = data.person;
    this.onAttack = data.onAttack;
    // Lines and replies can depend on quests, and replies can take them on or hand them in.
    this.conversation = new Conversation(data.person.def.dialog!, questDialogWorld(state));
    this.menu = new ReplyMenu(this.conversation);
    this.replies = [];
  }

  create(): void {
    this.box = this.add.graphics();
    this.speech = this.add.text(BOX_X + BOX_PADDING, 0, '', BOX_TEXT);
    this.notice = this.add.text(BOX_X + BOX_PADDING, 0, '', NOTICE_TEXT);

    const keyboard = this.input.keyboard!;
    // Ignore auto-repeat, so the key that started the conversation can't also answer.
    const fresh = (action: () => void) => (event: KeyboardEvent) => {
      if (!event.repeat) action();
    };
    for (const key of ['UP', 'W']) keyboard.on(`keydown-${key}`, fresh(() => this.move(-1)));
    for (const key of ['DOWN', 'S']) keyboard.on(`keydown-${key}`, fresh(() => this.move(1)));
    for (const key of ['ENTER', 'SPACE', 'E']) keyboard.on(`keydown-${key}`, fresh(() => this.answer(this.menu.selected)));
    keyboard.on('keydown-ESC', () => this.leave());
    keyboard.on('keydown', (event: KeyboardEvent) => {
      const number = Number(event.key);
      if (!event.repeat && Number.isInteger(number) && number >= 1) this.answer(number - 1);
    });
    // Coming back from the barter or repair screen: the conversation goes on where it was.
    const onWake = () => {
      keyboard.resetKeys();
      this.show();
    };
    this.events.on(Phaser.Scenes.Events.WAKE, onWake);
    // Scene events outlive the scene being stopped and started again, so remove this one ourselves.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.WAKE, onWake));

    this.show();
  }

  /** Lays out the box for the current line: what they say, then the replies. */
  private show(): void {
    for (const reply of this.replies) reply.destroy();
    this.speech.setText(speechText(this.person.name, this.conversation.text));
    const notice = this.conversation.notice;
    this.notice.setText(notice.join('\n')).setVisible(notice.length > 0);
    const textHeight = this.speech.height + (notice.length > 0 ? NOTICE_GAP + this.notice.height : 0);

    const layout = dialogBoxLayout(textHeight, this.conversation.replies.length);
    this.speech.setY(layout.speechY);
    this.notice.setY(layout.speechY + this.speech.height + NOTICE_GAP);
    this.replies = layout.replyY.map((y, i) =>
      this.add
        .text(BOX_X + BOX_PADDING, y, '', BOX_TEXT)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.select(i))
        .on('pointerdown', () => this.answer(i)),
    );

    // A thin black edge outside the green border, like the AP gauge's, so it reads on any ground.
    this.box
      .clear()
      .fillStyle(0x000000)
      .fillRect(BOX_X - 2, layout.top - 2, BOX_WIDTH + 4, layout.height + 4)
      .lineStyle(2, GREEN)
      .strokeRect(BOX_X + 1, layout.top + 1, BOX_WIDTH - 2, layout.height - 2);
    this.renderReplies();
  }

  private renderReplies(): void {
    this.menu.labels.forEach((label, i) => this.replies[i].setText(label));
  }

  private move(delta: number): void {
    if (!this.menu.move(delta)) return;
    playSound('menuMove');
    this.renderReplies();
  }

  private select(index: number): void {
    if (!this.menu.select(index)) return;
    playSound('menuMove');
    this.renderReplies();
  }

  private answer(index: number): void {
    const answered = this.menu.answer(index);
    if (!answered) return;
    playSound('menuSelect');
    // Also in the message log, for after the conversation.
    for (const line of this.conversation.notice) postMessage(this, line);
    if (answered.action === 'leave') {
      this.leave();
    } else if (answered.action === 'attack') {
      this.leave();
      this.onAttack();
    } else if (answered.action === 'barter') {
      this.scene.sleep();
      this.scene.launch('Barter', { trader: this.person });
    } else if (answered.action === 'repair') {
      // The workbench screen, as the trader's repair service; it wakes this conversation on closing.
      this.scene.sleep();
      this.scene.launch('Workbench', { trader: this.person });
    } else {
      this.show();
    }
  }

  private leave(): void {
    closeOverlay(this);
  }
}
