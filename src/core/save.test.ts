import { describe, expect, it } from 'vitest';
import { buildMap } from '../data/world';
import { Character } from './character';
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
  return { player, worldSeed: SEED, maps: { wasteland }, currentMap: 'wasteland' };
}

/** Goes through JSON like the real save does, so nothing relies on shared object references. */
function roundTrip(game: GameData): GameData {
  return loadGame(JSON.parse(JSON.stringify(saveGame(game))), buildMap);
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
    const loaded = loadGame(save, buildMap).player;
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

  it('moves the player off a tile that is no longer walkable', () => {
    const game = freshGame();
    game.player.pos = { x: 0, y: 0 }; // a rock, as if the map had changed under the save
    const loaded = roundTrip(game);
    expect(loaded.player.pos).toEqual(game.maps.wasteland.playerStart);
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

    const loaded = loadGame(v1, buildMap);
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

    const loaded = loadGame(save, buildMap);
    expect(loaded.maps.wasteland.creatures.every((c) => c.isDead)).toBe(true);
  });

  it('keeps chests and creatures the save does not know about (added to the map later)', () => {
    const save = saveJson(freshGame());
    save.maps.wasteland = { chests: {}, creatures: {} };
    const loaded = loadGame(save, buildMap);
    expect(loaded.maps.wasteland.chests[0].contents.isEmpty).toBe(false);
    expect(loaded.maps.wasteland.creatures.every((c) => !c.isDead)).toBe(true);
  });

  it('rejects corrupt player data and clamps out-of-range numbers', () => {
    const game = freshGame();
    game.player.backpack.add('10mm_pistol');
    game.player.equip('10mm_pistol', 'primary');
    const save = saveJson(game);

    expect(() => loadGame({ ...save, player: { ...save.player, special: undefined } }, buildMap)).toThrow(/strength/);
    expect(() => loadGame({ ...save, player: { ...save.player, activeWeaponSlot: 'tail' } }, buildMap)).toThrow(
      /weapon slot/,
    );

    const tooMuch = { ...save.player, hitPoints: 999, loadedRounds: { primary: 50, secondary: 3 } };
    const loaded = loadGame({ ...save, player: tooMuch }, buildMap).player;
    expect(loaded.hitPoints).toBe(loaded.maxHitPoints);
    expect(loaded.loadedRounds('primary')).toBe(12); // the pistol's magazine
    expect(loaded.loadedRounds('secondary')).toBe(0); // nothing equipped there
  });

  it('rejects saves from another version, with unknown items, or pointing at a missing map', () => {
    const save = saveJson(freshGame());
    expect(() => loadGame({ ...save, version: SAVE_VERSION + 1 }, buildMap)).toThrow(/version/);
    expect(() => loadGame(null, buildMap)).toThrow();
    expect(() => loadGame({ ...save, currentMap: 'moon' }, buildMap)).toThrow(/current map/);

    const broken = JSON.parse(JSON.stringify(save));
    broken.player.backpack = [['laser_sword', 1]];
    expect(() => loadGame(broken, buildMap)).toThrow(/Unknown item/);
  });
});
