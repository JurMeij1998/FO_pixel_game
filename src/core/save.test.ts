import { describe, expect, it } from 'vitest';
import { WASTELAND } from '../data/wasteland';
import { Character } from './character';
import { GridMap } from './gridMap';
import { takeItem } from './loot';
import { loadGame, saveGame, SAVE_VERSION } from './save';

function freshGame() {
  const map = GridMap.parse(WASTELAND);
  const player = new Character('Saver', {
    strength: 6,
    perception: 5,
    endurance: 5,
    charisma: 5,
    intelligence: 5,
    agility: 5,
    luck: 5,
  });
  player.pos = { ...map.playerStart };
  return { map, player };
}

/** Goes through JSON like the real save does, so nothing relies on shared object references. */
function roundTrip(player: Character, map: GridMap) {
  return loadGame(JSON.parse(JSON.stringify(saveGame(player, map))), WASTELAND);
}

describe('save and load', () => {
  it('restores the player', () => {
    const { map, player } = freshGame();
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

    const loaded = roundTrip(player, map).player;
    expect(loaded.toData()).toEqual(player.toData());
    expect(loaded.activeWeapon?.id).toBe('10mm_pistol');
    expect(loaded.skill('unarmed')).toBe(player.skill('unarmed'));
    expect(loaded.loadedRounds('secondary')).toBe(7);
    expect(loaded.level).toBe(3);
    expect(loaded.maxHitPoints).toBe(player.maxHitPoints);
  });

  it('loads saves from before levelling existed', () => {
    const { map, player } = freshGame();
    const save = JSON.parse(JSON.stringify(saveGame(player, map)));
    for (const key of ['level', 'experience', 'skillPoints', 'skillBonus', 'bonusHitPoints']) delete save.player[key];
    const loaded = loadGame(save, WASTELAND).player;
    expect(loaded.level).toBe(1);
    expect(loaded.skill('smallGuns')).toBe(player.skill('smallGuns'));
  });

  it('restores looted chests and dead creatures', () => {
    const { map, player } = freshGame();
    const chest = map.chests[0];
    chest.opened = true;
    takeItem(player, chest.contents, 'stimpak');
    const raider = map.creatures.find((c) => c.def.id === 'raider')!;
    raider.hitPoints = 0;
    raider.pos = { x: 20, y: 10 };
    raider.contents.remove('bottle_caps', 5);

    const loaded = roundTrip(player, map);
    const loadedChest = loaded.map.chests[0];
    expect(loadedChest.opened).toBe(true);
    expect(loadedChest.contents.count('stimpak')).toBe(0);
    expect(loaded.player.backpack.count('stimpak')).toBe(2);

    const loadedRaider = loaded.map.creatures.find((c) => c.id === raider.id)!;
    expect(loadedRaider.isDead).toBe(true);
    expect(loaded.map.corpseAt(20, 10)).toBe(loadedRaider);
    expect(loadedRaider.contents.count('bottle_caps')).toBe(20);
  });

  it('rejects saves from another version or with unknown items', () => {
    const { map, player } = freshGame();
    const save = saveGame(player, map);
    expect(() => loadGame({ ...save, version: SAVE_VERSION + 1 }, WASTELAND)).toThrow(/version/);
    expect(() => loadGame(null, WASTELAND)).toThrow();

    const broken = JSON.parse(JSON.stringify(save));
    broken.player.backpack = [['laser_sword', 1]];
    expect(() => loadGame(broken, WASTELAND)).toThrow(/Unknown item/);
  });
});
