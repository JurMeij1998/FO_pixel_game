import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import { GAME_WIDTH } from '../config';
import { LockPuzzle, PIN_COUNT } from '../core/lockPuzzle';
import { RepeatGuard } from '../ui/repeatGuard';
import { COLORS, TEXT } from '../ui/theme';
import { addButton, closeOverlay, drawPanel, PANEL } from '../ui/widgets';

export interface LockpickData {
  /** What's being picked, for the title ("Door", "Stockroom Crate"). */
  title: string;
  /** Called once the lock opens, just before the screen closes. Giving up (Esc) calls nothing. */
  onPicked: () => void;
}

const CENTER_X = GAME_WIDTH / 2;
const PIN_SPACING = 56;

// A padlock: a steel shackle on top and a slim brass body, with the four pins sticking out of
// its bottom until they're pushed up into it.
const BODY = { top: 250, width: 300, height: 150, radius: 22 };
const BODY_LEFT = CENTER_X - BODY.width / 2;
const BODY_BOTTOM = BODY.top + BODY.height;
/** The shackle's legs stand this far apart; its arch is a half circle on top, reaching up to y = legTop - spread / 2. */
const SHACKLE = { spread: 210, thickness: 26, legTop: BODY.top - 30, lift: 24 };
/** Where a pin's tip is: well below the body until it's pushed in, then only its head showing under it. */
const PIN = { width: 20, head: 9, length: 90, outBottom: BODY_BOTTOM + 56, inBottom: BODY_BOTTOM + 13 };
const PIN_TWEEN_MS = 90;
/** The open lock stays on screen this long, so you see (and hear) it give. */
const OPEN_PAUSE_MS = 750;

const BRASS = { light: 0xe0bc5c, base: 0xb88e34, dark: 0x8a6624, edge: 0x3e2c0c };
const STEEL = { light: 0xd0d0c8, base: 0x9a9a92, edge: 0x2a2a26 };
const SELECTED = Phaser.Display.Color.HexStringToColor(COLORS.bright).color;

const pinX = (pin: number) => CENTER_X + (pin - (PIN_COUNT - 1) / 2) * PIN_SPACING;

/**
 * Picking a lock: four pins stick out of the bottom of a padlock, to be pushed in in one order
 * (new each time, though the first pin you push always goes in; core/lockPuzzle.ts). The right
 * pin stays in; a wrong one drops every pin back out. A/D (or the arrow keys) choose a pin, E,
 * Space, W or Up push it in; 1-4 or a click push one directly. Esc gives up. Only opened for
 * locks the player has the skill to try.
 */
export class LockpickScene extends Phaser.Scene {
  private puzzle!: LockPuzzle;
  private onPicked!: () => void;
  private title = '';
  private selected = 0;
  /** Set once the lock opens or the player gives up, so nothing acts while the screen closes. */
  private closed = false;
  /** Each pin's rod, head at the bottom; its y is the pin's tip. */
  private pins: Phaser.GameObjects.Container[] = [];
  private highlight!: Phaser.GameObjects.Graphics;
  private shackle!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;

  constructor() {
    super('Lockpick');
  }

  init(data: LockpickData): void {
    this.title = data.title;
    this.onPicked = data.onPicked;
    this.puzzle = new LockPuzzle(Math.random);
    this.selected = 0;
    this.closed = false;
  }

  create(): void {
    drawPanel(this, `PICKING THE LOCK: ${this.title.toUpperCase()}`);
    addButton(this, PANEL.x + PANEL.width - 130, PANEL.y + 18, 'Close', () => this.giveUp());

    this.shackle = this.drawShackle();
    // The pins first, so the body hides the part of them that's inside it.
    this.pins = [];
    for (let pin = 0; pin < PIN_COUNT; pin++) this.pins.push(this.drawPin(pin));
    this.drawBody();
    this.highlight = this.add.graphics();

    const labels = PIN.outBottom + 18;
    for (let pin = 0; pin < PIN_COUNT; pin++) {
      // Click anywhere on a pin's column: the body above it, or the pin itself.
      this.add
        .zone(pinX(pin), BODY.top, PIN_SPACING - 6, PIN.outBottom + 6 - BODY.top)
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.press(pin));
      this.add.text(pinX(pin), labels, String(pin + 1), TEXT).setOrigin(0.5, 0);
    }
    this.marker = this.add.text(0, labels + 22, '^', { ...TEXT, color: COLORS.bright }).setOrigin(0.5, 0);
    this.feedback = this.add.text(CENTER_X, labels + 54, '', TEXT).setOrigin(0.5, 0);

