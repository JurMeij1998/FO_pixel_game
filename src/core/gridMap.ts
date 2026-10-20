import { ItemContainer } from './container';
import { Creature, getCreatureDef } from './creature';
import type { GridPos } from './grid';

export type TileType = 'dirt' | 'grass' | 'floor' | 'wall' | 'rock' | 'water';

const LEGEND: Record<string, TileType> = {
  '.': 'dirt',
  ',': 'grass',
  _: 'floor',
  '#': 'wall',
  o: 'rock',
  '~': 'water',
};

const BLOCKING: ReadonlySet<TileType> = new Set<TileType>(['wall', 'rock', 'water']);
/** Tiles you can't see (or shoot) through. Water blocks walking but not sight. */
const OPAQUE: ReadonlySet<TileType> = new Set<TileType>(['wall', 'rock']);

const PLAYER_MARKER = 'P';
const CHEST_MARKER = /^[a-z]$/;
const CREATURE_MARKER = /^[A-Z]$/;

/**
 * A map written as ASCII art. Each character is one tile (see LEGEND), and
 * there are three kinds of markers:
 *   P    the player start
 *   a-z  a chest, whose contents are listed under that letter in `chests`
 *   A-Z  a creature (except P), whose type is given under that letter in `creatures`;
 *        the same letter can be used many times
 * A marker stands on the same kind of ground as the tile to its left.
 */
export interface MapDef {
  name: string;
  rows: string[];
  chests: Record<string, { name: string; contents: Array<[itemId: string, quantity: number]> }>;
  /** Marker letter to creature id. */
  creatures?: Record<string, string>;
}

export interface Chest {
  id: string;
  name: string;
  x: number;
  y: number;
  contents: ItemContainer;
  opened: boolean;
}

export class GridMap {
  private constructor(
    readonly name: string,
    /** Indexed as tiles[y][x]. */
    readonly tiles: TileType[][],
    readonly chests: Chest[],
    readonly creatures: Creature[],
    readonly playerStart: GridPos,
  ) {}

  get width(): number {
    return this.tiles[0].length;
  }

  get height(): number {
    return this.tiles.length;
  }

  static parse(def: MapDef): GridMap {
    const width = def.rows[0]?.length ?? 0;
    if (width === 0) throw new Error(`Map '${def.name}' is empty`);

    const tiles: TileType[][] = [];
    const chests: Chest[] = [];
    const creatures: Creature[] = [];
    let playerStart: GridPos | null = null;

    for (let y = 0; y < def.rows.length; y++) {
      const row = def.rows[y];
      if (row.length !== width) {
        throw new Error(`Map '${def.name}': row ${y} is ${row.length} wide, expected ${width}`);
      }
      const tileRow: TileType[] = [];
      for (let x = 0; x < width; x++) {
        const char = row[x];
        const tile = LEGEND[char];
        if (tile) {
          tileRow.push(tile);
          continue;
        }

        tileRow.push(x > 0 ? tileRow[x - 1] : 'dirt');
        if (char === PLAYER_MARKER) {
          if (playerStart) throw new Error(`Map '${def.name}' has more than one player start`);
          playerStart = { x, y };
        } else if (CHEST_MARKER.test(char)) {
          const chest = def.chests[char];
          if (!chest) throw new Error(`Map '${def.name}': no chest defined for '${char}'`);
          chests.push({ id: char, name: chest.name, x, y, contents: new ItemContainer(chest.contents), opened: false });
        } else if (CREATURE_MARKER.test(char)) {
          const creatureId = def.creatures?.[char];
          if (!creatureId) throw new Error(`Map '${def.name}': no creature defined for '${char}'`);
          creatures.push(new Creature(`${creatureId}_${creatures.length}`, getCreatureDef(creatureId), { x, y }));
        } else {
          throw new Error(`Map '${def.name}': unknown character '${char}' at (${x}, ${y})`);
        }
      }
      tiles.push(tileRow);
    }

    if (!playerStart) throw new Error(`Map '${def.name}' has no player start`);
    for (const id of Object.keys(def.chests)) {
      if (!chests.some((c) => c.id === id)) throw new Error(`Map '${def.name}': chest '${id}' is not placed`);
    }
    return new GridMap(def.name, tiles, chests, creatures, playerStart);
  }

  tileAt(x: number, y: number): TileType | null {
    return this.tiles[y]?.[x] ?? null;
  }

  chestAt(x: number, y: number): Chest | undefined {
    return this.chests.find((c) => c.x === x && c.y === y);
  }

  livingCreatureAt(x: number, y: number): Creature | undefined {
    return this.creatures.find((c) => !c.isDead && c.pos.x === x && c.pos.y === y);
  }

  corpseAt(x: number, y: number): Creature | undefined {
    return this.creatures.find((c) => c.isDead && c.pos.x === x && c.pos.y === y);
  }

  blocksSight(x: number, y: number): boolean {
    const tile = this.tileAt(x, y);
    return tile === null || OPAQUE.has(tile);
  }

  /**
   * True if no wall or rock lies on the line between two tiles (the end tiles themselves
   * don't count). A Bresenham line from a to b can differ from one from b to a, so both are
   * tried and either being clear is enough; that keeps sight symmetric.
   */
  hasLineOfSight(a: GridPos, b: GridPos): boolean {
    return this.isLineClear(a, b) || this.isLineClear(b, a);
  }

  private isLineClear(from: GridPos, to: GridPos): boolean {
    const dx = Math.abs(to.x - from.x);
    const dy = -Math.abs(to.y - from.y);
    const stepX = from.x < to.x ? 1 : -1;
    const stepY = from.y < to.y ? 1 : -1;
    let error = dx + dy;
    let x = from.x;
    let y = from.y;
    while (x !== to.x || y !== to.y) {
      const doubled = 2 * error;
      if (doubled >= dy) {
        error += dy;
        x += stepX;
      }
      if (doubled <= dx) {
        error += dx;
        y += stepY;
      }
      const reachedEnd = x === to.x && y === to.y;
      if (!reachedEnd && this.blocksSight(x, y)) return false;
    }
    return true;
  }

  /** Corpses don't block; living creatures do. The player's own tile is not checked here. */
  isWalkable(x: number, y: number): boolean {
    const tile = this.tileAt(x, y);
    return tile !== null && !BLOCKING.has(tile) && !this.chestAt(x, y) && !this.livingCreatureAt(x, y);
  }
}
