import { addPos, DIRECTIONS, type GridPos } from '../grid';
import { isBlockingTile, LEGEND, type MapDef, type TileType } from '../gridMap';
import { hashSeed, Random } from '../random';
import { rollCreature, rollLoot, type LootTable, type SpawnTable } from './tables';

export type Side = 'north' | 'south' | 'east' | 'west';

/**
 * A hand-drawn structure that generators stamp onto a map, written in the map legend plus:
 *   ' '  keep whatever terrain is underneath
 *   '$'  the prefab's chest
 *   '&'  a creature, picked from the prefab's spawn table
 *   A-Z  a resident: a particular person who is always there (see `residents`)
 */
export interface Prefab {
  name: string;
  rows: string[];
  /** The tile a path should lead to, relative to the top-left corner. */
  entrance: GridPos;
  chest?: { name: string; loot: LootTable; owner?: string };
  creatures?: SpawnTable;
  /** Letter in the rows to the creature id of the person standing there, e.g. the shopkeeper. */
  residents?: Record<string, string>;
}

/**
 * The prefab upside down, entrance included: a house whose door faces south becomes one whose
 * door faces north, for the other side of a street.
 */
export function flipVertical(prefab: Prefab): Prefab {
  return {
    ...prefab,
    rows: [...prefab.rows].reverse(),
    entrance: { x: prefab.entrance.x, y: prefab.rows.length - 1 - prefab.entrance.y },
  };
}

const KEEP = ' ';
const CHEST_SLOT = '$';
const CREATURE_SLOT = '&';
const RESIDENT_SLOT = /^[A-Z]$/;
/** Cost of carving through a tree, bush or rock when connecting places, versus 1 for open ground. */
const CARVE_COST = 8;

/**
 * Builds a map tile by tile, then turns it into an ordinary MapDef, so a generated map is
 * parsed, saved and drawn exactly like a hand-made one.
 *
 * Tiles that belong to a stamped structure (or an exit) are locked: later terrain painting
 * leaves them alone, and `connect()` never carves through them.
 */
export class MapBuilder {
  /** Where the player arrives if there is no exit back to where they came from. */
  start: GridPos | null = null;

  private readonly tiles: string[][];
  private readonly locked: boolean[][];
  private readonly chests: Array<{ pos: GridPos; name: string; contents: Array<[string, number]>; owner?: string }> = [];
  /** Residents stay where they are (until a fight), so paths go around them, not through. */
  private readonly creatures: Array<{ pos: GridPos; creatureId: string; resident: boolean }> = [];
  private readonly exits: Array<{ pos: GridPos; side: Side; to: string }> = [];
  /** Places that must be reachable from the start once the map is finished. */
  private readonly landmarks: GridPos[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
    fill: string,
    /** Seeds each exit's own random numbers (see addExit). */
    private readonly seed = 0,
  ) {
    tileOf(fill); // throws on a character that isn't a tile
    this.tiles = Array.from({ length: height }, () => Array<string>(width).fill(fill));
    this.locked = Array.from({ length: height }, () => Array<boolean>(width).fill(false));
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): string {
    return this.tiles[y][x];
  }

  tileAt(x: number, y: number): TileType {
    return tileOf(this.tiles[y][x]);
  }

  /** Paints a tile, unless it is locked by a structure or exit. */
  set(x: number, y: number, char: string): void {
    tileOf(char);
    if (this.inBounds(x, y) && !this.locked[y][x]) this.tiles[y][x] = char;
  }

  isLocked(x: number, y: number): boolean {
    return this.locked[y][x];
  }

  /** Protects a tile from later painting and stamping, e.g. a road nothing should be built on. */
  lock(x: number, y: number): void {
    if (this.inBounds(x, y)) this.locked[y][x] = true;
  }

  /** Walkable ground with nothing placed on it. */
  isOpen(x: number, y: number): boolean {
    if (!this.inBounds(x, y) || isBlockingTile(this.tileAt(x, y))) return false;
    const here = (p: GridPos) => p.x === x && p.y === y;
    return (
      !this.chests.some((c) => here(c.pos)) &&
      !this.creatures.some((c) => here(c.pos)) &&
      !this.exits.some((e) => here(e.pos)) &&
      !(this.start && here(this.start))
    );
  }

