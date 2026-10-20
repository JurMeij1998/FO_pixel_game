import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import type { TileType } from '../core/gridMap';
import { SPRITES, type PixelSprite } from './sprites';

/**
 * Builds every texture at startup, so there are no image files yet.
 * Ground tiles are procedural (seeded, so they look the same every run);
 * characters and props come from the pixel grids in sprites.ts.
 */
export function createTextures(scene: Phaser.Scene): void {
  for (const [type, draw] of Object.entries(TILE_PAINTERS)) {
    for (let variant = 0; variant < TILE_VARIANTS; variant++) {
      createTexture(scene, `tile_${type}_${variant}`, TILE_SIZE, TILE_SIZE, draw);
    }
  }
  for (const [key, sprite] of Object.entries(SPRITES)) {
    createSpriteTexture(scene, key, sprite);
  }
}

/** Each tile type gets a few randomized versions so the ground doesn't look like a grid. */
const TILE_VARIANTS = 4;

/** Picks a stable variant per map position, so a tile looks the same every time it is drawn. */
export function tileTextureKey(type: TileType, x: number, y: number): string {
  const variant = (((x * 73856093) ^ (y * 19349663)) >>> 0) % TILE_VARIANTS;
  return `tile_${type}_${variant}`;
}

type Painter = (ctx: CanvasRenderingContext2D, rand: () => number) => void;

const TILE_PAINTERS: Record<TileType, Painter> = {
  dirt: (ctx, rand) => {
    paintDirt(ctx, rand);
  },

  grass: (ctx, rand) => {
    paintDirt(ctx, rand);
    for (let i = 0; i < 6; i++) {
      const x = 1 + Math.floor(rand() * 14);
      const y = 1 + Math.floor(rand() * 12);
      pixel(ctx, x, y, '#6f7d3a');
      pixel(ctx, x, y + 1, '#6f7d3a');
      pixel(ctx, x - 1, y + 1, '#57632c');
      pixel(ctx, x + 1, y + 1, '#57632c');
    }
  },

  floor: (ctx, rand) => {
    fill(ctx, '#5b5c57');
    speckle(ctx, rand, ['#666761', '#52534e'], 20);
    ctx.fillStyle = '#4a4b47';
    for (const p of [0, 8]) {
      ctx.fillRect(p, 0, 1, TILE_SIZE);
      ctx.fillRect(0, p, TILE_SIZE, 1);
    }
  },

  wall: (ctx) => {
    fill(ctx, '#3b342b'); // mortar
    for (let row = 0; row < 4; row++) {
      const offset = row % 2 === 0 ? 0 : -4;
      for (let x = offset; x < TILE_SIZE; x += 8) {
        ctx.fillStyle = '#7d6a52';
        ctx.fillRect(x + 1, row * 4 + 1, 7, 3);
        ctx.fillStyle = '#927d61';
        ctx.fillRect(x + 1, row * 4 + 1, 7, 1);
      }
    }
  },

  rock: (ctx, rand) => {
    paintDirt(ctx, rand);
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const dx = (x - 7.5) / 7;
        const dy = (y - 8.5) / 6;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        const color = d > 0.7 ? '#55524b' : x + y < 14 ? '#8e8a7f' : '#77736a';
        pixel(ctx, x, y, color);
      }
    }
  },

  water: (ctx, rand) => {
    fill(ctx, '#35604a');
    speckle(ctx, rand, ['#2b5040'], 12);
    ctx.fillStyle = '#4f8a63';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(Math.floor(rand() * 13), Math.floor(rand() * 16), 3, 1);
    }
  },
};

function paintDirt(ctx: CanvasRenderingContext2D, rand: () => number): void {
  fill(ctx, '#8b7451');
  speckle(ctx, rand, ['#7a6444', '#9e8760', '#6e5a3d'], 40);
}

function fill(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
}

function pixel(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function speckle(ctx: CanvasRenderingContext2D, rand: () => number, colors: string[], count: number): void {
  for (let i = 0; i < count; i++) {
    const color = colors[Math.floor(rand() * colors.length)];
    pixel(ctx, Math.floor(rand() * TILE_SIZE), Math.floor(rand() * TILE_SIZE), color);
  }
}

function createSpriteTexture(scene: Phaser.Scene, key: string, sprite: PixelSprite): void {
  const width = sprite.rows[0].length;
  createTexture(scene, key, width, sprite.rows.length, (ctx) => {
    sprite.rows.forEach((row, y) => {
      for (let x = 0; x < width; x++) {
        const color = sprite.palette[row[x]];
        if (color) pixel(ctx, x, y, color);
      }
    });
  });
}

function createTexture(scene: Phaser.Scene, key: string, width: number, height: number, draw: Painter): void {
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`Could not create texture '${key}'`);
  draw(texture.getContext(), seededRandom(hashString(key)));
  texture.refresh();
}

/** mulberry32: a tiny deterministic PRNG returning values in [0, 1). */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash;
}
