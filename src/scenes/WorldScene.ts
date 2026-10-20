import Phaser from 'phaser';
import { HUD_BOTTOM, HUD_TOP, TILE_SIZE, WORLD_ZOOM } from '../config';
import { Combat, INVENTORY_AP_COST, type CombatEvent } from '../core/combat';
import type { Creature } from '../core/creature';
import type { Fighter } from '../core/fighter';
import { addPos, type GridPos } from '../core/grid';
import type { Lootable } from '../core/loot';
import { tileTextureKey } from '../gfx/textures';
import { state } from '../state';
import { postMessage } from '../ui/messages';
import { FONT } from '../ui/theme';

type Direction = 'up' | 'down' | 'left' | 'right';
type AttackEvent = Extract<CombatEvent, { type: 'attack' }>;

const STEP: Record<Direction, GridPos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const MOVE_DURATION_MS = 140;

const DEPTH = { corpse: 1, creature: 2, player: 3, marker: 4, effects: 10 };

/** Pixel position of a tile's centre. */
const toPixel = (tile: number) => tile * TILE_SIZE + TILE_SIZE / 2;

/**
 * The top-down map. Outside combat: Pokémon-style grid movement and interacting with
 * what you face. In combat: the same movement, paid for with AP, plus attacks.
 * All rules live in core/Combat; this scene turns its events into animations.
 */
