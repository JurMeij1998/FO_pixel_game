import Phaser from 'phaser';
import { GLYPH_HEIGHT, GLYPH_WIDTH, glyphTextureKey, plainGlyphKey } from '../gfx/pixelFont';
import { WEAPON_SPRITES, weaponTextureKey } from '../gfx/weaponSprites';
import { choosePlacement, placementOffsets, type Offset, type Rect } from './gaugePlacement';

/**
 * Everything the card shows and needs each frame. Positions and sizes are in card pixels: the
 * card is drawn in its own overlay at 2x, so it stays crisp but smaller than the 3x world.
 */
export interface CombatCardState {
  /** Shown only in combat, which is the only time AP is spent. */
  active: boolean;
  playerTurn: boolean;
  actionPoints: number;
  maxActionPoints: number;
  hitPoints: number;
  maxHitPoints: number;
  weapon: {
    /** Item id of the weapon in hand, or null for fists. */
    itemId: string | null;
    damageMin: number;
    damageMax: number;
    /** Rounds in the magazine and all rounds carried (magazine included); null for melee. */
    ammo: { loaded: number; total: number } | null;
  };
  /** Centre of the player sprite, and its size. */
  anchor: Offset;
  playerSize: number;
  /** Things the card must not cover: chests, creatures, exits... */
  obstacles: readonly Rect[];
  /** The part of the screen the world shows through, minus the HUD. */
  view: Rect;
}

const PADDING = 2;
const ROW_GAP = 2;
/** Plain glyphs are 3 wide; 1 pixel between them. */
const ADVANCE = GLYPH_WIDTH + 1;
const PIP_WIDTH = 2;
const PIP_HEIGHT = 3;
const PIP_GAP = 1;
/** Space between the card and the player, in card pixels. */
const GAP = 6;

const COLOR = {
  plate: 0x0a140c,
  border: 0x3cd070,
  label: 0x3cd070,
  number: 0xd8ffb0,
  empty: 0xff6a4d,
  pipFull: 0xa8ff60,
  pipSpent: 0x23351f,
  spentFlash: 0xffffff,
  refillFlash: 0x60ffa0,
  spentDelta: 0xffb040,
  refillDelta: 0x7dff9a,
  damage: 0xff5040,
  ammo: 0xd8ffb0,
  ammoEmpty: 0xff6a4d,
  hpTrack: 0x3a1210,
  hpGood: 0x4caf50,
  hpHurt: 0xd8a030,
  hpBad: 0xc83a2a,
  hpText: 0xffffff,
};

const COUNT_STEP_MS = 70;
const FLASH_MS = 180;
const DELTA_MS = 900;
const FOLLOW_RATE = 0.012;

/**
 * The card that floats beside the player in combat:
 *
 *   AP 10      [ 41/41 ]      <- action points, and an HP bar with the values in it
 *   ▮▮▮▮▮▮▮▮▮▮                <- one pip per AP
 *   8-20           5/20 ══>   <- weapon damage (red), ammo loaded/carried, the weapon peeking out
 *
 * Spending AP counts the number down, flashes the spent pips and pops a superscript "-3";
 * a new turn refills it with a "+N". It bobs gently, dims during the enemy turn, and moves
 * around the player so it never covers a chest, creature or exit.
 */
export class CombatCard {
  private readonly root: Phaser.GameObjects.Container;
  /** Child of root that bobs, so the bob doesn't disturb positioning. */
  private readonly body: Phaser.GameObjects.Container;
  private readonly weapon: Phaser.GameObjects.Image;
  private readonly plate: Phaser.GameObjects.Graphics;
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly label: GlyphRun;
  private readonly apNumber: GlyphRun;
  private readonly hpText: GlyphRun;
  private readonly damageText: GlyphRun;
  private readonly ammoText: GlyphRun;

  private shown = 0;
  private target = 0;
  private lastSeen = 0;
  private stepTimer = 0;
  private readonly flashes = new Map<number, { ms: number; refill: boolean }>();
  /** The HP bar's fill, easing towards the real value. */
  private shownHpFraction = 1;
  private placement = 0;
  private wasActive = false;
  private time = 0;
  private layout = { width: 0, height: 0, peek: 0 };

