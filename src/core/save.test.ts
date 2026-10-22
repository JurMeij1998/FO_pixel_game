import { describe, expect, it } from 'vitest';
import { buildKnownMap, buildMap } from '../data/world';
import { Character } from './character';
import { GridMap } from './gridMap';
import { takeItem } from './loot';
import { loadGame, saveGame, SAVE_VERSION, type GameData } from './save';

const SEED = 4242;

function freshGame(): GameData {
  const wasteland = buildMap('wasteland', SEED);
  const player = new Character('Saver', {
    strength: 6,
    perception: 5,
    endurance: 5,
    charisma: 5,
    intelligence: 5,
    agility: 5,
    luck: 5,
  });
  player.pos = { ...wasteland.playerStart };
  return { player, worldSeed: SEED, difficulty: 'normal', maps: { wasteland }, currentMap: 'wasteland' };
}

/** Goes through JSON like the real save does, so nothing relies on shared object references. */
function roundTrip(game: GameData): GameData {
  return loadGame(JSON.parse(JSON.stringify(saveGame(game))), buildKnownMap, 'wasteland');
}

/** The save as plain JSON, to edit like a corrupt or old save would be. */
function saveJson(game: GameData) {
  return JSON.parse(JSON.stringify(saveGame(game)));
}

describe('save and load', () => {
  it('restores the player', () => {
    const game = freshGame();
    const { player } = game;
    player.backpack.add('knife');
    player.backpack.add('10mm_pistol');
    player.backpack.add('stimpak', 3);
    player.equip('knife', 'primary');
    player.equip('10mm_pistol', 'secondary');
    player.swapWeapons();
    player.backpack.add('ammo_10mm', 7);
    player.reload(); // 7 rounds in the pistol's magazine
    player.taggedSkills.add('unarmed');
    player.gainExperience(350);
    player.improveSkill('unarmed');
    player.hitPoints = 7;
    player.pos = { x: 10, y: 8 };

    const loaded = roundTrip(game).player;
    expect(loaded.toData()).toEqual(player.toData());
    expect(loaded.activeWeapon?.id).toBe('10mm_pistol');
    expect(loaded.skill('unarmed')).toBe(player.skill('unarmed'));
    expect(loaded.loadedRounds('secondary')).toBe(7);
    expect(loaded.level).toBe(3);
    expect(loaded.maxHitPoints).toBe(player.maxHitPoints);
  });

  it('loads saves from before levelling existed', () => {
    const game = freshGame();
    const save = saveJson(game);
    for (const key of ['level', 'experience', 'skillPoints', 'skillBonus', 'bonusHitPoints']) delete save.player[key];
    const loaded = loadGame(save, buildKnownMap, 'wasteland').player;
    expect(loaded.level).toBe(1);
    expect(loaded.skill('smallGuns')).toBe(game.player.skill('smallGuns'));
  });

  it('restores looted chests and dead creatures', () => {
    const game = freshGame();
    const map = game.maps.wasteland;
    const chest = map.chests[0];
    chest.opened = true;
    takeItem(game.player, chest.contents, 'stimpak');
    const raider = map.creatures.find((c) => c.def.id === 'raider')!;
    raider.hitPoints = 0;
    raider.pos = { x: 20, y: 10 };
    raider.contents.remove('bottle_caps', 5);

    const loaded = roundTrip(game);
    const loadedMap = loaded.maps.wasteland;
    expect(loadedMap.chests[0].opened).toBe(true);
    expect(loadedMap.chests[0].contents.count('stimpak')).toBe(0);
    expect(loaded.player.backpack.count('stimpak')).toBe(2);

    const loadedRaider = loadedMap.creatures.find((c) => c.id === raider.id)!;
    expect(loadedRaider.isDead).toBe(true);
    expect(loadedMap.corpseAt(20, 10)).toBe(loadedRaider);
    expect(loadedRaider.contents.count('bottle_caps')).toBe(20);
  });

  it('rebuilds a generated map from the world seed and applies what changed', () => {
    const game = freshGame();
    const forest = buildMap('forest', SEED);
    game.maps.forest = forest;
    game.currentMap = 'forest';
    forest.creatures[0].hitPoints = 0;
    forest.chests[0].contents.clear();

    const loaded = roundTrip(game);
    expect(loaded.currentMap).toBe('forest');
    const loadedForest = loaded.maps.forest;
    expect(loadedForest.tiles).toEqual(forest.tiles); // the same forest, regenerated
    expect(loadedForest.creatures[0].isDead).toBe(true);
    expect(loadedForest.chests[0].contents.isEmpty).toBe(true);
    expect(loaded.maps.wasteland).toBeDefined();
  });

  it("restores what a trader has left to sell, and whether people have turned hostile", () => {
    const game = freshGame();
    const village = buildMap('village', SEED);
    game.maps.village = village;
    const gus = village.creatures.find((c) => c.def.id === 'shopkeeper')!;
    gus.contents.remove('stimpak', 2);
    gus.contents.add('canteen', 1);
    village.provoke(gus);

    const loaded = roundTrip(game).maps.village.creatures;
    const loadedGus = loaded.find((c) => c.id === gus.id)!;
    expect(loadedGus.contents.count('stimpak')).toBe(0);
    expect(loadedGus.contents.count('canteen')).toBe(1);
    expect(loaded.filter((c) => c.def.group === 'store').every((c) => c.hostile)).toBe(true);
  });

  it('keeps people friendly in saves from before hostility was saved, and never makes a monster friendly', () => {
    const game = freshGame();
    const village = buildMap('village', SEED);
    game.maps.village = village;
    const old = saveJson(game);
    for (const creature of Object.values(old.maps.village.creatures) as Array<{ hostile?: boolean }>) {
      delete creature.hostile;
    }
    const roach = Object.keys(old.maps.village.creatures).find((id) => !id.startsWith('shopkeeper') && !id.startsWith('guard'))!;
    const edited = saveJson(game);
    edited.maps.village.creatures[roach].hostile = false;

    const fromOld = loadGame(old, buildKnownMap, 'wasteland').maps.village.creatures;
    expect(fromOld.find((c) => c.def.id === 'shopkeeper')?.hostile).toBe(false);
    const fromEdited = loadGame(edited, buildKnownMap, 'wasteland').maps.village.creatures;
    expect(fromEdited.find((c) => c.id === roach)?.hostile).toBe(true);
  });

  it('moves the player off a tile that is no longer walkable', () => {
    const game = freshGame();
    game.player.pos = { x: 0, y: 0 }; // a rock, as if the map had changed under the save
    const loaded = roundTrip(game);
    expect(loaded.player.pos).toEqual(game.maps.wasteland.playerStart);
  });

  it('starts a generated map afresh when its generator has changed since the save', () => {
    const game = freshGame();
    const forest = buildMap('forest', SEED);
    forest.chests[0].contents.clear();
    game.maps.forest = forest;
    const save = saveJson(game);
    expect(save.maps.forest.generator).toBe(forest.generator);

    // Same generator: the looted chest stays looted.
    expect(loadGame(save, buildKnownMap, 'wasteland').maps.forest.chests[0].contents.isEmpty).toBe(true);
    // A different (or, in older saves, missing) generator: the saved state no longer fits.
    for (const generator of ['forest@1:west>wasteland', undefined]) {
      const old = { ...save, maps: { ...save.maps, forest: { ...save.maps.forest, generator } } };
      expect(loadGame(old, buildKnownMap, 'wasteland').maps.forest.chests[0].contents.isEmpty).toBe(false);
    }
  });

  it('keeps hand-made maps\' state, also from saves that have no generator field', () => {
    const game = freshGame();
    game.maps.wasteland.chests[0].contents.clear();
    const save = saveJson(game);
    delete save.maps.wasteland.generator;
    expect(loadGame(save, buildKnownMap, 'wasteland').maps.wasteland.chests[0].contents.isEmpty).toBe(true);
  });

  it('leaves out maps the world no longer has, instead of discarding the save', () => {
    const save = saveJson(freshGame());
    save.maps.moon_base = { chests: {}, creatures: {} };
    const loaded = loadGame(save, buildKnownMap, 'wasteland');
    expect(Object.keys(loaded.maps)).toEqual(['wasteland']);
  });

  it('puts the player on the start map if the map they were on no longer exists', () => {
    const save = saveJson(freshGame());
    save.maps.moon_base = { chests: {}, creatures: {} };
    save.currentMap = 'moon_base';
    save.player.pos = { x: 40, y: 40 };
    const loaded = loadGame(save, buildKnownMap, 'wasteland');
    expect(loaded.currentMap).toBe('wasteland');
    expect(loaded.player.pos).toEqual(loaded.maps.wasteland.playerStart);
  });

  it('moves the player off a tile that is walkable but walled off from the rest of the map', () => {
    // A map with a sealed pocket at (3,1), as a changed layout could leave a saved player in.
    const pocket = () => GridMap.parse({ name: 'Pocket', rows: ['#####', '#P#.#', '#####'], chests: {} }, 'pocket');
    const build = (id: string) => (id === 'pocket' ? pocket() : null);
    const game: GameData = { ...freshGame(), maps: { pocket: pocket() }, currentMap: 'pocket' };
    game.player.pos = { x: 3, y: 1 };
    const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(game))), build, 'pocket');
    expect(loaded.player.pos).toEqual({ x: 1, y: 1 });

    game.player.pos = { x: 1, y: 1 }; // the connected part is left alone
    expect(loadGame(JSON.parse(JSON.stringify(saveGame(game))), build, 'pocket').player.pos).toEqual({ x: 1, y: 1 });
  });

  it('only stores maps that have been visited', () => {
    const save = saveJson(freshGame());
    expect(Object.keys(save.maps)).toEqual(['wasteland']);
  });

  it('upgrades version 1 saves, which had only the wasteland', () => {
    const game = freshGame();
    game.maps.wasteland.creatures.find((c) => c.def.id === 'raider')!.hitPoints = 0;
    const v2 = saveJson(game);
    const v1 = { version: 1, player: v2.player, ...v2.maps.wasteland };

    const loaded = loadGame(v1, buildKnownMap, 'wasteland');
    expect(loaded.currentMap).toBe('wasteland');
    expect(loaded.maps.wasteland.creatures.find((c) => c.def.id === 'raider')!.isDead).toBe(true);
    expect(Number.isInteger(loaded.worldSeed)).toBe(true);
  });

  it('reads creatures from saves that keyed them by map order', () => {
    const game = freshGame();
    const save = saveJson(game);
    // Rewrite the ids the way older saves stored them: "<type>_<index>".
    const legacy: Record<string, unknown> = {};
    game.maps.wasteland.creatures.forEach((c, i) => {
      legacy[`${c.def.id}_${i}`] = { ...save.maps.wasteland.creatures[c.id], hitPoints: 0 };
    });
    save.maps.wasteland.creatures = legacy;

    const loaded = loadGame(save, buildKnownMap, 'wasteland');
    expect(loaded.maps.wasteland.creatures.every((c) => c.isDead)).toBe(true);
  });

  it('keeps chests and creatures the save does not know about (added to the map later)', () => {
    const save = saveJson(freshGame());
    save.maps.wasteland = { chests: {}, creatures: {} };
    const loaded = loadGame(save, buildKnownMap, 'wasteland');
    expect(loaded.maps.wasteland.chests[0].contents.isEmpty).toBe(false);
    expect(loaded.maps.wasteland.creatures.every((c) => !c.isDead)).toBe(true);
  });

  it('rejects corrupt player data and clamps out-of-range numbers', () => {
    const game = freshGame();
    game.player.backpack.add('10mm_pistol');
    game.player.equip('10mm_pistol', 'primary');
    const save = saveJson(game);

    expect(() => loadGame({ ...save, player: { ...save.player, special: undefined } }, buildKnownMap, 'wasteland')).toThrow(/strength/);
    expect(() => loadGame({ ...save, player: { ...save.player, activeWeaponSlot: 'tail' } }, buildKnownMap, 'wasteland')).toThrow(
      /weapon slot/,
    );

    const tooMuch = { ...save.player, hitPoints: 999, loadedRounds: { primary: 50, secondary: 3 } };
    const loaded = loadGame({ ...save, player: tooMuch }, buildKnownMap, 'wasteland').player;
    expect(loaded.hitPoints).toBe(loaded.maxHitPoints);
    expect(loaded.loadedRounds('primary')).toBe(12); // the pistol's magazine
    expect(loaded.loadedRounds('secondary')).toBe(0); // nothing equipped there
  });

  it('rejects saves from another version, with unknown items, or pointing at a missing map', () => {
    const save = saveJson(freshGame());
    expect(() => loadGame({ ...save, version: SAVE_VERSION + 1 }, buildKnownMap, 'wasteland')).toThrow(/version/);
    expect(() => loadGame(null, buildKnownMap, 'wasteland')).toThrow();
    expect(() => loadGame({ ...save, currentMap: 'moon' }, buildKnownMap, 'wasteland')).toThrow(/current map/);

    const broken = JSON.parse(JSON.stringify(save));
    broken.player.backpack = [['laser_sword', 1]];
    expect(() => loadGame(broken, buildKnownMap, 'wasteland')).toThrow(/Unknown item/);
  });
});

