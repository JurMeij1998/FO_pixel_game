import Phaser from 'phaser';
import { GLYPH_WIDTH, glyphTextureKey } from '../gfx/pixelFont';
import { choosePlacement, placementOffsets, type Offset, type Rect } from './gaugePlacement';

/** Everything the gauge needs to know each frame. Positions are in world pixels. */
export interface ApGaugeState {
  /** Shown only in combat, which is the only time AP is spent. */
  active: boolean;
  playerTurn: boolean;
  actionPoints: number;
  /** Centre of the player sprite. */
  anchor: Offset;
  /** Things the gauge must not cover: chests, creatures, exits... */
  obstacles: readonly Rect[];
  /** The part of the world the player can see, minus the HUD. */
  view: Rect;
}

const PADDING = 2;
/** Glyph textures are 5 wide including their outline; overlapping outlines by 1 spaces glyphs evenly. */
const ADVANCE = GLYPH_WIDTH + 1;
const PIP_WIDTH = 2;
const PIP_HEIGHT = 3;
const PIP_GAP = 1;
const PLAYER_SIZE = 16;

const COLOR = {
  plate: 0x0a140c,
  border: 0x3cd070,
  number: 0xd8ffb0,
  empty: 0xff6a4d,
  pipFull: 0xa8ff60,
  pipSpent: 0x23351f,
  spentFlash: 0xffffff,
  refillFlash: 0x60ffa0,
  spentDelta: 0xffb040,
  refillDelta: 0x7dff9a,
};

/** Milliseconds per step when the number counts towards a new value, and for a pip's flash. */
const COUNT_STEP_MS = 70;
const FLASH_MS = 180;
const DELTA_MS = 900;
/** How quickly the gauge glides to a new spot (higher is faster). */
const FOLLOW_RATE = 0.012;

/**
 * A small plate floating beside the player in combat: the AP left, in pixel digits, centred
 * over a row of pips, one per action point. Spending AP counts the number down, flashes the spent pips and
 * pops a superscript "-3" that rises and fades; a new turn refills it with a "+N". It bobs
 * gently, and moves around the player so it never covers a chest, creature or exit.
 */
export class ApGauge {
  private readonly root: Phaser.GameObjects.Container;
  /** Child of root that bobs, so the bob doesn't disturb positioning. */
  private readonly body: Phaser.GameObjects.Container;
  private readonly pips: Phaser.GameObjects.Graphics;
  private readonly digits: Phaser.GameObjects.Image[] = [];
  private readonly offsets: Offset[];
  private readonly width: number;
  private readonly height: number;