    const guard = new RepeatGuard(); // a key held from the world doesn't act here
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (!guard.allow(event.code, event.repeat)) return;
      this.onKey(event);
    });
    this.refresh();
  }

  // --- Drawing -------------------------------------------------------------

  /** The steel U on top: two legs going down into the body, joined by an arch. */
  private drawShackle(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const half = SHACKLE.spread / 2;
    const stroke = (width: number, color: number) => {
      g.lineStyle(width, color);
      g.beginPath();
      g.moveTo(CENTER_X - half, BODY.top + 10);
      g.lineTo(CENTER_X - half, SHACKLE.legTop);
      g.arc(CENTER_X, SHACKLE.legTop, half, Math.PI, 0, false);
      g.lineTo(CENTER_X + half, BODY.top + 10);
      g.strokePath();
    };
    stroke(SHACKLE.thickness + 6, STEEL.edge);
    stroke(SHACKLE.thickness, STEEL.base);
    stroke(SHACKLE.thickness / 3, STEEL.light); // the shine along the bar
    return g;
  }

  /** The brass body: lit along the top, darker towards the bottom, with the holes the pins come out of. */
  private drawBody(): void {
    const g = this.add.graphics();
    g.fillStyle(BRASS.edge).fillRoundedRect(BODY_LEFT - 4, BODY.top - 4, BODY.width + 8, BODY.height + 8, BODY.radius + 4);
    g.fillStyle(BRASS.dark).fillRoundedRect(BODY_LEFT, BODY.top, BODY.width, BODY.height, BODY.radius);
    g.fillStyle(BRASS.base).fillRoundedRect(BODY_LEFT + 5, BODY.top + 4, BODY.width - 10, BODY.height - 16, BODY.radius - 4);
    g.fillStyle(BRASS.light, 0.55).fillRoundedRect(BODY_LEFT + 14, BODY.top + 8, BODY.width - 28, 9, 4); // light along the top
    g.fillStyle(BRASS.dark, 0.5).fillRect(BODY_LEFT + 10, BODY.top + BODY.height / 2 + 20, BODY.width - 20, 2); // a seam
    for (let pin = 0; pin < PIN_COUNT; pin++) {
      g.fillStyle(BRASS.edge).fillEllipse(pinX(pin), BODY_BOTTOM - 1, PIN.width + 10, 8);
      g.fillStyle(0x000000).fillEllipse(pinX(pin), BODY_BOTTOM, PIN.width + 4, 5);
    }
    // Rivets in the corners.
    for (const [dx, dy] of [
      [22, 26],
      [BODY.width - 22, 26],
      [22, BODY.height - 30],
      [BODY.width - 22, BODY.height - 30],
    ]) {
      g.fillStyle(BRASS.edge).fillCircle(BODY_LEFT + dx, BODY.top + dy, 6);
      g.fillStyle(BRASS.light).fillCircle(BODY_LEFT + dx - 1, BODY.top + dy - 1, 3);
    }
  }

  /** A pin: a steel rod with a wider head at the bottom, lit down its left side. Its origin is the tip. */
  private drawPin(pin: number): Phaser.GameObjects.Container {
    const rod = this.add.graphics();
    const w = PIN.width;
    const top = -PIN.length;
    rod.fillStyle(STEEL.edge).fillRect(-w / 2 + 2, top, w - 4, PIN.length - PIN.head + 2);
    rod.fillStyle(STEEL.base).fillRect(-w / 2 + 4, top, w - 8, PIN.length - PIN.head);
    rod.fillStyle(STEEL.light).fillRect(-w / 2 + 5, top, 3, PIN.length - PIN.head);
    rod.fillStyle(STEEL.edge).fillRoundedRect(-w / 2 - 3, -PIN.head - 2, w + 6, PIN.head + 2, 4);
    rod.fillStyle(STEEL.light).fillRoundedRect(-w / 2 - 1, -PIN.head - 1, w + 2, PIN.head - 2, 3);
    return this.add.container(pinX(pin), PIN.outBottom, [rod]);
  }

  // --- Input ---------------------------------------------------------------

  private onKey(event: KeyboardEvent): void {
    if (event.code === 'Escape') {
      this.giveUp();
      return;
    }
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= PIN_COUNT) {
      if (!event.repeat) this.press(digit - 1);
      return;
    }
    switch (event.code) {
      case 'KeyA':
      case 'ArrowLeft':
        this.select(this.selected - 1);
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.select(this.selected + 1);
        break;
      case 'KeyE':
      case 'Space':
      case 'KeyW':
      case 'ArrowUp':
      case 'Enter':
        if (!event.repeat) this.press(this.selected);
        break;
    }
  }

  private select(pin: number): void {
    if (this.closed || pin < 0 || pin >= PIN_COUNT || pin === this.selected) return;
    this.selected = pin;
    playSound('menuMove');
    this.refresh();
  }

  private press(pin: number): void {
    if (this.closed) return;
    this.selected = pin;
    switch (this.puzzle.press(pin)) {
      case 'set':
        playSound('pinSet');
        this.feedback.setText('');
        break;
      case 'alreadySet':
        this.feedback.setText('That pin is already in.').setColor(COLORS.dim);
        break;
      case 'wrong':
        playSound('pinsDrop');
        this.feedback.setText('Wrong pin! They all drop back out.').setColor(COLORS.warn);
        // The wrong pin gives a little under your pick before it drops with the rest.
        this.nudge(pin);
        this.refresh(pin);
        return;
      case 'open':
        this.closed = true;
        playSound('lockPick');
        this.feedback.setText('Click! The lock gives.').setColor(COLORS.bright);
        // The shackle springs up out of the body.
        this.tweens.add({ targets: this.shackle, y: -SHACKLE.lift, duration: 160, delay: 120, ease: 'Back.easeOut' });
        this.time.delayedCall(OPEN_PAUSE_MS, () => {
          this.onPicked();
          closeOverlay(this);
        });
        break;
    }
    this.refresh();
  }

  private giveUp(): void {
    if (this.closed) return;
    this.closed = true;
    closeOverlay(this);
  }

  /** A wrong pin moves up a little and drops straight back. */
  private nudge(pin: number): void {
    const rod = this.pins[pin];
    this.tweens.killTweensOf(rod);
    rod.y = PIN.outBottom;
    this.tweens.add({ targets: rod, y: PIN.outBottom - 16, duration: 60, yoyo: true });
  }

  /**
   * Moves every pin to where it now is (in or out), and marks the chosen one. `nudged` is a pin
   * left to its own little animation (see nudge).
   */
  private refresh(nudged?: number): void {
    for (let pin = 0; pin < PIN_COUNT; pin++) {
      if (pin === nudged) continue;
      const rod = this.pins[pin];
      const bottom = this.puzzle.isSet(pin) ? PIN.inBottom : PIN.outBottom;
      this.tweens.killTweensOf(rod); // a push mid-animation goes where it now should
      if (rod.y !== bottom) {
        const ease = this.puzzle.isSet(pin) ? 'Quad.easeIn' : 'Bounce.easeOut';
        this.tweens.add({ targets: rod, y: bottom, duration: PIN_TWEEN_MS * (this.puzzle.isSet(pin) ? 1 : 2), ease });
      }
    }
    // A green frame around the chosen pin, below the lock, like the cursor on other screens.
    const x = pinX(this.selected);
    this.highlight
      .clear()
      .lineStyle(2, SELECTED)
      .strokeRect(x - PIN.width / 2 - 8, BODY_BOTTOM + 6, PIN.width + 16, PIN.outBottom - BODY_BOTTOM);
    this.marker.setX(x);
  }
}