describe('character creation in saves', () => {
  it('keeps the difficulty and the gender', () => {
    const game = freshGame();
    game.difficulty = 'hard';
    game.player.gender = 'female';
    const loaded = roundTrip(game);
    expect(loaded.difficulty).toBe('hard');
    expect(loaded.player.gender).toBe('female');
  });

  it('loads saves from before character creation as normal difficulty and a male player', () => {
    const old = saveJson(freshGame());
    delete old.difficulty;
    delete old.player.gender;
    const loaded = loadGame(old, buildKnownMap, 'wasteland');
    expect(loaded.difficulty).toBe('normal');
    expect(loaded.player.gender).toBe('male');
  });

  it('ignores a difficulty it does not know', () => {
    const odd = saveJson(freshGame());
    odd.difficulty = 'nightmare';
    expect(loadGame(odd, buildKnownMap, 'wasteland').difficulty).toBe('normal');
  });
});

describe('doors, locks and roofs in saves', () => {
  it('keep doors open or shut, picked locks picked, and entered buildings unroofed', () => {
    const game = freshGame();
    const map = game.maps.wasteland;
    const shed = map.doors.find((d) => d.lock !== null)!;
    shed.lock = null;
    shed.open = true;
    const locker = map.chests.find((c) => c.name === 'Metal Locker')!;
    map.enter(locker);

    const loaded = roundTrip(game).maps.wasteland;
    const loadedShed = loaded.doorAt(shed.x, shed.y)!;
    expect(loadedShed).toMatchObject({ open: true, lock: null });
    expect(loaded.isHidden(locker.x, locker.y)).toBe(false);
    const shack = loaded.doors.find((d) => d !== loadedShed)!;
    expect(shack.open).toBe(false);
  });

  it('keep a chest unlocked once picked', () => {
    const game = freshGame();
    const chest = game.maps.wasteland.chests[0];
    chest.lock = 40; // as if the map had locked it
    const json = saveJson(game);
    expect(json.maps.wasteland.chests[chest.id].locked).toBe(true);
    json.maps.wasteland.chests[chest.id].locked = false;
    const loaded = loadGame(json, buildKnownMap, 'wasteland');
    expect(loaded.maps.wasteland.chests[0].lock).toBeNull();
  });

  it('load saves from before doors: closed, locked as the map says, every roof on', () => {
    const json = saveJson(freshGame());
    delete json.maps.wasteland.doors;
    delete json.maps.wasteland.entered;
    for (const chest of Object.values(json.maps.wasteland.chests) as Array<{ locked?: boolean }>) delete chest.locked;
    const loaded = loadGame(json, buildKnownMap, 'wasteland').maps.wasteland;
    expect(loaded.doors.every((d) => !d.open)).toBe(true);
    expect(loaded.doors.filter((d) => d.lock !== null)).toHaveLength(1);
    expect(loaded.entered.size).toBe(0);
  });

  it('open a door on anyone saved standing in that doorway (from before it had a door)', () => {
    const game = freshGame();
    const map = game.maps.wasteland;
    const shack = map.doors.find((d) => d.lock === null)!;
    const roach = map.creatures.find((c) => c.def.id === 'radroach')!;
    roach.hitPoints = 0; // died in the doorway
    roach.pos = { x: shack.x, y: shack.y };
    const json = saveJson(game);
    delete json.maps.wasteland.doors;
    const loaded = loadGame(json, buildKnownMap, 'wasteland').maps.wasteland;
    expect(loaded.doorAt(shack.x, shack.y)!.open).toBe(true);
    expect(loaded.doors.filter((d) => d.open)).toHaveLength(1);
  });

  it("ignore entered buildings the map doesn't have (any more)", () => {
    const json = saveJson(freshGame());
    json.maps.wasteland.entered = ['99,99', 42];
    expect(loadGame(json, buildKnownMap, 'wasteland').maps.wasteland.entered.size).toBe(0);
  });
});