  /** The value currently drawn, which counts towards `target` one step at a time. */
  private shown = 0;
  private target = 0;
  /** The last AP value seen, to notice changes. */
  private lastSeen = 0;
  private stepTimer = 0;
  /** Remaining flash time per pip index, and whether it is a spend (white) or refill (green) flash. */
  private readonly flashes = new Map<number, { ms: number; refill: boolean }>();
  private placement = 0;
  private wasActive = false;
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly maxActionPoints: number,
    depth: number,
  ) {
    const textWidth = numberWidth(2); // up to two digits
    const pipsWidth = maxActionPoints * (PIP_WIDTH + PIP_GAP) - PIP_GAP;
    this.width = Math.max(textWidth, pipsWidth) + PADDING * 2;
    this.height = 7 + 1 + PIP_HEIGHT + PADDING * 2 - 1;
    this.offsets = placementOffsets(this.width, this.height, PLAYER_SIZE);

    const left = -this.width / 2;
    const top = -this.height / 2;
    const plate = scene.add.graphics();
    plate.fillStyle(COLOR.plate, 0.88).fillRect(left, top, this.width, this.height);
    plate.lineStyle(1, COLOR.border, 0.9).strokeRect(left + 0.5, top + 0.5, this.width - 1, this.height - 1);

    const textY = top + PADDING - 1;
    for (let i = 0; i < 2; i++) this.digits.push(scene.add.image(0, textY, glyphTextureKey('0')).setOrigin(0));
    this.pips = scene.add.graphics();

    this.body = scene.add.container(0, 0, [plate, ...this.digits, this.pips]);
    this.root = scene.add.container(0, 0, [this.body]).setDepth(depth).setAlpha(0).setVisible(false);
  }

  update(deltaMs: number, s: ApGaugeState): void {
    this.time += deltaMs;
    if (s.active && !this.wasActive) this.start(s);
    this.wasActive = s.active;

    // Fade in for combat, dim during the enemy turn, fade out afterwards.
    const targetAlpha = !s.active ? 0 : s.playerTurn ? 1 : 0.55;
    this.root.setAlpha(this.root.alpha + (targetAlpha - this.root.alpha) * Math.min(1, deltaMs * 0.01));
    this.root.setVisible(this.root.alpha > 0.02);
    if (!s.active && !this.root.visible) return;

    if (s.active && s.actionPoints !== this.lastSeen) {
      this.showDelta(s.actionPoints - this.lastSeen);
      this.lastSeen = s.actionPoints;
      this.target = s.actionPoints;
    }
    this.countTowardsTarget(deltaMs);
    this.drawPips(deltaMs);

    // Float beside the player in the least obstructive spot, gliding there smoothly, with a gentle bob.
    this.placement = choosePlacement(s.anchor, this.size(), this.offsets, s.obstacles, s.view, this.placement);
    const goal = { x: s.anchor.x + this.offsets[this.placement].x, y: s.anchor.y + this.offsets[this.placement].y };
    const follow = 1 - Math.exp(-deltaMs * FOLLOW_RATE);
    this.root.setPosition(this.root.x + (goal.x - this.root.x) * follow, this.root.y + (goal.y - this.root.y) * follow);
    this.body.setY(Math.round(Math.sin(this.time / 650)));
  }

  /** Combat just started: show the current AP straight away, with no animation. */
  private start(s: ApGaugeState): void {
    this.shown = this.target = this.lastSeen = s.actionPoints;
    this.flashes.clear();
    this.placement = choosePlacement(s.anchor, this.size(), this.offsets, s.obstacles, s.view, 0);
    this.root.setPosition(s.anchor.x + this.offsets[this.placement].x, s.anchor.y + this.offsets[this.placement].y);
    this.drawNumber();
  }

  private countTowardsTarget(deltaMs: number): void {
    if (this.shown === this.target) {
      this.stepTimer = 0;
      return;
    }
    this.stepTimer += deltaMs;
    while (this.stepTimer >= COUNT_STEP_MS && this.shown !== this.target) {
      this.stepTimer -= COUNT_STEP_MS;
      const refill = this.target > this.shown;
      // Flash the pip that is changing: the last full one when spending, the next one when refilling.
      this.flashes.set(refill ? this.shown : this.shown - 1, { ms: FLASH_MS, refill });
      this.shown += refill ? 1 : -1;
      this.drawNumber();
    }
  }

  /** The number, centred over the pips. */
  private drawNumber(): void {
    const text = String(this.shown);
    const left = this.numberLeft(text);
    this.digits.forEach((digit, i) => {
      const char = text[i];
      digit.setVisible(char !== undefined);
      if (char) {
        digit
          .setTexture(glyphTextureKey(char))
          .setX(left + i * ADVANCE)
          .setTint(this.shown === 0 ? COLOR.empty : COLOR.number);
      }
    });
  }

  private numberLeft(text: string): number {
    return -Math.round(numberWidth(text.length) / 2);
  }

  private drawPips(deltaMs: number): void {
    const left = -this.width / 2 + PADDING + (this.width - PADDING * 2 - this.pipsWidth()) / 2;
    const top = this.height / 2 - PADDING - PIP_HEIGHT;
    this.pips.clear();
    for (let i = 0; i < this.maxActionPoints; i++) {
      const flash = this.flashes.get(i);
      let color = i < this.shown ? COLOR.pipFull : COLOR.pipSpent;
      if (flash) {
        color = flash.refill ? COLOR.refillFlash : COLOR.spentFlash;
        flash.ms -= deltaMs;
        if (flash.ms <= 0) this.flashes.delete(i);
      }
      this.pips.fillStyle(color, 1).fillRect(left + i * (PIP_WIDTH + PIP_GAP), top, PIP_WIDTH, PIP_HEIGHT);
    }
  }

  private size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  private pipsWidth(): number {
    return this.maxActionPoints * (PIP_WIDTH + PIP_GAP) - PIP_GAP;
  }

  /** A superscript "-3" or "+8" beside the number that pops, rises and fades. */
  private showDelta(delta: number): void {
    const text = `${delta > 0 ? '+' : '-'}${Math.abs(delta)}`;
    const color = delta > 0 ? COLOR.refillDelta : COLOR.spentDelta;
    const glyphs = [...text].map((char, i) => this.scene.add.image(i * ADVANCE, 0, glyphTextureKey(char)).setOrigin(0).setTint(color));
    // Superscript: just past the number's right edge, raised above the plate's top.
    const shown = String(this.shown);
    const numberRight = this.numberLeft(shown) + numberWidth(shown.length);
    const floater = this.scene.add.container(numberRight, -this.height / 2 - 5, glyphs).setScale(1.3);
    this.body.add(floater);
    this.scene.tweens.add({ targets: floater, scale: 1, duration: 120, ease: 'Back.Out' });
    this.scene.tweens.add({
      targets: floater,
      y: floater.y - 6,
      alpha: 0,
      delay: 250,
      duration: DELTA_MS - 250,
      onComplete: () => floater.destroy(),
    });
  }
}

/** Width of a number in outlined glyphs, which overlap by their 1-pixel outline. */
function numberWidth(digits: number): number {
  return digits * ADVANCE + 1;
}
