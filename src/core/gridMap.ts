import { ItemContainer } from './container';
import { Creature, getCreatureDef } from './creature';
import { addPos, DIRECTIONS, type GridPos } from './grid';

export type TileType =
  | 'dirt'
  | 'grass'
  | 'floor'
  | 'wall'
  | 'rock'
  | 'water'
  | 'forestFloor'
  | 'tree'
  | 'bush'
  | 'logs'
  | 'path'
  | 'planks'
  | 'woodWall'
  | 'fence'
  | 'crops'
  | 'hay'
  | 'shelf';

/** Map characters for each tile. Letters and digits are taken by markers, so tiles use symbols. */
export const LEGEND: Readonly<Record<string, TileType>> = {
  '.': 'dirt',
  ',': 'grass',
  _: 'floor',
  '#': 'wall',
  o: 'rock',
  '~': 'water',
  ';': 'forestFloor',
  '^': 'tree',
  '"': 'bush',
  '=': 'logs',
  ':': 'path',
  '+': 'planks',
  '%': 'woodWall',
  '|': 'fence',
  '*': 'crops',
  '[': 'hay',
  ']': 'shelf',
};

const BLOCKING: ReadonlySet<TileType> = new Set<TileType>([
  'wall',
  'rock',
  'water',
  'tree',
  'logs',
  'woodWall',
  'fence',
  'hay',
  'shelf',
]);
/** Tiles you can't see (or shoot) through. Low obstacles (water, logs, fences, hay, shelves) block walking only. */
const OPAQUE: ReadonlySet<TileType> = new Set<TileType>(['wall', 'rock', 'tree', 'woodWall']);

export function isBlockingTile(tile: TileType): boolean {
  return BLOCKING.has(tile);
}

const PLAYER_MARKER = 'P';
const CHEST_MARKER = /^[a-z]$/;
const CREATURE_MARKER = /^[A-Z]$/;
const EXIT_MARKER = /^[1-9]$/;

/**
 * A map written as ASCII art. Each character is one tile (see LEGEND), and
 * there are four kinds of markers:
 *   P    the player start
 *   a-z  a chest, whose contents are listed under that letter in `chests`
 *   A-Z  a creature or person (except P), whose type is given under that letter in
 *        `creatures`; the same letter can be used many times
 *   1-9  an exit to another map, given under that digit in `exits`
 * A marker stands on the ground of a neighbouring tile: the first walkable one of left,
 * right, above and below.
 */
export interface MapDef {
  name: string;
  rows: string[];
  chests: Record<string, ChestDef>;
  /** Marker letter to creature id. */
  creatures?: Record<string, string>;
  /** Marker digit to the id of the map it leads to. */
  exits?: Record<string, { to: string }>;
}

export interface ChestDef {
  name: string;
  contents: Array<[itemId: string, quantity: number]>;
  /** The group it belongs to (see CreatureDef.group): taking from it is stealing from them. */
  owner?: string;
}

export interface Chest {
  id: string;
  name: string;
  x: number;
  y: number;
  contents: ItemContainer;
  opened: boolean;
  owner?: string;
}

/** A walkable tile that takes the player to another map. */
export interface Exit {
  x: number;
  y: number;
  /** Id of the map it leads to. */
  to: string;
}

export class GridMap {
  /**
   * For a generated map, which generator made it (biome, version, exits; see
   * `generatorFingerprint`). Saves compare it to tell whether their saved state still fits.
   * Null for hand-made maps.
   */
  generator: string | null = null;

  private constructor(
    /** Identifies the map in the world and in saves; see data/world.ts. */
    readonly id: string,
    readonly name: string,
    /** Indexed as tiles[y][x]. */
    readonly tiles: TileType[][],
    readonly chests: Chest[],
    readonly creatures: Creature[],
    readonly exits: Exit[],
    readonly playerStart: GridPos,
  ) {}

  get width(): number {
    return this.tiles[0].length;
  }

  get height(): number {
    return this.tiles.length;
  }