  /** Paints every unlocked tile for which `where` is true. */
  paint(char: string, where: (x: number, y: number) => boolean): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) if (where(x, y)) this.set(x, y, char);
    }
  }

  /**
   * True if the prefab fits at (x, y) inside the map, at least `margin` from the edge, on
   * unlocked tiles, without building on or right next to another structure's entrance or an
   * exit's way in (which could wall it off).
   */
  canStamp(prefab: Prefab, x: number, y: number, margin = 2): boolean {
    const height = prefab.rows.length;
    const width = prefab.rows[0].length;
    if (x < margin || y < margin || x + width > this.width - margin || y + height > this.height - margin) return false;
    const reserved = [...this.landmarks, ...this.exits.map((e) => addPos(e.pos, inwardStep(e.side)))];
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        if (prefab.rows[dy][dx] === KEEP) continue;
        if (this.locked[y + dy][x + dx]) return false;
        if (reserved.some((r) => Math.abs(r.x - (x + dx)) + Math.abs(r.y - (y + dy)) <= 1)) return false;
      }
    }
    return true;
  }

  /** Stamps a prefab with its top-left corner at (x, y), fills its chest and creatures, and returns its entrance. */
  stamp(prefab: Prefab, x: number, y: number, rng: Random): GridPos {
    if (!this.canStamp(prefab, x, y, 0)) throw new Error(`Prefab '${prefab.name}' doesn't fit at (${x}, ${y})`);
    prefab.rows.forEach((row, dy) => {
      [...row].forEach((char, dx) => {
        if (char === KEEP) return;
        const pos = { x: x + dx, y: y + dy };
        if (char === CHEST_SLOT || char === CREATURE_SLOT || RESIDENT_SLOT.test(char)) {
          // The slot itself stands on the prefab's floor, taken from its left neighbour.
          this.tiles[pos.y][pos.x] = floorBeside(row, dx);
          if (char === CHEST_SLOT) {
            if (!prefab.chest) throw new Error(`Prefab '${prefab.name}' has a chest slot but no chest`);
            this.addChest(pos, prefab.chest.name, rollLoot(prefab.chest.loot, rng), prefab.chest.owner);
          } else if (char !== CREATURE_SLOT) {
            const resident = prefab.residents?.[char];
            if (!resident) throw new Error(`Prefab '${prefab.name}' has no resident for '${char}'`);
            this.addCreature(pos, resident, true);
          } else {
            if (!prefab.creatures) throw new Error(`Prefab '${prefab.name}' has a creature slot but no creatures`);
            this.addCreature(pos, rollCreature(prefab.creatures, rng));
          }
        } else {
          tileOf(char);
          this.tiles[pos.y][pos.x] = char;
        }
        this.locked[pos.y][pos.x] = true;
      });
    });
    const entrance = addPos({ x, y }, prefab.entrance);
    this.landmarks.push(entrance);
    return entrance;
  }

  addChest(pos: GridPos, name: string, contents: Array<[string, number]>, owner?: string): void {
    if (!this.isOpen(pos.x, pos.y)) throw new Error(`Can't place a chest at (${pos.x}, ${pos.y})`);
    this.chests.push({ pos, name, contents, owner });
  }

  /** A `resident` stays put, like a shopkeeper: paths lead up to them, not through them. */
  addCreature(pos: GridPos, creatureId: string, resident = false): void {
    if (!this.isOpen(pos.x, pos.y)) throw new Error(`Can't place a creature at (${pos.x}, ${pos.y})`);
    this.creatures.push({ pos, creatureId, resident });
  }

  /**
   * Puts an exit somewhere along one edge, with a path tile just inside it, and returns that
   * inside tile. The first exit's inside tile also becomes the start if none is set.
   *
   * Each exit draws its position from its own random numbers (seeded by the map seed, its side
   * and its destination), not the biome's, so adding an exit to a map doesn't reshuffle where
   * the others are. Exits on the same side keep at least 3 tiles apart.
   */
  addExit(side: Side, to: string, pathChar: string): GridPos {
    const rng = new Random(hashSeed(this.seed, 'exit', side, to));
    const along = side === 'north' || side === 'south' ? this.width : this.height;
    const at = (offset: number): GridPos =>
      side === 'north' ? { x: offset, y: 0 }
      : side === 'south' ? { x: offset, y: this.height - 1 }
      : side === 'west' ? { x: 0, y: offset }
      : { x: this.width - 1, y: offset };
    const tooClose = (p: GridPos) => this.exits.some((e) => Math.abs(e.pos.x - p.x) + Math.abs(e.pos.y - p.y) < 3);
    let pos = at(rng.int(Math.floor(along * 0.25), Math.floor(along * 0.75)));
    for (let attempt = 0; attempt < 50 && tooClose(pos); attempt++) pos = at(rng.int(2, along - 3));
    if (tooClose(pos)) throw new Error(`No room for another exit on the ${side} side`);
    const inside = addPos(pos, inwardStep(side));

    for (const p of [pos, inside]) {
      this.set(p.x, p.y, pathChar);
      this.locked[p.y][p.x] = true;
    }
    this.exits.push({ pos, side, to });
    this.start ??= inside;
    return inside;
  }

  /**
   * Makes sure every exit, structure entrance, chest, creature and resident can be reached from
   * the start, by carving the cheapest path through trees, bushes and rocks where needed.
   * Locked structure walls are never carved. (A chest or resident counts as reached when a tile
   * next to it is.)
   */
  connect(pathChar: string): void {
    if (!this.start) throw new Error('The map has no start; add an exit first');
    const roaming = this.creatures.filter((c) => !c.resident).map((c) => c.pos);
    const targets: GridPos[] = [...this.exits.map((e) => e.pos), ...this.landmarks, ...roaming];
    for (const target of targets) this.connectTo(target, pathChar);
    for (const fixed of [...this.chests, ...this.creatures.filter((c) => c.resident)]) {
      this.connectTo(this.chestAccess(fixed.pos), pathChar);
    }
  }

  toMapDef(name: string): MapDef {
    if (!this.start) throw new Error('The map has no start; add an exit first');
    const rows = this.tiles.map((row) => [...row]);
    const def: MapDef = { name, rows: [], chests: {}, creatures: {}, exits: {} };

    rows[this.start.y][this.start.x] = 'P';
    this.chests.forEach((chest, i) => {
      if (i >= 26) throw new Error('A map can hold at most 26 chests');
      const letter = String.fromCharCode(97 + i);
      rows[chest.pos.y][chest.pos.x] = letter;
      def.chests[letter] = { name: chest.name, contents: chest.contents, ...(chest.owner && { owner: chest.owner }) };
    });
    // One letter per creature type, skipping P (the player start).
    const letters = 'ABCDEFGHIJKLMNOQRSTUVWXYZ';
    const letterFor = new Map<string, string>();
    for (const creature of this.creatures) {
      if (!letterFor.has(creature.creatureId)) {
        const letter = letters[letterFor.size];
        if (!letter) throw new Error('Too many creature types on one map');
        letterFor.set(creature.creatureId, letter);
        def.creatures![letter] = creature.creatureId;
      }
      rows[creature.pos.y][creature.pos.x] = letterFor.get(creature.creatureId)!;
    }
    this.exits.forEach((exit, i) => {
      if (i >= 9) throw new Error('A map can have at most 9 exits');
      const digit = String(i + 1);
      rows[exit.pos.y][exit.pos.x] = digit;
      def.exits![digit] = { to: exit.to };
    });

    def.rows = rows.map((row) => row.join(''));
    return def;
  }

  /** Every tile reachable on foot from the start, as `y * width + x` keys. */
  reachable(): Set<number> {
    const seen = new Set<number>();
    if (!this.start) return seen;
    const queue = [this.start];
    seen.add(this.key(this.start));
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const direction of DIRECTIONS) {
        const next = addPos(current, direction);
        if (!this.passable(next) || seen.has(this.key(next))) continue;
        seen.add(this.key(next));
        queue.push(next);
      }
    }
    return seen;
  }

  private key(p: GridPos): number {
    return p.y * this.width + p.x;
  }

  /** Can be walked over, ignoring creatures (they move, or die). */
  private passable(p: GridPos): boolean {
    return this.inBounds(p.x, p.y) && !isBlockingTile(this.tileAt(p.x, p.y)) && !this.standsInTheWay(p);
  }

  /** A chest or resident: never moves, so paths go around it. */
  private standsInTheWay(p: GridPos): boolean {
    const here = (q: GridPos) => q.x === p.x && q.y === p.y;
    return this.chests.some((c) => here(c.pos)) || this.creatures.some((c) => c.resident && here(c.pos));
  }

  /** The cost of a path stepping onto this tile; Infinity where a path can't go. */
  private stepCost(p: GridPos): number {
    if (!this.inBounds(p.x, p.y) || this.standsInTheWay(p)) return Infinity;
    if (!isBlockingTile(this.tileAt(p.x, p.y))) return 1;
    return this.locked[p.y][p.x] ? Infinity : CARVE_COST;
  }

  /** The neighbour of a chest (or resident) the player will stand on to use it: the cheapest one to reach. */
  private chestAccess(chest: GridPos): GridPos {
    const options = DIRECTIONS.map((d) => addPos(chest, d)).filter((p) => this.stepCost(p) < Infinity);
    if (options.length === 0) throw new Error(`Chest at (${chest.x}, ${chest.y}) is walled in`);
    return options.reduce((best, p) => (this.stepCost(p) < this.stepCost(best) ? p : best));
  }

  /**
   * Finds the cheapest path from `target` to anywhere already reachable (Dial's algorithm:
   * Dijkstra with a bucket per distance, since step costs are small whole numbers) and carves
   * the obstacles along it.
   */
  private connectTo(target: GridPos, pathChar: string): void {
    const reachable = this.reachable();
    if (reachable.has(this.key(target))) return;

    const distance = new Map<number, number>([[this.key(target), 0]]);
    const previous = new Map<number, GridPos>();
    const buckets: GridPos[][] = [[target]];
    for (let d = 0; d < buckets.length; d++) {
      for (const current of buckets[d] ?? []) {
        if (distance.get(this.key(current)) !== d) continue; // a cheaper way here was found later
        if (reachable.has(this.key(current))) {
          // Walk back to the target, opening up every obstacle on the way.
          let step: GridPos | undefined = current;
          while (step) {
            if (isBlockingTile(this.tileAt(step.x, step.y))) this.set(step.x, step.y, pathChar);
            step = previous.get(this.key(step));
          }
          return;
        }
        for (const direction of DIRECTIONS) {
          const next = addPos(current, direction);
          const cost = this.stepCost(next);
          if (cost === Infinity) continue;
          const nextDistance = d + cost;
          if (nextDistance < (distance.get(this.key(next)) ?? Infinity)) {
            distance.set(this.key(next), nextDistance);
            previous.set(this.key(next), current);
            (buckets[nextDistance] ??= []).push(next);
          }
        }
      }
    }
    throw new Error(`Can't connect (${target.x}, ${target.y}) to the start`);
  }
}

/** The step from an exit on this side into the map. */
function inwardStep(side: Side): GridPos {
  return side === 'north' ? { x: 0, y: 1 } : side === 'south' ? { x: 0, y: -1 } : side === 'west' ? { x: 1, y: 0 } : { x: -1, y: 0 };
}

function tileOf(char: string): TileType {
  const tile = LEGEND[char];
  if (!tile) throw new Error(`'${char}' is not a map tile`);
  return tile;
}

/** The floor a prefab's chest or creature slot stands on: its left neighbour, or dirt. */
function floorBeside(row: string, dx: number): string {
  const left = row[dx - 1];
  return left && LEGEND[left] && !isBlockingTile(LEGEND[left]) ? left : '.';
}
