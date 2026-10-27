import { describe, expect, it } from 'vitest';
import { generateMap, type ExitRequest } from '../../core/generation/biome';
import { flipVertical } from '../../core/generation/mapBuilder';
import { GridMap } from '../../core/gridMap';
import { LOCKS } from '../../core/locks';
import { playabilityProblems, workbenches } from './playability';
import { VILLAGE } from './village';

const EXITS: ExitRequest[] = [{ side: 'north', to: 'wasteland' }];
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 104729 + 3);

/** The world's layout today, plus layouts the village may get later: other sides, more exits. */
const LAYOUTS: Record<string, ExitRequest[]> = {
  'north only': EXITS,
  'entered from the west': [{ side: 'west', to: 'forest' }],
  'north and south': [...EXITS, { side: 'south', to: 'plains' }],
};

describe('village biome', () => {
  it('generates the same map from the same seed', () => {
    expect(generateMap(VILLAGE, 99, EXITS)).toEqual(generateMap(VILLAGE, 99, EXITS));
    expect(generateMap(VILLAGE, 99, EXITS).rows).not.toEqual(generateMap(VILLAGE, 100, EXITS).rows);
  });

  describe.each(Object.entries(LAYOUTS))('with exits %s', (_name, exits) => {
    it.each(SEEDS)('seed %i: everything can be reached, and nothing sees you arrive through any exit', (seed) => {
      const map = GridMap.parse(generateMap(VILLAGE, seed, exits), 'village');
      expect(map.creatures.length).toBeGreaterThan(0);
      expect(map.exits.map((e) => e.to).sort()).toEqual(exits.map((e) => e.to).sort());
      expect(playabilityProblems(map)).toEqual([]);
    });
  });

  it('runs a road from every exit to the main street', () => {
    for (const exits of Object.values(LAYOUTS)) {
      const map = GridMap.parse(generateMap(VILLAGE, 5, exits), 'village');
      for (const exit of map.exits) {
        // From just inside the exit, follow path tiles; the street is the long run of path across the map.
        const onPath = map.reachableFrom(map.arrivalFrom(exit.to));
        const streetRow = map.tiles.findIndex((row) => row.filter((t) => t === 'path').length > map.width * 0.7);
        expect(streetRow).toBeGreaterThan(0);
        expect(onPath.has(`${Math.floor(map.width / 2)},${streetRow}`)).toBe(true);
      }
    }
  });

  it('has creatures out in the streets too', () => {
    const onStreet = SEEDS.slice(0, 20).filter((seed) => {
      const map = GridMap.parse(generateMap(VILLAGE, seed, EXITS), 'village');
      return map.creatures.some((c) => map.tileAt(c.pos.x, c.pos.y) === 'path');
    });
    expect(onStreet.length).toBeGreaterThan(5);
  });

  it('builds a proper village: several homes, always one store with its shopkeeper and one clinic with its doctor, usually a barn', () => {
    const villages = SEEDS.map((seed) => GridMap.parse(generateMap(VILLAGE, seed, EXITS), 'village'));
    for (const map of villages) {
      const chests = map.chests.map((c) => c.name);
      const homes = chests.filter((n) => n === 'Dresser' || n === 'Cupboard').length;
      expect(homes).toBeGreaterThanOrEqual(3);
      expect(chests.filter((n) => n === 'Stockroom Crate').length).toBe(1);
      expect(chests.filter((n) => n === 'Feed Bin').length).toBeLessThanOrEqual(1);
      const people = map.creatures.filter((c) => !c.hostile).map((c) => c.def.id);
      expect(people.sort()).toEqual(['doctor', 'guard', 'shopkeeper']);
      expect(map.chests.find((c) => c.name === 'Medicine Cabinet')?.owner).toBe('clinic');
      expect(map.chests.find((c) => c.name === 'Stockroom Crate')?.owner).toBe('store');
    }
    expect(villages.filter((map) => map.chests.some((c) => c.name === 'Feed Bin')).length).toBeGreaterThan(SEEDS.length / 3);
    // The store isn't always the first building in its row.
    const storeX = villages.map((map) => map.creatures.find((c) => c.def.id === 'shopkeeper')!.pos.x);
    expect(new Set(storeX).size).toBeGreaterThan(5);
  });

  it('puts the shopkeeper behind the counter, facing the shop floor, and the guard by the door', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const map = GridMap.parse(generateMap(VILLAGE, seed, EXITS), 'village');
      const gus = map.creatures.find((c) => c.def.id === 'shopkeeper')!;
      const guard = map.creatures.find((c) => c.def.id === 'guard')!;
      const reachable = map.reachableFrom(map.arrivalFrom('wasteland'));
      // Whichever side of the street the store is on, there's a spot on the shop floor two
      // tiles from Gus, with the counter in between, from where you talk to him.
      const spots = [1, -1].filter((dy) => {
        const customer = { x: gus.pos.x, y: gus.pos.y + 2 * dy };
        return (
          map.tileAt(gus.pos.x, gus.pos.y + dy) === 'shelf' &&
          reachable.has(`${customer.x},${customer.y}`) &&
          map.personFacing(customer, { x: 0, y: -dy }) === gus
        );
      });
      expect(spots).toHaveLength(1);
      // The guard stands just outside, beside the way in: the store's door is diagonally next
      // to him. (Not checked through the path tile beside him: a creature may stand on it.)
      const byTheDoor = [-1, 1].some((dy) => map.doorAt(guard.pos.x - 1, guard.pos.y + dy));
      expect(byTheDoor).toBe(true);
      expect(reachable.has(`${guard.pos.x},${guard.pos.y}`)).toBe(true);
    }
  });
});

