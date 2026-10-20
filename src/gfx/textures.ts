import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import type { TileType } from '../core/gridMap';
import { hashSeed, Random } from '../core/random';
import {
  GLYPH_HEIGHT,
  GLYPH_TEXTURE_HEIGHT,
  GLYPH_TEXTURE_WIDTH,
  GLYPH_WIDTH,
  GLYPHS,
  glyphTextureKey,
  plainGlyphKey,
} from './pixelFont';
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
  for (const [char, rows] of Object.entries(GLYPHS)) {
    createGlyphTexture(scene, char, rows);
    createPlainGlyphTexture(scene, char, rows);
  }
  createSealTexture(scene);
}

/** Diameter of the AP gauge's seal, in pixels. */
export const SEAL_SIZE = 15;
export const SEAL_TEXTURE = 'ap_seal';

/**
 * The round seal the AP number sits in: a dark disc with a thin black edge, so it reads on any
 * ground. Drawn pixel by pixel to match the rest of the art. The green ring between them is
 * left transparent: the AP gauge draws it (pulsing and shining), and drawing it here too would
 * show through the glow whenever the gauge is dimmed or fading.
 */
function createSealTexture(scene: Phaser.Scene): void {
  createTexture(scene, SEAL_TEXTURE, SEAL_SIZE, SEAL_SIZE, (ctx) => {
    const center = SEAL_SIZE / 2;
    for (let y = 0; y < SEAL_SIZE; y++) {
      for (let x = 0; x < SEAL_SIZE; x++) {
        const d = Math.hypot(x + 0.5 - center, y + 0.5 - center);
        if (d > center) continue;
        if (d > center - 1) pixel(ctx, x, y, '#000000');
        else if (d <= center - 2) pixel(ctx, x, y, '#0a140c');
      }
    }
  });
}

/** The glyph alone, white so it can be tinted, for text on a solid background. */
function createPlainGlyphTexture(scene: Phaser.Scene, char: string, rows: string[]): void {
  createTexture(scene, plainGlyphKey(char), GLYPH_WIDTH, GLYPH_HEIGHT, (ctx) => {
    rows.forEach((row, y) => [...row].forEach((c, x) => c === '#' && pixel(ctx, x, y, '#ffffff')));
  });
}

/**
 * A white glyph with a dark outline around it. Drawn white so it can be tinted any colour;
 * the outline stays dark because tinting multiplies.
 */
