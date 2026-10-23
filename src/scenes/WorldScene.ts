import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import { COMBAT_LABEL, HUD_BOTTOM, TILE_SIZE, WORLD_ZOOM } from '../config';
import type { Building } from '../core/buildings';
import { Combat, INVENTORY_AP_COST, type AttackEvent, type CombatEvent } from '../core/combat';
import { capitalize, listNames, type Creature } from '../core/creature';
import type { DialogData } from './DialogScene';
import type { LockpickData } from './LockpickScene';
import type { Fighter } from '../core/fighter';
import { addPos, type GridPos } from '../core/grid';
import type { Chest, Door, Exit, Owned } from '../core/gridMap';
import { lockedMessage, lockKind, pickProblem, pinsFor, unlock, type Lockable } from '../core/locks';
import type { Lootable } from '../core/loot';
import { DOOR_CLOSED, DOOR_LOCKED, DOOR_OPEN, roofTextureKey, roofVariant, tileTextureKey } from '../gfx/textures';
import { autosave, state, travelTo } from '../state';
import { ApGauge } from '../ui/apGauge';
import { ENEMY_BAR_GAP, ENEMY_BAR_HEIGHT, enemyBar } from '../ui/healthBar';
import { holdHealth, releaseHealth, showHit, shownHitPoints } from '../ui/shownHealth';
import type { Rect } from '../ui/gaugePlacement';
import { postMessage } from '../ui/messages';
import { FONT } from '../ui/theme';
import { modifiersOf } from '../ui/widgets';

type Direction = 'up' | 'down' | 'left' | 'right';

const STEP: Record<Direction, GridPos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const MOVE_DURATION_MS = 140;

// Roofs go over everything inside a building, health bars included; the AP gauge and effects
// stay on top.
const DEPTH = { prop: 1, corpse: 1, creature: 2, player: 3, marker: 4, healthBars: 5, roof: 6, gauge: 9, effects: 10 };
/** How long a roof takes to fade away when you first step inside. */
const ROOF_FADE_MS = 300;
/** A pause after opening a door by walking into it, so a held key doesn't stride straight through. */
const DOOR_PAUSE_MS = 120;
const ENEMY_RED = 0xd02020;
const FADE_MS = 250;