describe('village workbench', () => {
  it('stands in the barn, where you can get at it', () => {
    let withBarn = 0;
    for (const seed of SEEDS) {
      const map = GridMap.parse(generateMap(VILLAGE, seed, EXITS), 'village');
      const benches = workbenches(map);
      const barn = map.chests.some((c) => c.name === 'Feed Bin');
      expect(benches.length).toBe(barn ? 1 : 0);
      if (!barn) continue;
      withBarn++;
      expect(benches[0].reachable).toBe(true);
      expect(map.buildingAt(benches[0].x, benches[0].y)).toBeDefined();
    }
    expect(withBarn).toBeGreaterThan(SEEDS.length / 2);
  });
});

describe('village buildings', () => {
  it("lock the store's crate with a hard lock, but never the store or the barn", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const map = GridMap.parse(generateMap(VILLAGE, seed, EXITS), 'village');
      const crate = map.chests.find((c) => c.owner === 'store')!;
      expect(crate.lock).toBe(LOCKS.hard);
      const gus = map.creatures.find((c) => c.def.id === 'shopkeeper')!;
      const store = map.buildingAt(gus.pos.x, gus.pos.y)!;
      expect(store).toBeDefined();
      const storeDoors = map.doors.filter((d) => [...store.interior].some((k) => isNextTo(k, d)));
      expect(storeDoors.map((d) => [d.lock, d.owner])).toEqual([[null, 'store']]);
      // Picking the crate's lock is breaking into the store.
      expect(map.noticeLockpicking(crate).map((c) => c.def.id).sort()).toEqual(['guard', 'shopkeeper']);
    }
  });

  it('are roofed, every one with a door, and some houses locked up', () => {
    let locked = 0;
    for (const seed of SEEDS) {
      const map = GridMap.parse(generateMap(VILLAGE, seed, EXITS), 'village');
      // The store, a house or two, maybe the barn: each enclosed, with its own roof.
      expect(map.buildings.length).toBeGreaterThanOrEqual(2);
      for (const chest of map.chests) {
        if (chest.name !== 'Dresser' && chest.name !== 'Cupboard') continue;
        expect(map.buildingAt(chest.x, chest.y)).toBeDefined();
      }
      locked += map.doors.filter((d) => d.lock !== null).length;
    }
    expect(locked).toBeGreaterThan(0);
  });
});

/** Whether an "x,y" tile is right next to (up, down, left, right) a position. */
function isNextTo(key: string, p: { x: number; y: number }): boolean {
  const [x, y] = key.split(',').map(Number);
  return Math.abs(x - p.x) + Math.abs(y - p.y) === 1;
}

describe('flipVertical', () => {
  it('turns a prefab upside down, entrance included', () => {
    const flipped = flipVertical({ name: 'hut', rows: ['%%%', '%$%', '%+%', ' : '], entrance: { x: 1, y: 3 } });
    expect(flipped.rows).toEqual([' : ', '%+%', '%$%', '%%%']);
    expect(flipped.entrance).toEqual({ x: 1, y: 0 });
  });
});