  constructor(private readonly scene: Phaser.Scene) {
    this.weapon = scene.add.image(0, 0, '__DEFAULT').setOrigin(1, 0.5).setVisible(false);
    this.plate = scene.add.graphics();
    this.bars = scene.add.graphics();
    this.label = new GlyphRun(scene);
    this.apNumber = new GlyphRun(scene);
    this.hpText = new GlyphRun(scene);
    this.damageText = new GlyphRun(scene);
    this.ammoText = new GlyphRun(scene);
    // Drawn back to front: the weapon behind the card, so only its end shows past the edge.
    this.body = scene.add.container(0, 0, [
      this.weapon,
      this.plate,
      this.bars,
      ...[this.label, this.apNumber, this.hpText, this.damageText, this.ammoText].map((run) => run.container),
    ]);
    this.root = scene.add.container(0, 0, [this.body]).setAlpha(0).setVisible(false);
  }

  update(deltaMs: number, s: CombatCardState): void {
    this.time += deltaMs;
    if (s.active && !this.wasActive) this.start(s);
    this.wasActive = s.active;

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
    const hpFraction = s.maxHitPoints > 0 ? s.hitPoints / s.maxHitPoints : 0;
    this.shownHpFraction += (hpFraction - this.shownHpFraction) * Math.min(1, deltaMs * 0.008);
    this.draw(s, deltaMs);

    // Float beside the player in the least obstructive spot, gliding there, with a gentle bob.
    const size = { width: this.layout.width + this.layout.peek, height: this.layout.height };
    const offsets = placementOffsets(size.width, size.height, s.playerSize, GAP);
    this.placement = choosePlacement(s.anchor, size, offsets, s.obstacles, s.view, this.placement);
    const goal = { x: s.anchor.x + offsets[this.placement].x, y: s.anchor.y + offsets[this.placement].y };
    const follow = 1 - Math.exp(-deltaMs * FOLLOW_RATE);
    this.root.setPosition(this.root.x + (goal.x - this.root.x) * follow, this.root.y + (goal.y - this.root.y) * follow);
    this.body.setY(Math.round(Math.sin(this.time / 650)));
  }