export class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private facing: Direction = 'down';
  /** Steps taken so far; picks which leg leads in the walk animation. */
  private steps = 0;
  /** True while an animation plays; input is ignored until it finishes. */
  private busy = false;
  private readonly chestImages = new Map<string, Phaser.GameObjects.Image>();
  private readonly creatureImages = new Map<Creature, Phaser.GameObjects.Image>();
  private targetMarker!: Phaser.GameObjects.Graphics;
  private keys!: Record<Direction, Phaser.Input.Keyboard.Key[]>;

  constructor() {
    super('World');
  }

  create(): void {
    const map = state.map;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        this.add.image(x * TILE_SIZE, y * TILE_SIZE, tileTextureKey(map.tiles[y][x], x, y)).setOrigin(0);
      }
    }
    for (const chest of map.chests) {
      const image = this.add.image(toPixel(chest.x), toPixel(chest.y), chest.opened ? 'chest_open' : 'chest_closed');
      this.chestImages.set(chest.id, image);
    }
    for (const creature of map.creatures) {
      const image = this.add
        .image(toPixel(creature.pos.x), toPixel(creature.pos.y), creature.def.id)
        .setDepth(DEPTH.creature)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.attack(creature));
      this.creatureImages.set(creature, image);
      if (creature.isDead) this.showCorpse(image);
    }

    const start = state.player.pos;
    this.player = this.add.image(toPixel(start.x), toPixel(start.y), 'player_down').setDepth(DEPTH.player);
    this.targetMarker = this.add.graphics().setDepth(DEPTH.marker);

    // Let the camera scroll past the map edges by the HUD's height, so the HUD never hides a tile.
    const top = HUD_TOP / WORLD_ZOOM;
    const bottom = HUD_BOTTOM / WORLD_ZOOM;
    this.cameras.main
      .setBounds(0, -top, map.width * TILE_SIZE, map.height * TILE_SIZE + top + bottom)
      .setZoom(WORLD_ZOOM)
      .startFollow(this.player, true);

    const keyboard = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [keyboard.addKey(K.UP), keyboard.addKey(K.W)],
      down: [keyboard.addKey(K.DOWN), keyboard.addKey(K.S)],
      left: [keyboard.addKey(K.LEFT), keyboard.addKey(K.A)],
      right: [keyboard.addKey(K.RIGHT), keyboard.addKey(K.D)],
    };
    keyboard.addCapture('TAB'); // keep the browser from moving focus
    keyboard.on('keydown-E', () => this.interact());
    keyboard.on('keydown-SPACE', () => (state.combat ? this.endTurn() : this.interact()));
    keyboard.on('keydown-F', () => state.combat?.target && this.attack(state.combat.target));
    keyboard.on('keydown-TAB', () => state.combat?.cycleTarget());
    keyboard.on('keydown-I', () => this.openInventory());
    keyboard.on('keydown-Q', () => postMessage(this, state.player.swapWeapons().message));

    // Keys released while an overlay was open would otherwise still count as held.
    this.events.on(Phaser.Scenes.Events.RESUME, () => keyboard.resetKeys());
  }

  update(): void {
    this.drawTargetMarker();
    if (this.busy) return;
    const direction = this.heldDirection();
    if (!direction) return;

    this.face(direction);
    if (state.combat) this.stepInCombat(direction);
    else this.stepFreely(direction);
  }

  private stepFreely(direction: Direction): void {
    const target = addPos(state.player.pos, STEP[direction]);
    if (!state.map.isWalkable(target.x, target.y)) return;
    state.player.pos = target;
    void this.run(async () => {
      await this.tweenTo(this.player, target);
      this.checkForCombat();
    });
  }

  private stepInCombat(direction: Direction): void {
    const combat = state.combat!;
    if (!combat.isPlayerTurn) return;
    const result = combat.movePlayer(STEP[direction]);
    if (result.ok) void this.run(() => this.play(result.events));
  }

  /** Starts a fight if any creature can see the player. */
  private checkForCombat(): void {
    const spotters = Combat.spotters(state.map, state.player);
    if (spotters.length === 0) return;
    this.enterCombat(new Combat(state.map, state.player));
    const names = spotters.map((c) => `a ${c.name}`).join(' and ');
    postMessage(this, `Combat! You are spotted by ${names}.`);
  }

  private enterCombat(combat: Combat): void {
    state.combat = combat;
    this.input.keyboard!.resetKeys(); // don't keep walking (and spending AP) on a held key
    this.cameras.main.shake(150, 0.004);
  }

  /** Attacks a creature; outside combat a successful attack starts a fight. */
  private attack(creature: Creature): void {
    if (this.busy || creature.isDead) return;
    const combat = state.combat ?? new Combat(state.map, state.player);
    const result = combat.attack(creature);
    if (!result.ok) {
      postMessage(this, result.message);
      return;
    }
    if (!state.combat) this.enterCombat(combat);
    void this.run(async () => {
      await this.play(result.events);
      this.afterAction();
    });
  }

  private endTurn(): void {
    const combat = state.combat;
    if (this.busy || !combat?.isPlayerTurn) return;
    const events = combat.endTurn();
    void this.run(async () => {
      await this.play(events);
      this.afterAction();
      if (state.combat?.isPlayerTurn) postMessage(this, 'Your turn.');
    });
  }

  /** Called after every combat action has been animated. */
  private afterAction(): void {
    const combat = state.combat;
    if (!combat?.outcome) return;
    state.combat = null;
    switch (combat.outcome) {
      case 'victory':
        postMessage(this, 'The fight is over. You survived.');
        break;
      case 'escaped':
        postMessage(this, 'You got away.');
        break;
      case 'defeat':
        this.scene.pause();
        this.scene.launch('GameOver');
        break;
    }
  }

  // --- Animation -------------------------------------------------------------

  /** Runs an animation sequence while blocking input. */
  private async run(sequence: () => Promise<void>): Promise<void> {
    this.busy = true;
    try {
      await sequence();
    } finally {
      this.busy = false;
    }
  }

  private async play(events: CombatEvent[]): Promise<void> {
    for (const event of events) {
      if (event.type === 'move') {
        const image = this.imageFor(event.fighter);
        await this.tweenTo(image, event.to);
      } else {
        await this.showAttack(event);
      }
    }
  }

  private async showAttack(event: AttackEvent): Promise<void> {
    const attacker = this.imageFor(event.attacker);
    const target = this.imageFor(event.target);
    if (event.attacker === state.player) this.faceToward(event.target.pos);

    if (event.ranged) {
      const tracer = this.add.graphics().setDepth(DEPTH.effects);
      tracer.lineStyle(1, 0xffe080).lineBetween(attacker.x, attacker.y, target.x, target.y);
      await this.wait(90);
      tracer.destroy();
    } else {
      await this.lunge(attacker, target);
    }

    postMessage(this, event.message);
    if (event.hit) {
      this.floatText(target, `-${event.damage}`, event.critical ? '#ffe040' : '#ff5040');
      target.setTintFill(0xff3030);
      await this.wait(120);
      target.clearTint();
      if (event.killed) this.showCorpse(target);
    } else {
      this.floatText(target, 'miss', '#d0d0d0');
    }
    await this.wait(250);
  }

  private showCorpse(image: Phaser.GameObjects.Image): void {
    image.setAngle(90).setTint(0x707070).setDepth(DEPTH.corpse).disableInteractive();
  }

  private tweenTo(image: Phaser.GameObjects.Image, to: GridPos): Promise<void> {
    const isPlayer = image === this.player;
    if (isPlayer) this.showStride();
    return new Promise((resolve) => {
      this.tweens.add({
        targets: image,
        x: toPixel(to.x),
        y: toPixel(to.y),
        duration: MOVE_DURATION_MS,
        // Second half of the step: back to the standing frame.
        onUpdate: (tween) => {
          if (isPlayer && tween.progress >= 0.5) this.face(this.facing);
        },
        onComplete: () => resolve(),
      });
    });
  }

  /** Shows the walking frame for the first half of a step. */
  private showStride(): void {
    this.steps++;
    const vertical = this.facing === 'up' || this.facing === 'down';
    const texture = this.facing === 'up' ? 'player_up_walk' : this.facing === 'down' ? 'player_down_walk' : 'player_side_walk';
    // Mirroring the up/down stride swaps which leg is lifted, so the legs alternate step by step.
    const flip = vertical ? this.steps % 2 === 1 : this.facing === 'left';
    this.player.setTexture(texture).setFlipX(flip);
  }

  /** A short jab towards the target and back. */
  private lunge(image: Phaser.GameObjects.Image, target: Phaser.GameObjects.Image): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({
        targets: image,
        x: image.x + (target.x - image.x) * 0.3,
        y: image.y + (target.y - image.y) * 0.3,
        duration: 70,
        yoyo: true,
        onComplete: () => resolve(),
      });
    });
  }

  private floatText(over: Phaser.GameObjects.Image, text: string, color: string): void {
    const label = this.add
      .text(over.x, over.y - 8, text, { fontFamily: FONT, fontSize: '8px', color, stroke: '#000000', strokeThickness: 2 })
      .setResolution(WORLD_ZOOM * 2) // render at screen resolution so it stays sharp when zoomed
      .setOrigin(0.5)
      .setDepth(DEPTH.effects);
    this.tweens.add({
      targets: label,
      y: label.y - 10,
      alpha: 0,
      duration: 800,
      onComplete: () => label.destroy(),
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private drawTargetMarker(): void {
    this.targetMarker.clear();
    const target = state.combat?.target;
    if (!target) return;
    const image = this.imageFor(target);
    this.targetMarker
      .lineStyle(1, 0xff4040)
      .strokeRect(image.x - TILE_SIZE / 2 + 0.5, image.y - TILE_SIZE / 2 + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  }

  private imageFor(fighter: Fighter): Phaser.GameObjects.Image {
    if (fighter === state.player) return this.player;
    const image = this.creatureImages.get(fighter as Creature);
    if (!image) throw new Error(`No sprite for ${fighter.name}`);
    return image;
  }

  // --- Movement and interaction ---------------------------------------------

  private heldDirection(): Direction | null {
    for (const direction of ['up', 'down', 'left', 'right'] as const) {
      if (this.keys[direction].some((key) => key.isDown)) return direction;
    }
    return null;
  }

  private face(direction: Direction): void {
    this.facing = direction;
    const texture = direction === 'up' ? 'player_up' : direction === 'down' ? 'player_down' : 'player_side';
    this.player.setTexture(texture).setFlipX(direction === 'left');
  }

  private faceToward(pos: GridPos): void {
    const dx = pos.x - state.player.pos.x;
    const dy = pos.y - state.player.pos.y;
    if (Math.abs(dx) >= Math.abs(dy)) this.face(dx < 0 ? 'left' : 'right');
    else this.face(dy < 0 ? 'up' : 'down');
  }

  /** Acts on the tile the player is facing. */
  private interact(): void {
    if (this.busy) return;
    if (state.combat) {
      postMessage(this, "There's no time for that now.");
      return;
    }
    const { x, y } = addPos(state.player.pos, STEP[this.facing]);
    const chest = state.map.chestAt(x, y);
    if (chest) {
      chest.opened = true;
      this.chestImages.get(chest.id)?.setTexture('chest_open');
      this.openLoot(chest);
      return;
    }
    const corpse = state.map.corpseAt(x, y);
    if (corpse) {
      this.openLoot(corpse);
      return;
    }
    postMessage(this, 'There is nothing there.');
  }

  private openLoot(lootable: Lootable): void {
    this.scene.pause();
    this.scene.launch('Loot', { lootable });
  }

  private openInventory(): void {
    if (this.busy) return;
    const combat = state.combat;
    if (combat && !combat.spendActionPoints(INVENTORY_AP_COST)) {
      postMessage(this, `Opening your pack takes ${INVENTORY_AP_COST} AP.`);
      return;
    }
    this.scene.pause();
    this.scene.launch('Inventory');
  }
}