/** Locked doors and chests show a padlock, so you can tell from afar. */
const doorTexture = (door: Door) => (door.open ? DOOR_OPEN : door.lock !== null ? DOOR_LOCKED : DOOR_CLOSED);
const chestTexture = (chest: Chest) => (chest.opened ? 'chest_open' : chest.lock !== null ? 'chest_locked' : 'chest_closed');

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
  /**
   * The tile ("x,y") the player last walked into and was told why they can't (a locked door,
   * an exit mid-fight). Holding the key against it says so once; letting go clears it.
   */
  private bumpedInto: string | null = null;
  private readonly chestImages = new Map<string, Phaser.GameObjects.Image>();
  private readonly creatureImages = new Map<Creature, Phaser.GameObjects.Image>();
  private readonly doorImages = new Map<Door, Phaser.GameObjects.Image>();
  /** The roofs still on, by building id. */
  private readonly roofs = new Map<string, Phaser.GameObjects.Container>();
  private targetMarker!: Phaser.GameObjects.Graphics;
  /** The thin health bars floating over the creatures you're fighting. */
  private enemyBars!: Phaser.GameObjects.Graphics;
  private apGauge!: ApGauge;
  /** Whether the camera bounds currently leave the extra room combat needs at the top. */
  private combatBounds = false;
  private keys!: Record<Direction, Phaser.Input.Keyboard.Key[]>;

  constructor() {
    super('World');
  }

  create(): void {
    // The scene object is reused when a game is loaded or started, so reset what create() fills in.
    this.busy = false;
    this.bumpedInto = null;
    this.steps = 0;
    this.facing = 'down';
    this.chestImages.clear();
    this.creatureImages.clear();
    this.doorImages.clear();
    this.roofs.clear();

    const map = state.map;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        this.add.image(x * TILE_SIZE, y * TILE_SIZE, tileTextureKey(map.tiles[y][x], x, y)).setOrigin(0);
      }
    }
    for (const chest of map.chests) {
      const image = this.add.image(toPixel(chest.x), toPixel(chest.y), chestTexture(chest));
      this.chestImages.set(chest.id, image);
    }
    for (const exit of map.exits) this.add.image(toPixel(exit.x), toPixel(exit.y), 'signpost').setDepth(DEPTH.prop);
    for (const door of map.doors) {
      // Drawn for a wall running left to right; turned a quarter in one running up and down.
      const image = this.add.image(toPixel(door.x), toPixel(door.y), doorTexture(door)).setDepth(DEPTH.prop);
      this.doorImages.set(door, image.setAngle(door.leftToRight ? 0 : 90));
    }
    for (const creature of map.creatures) {
      const image = this.add
        .image(toPixel(creature.pos.x), toPixel(creature.pos.y), creature.def.id)
        .setDepth(DEPTH.creature)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (pointer: Phaser.Input.Pointer) => this.clickCreature(creature, modifiersOf(pointer).ctrl));
      this.creatureImages.set(creature, image);
      if (creature.isDead) this.showCorpse(image);
    }

    const start = state.player.pos;
    map.enter(start); // starting (or loading) inside a building: its roof is off
    for (const building of map.buildings) {
      if (!map.entered.has(building.id)) this.roofs.set(building.id, this.drawRoof(building));
    }
    this.player = this.add.image(toPixel(start.x), toPixel(start.y), this.playerTexture('down')).setDepth(DEPTH.player);
    // Start facing whoever is right there to talk to (Rosa at the start of a game, Gus in the
    // test shop), so E talks to them straight away.
    const towardsSomeone = (['up', 'down', 'left', 'right'] as const).find((d) => state.map.personFacing(start, STEP[d]));
    this.face(towardsSomeone ?? 'down');
    this.targetMarker = this.add.graphics().setDepth(DEPTH.marker);
    this.enemyBars = this.add.graphics().setDepth(DEPTH.healthBars);
    this.apGauge = new ApGauge(this, state.player.maxActionPoints, DEPTH.gauge);

    this.combatBounds = state.combat !== null;
    this.setCameraBounds();
    this.cameras.main.setZoom(WORLD_ZOOM).fadeIn(FADE_MS).startFollow(this.player, true);

    const keyboard = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [keyboard.addKey(K.UP), keyboard.addKey(K.W)],
      down: [keyboard.addKey(K.DOWN), keyboard.addKey(K.S)],
      left: [keyboard.addKey(K.LEFT), keyboard.addKey(K.A)],
      right: [keyboard.addKey(K.RIGHT), keyboard.addKey(K.D)],
    };
    keyboard.addCapture('TAB'); // keep the browser from moving focus
    // Not on key repeat: holding E at a lock you can't pick would try (and fail) over and over.
    keyboard.on('keydown-E', (event: KeyboardEvent) => !event.repeat && this.interact());
    // Not on key repeat either: Space still held from the lock screen (or a turn ago) mustn't
    // end the turn the moment a fight starts.
    keyboard.on('keydown-SPACE', (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (state.combat) this.endTurn();
      else this.interact();
    });
    keyboard.on('keydown-F', () => state.combat?.target && this.attack(state.combat.target));
    keyboard.on('keydown-T', () => state.combat?.cycleTarget());
    // Not on key repeat: a held key would open it again the moment it closes.
    for (const key of ['TAB', 'I']) {
      keyboard.on(`keydown-${key}`, (event: KeyboardEvent) => !event.repeat && this.openInventory());
    }
    // Not on key repeat: holding C would open and close the sheet over and over, and an Esc held
    // a moment too long after closing a screen would open the pause menu.
    keyboard.on('keydown-C', (event: KeyboardEvent) => !event.repeat && this.openCharacterSheet());
    keyboard.on('keydown-R', () => this.reload());
    keyboard.on('keydown-ESC', (event: KeyboardEvent) => !event.repeat && this.openOverlay('Pause'));
    keyboard.on('keydown-Q', () => {
      if (this.busy) return; // a swap mid-animation would autosave or play the wrong weapon's sound
      postMessage(this, state.player.swapWeapons().message);
      playSound('equip');
      autosave();
    });

    const onResume = () => {
      // Keys released while an overlay was open would otherwise still count as held.
      keyboard.resetKeys();
      autosave(); // the overlay may have changed the inventory
    };
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    // Scene events outlive a restart, unlike the keyboard and input listeners, so remove this one ourselves.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.RESUME, onResume));

    // The test arena is for trying out combat, so the fight starts without taking a step first.
    if (state.sandbox) this.checkForCombat();
  }

  update(_time: number, delta: number): void {
    if (this.combatBounds !== (state.combat !== null)) {
      this.combatBounds = state.combat !== null;
      this.setCameraBounds();
    }
    this.revealFighters();
    this.drawTargetMarker();
    this.drawEnemyBars();
    this.updateApGauge(delta);
    const direction = this.heldDirection();
    if (!direction) this.bumpedInto = null;
    if (this.busy || !direction) return;

    this.face(direction);
    if (state.combat) this.stepInCombat(direction);
    else this.stepFreely(direction);
  }

  private stepFreely(direction: Direction): void {
    const target = addPos(state.player.pos, STEP[direction]);
    if (state.map.isClosedDoor(target.x, target.y)) {
      this.walkIntoDoor(state.map.doorAt(target.x, target.y)!);
      return;
    }
    if (!state.map.isWalkable(target.x, target.y)) return;
    state.player.pos = target;
    void this.run(async () => {
      await this.tweenTo(this.player, target);
      this.enterBuilding();
      const exit = state.map.exitAt(target.x, target.y);
      if (exit) {
        await this.travel(exit);
        return;
      }
      this.checkForCombat();
      autosave();
    });
  }

  /** Fades out, moves the player to the exit's map and rebuilds the scene for it. */
  private async travel(exit: Exit): Promise<void> {
    await new Promise<void>((resolve) => {
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => resolve());
      this.cameras.main.fadeOut(FADE_MS);
    });
    let map;
    try {
      map = travelTo(exit.to);
    } catch (error) {
      // Generation retries several seeds before giving up, so this should be very rare; never
      // leave the screen faded out over it.
      console.error(`Couldn't travel to '${exit.to}':`, error);
      postMessage(this, 'The way ahead is impassable. Try again later.');
      this.cameras.main.fadeIn(FADE_MS);
      return;
    }
    postMessage(this, `You make your way to ${map.name}.`);
    this.scene.restart(); // create() draws the new map and fades back in
  }

  /**
   * Walking into a closed door opens it, unless it's locked: then you're told what lock it is
   * and whether you can pick it (E does that).
   */
  private walkIntoDoor(door: Door): void {
    const opened = state.map.openDoor(door);
    if (!opened.ok) {
      this.explainBump(door, () => {
        playSound('locked');
        postMessage(this, lockedMessage('door', door, state.player));
      });
      return;
    }
    this.input.keyboard!.resetKeys(); // the key held to open it shouldn't count as held while the door swings
    this.doorOpened(door);
    void this.run(() => this.wait(DOOR_PAUSE_MS));
  }

  /** Shows a door the player just opened; whoever is behind it may now see them. */
  private doorOpened(door: Door): void {
    this.showDoor(door);
    this.checkForCombat();
    autosave(); // not if a fight just started: autosave skips itself in combat
  }

  /** Says why the player can't walk onto a tile, once for as long as the key is held against it. */
  private explainBump(tile: GridPos, explain: () => void): void {
    const key = `${tile.x},${tile.y}`;
    if (this.bumpedInto === key) return;
    this.bumpedInto = key;
    explain();
  }

  private stepInCombat(direction: Direction): void {
    const combat = state.combat!;
    if (!combat.isPlayerTurn) return;
    const result = combat.movePlayer(STEP[direction]);
    if (!result.ok) {
      // Say why only for the refusals worth explaining; bumping into walls while a key is held stays quiet.
      const to = addPos(state.player.pos, STEP[direction]);
      if (state.map.exitAt(to.x, to.y) || state.map.isClosedDoor(to.x, to.y)) {
        this.explainBump(to, () => {
          // The rattle only for a lock; a door you're just out of AP to open stays quiet.
          const door = state.map.doorAt(to.x, to.y);
          if (door && door.lock !== null) playSound('locked');
          postMessage(this, result.message);
        });
      }
      return;
    }
    void this.run(() => this.play(result.events));
  }

  /** Starts a fight if any creature can see the player. */
  private checkForCombat(): void {
    const spotters = Combat.spotters(state.map, state.player);
    if (spotters.length === 0) return;
    this.enterCombat(new Combat(state.map, state.player, Math.random, state.difficulty));
    const names = spotters.map((c) => (c.def.properName ? c.name : `a ${c.name}`)).join(' and ');
    postMessage(this, `Combat! You are spotted by ${names}.`);
  }

  private enterCombat(combat: Combat): void {
    state.combat = combat;
    this.input.keyboard!.resetKeys(); // don't keep walking (and spending AP) on a held key
    this.cameras.main.shake(150, 0.004);
    playSound('combatStart');
  }

  /**
   * A click on a creature. Hostile ones are attacked. Friendly people are talked to; Ctrl+click
   * attacks them instead, which turns them (and their group) hostile.
   */
  private clickCreature(creature: Creature, ctrl: boolean): void {
    // Under a roof you haven't looked beneath, there's nothing to click as far as you know.
    if (creature.isDead || state.map.isHidden(creature.pos.x, creature.pos.y)) return;
    if (creature.hostile) this.attack(creature);
    else if (ctrl) this.attackFriendly(creature);
    else this.talkByClick(creature);
  }

  /**
   * Turns a friendly person and their group hostile, starts the fight, and takes the first swing.
   * If the swing can't happen (no AP, an empty gun, no line of sight) nothing happens at all, so
   * a misclick doesn't start a fight. Out of range is the exception: choosing *Attack* across
   * the counter with a knife declares the fight, and you close in on your turn.
   */
  private attackFriendly(person: Creature): void {
    if (this.busy || person.isDead) return;
    const problem = (state.combat ?? new Combat(state.map, state.player, Math.random, state.difficulty)).attackProblem(person);
    if (problem && problem.code !== 'outOfRange') {
      postMessage(this, problem.message);
      if (problem.code === 'empty') playSound('dryFire');
      return;
    }
    this.fightWith(state.map.provoke(person));
    this.attack(person);
  }

  /**
   * Starts a fight with (or adds to the current one) creatures that have just turned hostile,
   * whether or not they can see the player: a guard comes running when the shopkeeper is attacked.
   */
  private fightWith(angered: Creature[]): void {
    if (angered.length === 0) return;
    postMessage(this, `${capitalize(listNames(angered))} turn${angered.length > 1 ? '' : 's'} hostile!`);
    const combat = state.combat ?? new Combat(state.map, state.player, Math.random, state.difficulty);
    combat.join(angered);
    if (!state.combat) this.enterCombat(combat);
  }

  /** Attacks a creature; outside combat a successful attack starts a fight. */
  private attack(creature: Creature): void {
    if (this.busy || creature.isDead) return;
    const combat = state.combat ?? new Combat(state.map, state.player, Math.random, state.difficulty);
    const result = combat.attack(creature);
    if (!result.ok) {
      postMessage(this, result.message);
      if (result.problem === 'empty') playSound('dryFire');
      return;
    }
    // A one-hit kill from outside combat is over before it starts: no combat sting or shake.
    const startsFight = !state.combat && !combat.outcome;
    if (startsFight) this.enterCombat(combat);
    void this.run(async () => {
      await this.play(result.events);
      if (state.combat) this.afterAction();
      else autosave();
    });
  }

  private endTurn(): void {
    const combat = state.combat;
    if (this.busy || !combat?.isPlayerTurn) return;
    const events = combat.endTurn();
    void this.run(async () => {
      await this.play(events);
      combat.startPlayerTurn(); // only now, so the HUD shows the enemy turn while it plays
      this.afterAction();
      if (state.combat?.isPlayerTurn) postMessage(this, 'Your turn.');
    });
  }

  /** Called after every combat action has been animated. */
  private afterAction(): void {
    const combat = state.combat;
    combat?.ensureTarget(); // a killed target stays marked until its death has been shown
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
        return; // don't autosave a dead player
    }
    autosave();
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
    // The rules have already applied every hit; the health bars catch up as each one is shown.
    holdHealth(events);
    try {
      for (const event of events) {
        if (event.type === 'move') {
          const image = this.imageFor(event.fighter);
          if (event.fighter !== state.player) playSound('creatureStep'); // the player's steps play in showStride
          await this.tweenTo(image, event.to);
          if (event.fighter === state.player) this.enterBuilding();
        } else if (event.type === 'door') {
          if (event.fighter !== state.player) this.faceDoor(event.fighter, event.door);
          this.showDoor(event.door);
          await this.wait(DOOR_PAUSE_MS * 2);
        } else {
          await this.showAttack(event);
        }
      }
    } finally {
      releaseHealth();
    }
  }

  private async showAttack(event: AttackEvent): Promise<void> {
    const attacker = this.imageFor(event.attacker);
    const target = this.imageFor(event.target);
    const targetIsPlayer = event.target === state.player;
    if (event.attacker === state.player) this.faceToward(event.target.pos);
    playSound(event.sound);

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
      showHit(event);
      playSound(targetIsPlayer ? 'hurt' : 'impact');
      this.floatText(target, `-${event.damage}`, event.critical ? '#ffe040' : '#ff5040');
      target.setTintFill(0xff3030);
      await this.wait(120);
      target.clearTint();
      if (event.killed) {
        playSound(targetIsPlayer ? 'playerDeath' : 'creatureDeath');
        this.showCorpse(target);
      }
    } else {
      if (event.ranged) playSound('ricochet');
      this.floatText(target, 'miss', '#d0d0d0');
    }
    if (event.newLevel) {
      postMessage(this, `Level up! You are now level ${event.newLevel}. Press C to spend skill points.`);
      this.cameras.main.flash(250, 255, 240, 160);
      this.time.delayedCall(350, () => playSound('levelUp')); // after the death sound
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
    // The position is already updated to the tile being stepped onto.
    const ground = state.map.tileAt(state.player.pos.x, state.player.pos.y);
    playSound(ground === 'floor' || ground === 'planks' ? 'stepFloor' : 'stepGravel');
    const vertical = this.facing === 'up' || this.facing === 'down';
    const texture = this.playerTexture(this.facing === 'up' ? 'up_walk' : this.facing === 'down' ? 'down_walk' : 'side_walk');
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

  /**
   * Lets the camera scroll past the bottom of the map by the message log's height, so the log
   * never hides a tile. In combat it can scroll a tile past the top, so the AP gauge (always
   * above the player) still has room when the player is on the top row.
   */
  private setCameraBounds(): void {
    const map = state.map;
    const top = this.combatBounds ? TILE_SIZE : 0;
    const bottom = HUD_BOTTOM / WORLD_ZOOM;
    this.cameras.main.setBounds(0, -top, map.width * TILE_SIZE, map.height * TILE_SIZE + top + bottom);
  }

  private updateApGauge(delta: number): void {
    const combat = state.combat;
    if (!combat && this.apGauge.idle) return; // out of combat and faded out: no need to look for obstacles
    this.apGauge.update(delta, {
      active: combat !== null,
      playerTurn: combat?.isPlayerTurn ?? false,
      actionPoints: combat?.actionPoints ?? state.player.maxActionPoints,
      anchor: { x: this.player.x, y: this.player.y },
      obstacles: this.gaugeObstacles(),
      view: this.visibleWorld(),
    });
  }

  /** What the AP gauge must never cover: everything the player might want to see or click. */
  private gaugeObstacles(): Rect[] {
    const map = state.map;
    const tile = (x: number, y: number): Rect => ({ x: x * TILE_SIZE, y: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE });
    // Living creatures use their sprites, which may be mid-step, plus the health bar over the
    // ones you're fighting.
    const around = (image: Phaser.GameObjects.Image, withBar: boolean): Rect => {
      const overhead = withBar ? ENEMY_BAR_GAP + ENEMY_BAR_HEIGHT : 0;
      return { x: image.x - TILE_SIZE / 2, y: image.y - TILE_SIZE / 2 - overhead, width: TILE_SIZE, height: TILE_SIZE + overhead };
    };
    // Nothing under a roof you haven't looked beneath: dodging it would give away what's there.
    const visible = (p: GridPos) => !map.isHidden(p.x, p.y);
    const rects = [...map.chests.filter(visible).map((c) => tile(c.x, c.y)), ...map.exits.map((e) => tile(e.x, e.y))];
    const fighting = new Set(this.creaturesWithBars());
    for (const creature of map.creatures) {
      if (!visible(creature.pos)) continue;
      if (!creature.isDead) rects.push(around(this.imageFor(creature), fighting.has(creature)));
      else if (!creature.contents.isEmpty) rects.push(tile(creature.pos.x, creature.pos.y)); // lootable corpse
    }
    // The HUD's floating combat label, in the top left corner of the screen, in world pixels.
    const view = this.cameras.main.worldView;
    rects.push({
      x: view.x + COMBAT_LABEL.x / WORLD_ZOOM,
      y: view.y + COMBAT_LABEL.y / WORLD_ZOOM,
      width: COMBAT_LABEL.width / WORLD_ZOOM,
      height: COMBAT_LABEL.height / WORLD_ZOOM,
    });
    return rects;
  }

  /** The part of the world on screen, not counting the message log at the bottom. */
  private visibleWorld(): Rect {
    const view = this.cameras.main.worldView;
    const bottom = HUD_BOTTOM / WORLD_ZOOM;
    return { x: view.x, y: view.y, width: view.width, height: view.height - bottom };
  }

  /**
   * The creatures you're fighting whose death hasn't been shown yet: the ones with a health bar.
   * A creature killed by an attack still playing keeps its bar until the hit is shown.
   */
  private creaturesWithBars(): Creature[] {
    return (state.combat?.participants ?? []).filter((c) => shownHitPoints(c) > 0);
  }

  /**
   * A thin bar over every creature you're in combat with, red for the health it has left and
   * black, from the right, for what it has lost. None outside combat, nor over creatures that
   * haven't joined the fight. Redrawn every frame, so it follows creatures mid-step, and it
   * shows health as the animation has got to (ui/shownHealth.ts).
   */
  private drawEnemyBars(): void {
    this.enemyBars.clear();
    for (const creature of this.creaturesWithBars()) {
      const image = this.imageFor(creature);
      const bar = enemyBar(image.x, image.y, TILE_SIZE, shownHitPoints(creature), creature.maxHitPoints);
      this.enemyBars
        .fillStyle(0x000000)
        .fillRect(bar.x, bar.y, bar.width, bar.height)
        .fillStyle(ENEMY_RED)
        .fillRect(bar.x, bar.y, bar.red, bar.height);
    }
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

  // --- Doors and roofs -----------------------------------------------------

  /** Shows a door as it now is (open or closed), with its sound. */
  private showDoor(door: Door): void {
    this.doorImages.get(door)?.setTexture(doorTexture(door));
    playSound(door.open ? 'doorOpen' : 'doorClose');
  }

  /** A creature opening a door leans into it, so you can tell who did. */
  private faceDoor(fighter: Fighter, door: Door): void {
    const image = this.imageFor(fighter);
    this.tweens.add({
      targets: image,
      x: image.x + (toPixel(door.x) - image.x) * 0.2,
      y: image.y + (toPixel(door.y) - image.y) * 0.2,
      duration: 70,
      yoyo: true,
    });
  }

  /**
   * A building's roof: a tile over every inside and wall tile, with a dark edge along the
   * outside so it reads as one roof. It hides everything under it until you step inside.
   */
  private drawRoof(building: Building): Phaser.GameObjects.Container {
    const key = (x: number, y: number) => `${x},${y}`;
    // Without the walls it shares with rooms you've been in (GridMap.roofOf).
    const tiles = state.map.roofOf(building);
    const covered = new Set(tiles.map((p) => key(p.x, p.y)));
    const roof = this.add.container(0, 0).setDepth(DEPTH.roof);
    // A ridge across the middle, the far slope in the light and the near one in shade, so it
    // reads as a pitched roof rather than a flat patch.
    const rows = tiles.map((p) => p.y);
    const ridge = ((Math.min(...rows) + Math.max(...rows) + 1) / 2) * TILE_SIZE;
    const shade = this.add.graphics().fillStyle(0x000000, 0.18);
    const ridgeLine = this.add.graphics();
    const edge = this.add.graphics().fillStyle(0x1a1410);
    for (const { x, y } of tiles) {
      roof.add(this.add.image(x * TILE_SIZE, y * TILE_SIZE, roofTextureKey(building.material, roofVariant(x, y))).setOrigin(0));
      const left = x * TILE_SIZE;
      const top = y * TILE_SIZE;
      const shadeFrom = Math.max(top, ridge);
      if (shadeFrom < top + TILE_SIZE) shade.fillRect(left, shadeFrom, TILE_SIZE, top + TILE_SIZE - shadeFrom);
      if (ridge > top && ridge < top + TILE_SIZE) {
        ridgeLine.fillStyle(0x000000, 0.35).fillRect(left, ridge, TILE_SIZE, 1);
        ridgeLine.fillStyle(0xffffff, 0.15).fillRect(left, ridge - 1, TILE_SIZE, 1);
      }
      if (!covered.has(key(x, y - 1))) edge.fillRect(left, top, TILE_SIZE, 1);
      if (!covered.has(key(x, y + 1))) edge.fillRect(left, top + TILE_SIZE - 1, TILE_SIZE, 1);
      if (!covered.has(key(x - 1, y))) edge.fillRect(left, top, 1, TILE_SIZE);
      if (!covered.has(key(x + 1, y))) edge.fillRect(left + TILE_SIZE - 1, top, 1, TILE_SIZE);
    }
    roof.add([shade, ridgeLine, edge]);
    return roof;
  }

  /** After the player's step: the first time inside a building, its roof comes off. */
  private enterBuilding(): void {
    const building = state.map.enter(state.player.pos);
    if (building) this.liftRoof(building.id);
  }

  private liftRoof(id: string): void {
    const roof = this.roofs.get(id);
    if (!roof) return;
    this.roofs.delete(id);
    this.tweens.add({ targets: roof, alpha: 0, duration: ROOF_FADE_MS, onComplete: () => roof.destroy() });
    // The rooms next door no longer cover the walls (and doors) this one shares with them.
    for (const building of state.map.buildings) {
      const old = this.roofs.get(building.id);
      if (!old) continue;
      old.destroy();
      this.roofs.set(building.id, this.drawRoof(building));
    }
  }

  /**
   * Someone you're fighting is inside a building you haven't been in (shooting through its open
   * door, say): you know they're there now, so its roof comes off.
   */
  private revealFighters(): void {
    if (this.roofs.size === 0) return;
    for (const creature of state.combat?.participants ?? []) {
      const building = state.map.buildingAt(creature.pos.x, creature.pos.y);
      if (!building || state.map.entered.has(building.id)) continue;
      state.map.entered.add(building.id);
      this.liftRoof(building.id);
    }
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
    const texture = this.playerTexture(direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'side');
    this.player.setTexture(texture).setFlipX(direction === 'left');
  }

  /** The player's sprite for a pose: the female or male one, by the character's gender. */
  private playerTexture(pose: 'down' | 'up' | 'side' | 'down_walk' | 'up_walk' | 'side_walk'): string {
    return `${state.player.gender === 'female' ? 'player_female' : 'player'}_${pose}`;
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
    const person = state.map.personFacing(state.player.pos, STEP[this.facing]);
    // Not someone under a roof you haven't looked beneath (from an open doorway, say).
    if (person && !state.map.isHidden(person.pos.x, person.pos.y)) {
      this.talkTo(person);
      return;
    }
    const { x, y } = addPos(state.player.pos, STEP[this.facing]);
    const chest = state.map.chestAt(x, y);
    if (chest) {
      this.openChest(chest);
      return;
    }
    // A door in front of you, unless a corpse with something on it lies in the doorway: that's
    // what you'd reach for. (An emptied one leaves you the door, which then says it's in the way.)
    const door = state.map.doorAt(x, y);
    if (door && !(state.map.corpseAt(x, y)?.contents.isEmpty === false)) {
      this.useDoor(door);
      return;
    }
    // A corpse in front of you, or else one you're standing on.
    const corpse = state.map.corpseToLoot(state.player.pos, STEP[this.facing]);
    if (corpse) {
      this.openLoot(corpse);
      return;
    }
    postMessage(this, 'There is nothing there.');
  }

  /**
   * Opens a chest, picking its lock first if it has one (and you can). Picking someone's lock
   * turns them hostile; then there's no time to look inside.
   */
  private openChest(chest: Chest): void {
    if (chest.lock !== null) {
      this.pickLock(chest.name, chest, () => {
        if (this.caughtPicking(chest)) {
          this.chestImages.get(chest.id)?.setTexture(chestTexture(chest));
          return;
        }
        this.openChest(chest);
      });
      return;
    }
    chest.opened = true;
    playSound('chestOpen');
    this.chestImages.get(chest.id)?.setTexture(chestTexture(chest));
    this.openLoot(chest);
  }

  /** E at a door: pick its lock and open it (picking someone's lock turns them hostile), open it, or close it. */
  private useDoor(door: Door): void {
    if (door.lock !== null) {
      this.pickLock('Door', door, () => {
        // Picked, the door swings open.
        state.map.openDoor(door);
        if (this.caughtPicking(door)) this.showDoor(door);
        else this.doorOpened(door);
      });
      return;
    }
    const result = door.open ? state.map.closeDoor(door, state.player.pos) : state.map.openDoor(door);
    if (!result.ok) {
      postMessage(this, result.message);
      return;
    }
    if (door.open) this.doorOpened(door);
    else {
      this.showDoor(door);
      autosave();
    }
  }

  private talkTo(person: Creature): void {
    this.input.keyboard!.resetKeys(); // a key held while talking shouldn't walk off afterwards
    const data: DialogData = { person, onAttack: () => this.attackFriendly(person) };
    this.openOverlay('Dialog', data);
  }

  /** Clicking a person talks to them if they're within talking distance (next to you, or across a counter). */
  private talkByClick(person: Creature): void {
    if (this.busy) return;
    if (state.combat) {
      postMessage(this, "There's no time for that now.");
      return;
    }
    for (const direction of ['up', 'down', 'left', 'right'] as const) {
      if (state.map.personFacing(state.player.pos, STEP[direction]) === person) {
        this.face(direction);
        this.talkTo(person);
        return;
      }
    }
    postMessage(this, `You need to get closer to talk to ${person.theName}.`);
  }

  private openLoot(lootable: Lootable): void {
    // Taking from something that isn't yours can start a fight once the loot screen closes.
    this.openOverlay('Loot', { lootable, onTheft: (angered: Creature[]) => this.caughtStealing(angered) });
  }

  /**
   * Picking a lock: if the player has the skill to try, the lockpicking screen opens (the pin
   * puzzle); once it's solved and the screen has closed, the lock is open for good and `then`
   * carries on (open the door, look in the chest). Giving up leaves it locked. Without the
   * skill you're told what it takes.
   */
  private pickLock(what: string, thing: Lockable, then: () => void): void {
    const problem = pickProblem(what.toLowerCase(), thing, state.player);
    if (problem || thing.lock === null) {
      playSound('locked');
      postMessage(this, problem ?? '');
      return;
    }
    const data: LockpickData = {
      title: what,
      level: lockKind(thing.lock),
      pins: pinsFor(thing.lock),
      // Only once the world is back: a fight or the loot screen can't start under the lock screen.
      // (It's registered after the world's own resume handler, which autosaves, so a lock picked
      // into a fight isn't saved as open.)
      onPicked: () =>
        this.events.once(Phaser.Scenes.Events.RESUME, () => {
          postMessage(this, unlock(what.toLowerCase(), thing));
          then();
        }),
    };
    this.openOverlay('Lockpick', data);
  }

  /**
   * After picking a lock: if it's someone's, they (and their group) turn hostile and the fight
   * starts. Returns whether it did. No autosave before it, so "load last save" goes back to
   * before you picked it.
   */
  private caughtPicking(thing: Owned): boolean {
    const angered = state.map.noticeLockpicking(thing);
    if (angered.length === 0) return false;
    postMessage(this, "You've been caught breaking in!");
    this.fightWith(angered);
    return true;
  }

  private caughtStealing(angered: Creature[]): void {
    postMessage(this, "You've been caught stealing!");
    this.fightWith(angered);
  }

  /** Pauses the world and shows a screen on top of it; the screen resumes the world when it closes. */
  private openOverlay(key: string, data?: object): void {
    if (this.busy) return;
    this.scene.pause();
    this.scene.launch(key, data);
  }

  /** Free outside combat, 2 AP during it. */
  private reload(): void {
    if (this.busy) return;
    const result = state.combat ? state.combat.reload() : state.player.reload();
    postMessage(this, result.message);
    if (result.ok) playSound('reload');
    autosave();
  }

  private openCharacterSheet(): void {
    if (this.busy) return;
    if (state.combat) {
      postMessage(this, "There's no time for that now.");
      return;
    }
    this.openOverlay('Character');
  }

  private openInventory(): void {
    if (this.busy) return;
    const combat = state.combat;
    if (combat && !combat.spendActionPoints(INVENTORY_AP_COST)) {
      postMessage(this, `Opening your pack takes ${INVENTORY_AP_COST} AP.`);
      return;
    }
    this.openOverlay('Inventory');
  }
}