  /** Combat just started: show the current values straight away, with no animation. */
  private start(s: CombatCardState): void {
    this.shown = this.target = this.lastSeen = s.actionPoints;
    this.flashes.clear();
    this.shownHpFraction = s.maxHitPoints > 0 ? s.hitPoints / s.maxHitPoints : 0;
    this.draw(s, 0);
    const size = { width: this.layout.width + this.layout.peek, height: this.layout.height };
    const offsets = placementOffsets(size.width, size.height, s.playerSize, GAP);
    this.placement = choosePlacement(s.anchor, size, offsets, s.obstacles, s.view, 0);
    this.root.setPosition(s.anchor.x + offsets[this.placement].x, s.anchor.y + offsets[this.placement].y);
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
      this.flashes.set(refill ? this.shown : this.shown - 1, { ms: FLASH_MS, refill });
      this.shown += refill ? 1 : -1;
    }
  }

  /** Lays out and draws everything; cheap enough to do every frame, and it follows changes in size. */
  private draw(s: CombatCardState, deltaMs: number): void {
    const hp = `${s.hitPoints}/${s.maxHitPoints}`;
    const damage = `${s.weapon.damageMin}-${s.weapon.damageMax}`;
    const ammo = s.weapon.ammo ? `${s.weapon.ammo.loaded}/${s.weapon.ammo.total}` : '';
    const hpBarWidth = textWidth(`${s.maxHitPoints}/${s.maxHitPoints}`) + 4;
    const pipsWidth = s.maxActionPoints * (PIP_WIDTH + PIP_GAP) - PIP_GAP;
    const apWidth = textWidth('AP') + 2 + textWidth('00');

    const contentWidth = Math.max(
      apWidth + 4 + hpBarWidth,
      pipsWidth,
      textWidth(damage) + (ammo ? 4 + textWidth(ammo) : 0),
    );
    const width = contentWidth + PADDING * 2;
    const rowPips = PADDING + GLYPH_HEIGHT + ROW_GAP;
    const rowBottom = rowPips + PIP_HEIGHT + ROW_GAP;
    const height = rowBottom + GLYPH_HEIGHT + PADDING;
    const sprite = s.weapon.itemId ? WEAPON_SPRITES[s.weapon.itemId] : undefined;
    const peek = sprite?.peek ?? 0;
    this.layout = { width, height, peek };

    // The whole thing, card plus the weapon sticking out, is centred on the container.
    const left = -(width + peek) / 2;
    const top = -height / 2;
    const right = left + width;

    this.plate.clear();
    this.plate.fillStyle(COLOR.plate, 1).fillRect(left, top, width, height);
    this.plate.lineStyle(1, COLOR.border, 0.9).strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);

    if (sprite && s.weapon.itemId) {
      // Lying along the bottom row, its end poking out of the card's right edge. The part
      // "behind" the card is cropped off rather than covered, so it can't show through when
      // the card fades or dims.
      const length = sprite.rows[0].length;
      this.weapon
        .setTexture(weaponTextureKey(s.weapon.itemId))
        .setCrop(length - peek, 0, peek, sprite.rows.length)
        .setPosition(right + peek, top + rowBottom + GLYPH_HEIGHT / 2)
        .setVisible(true);
    } else {
      this.weapon.setVisible(false);
    }

    // Top row: AP on the left, the HP bar on the right with the values written in it.
    this.label.set('AP', left + PADDING, top + PADDING, COLOR.label);
    this.apNumber.set(String(this.shown), left + PADDING + textWidth('AP') + 2, top + PADDING, this.shown === 0 ? COLOR.empty : COLOR.number);

    const barX = right - PADDING - hpBarWidth;
    const barY = top + PADDING - 1;
    const barHeight = GLYPH_HEIGHT + 2;
    const fraction = Math.max(0, Math.min(1, this.shownHpFraction));
    const fill = fraction > 0.5 ? COLOR.hpGood : fraction > 0.25 ? COLOR.hpHurt : COLOR.hpBad;
    this.bars.clear();
    this.bars.fillStyle(COLOR.hpTrack, 1).fillRect(barX, barY, hpBarWidth, barHeight);
    this.bars.fillStyle(fill, 1).fillRect(barX, barY, Math.round(hpBarWidth * fraction), barHeight);
    this.hpText.set(hp, barX + Math.floor((hpBarWidth - textWidth(hp)) / 2), barY + 1, COLOR.hpText);

    // Middle row: the pips.
    const pipsLeft = left + PADDING;
    for (let i = 0; i < s.maxActionPoints; i++) {
      const flash = this.flashes.get(i);
      let color = i < this.shown ? COLOR.pipFull : COLOR.pipSpent;
      if (flash) {
        color = flash.refill ? COLOR.refillFlash : COLOR.spentFlash;
        flash.ms -= deltaMs;
        if (flash.ms <= 0) this.flashes.delete(i);
      }
      this.bars.fillStyle(color, 1).fillRect(pipsLeft + i * (PIP_WIDTH + PIP_GAP), top + rowPips, PIP_WIDTH, PIP_HEIGHT);
    }

    // Bottom row: damage in red on the left, ammo on the right.
    this.damageText.set(damage, left + PADDING, top + rowBottom, COLOR.damage);
    const ammoColor = s.weapon.ammo && s.weapon.ammo.loaded === 0 ? COLOR.ammoEmpty : COLOR.ammo;
    this.ammoText.set(ammo, right - PADDING - textWidth(ammo), top + rowBottom, ammoColor);
  }

  /** A superscript "-3" or "+8" just after the AP number that pops, rises and fades. */
  private showDelta(delta: number): void {
    const text = `${delta > 0 ? '+' : '-'}${Math.abs(delta)}`;
    const color = delta > 0 ? COLOR.refillDelta : COLOR.spentDelta;
    // Outlined glyphs (5x7, overlapping by their outline), as this floats over the map.
    const glyphs = [...text].map((char, i) =>
      this.scene.add.image(i * (ADVANCE + 0), 0, glyphTextureKey(char)).setOrigin(0).setTint(color),
    );
    const left = -(this.layout.width + this.layout.peek) / 2;
    const x = left + PADDING + textWidth('AP') + 2 + textWidth(String(this.shown)) + 1;
    const floater = this.scene.add.container(x, -this.layout.height / 2 - 6, glyphs).setScale(1.3);
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

/** Width in pixels of a line of plain glyphs. */
function textWidth(text: string): number {
  return text.length === 0 ? 0 : text.length * ADVANCE - 1;
}

/** A line of plain pixel-font glyphs, reusing its images as the text changes. */
class GlyphRun {
  readonly container: Phaser.GameObjects.Container;
  private readonly images: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0);
  }

  set(text: string, x: number, y: number, tint: number): void {
    this.container.setPosition(x, y);
    while (this.images.length < text.length) {
      const image = this.scene.add.image(0, 0, plainGlyphKey('0')).setOrigin(0);
      this.images.push(image);
      this.container.add(image);
    }
    this.images.forEach((image, i) => {
      const char = text[i];
      image.setVisible(char !== undefined);
      if (char) image.setTexture(plainGlyphKey(char)).setPosition(i * ADVANCE, 0).setTint(tint);
    });
  }
}