  static parse(def: MapDef, id = def.name): GridMap {
    const width = def.rows[0]?.length ?? 0;
    if (width === 0) throw new Error(`Map '${def.name}' is empty`);

    const tiles: TileType[][] = [];
    const chests: Chest[] = [];
    const creatures: Creature[] = [];
    const exits: Exit[] = [];
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

        tileRow.push(groundUnderMarker(def.rows, x, y));
        if (char === PLAYER_MARKER) {
          if (playerStart) throw new Error(`Map '${def.name}' has more than one player start`);
          playerStart = { x, y };
        } else if (CHEST_MARKER.test(char)) {
          const chest = def.chests[char];
          if (!chest) throw new Error(`Map '${def.name}': no chest defined for '${char}'`);
          const contents = new ItemContainer(chest.contents);
          chests.push({ id: char, name: chest.name, x, y, contents, opened: false, owner: chest.owner });
        } else if (CREATURE_MARKER.test(char)) {
          const creatureId = def.creatures?.[char];
          if (!creatureId) throw new Error(`Map '${def.name}': no creature defined for '${char}'`);
          // Keyed by spawn position, so adding a creature elsewhere on the map doesn't shift every id.
          creatures.push(new Creature(`${creatureId}@${x},${y}`, getCreatureDef(creatureId), { x, y }));
        } else if (EXIT_MARKER.test(char)) {
          const exit = def.exits?.[char];
          if (!exit) throw new Error(`Map '${def.name}': no exit defined for '${char}'`);
          exits.push({ x, y, to: exit.to });
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
    const placedExits = new Set(def.rows.join(''));
    for (const digit of Object.keys(def.exits ?? {})) {
      if (!placedExits.has(digit)) throw new Error(`Map '${def.name}': exit '${digit}' is not placed`);
    }
    return new GridMap(id, def.name, tiles, chests, creatures, exits, playerStart);
  }

  tileAt(x: number, y: number): TileType | null {
    return this.tiles[y]?.[x] ?? null;
  }

  chestAt(x: number, y: number): Chest | undefined {
    return this.chests.find((c) => c.x === x && c.y === y);
  }

  exitAt(x: number, y: number): Exit | undefined {
    return this.exits.find((e) => e.x === x && e.y === y);
  }

  /**
   * Where the player appears when arriving from another map: on the tile just inside the exit
   * that leads back there, so stepping back onto it returns them. Exits sit on the map's edge,
   * so of the exit's walkable neighbours this picks the one furthest from the edge.
   * Falls back to the map's player start.
   */
  arrivalFrom(fromMapId: string): GridPos {
    const exit = this.exits.find((e) => e.to === fromMapId);
    if (!exit) return { ...this.playerStart };
    const fromEdge = (p: GridPos) => Math.min(p.x, p.y, this.width - 1 - p.x, this.height - 1 - p.y);
    const options = DIRECTIONS.map((d) => addPos(exit, d)).filter(
      (p) => this.isWalkable(p.x, p.y) && !this.exitAt(p.x, p.y),
    );
    if (options.length === 0) return { ...this.playerStart };
    return options.reduce((best, p) => (fromEdge(p) > fromEdge(best) ? p : best));
  }

  /**
   * Every tile reachable on foot from `start`, as "x,y" keys. Creatures don't count as
   * obstacles here (they move, or die); chests and blocking tiles do.
   */
  reachableFrom(start: GridPos): Set<string> {
    const key = (p: GridPos) => `${p.x},${p.y}`;
    const seen = new Set([key(start)]);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const direction of DIRECTIONS) {
        const next = addPos(current, direction);
        const tile = this.tileAt(next.x, next.y);
        if (!tile || BLOCKING.has(tile) || this.chestAt(next.x, next.y) || seen.has(key(next))) continue;
        seen.add(key(next));
        queue.push(next);
      }
    }
    return seen;
  }

  /**
   * The person someone at `from` talks to when facing `step`: one right in front of them, or
   * one standing behind a counter (a shelf) in front of them, as in a shop. Only people who
   * will talk: alive, friendly, and with a dialog.
   */
  personFacing(from: GridPos, step: GridPos): Creature | undefined {
    const front = addPos(from, step);
    const here = this.livingCreatureAt(front.x, front.y);
    if (here) return here.canTalk ? here : undefined;
    if (this.tileAt(front.x, front.y) !== 'shelf') return undefined;
    const behind = addPos(front, step);
    const person = this.livingCreatureAt(behind.x, behind.y);
    return person?.canTalk ? person : undefined;
  }

  /**
   * Turns a creature hostile, and with it every living, still friendly member of its group.
   * Returns everyone who turned hostile (empty if they all already were).
   */
  provoke(creature: Creature): Creature[] {
    const group = creature.def.group;
    const angered = this.creatures.filter(
      (c) => !c.isDead && !c.hostile && (c === creature || (group !== undefined && c.def.group === group)),
    );
    for (const c of angered) c.hostile = true;
    return angered;
  }

  /**
   * Taking something that belongs to a group (`owner`, e.g. a chest's) is stealing: if any of
   * that group is alive and still friendly, they all turn hostile. Returns who did (empty for
   * nothing owned, or an owner with no one left to care).
   */
  noticeTheft(owner: string | undefined): Creature[] {
    if (owner === undefined) return [];
    const witness = this.creatures.find((c) => !c.isDead && !c.hostile && c.def.group === owner);
    return witness ? this.provoke(witness) : [];
  }

  livingCreatureAt(x: number, y: number): Creature | undefined {
    return this.creatures.find((c) => !c.isDead && c.pos.x === x && c.pos.y === y);
  }

  /** Corpses don't block, so several can share a tile; the one that still holds loot comes first. */
  corpseAt(x: number, y: number): Creature | undefined {
    const corpses = this.creatures.filter((c) => c.isDead && c.pos.x === x && c.pos.y === y);
    return corpses.find((c) => !c.contents.isEmpty) ?? corpses[0];
  }

  /**
   * The corpse someone at `from` loots when facing `step`: the one in front of them, or else
   * one they're standing on (corpses don't block, so you can step onto them).
   */
  corpseToLoot(from: GridPos, step: GridPos): Creature | undefined {
    const front = addPos(from, step);
    return this.corpseAt(front.x, front.y) ?? this.corpseAt(from.x, from.y);
  }

  blocksSight(x: number, y: number): boolean {
    const tile = this.tileAt(x, y);
    return tile === null || OPAQUE.has(tile);
  }

  /**
   * True if no wall, rock or tree lies on the line between two tiles (the end tiles themselves
   * don't count). A Bresenham line from a to b can differ from one from b to a, so both are
   * tried and either being clear is enough; that keeps sight symmetric.
   */
  hasLineOfSight(a: GridPos, b: GridPos): boolean {
    return this.clearLine(a, b) !== null || this.clearLine(b, a) !== null;
  }

  /**
   * The tiles a shot from `from` to `to` passes over, nearest to the shooter first, end tiles
   * left out; null if there's no line of sight. It's the line hasLineOfSight found clear (from
   * the shooter's end if that one is), so a shot only ever crosses tiles you can see along.
   */
  lineOfFire(from: GridPos, to: GridPos): GridPos[] | null {
    return this.clearLine(from, to) ?? this.clearLine(to, from)?.reverse() ?? null;
  }

  /** The tiles strictly between two tiles on a Bresenham line, or null if something blocks sight. */
  private clearLine(from: GridPos, to: GridPos): GridPos[] | null {
    const between: GridPos[] = [];
    const dx = Math.abs(to.x - from.x);
    const dy = -Math.abs(to.y - from.y);
    const stepX = from.x < to.x ? 1 : -1;
    const stepY = from.y < to.y ? 1 : -1;
    let error = dx + dy;
    let x = from.x;
    let y = from.y;
    while (x !== to.x || y !== to.y) {
      const previousX = x;
      const previousY = y;
      const doubled = 2 * error;
      if (doubled >= dy) {
        error += dy;
        x += stepX;
      }
      if (doubled <= dx) {
        error += dx;
        y += stepY;
      }
      // A diagonal step squeezes between two tiles; if both block sight, so does the gap.
      const diagonal = x !== previousX && y !== previousY;
      if (diagonal && this.blocksSight(previousX, y) && this.blocksSight(x, previousY)) return null;
      const reachedEnd = x === to.x && y === to.y;
      if (reachedEnd) break;
      if (this.blocksSight(x, y)) return null;
      between.push({ x, y });
    }
    return between;
  }

  /** Corpses don't block; living creatures do. The player's own tile is not checked here. */
  isWalkable(x: number, y: number): boolean {
    const tile = this.tileAt(x, y);
    return tile !== null && !BLOCKING.has(tile) && !this.chestAt(x, y) && !this.livingCreatureAt(x, y);
  }
}

/**
 * The ground a marker stands on: the first walkable tile among its left, right, upper and
 * lower neighbours, so a chest against a wall still sits on the floor. If none is walkable
 * (an exit between edge trees, say) it's dirt: markers are things to stand on or beside, so
 * their ground must never block.
 */
function groundUnderMarker(rows: string[], x: number, y: number): TileType {
  const neighbours = [rows[y][x - 1], rows[y][x + 1], rows[y - 1]?.[x], rows[y + 1]?.[x]]
    .map((char) => (char === undefined ? undefined : LEGEND[char]))
    .filter((tile): tile is TileType => tile !== undefined);
  return neighbours.find((tile) => !BLOCKING.has(tile)) ?? 'dirt';
}
