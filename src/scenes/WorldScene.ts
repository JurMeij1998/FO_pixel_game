import Phaser from 'phaser';
import { TILE_SIZE, WORLD_ZOOM } from '../config';
import type { GridPos } from '../core/gridMap';
import { tileTextureKey } from '../gfx/textures';
import { state } from '../state';
import { postMessage } from '../ui/messages';

type Direction = 'up' | 'down' | 'left' | 'right';

const STEP: Record<Direction, GridPos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const MOVE_DURATION_MS = 140;

/** Pixel position of a tile's centre. */
const toPixel = (tile: number) => tile * TILE_SIZE + TILE_SIZE / 2;

/** The top-down map: grid movement, Pokémon-style, plus interacting with what you face. */
export class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private playerPos: GridPos = { x: 0, y: 0 };
  private facing: Direction = 'down';
  private moving = false;
  private readonly chestImages = new Map<string, Phaser.GameObjects.Image>();
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

    this.playerPos = { ...map.playerStart };
    this.player = this.add.image(toPixel(this.playerPos.x), toPixel(this.playerPos.y), 'player_down');

    this.cameras.main
      .setBounds(0, 0, map.width * TILE_SIZE, map.height * TILE_SIZE)
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
    keyboard.on('keydown-E', () => this.interact());
    keyboard.on('keydown-SPACE', () => this.interact());
    keyboard.on('keydown-I', () => this.openOverlay('Inventory'));
    keyboard.on('keydown-Q', () => postMessage(this, state.player.swapWeapons().message));

    // Keys released while an overlay was open would otherwise still count as held.
    this.events.on(Phaser.Scenes.Events.RESUME, () => keyboard.resetKeys());
  }

  update(): void {
    if (this.moving) return;
    const direction = this.heldDirection();
    if (!direction) return;

    this.face(direction);
    const target = { x: this.playerPos.x + STEP[direction].x, y: this.playerPos.y + STEP[direction].y };
    if (!state.map.isWalkable(target.x, target.y)) return;

    this.moving = true;
    this.playerPos = target;
    this.tweens.add({
      targets: this.player,
      x: toPixel(target.x),
      y: toPixel(target.y),
      duration: MOVE_DURATION_MS,
      onComplete: () => {
        this.moving = false;
      },
    });
  }

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

  /** Acts on the tile the player is facing. */
  private interact(): void {
    if (this.moving) return;
    const step = STEP[this.facing];
    const chest = state.map.chestAt(this.playerPos.x + step.x, this.playerPos.y + step.y);
    if (!chest) {
      postMessage(this, 'There is nothing there.');
      return;
    }
    chest.opened = true;
    this.chestImages.get(chest.id)?.setTexture('chest_open');
    this.openOverlay('Loot', { chestId: chest.id });
  }

  private openOverlay(key: string, data?: object): void {
    this.scene.pause();
    this.scene.launch(key, data);
  }
}
