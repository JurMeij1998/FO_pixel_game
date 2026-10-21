import Phaser from 'phaser';
import { GLYPH_HEIGHT, GLYPH_WIDTH, glyphTextureKey, plainGlyphKey } from '../gfx/pixelFont';
import { SEAL_SIZE, SEAL_TEXTURE } from '../gfx/textures';
import { choosePlacement, placementOffsets, type Offset, type Rect } from './gaugePlacement';
import { GLOW_COLOR, glowColor, SHINE_WIDTH } from './glow';

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

/** Glyphs are 3 wide with 1 pixel between them (the outlined ones overlap by their outline). */
const ADVANCE = GLYPH_WIDTH + 1;
const PIP_WIDTH = 1;
const PIP_HEIGHT = 2;
const PIP_GAP = 1;
/** Around the pips: 1 pixel of space, the green border, then a black edge. */
const BAR_FRAME = 3;
const BAR_HEIGHT = PIP_HEIGHT + BAR_FRAME * 2;
/** How far the bar starts underneath the seal, so the two read as one shape. */
const BAR_OVERLAP = 4;
const PLAYER_SIZE = 16;
/** Space between the gauge and the player. */
const GAP = 5;

const COLOR = {
  plate: 0x0a140c,
  border: GLOW_COLOR.border,
  edge: 0x000000,
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
 * A small badge floating above the player in combat: the AP left, in pixel digits, inside a
 * round seal, with a bar of pips (one per action point) sweeping out of it to the right, a bit
 * like a swoosh. Spending AP counts the number down, flashes the spent pips and pops a
 * superscript "-3" that rises and fades; a new turn refills it with a "+N". It bobs gently,
 * and picks the spot above the player that covers the least of any chest, creature or exit.
 */
export class ApGauge {
  private readonly root: Phaser.GameObjects.Container;
  /** Child of root that bobs, so the bob doesn't disturb positioning. */
  private readonly body: Phaser.GameObjects.Container;
  private readonly pips: Phaser.GameObjects.Graphics;
  /** The light green border (the seal's ring and the bar's border), redrawn each frame to pulse and shine. */
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly borderPixels: Array<{ x: number; y: number }> = [];
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
  /**
   * Where the gauge is gliding, unrounded. The containers themselves are always placed on whole
   * world pixels, so the pixel art stays on the map's pixel grid instead of shimmering against it.
   */
  private readonly glide = { x: 0, y: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly maxActionPoints: number,
    depth: number,
  ) {
    const pipsWidth = maxActionPoints * (PIP_WIDTH + PIP_GAP) - PIP_GAP;
    // The seal, then the pips just past its edge, framed by the bar.
    this.width = SEAL_SIZE + 1 + pipsWidth + BAR_FRAME;
    this.height = SEAL_SIZE;
    this.offsets = placementOffsets(this.width, this.height, PLAYER_SIZE, GAP);

    const { left, top } = this.corner();
    // The bar runs along the lower half of the seal and starts where the seal curves away. It
    // only fills pixels outside the seal's circle, rather than lying underneath it, so nothing
    // shows through when the gauge is dimmed or fading.
    const bar = this.barRect();
    const frame = scene.add.graphics();
    const radius = SEAL_SIZE / 2;
    for (let y = bar.y; y < bar.y + bar.height; y++) {
      const row = y - bar.y;
      const onEdge = row === 0 || row === bar.height - 1;
      const onBorder = row === 1 || row === bar.height - 2;
      for (let x = bar.x; x < bar.x + bar.width; x++) {
        const insideSeal = Math.hypot(x + 0.5 - (left + radius), y + 0.5 - (top + radius)) <= radius;
        if (insideSeal) continue;
        const column = bar.x + bar.width - 1 - x; // counted from the bar's right end
        const color =
          onEdge || column === 0 ? COLOR.edge : onBorder || column === 1 ? COLOR.border : COLOR.plate;
        frame.fillStyle(color, 1).fillRect(x, y, 1, 1);
        if (color === COLOR.border) this.borderPixels.push({ x, y });
      }
    }
    const seal = scene.add.image(left, top, SEAL_TEXTURE).setOrigin(0);
    // The seal's green ring, which its texture leaves open, so it glows along with the bar's border.
    for (let y = 0; y < SEAL_SIZE; y++) {
      for (let x = 0; x < SEAL_SIZE; x++) {
        const d = Math.hypot(x + 0.5 - radius, y + 0.5 - radius);
        if (d <= radius - 1 && d > radius - 2) this.borderPixels.push({ x: left + x, y: top + y });
      }
    }
    this.glow = scene.add.graphics();

    // Plain digits (no outline): they sit on the seal, not on the map.
    for (let i = 0; i < 2; i++) this.digits.push(scene.add.image(0, 0, plainGlyphKey('0')).setOrigin(0));
    this.pips = scene.add.graphics();

    this.body = scene.add.container(0, 0, [frame, seal, this.glow, ...this.digits, this.pips]);
    this.root = scene.add.container(0, 0, [this.body]).setDepth(depth).setAlpha(0).setVisible(false);
  }

  /** True while out of combat and fully faded out: nothing to update or draw. */
  get idle(): boolean {
    return !this.wasActive && !this.root.visible;
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
    this.drawGlow();

    // Float above the player in the least obstructive spot, gliding there smoothly, with a gentle bob.
    this.placement = choosePlacement(s.anchor, this.size(), this.offsets, s.obstacles, s.view, this.placement);
    const goal = { x: s.anchor.x + this.offsets[this.placement].x, y: s.anchor.y + this.offsets[this.placement].y };
    const follow = 1 - Math.exp(-deltaMs * FOLLOW_RATE);
    this.glide.x += (goal.x - this.glide.x) * follow;
    this.glide.y += (goal.y - this.glide.y) * follow;
    this.root.setPosition(Math.round(this.glide.x), Math.round(this.glide.y));
    this.body.setY(Math.round(Math.sin(this.time / 650)));
  }

  /**
   * Combat just started. The gauge starts from full AP and counts down to the current value, so
   * an opening attack (which has already spent its AP by the time combat starts) still shows
   * its "-N"; a fight that starts with full AP looks the same as before.
   */
  private start(s: ApGaugeState): void {
    this.shown = this.target = this.lastSeen = this.maxActionPoints;
    this.flashes.clear();
    this.placement = choosePlacement(s.anchor, this.size(), this.offsets, s.obstacles, s.view, 0);
    this.glide.x = s.anchor.x + this.offsets[this.placement].x;
    this.glide.y = s.anchor.y + this.offsets[this.placement].y;
    this.root.setPosition(Math.round(this.glide.x), Math.round(this.glide.y));
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

  /**
   * Pulses the light green border slowly between its normal and a brighter green, and every
   * few seconds sweeps a white glint diagonally across it, from the seal to the bar's end.
   */
  private drawGlow(): void {
    const { left, top } = this.corner();
    const span = this.width + this.height;
    // The game loop's clock, shared with the health bar's glow, so the two shine together.
    const time = this.scene.game.loop.time;
    this.glow.clear();
    for (const p of this.borderPixels) {
      const color = glowColor(time, p.x - left + (p.y - top), span, SHINE_WIDTH);
      this.glow.fillStyle(color, 1).fillRect(p.x, p.y, 1, 1);
    }
  }

  /** The number, centred in the seal. */
  private drawNumber(): void {
    const text = String(this.shown);
    const { left, top } = this.corner();
    const x = Math.round(left + SEAL_SIZE / 2 - numberWidth(text.length) / 2);
    const y = Math.round(top + SEAL_SIZE / 2 - GLYPH_HEIGHT / 2);
    this.digits.forEach((digit, i) => {
      const char = text[i];
      digit.setVisible(char !== undefined);
      if (char) {
        digit
          .setTexture(plainGlyphKey(char))
          .setPosition(x + i * ADVANCE, y)
          .setTint(this.shown === 0 ? COLOR.empty : COLOR.number);
      }
    });
  }

  /** Top-left corner of the gauge, relative to its centre (whole pixels, so the art stays crisp). */
  private corner(): { left: number; top: number } {
    return { left: -Math.floor(this.width / 2), top: -Math.floor(this.height / 2) };
  }

  /** The pip bar's frame: from under the seal to past the last pip, along the seal's lower half. */
  private barRect(): Rect {
    const { left, top } = this.corner();
    const x = left + SEAL_SIZE - BAR_OVERLAP;
    const y = top + Math.floor(SEAL_SIZE / 2) - 1;
    return { x, y, width: left + this.width - x, height: BAR_HEIGHT };
  }

  private drawPips(deltaMs: number): void {
    const left = this.corner().left + SEAL_SIZE + 1;
    const top = this.barRect().y + BAR_FRAME;
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

  /** A superscript "-3" or "+8" beside the number that pops, rises and fades. */
  private showDelta(delta: number): void {
    const text = `${delta > 0 ? '+' : '-'}${Math.abs(delta)}`;
    const color = delta > 0 ? COLOR.refillDelta : COLOR.spentDelta;
    const glyphs = [...text].map((char, i) => this.scene.add.image(i * ADVANCE, 0, glyphTextureKey(char)).setOrigin(0).setTint(color));
    // Superscript: at the seal's top right, raised above it.
    const { left, top } = this.corner();
    const floater = this.scene.add.container(left + SEAL_SIZE - 4, top - 5, glyphs).setScale(1.3);
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

/** Width of a number in plain glyphs. */
function numberWidth(digits: number): number {
  return digits * ADVANCE - 1;
}

