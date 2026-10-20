import { ItemContainer } from './container';

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

const PLAYER_MARKER = 'P';
const CHEST_MARKER = /^[a-z]$/;

export interface GridPos {
  x: number;
  y: number;
}

/**
 * A map written as ASCII art. Each character is one tile (see LEGEND), and
 * there are two kinds of markers:
 *   P    the player start
 *   a-z  a chest, whose contents are listed under that letter in `chests`
 * A marker stands on the same kind of ground as the tile to its left.
 */
export interface MapDef {
  name: string;
  rows: string[];
  chests: Record<string, { name: string; contents: Array<[itemId: string, quantity: number]> }>;
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
    return new GridMap(def.name, tiles, chests, playerStart);
  }

  tileAt(x: number, y: number): TileType | null {
    return this.tiles[y]?.[x] ?? null;
  }

  chestAt(x: number, y: number): Chest | undefined {
    return this.chests.find((c) => c.x === x && c.y === y);
  }

  isWalkable(x: number, y: number): boolean {
    const tile = this.tileAt(x, y);
    return tile !== null && !BLOCKING.has(tile) && !this.chestAt(x, y);
  }
}