function createGlyphTexture(scene: Phaser.Scene, char: string, rows: string[]): void {
  const lit = (x: number, y: number) => rows[y]?.[x] === '#';
  createTexture(scene, glyphTextureKey(char), GLYPH_TEXTURE_WIDTH, GLYPH_TEXTURE_HEIGHT, (ctx) => {
    for (let y = -1; y <= GLYPH_HEIGHT; y++) {
      for (let x = -1; x <= GLYPH_WIDTH; x++) {
        if (lit(x, y)) pixel(ctx, x + 1, y + 1, '#ffffff');
        else if ([-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => lit(x + dx, y + dy)))) pixel(ctx, x + 1, y + 1, '#0a0f0a');
      }
    }
  });
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

  forestFloor: (ctx, rand) => {
    paintForestFloor(ctx, rand);
  },

  // A tree seen from above: a round canopy, darker at the edge, lit from the top left.
  tree: (ctx, rand) => {
    paintForestFloor(ctx, rand);
    pixel(ctx, 7, 14, '#3a2818'); // trunk peeking out below the canopy
    pixel(ctx, 8, 14, '#4a3420');
    disc(ctx, 7.5 + (rand() - 0.5), 7 + (rand() - 0.5), 7.2, (d, x, y) =>
      d > 0.82 ? '#1c3319' : x + y < 11 ? '#3f6a34' : rand() < 0.15 ? '#24421f' : '#2e5228',
    );
  },

  bush: (ctx, rand) => {
    paintForestFloor(ctx, rand);
    disc(ctx, 8, 9, 4.6, (d, x, y) => (d > 0.75 ? '#25451f' : x + y < 15 ? '#4a7a3a' : '#33602b'));
  },

  // Two cut logs on the ground with one stacked on top, end grain showing on the left.
  logs: (ctx, rand) => {
    paintForestFloor(ctx, rand);
    for (const [y, x0] of [
      [10, 2],
      [6, 4],
    ] as const) {
      ctx.fillStyle = '#5e3c1c';
      ctx.fillRect(x0, y, 12, 4);
      ctx.fillStyle = '#7a5530';
      ctx.fillRect(x0, y + 1, 12, 1);
      ctx.fillStyle = '#c09a64'; // end grain
      ctx.fillRect(x0, y, 2, 4);
      pixel(ctx, x0, y + 1, '#8a6a40');
    }
  },

  path: (ctx, rand) => {
    fill(ctx, '#7d6a48');
    speckle(ctx, rand, ['#6c5a3c', '#8c7854', '#73613f'], 30);
  },

  // Floorboards running left to right.
  planks: (ctx, rand) => {
    fill(ctx, '#7a5530');
    ctx.fillStyle = '#5a3c20';
    for (let y = 3; y < TILE_SIZE; y += 4) ctx.fillRect(0, y, TILE_SIZE, 1);
    speckle(ctx, rand, ['#8a6238', '#6e4a28'], 14);
  },

  // A wall of upright logs, each lit on its left side.
  woodWall: (ctx) => {
    for (let x = 0; x < TILE_SIZE; x += 4) {
      ctx.fillStyle = '#6a4626';
      ctx.fillRect(x, 0, 4, TILE_SIZE);
      ctx.fillStyle = '#86603a';
      ctx.fillRect(x, 0, 1, TILE_SIZE);
      ctx.fillStyle = '#4a3018';
      ctx.fillRect(x + 3, 0, 1, TILE_SIZE);
    }
    ctx.fillStyle = '#3a2414';
    ctx.fillRect(0, 0, TILE_SIZE, 2);
  },

  // Two rails between posts. Fences run both ways, so the same tile serves for both.
  fence: (ctx, rand) => {
    paintForestFloor(ctx, rand);
    ctx.fillStyle = '#6e5232';
    ctx.fillRect(0, 5, TILE_SIZE, 2);
    ctx.fillRect(0, 10, TILE_SIZE, 2);
    ctx.fillStyle = '#4a3420';
    ctx.fillRect(2, 3, 2, 11);
    ctx.fillRect(12, 3, 2, 11);
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(0, 5, TILE_SIZE, 1);
    ctx.fillRect(0, 10, TILE_SIZE, 1);
  },

  // Tilled furrows with rows of withered sprouts.
  crops: (ctx, rand) => {
    fill(ctx, '#5a4428');
    ctx.fillStyle = '#4a3820';
    for (let y = 1; y < TILE_SIZE; y += 4) ctx.fillRect(0, y, TILE_SIZE, 1);
    for (let y = 2; y < TILE_SIZE; y += 4) {
      for (let x = 1 + Math.floor(rand() * 3); x < TILE_SIZE; x += 3 + Math.floor(rand() * 2)) {
        pixel(ctx, x, y, rand() < 0.3 ? '#8a8a3a' : '#6a7a30');
        pixel(ctx, x, y - 1, '#7a8a38');
      }
    }
  },

  // A bale of hay on the barn floor, its binding twine across it.
  hay: (ctx, rand) => {
    TILE_PAINTERS.planks(ctx, rand);
    ctx.fillStyle = '#b8963c';
    ctx.fillRect(1, 2, 14, 12);
    speckle(ctx, rand, ['#d0b050', '#a08030', '#c8a848'], 40);
    ctx.fillStyle = '#7a5e24';
    ctx.fillRect(1, 13, 14, 1);
    ctx.fillRect(4, 2, 1, 12);
    ctx.fillRect(11, 2, 1, 12);
  },

  // A shop shelf seen from above: wooden edge with tins and boxes on it.
  shelf: (ctx, rand) => {
    TILE_PAINTERS.planks(ctx, rand);
    ctx.fillStyle = '#4a3018';
    ctx.fillRect(0, 2, TILE_SIZE, 12);
    ctx.fillStyle = '#6a4626';
    ctx.fillRect(1, 3, 14, 10);
    const goods = ['#b84a3a', '#c8c0a0', '#4a7aa8', '#c8a040', '#7a8a6a'];
    for (let x = 2; x < 14; x += 3) {
      ctx.fillStyle = goods[Math.floor(rand() * goods.length)];
      ctx.fillRect(x, 4 + Math.floor(rand() * 2), 2, 3);
      ctx.fillStyle = goods[Math.floor(rand() * goods.length)];
      ctx.fillRect(x, 9, 2, 3);
    }
  },
};

function paintForestFloor(ctx: CanvasRenderingContext2D, rand: () => number): void {
  fill(ctx, '#4a5a2e');
  speckle(ctx, rand, ['#3e4d26', '#56683a', '#5e5232', '#6e5a32'], 45); // moss and fallen leaves
}

/**
 * Fills a pixelated disc. `color` gets the distance from the centre as a fraction of the
 * radius (0 to 1) and the pixel position, so it can shade the edge or one side.
 */
function disc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: (d: number, x: number, y: number) => string,
): void {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radius;
      if (d <= 1) pixel(ctx, x, y, color(d, x, y));
    }
  }
}

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
  // Seeded by the texture key, so procedural tiles look the same every run.
  const rng = new Random(hashSeed(key));
  draw(texture.getContext(), () => rng.next());
  texture.refresh();
}
