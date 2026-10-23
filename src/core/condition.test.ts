import { describe, expect, it } from 'vitest';
import { buyPrice, sellPrice } from './barter';
import { Character } from './character';
import { Combat } from './combat';
import {
  afterRepair,
  afterWear,
  conditionLabel,
  damageShare,
  hitPenalty,
  isBroken,
  SCRAP,
  scrapToRepair,
  slowReloadChance,
  valueShare,
  wornness,
} from './condition';
import { rollLoot, FOUND_CONDITION } from './generation/tables';
import { GridMap } from './gridMap';
import { conditionOf, getItem, itemIdOf, itemKey } from './items';
import { Random } from './random';
import { repairables, repairWeapon } from './repair';
import { loadGame, saveGame } from './save';
import { workbenchRows } from '../ui/workbench';
import { describeItem, itemName } from '../ui/format';
import { weaponLine } from '../ui/healthBar';

const average = () => new Character('Tester', { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 });

/** A tester holding this weapon (by key), loaded if it's a gun. */
function armed(key: string): Character {
  const player = average();
  player.backpack.add(key);
  const ammo = getItem(key).weapon?.ammo;
  if (ammo) player.backpack.add(ammo, 30);
  player.equip(key, 'primary');
  if (ammo) player.reload();
  return player;
}

describe('item keys', () => {
  it('carry a worn weapon\'s condition, and nothing for a perfect one', () => {
    expect(itemKey('10mm_pistol', 100)).toBe('10mm_pistol');
    expect(itemKey('10mm_pistol', 62.54)).toBe('10mm_pistol@62.5');
    expect(itemKey('knife', -3)).toBe('knife@0');
    expect(itemIdOf('10mm_pistol@62.5')).toBe('10mm_pistol');
    expect(conditionOf('10mm_pistol@62.5')).toBe(62.5);
    expect(conditionOf('stimpak')).toBe(100);
    expect(conditionOf('knife@nonsense')).toBe(100); // a bad save: as good as new
    expect(getItem('10mm_pistol@12').name).toBe('10mm Pistol');
  });

  it('keep worn weapons apart from good ones in a container', () => {
    const player = average();
    player.backpack.add('knife');
    player.backpack.add('knife');
    player.backpack.add('knife@40');
    expect(player.backpack.count('knife')).toBe(2);
    expect(player.backpack.count('knife@40')).toBe(1);
    expect(itemName('knife@40')).toBe('Knife (40%)');
    expect(itemName('knife@0')).toBe('Knife (broken)');
  });
});

describe('weapon condition', () => {
  it('only matters at 35% or below, more so the lower it gets', () => {
    expect(wornness(100)).toBe(0);
    expect(wornness(35)).toBe(0);
    expect(wornness(17.5)).toBeCloseTo(0.5);
    expect(wornness(0)).toBe(1);
    expect(isBroken(0)).toBe(true);
    expect(isBroken(0.5)).toBe(false);
  });

  it('costs a gun hit chance and damage, and slows reloads; a melee weapon only damage', () => {
    expect(hitPenalty(50, true)).toBe(0);
    expect(hitPenalty(17.5, true)).toBe(15);
    expect(hitPenalty(17.5, false)).toBe(0);
    expect(damageShare(100)).toBe(1);
    expect(damageShare(0)).toBe(0.5);
    expect(slowReloadChance(40)).toBe(0);
    expect(slowReloadChance(0)).toBe(0.5);
  });

  it('wears by the weapon\'s own amount per attack', () => {
    expect(afterWear('10mm_pistol')).toBe('10mm_pistol@98.5');
    expect(afterWear('hunting_rifle')).toBe('hunting_rifle@97.5');
    expect(afterWear('knife')).toBe('knife@99.5');
    expect(afterWear('knife@0.3')).toBe('knife@0');
    expect(afterWear('stimpak')).toBe('stimpak'); // doesn't wear
  });

  it('takes more scrap to repair the more worn, and the better the weapon', () => {
    expect(scrapToRepair('knife')).toBe(0);
    expect(scrapToRepair('knife@0')).toBe(2);
    expect(scrapToRepair('10mm_pistol@0')).toBe(8);
    expect(scrapToRepair('hunting_rifle@0')).toBe(15);
    expect(scrapToRepair('10mm_pistol@50')).toBe(4);
    expect(scrapToRepair('10mm_pistol@99')).toBe(1); // any wear takes at least one piece
    expect(afterRepair('10mm_pistol@50', 2)).toBe('10mm_pistol@75');
    expect(afterRepair('10mm_pistol@50', 4)).toBe('10mm_pistol');
    expect(conditionLabel(62.3)).toBe('63%');
    expect(conditionLabel(0)).toBe('broken');
  });

  it('makes a worn weapon worth less, both buying and selling', () => {
    expect(valueShare(100)).toBe(1);
    expect(valueShare(0)).toBeCloseTo(0.1);
    expect(buyPrice('10mm_pistol@50', 10)).toBeLessThan(buyPrice('10mm_pistol', 10));
    expect(sellPrice('10mm_pistol@50', 5)).toBeLessThan(sellPrice('10mm_pistol', 5));
    expect(sellPrice('10mm_pistol@0', 5)).toBeGreaterThan(0);
  });

  it("shows a weapon's condition, and nothing more", () => {
    expect(describeItem('10mm_pistol')).toMatch(/\nCondition 100%\n/);
    expect(describeItem('10mm_pistol@20')).toMatch(/\nCondition 20%\n/);
    expect(describeItem('knife@0')).toMatch(/\nCondition broken\n/);
  });
});

describe('a worn weapon in hand', () => {
  it("does less damage, and a gun hits less often, at 35% or below", () => {
    const good = armed('10mm_pistol').attack;
    const worn = armed('10mm_pistol@10').attack;
    expect(worn.hitChance).toBeLessThan(good.hitChance);
    expect(worn.damageMax).toBeLessThan(good.damageMax);
    expect(armed('10mm_pistol@40').attack).toEqual(good); // not yet
    const knife = armed('knife@10').attack;
    expect(knife.hitChance).toBe(armed('knife').attack.hitChance);
    expect(knife.damageMax).toBeLessThan(armed('knife').attack.damageMax);
  });

  it('wears with every attack, and says when it gets badly worn and when it breaks', () => {
    const player = armed('knife@35.4');
    expect(player.wearWeapon()).toBe('worn');
    expect(player.equippedKey('primary')).toBe('knife@34.9');
    expect(player.wearWeapon()).toBe(null);
    const nearlyBroken = armed('knife@0.4');
    expect(nearlyBroken.wearWeapon()).toBe('broke');
    expect(nearlyBroken.weaponBroken).toBe(true);
  });

  it('keeps its condition when unequipped and equipped again, and in a save', () => {
    const player = armed('10mm_pistol@42');
    player.unequip('primary');
    expect(player.backpack.count('10mm_pistol@42')).toBe(1);
    player.equip('10mm_pistol@42', 'secondary');
    expect(player.weaponCondition('secondary')).toBe(42);
    const loaded = Character.fromData(JSON.parse(JSON.stringify(player.toData())));
    expect(loaded.equippedKey('secondary')).toBe('10mm_pistol@42');
  });

  it("shows its condition on the HUD's weapon line", () => {
    expect(weaponLine(armed('10mm_pistol@34'))).toBe('10mm Pistol (34%) 12/12 (+18)');
    expect(weaponLine(armed('10mm_pistol'))).toBe('10mm Pistol 12/12 (+18)');
  });
});

describe('a worn weapon in combat', () => {
  const pit = (key: string, rng: () => number) => {
    const map = GridMap.parse({ name: 'pit', rows: ['#####', '#PX.#', '#####'], chests: {}, creatures: { X: 'raider' } });
    const player = armed(key);
    player.pos = { ...map.playerStart };
    return { player, combat: new Combat(map, player, rng, 'normal'), raider: map.creatures[0] };
  };

  it("can't attack once broken", () => {
    const { combat, raider } = pit('knife@0', () => 0);
    expect(combat.attackProblem(raider)).toMatchObject({ code: 'broken', message: 'Your Knife is broken. Repair it at a workbench.' });
  });

  it('wears with each attack, and says so as it breaks', () => {
    const { player, combat, raider } = pit('knife@0.3', () => 0.99); // a miss
    const result = combat.attack(raider);
    expect(result.ok && result.events[0].type === 'attack' && result.events[0].message).toMatch(/Your Knife breaks!$/);
    expect(player.weaponBroken).toBe(true);
  });

  it('sometimes takes twice the AP to reload when badly worn', () => {
    const { player, combat } = pit('10mm_pistol@10', () => 0); // the slow-reload roll comes up
    player.spendRound();
    const before = combat.actionPoints;
    expect(combat.reload()).toMatchObject({ ok: true, message: expect.stringMatching(/^The worn 10mm Pistol fights you: you reload/) });
    expect(combat.actionPoints).toBe(before - 4);
  });

  it("jams halfway, eating the AP left, when there isn't enough for a slow reload", () => {
    const { player, combat } = pit('10mm_pistol@10', () => 0);
    player.spendRound();
    combat.actionPoints = 3;
    expect(combat.reload().ok).toBe(false);
    expect(combat.actionPoints).toBe(0);
    expect(player.loadedRounds()).toBe(11);
  });

  it("reloads a good gun for the usual AP, without rolling for it", () => {
    let rolls = 0;
    const { player, combat } = pit('10mm_pistol', () => (rolls++, 0));
    player.spendRound();
    const before = combat.actionPoints;
    combat.reload();
    expect(combat.actionPoints).toBe(before - 2);
    expect(rolls).toBe(0);
  });
});

describe('repairing at a workbench', () => {
  it('lists every weapon carried: in hand first, then the backpack', () => {
    const player = armed('10mm_pistol@30');
    player.backpack.add('knife@0');
    player.backpack.add('stimpak');
    expect(repairables(player).map((r) => r.key)).toEqual(['10mm_pistol@30', 'knife@0']);
    const rows = workbenchRows(player);
    expect(rows.map((r) => [r.label, r.detail])).toEqual([
      ['10mm Pistol (30%) (in hand)', '6 scrap'],
      ['Knife (broken)', '2 scrap'],
    ]);
  });

  it('repairs fully with enough scrap metal, in hand or in the backpack', () => {
    const player = armed('10mm_pistol@50');
    player.backpack.add(SCRAP, 10);
    expect(repairWeapon(player, { slot: 'primary' })).toMatchObject({ ok: true, repaired: '10mm_pistol' });
    expect(player.equippedKey('primary')).toBe('10mm_pistol');
    expect(player.backpack.count(SCRAP)).toBe(6);
    player.backpack.add('knife@0');
    expect(repairWeapon(player, { key: 'knife@0' }).ok).toBe(true);
    expect(player.backpack.count('knife')).toBe(1);
    expect(player.backpack.count('knife@0')).toBe(0);
  });

  it('patches a weapon up as far as the scrap goes', () => {
    const player = armed('hunting_rifle@0');
    player.backpack.add(SCRAP, 3);
    const result = repairWeapon(player, { slot: 'primary' });
    expect(result).toMatchObject({ ok: true, repaired: 'hunting_rifle@20' });
    expect(result.message).toMatch(/patch up the Hunting Rifle with 3 scrap metal: 20%\. A full repair takes 15\./);
    expect(player.backpack.count(SCRAP)).toBe(0);
  });

  it("can't repair without scrap, or what's already perfect", () => {
    const player = armed('knife@50');
    expect(repairWeapon(player, { slot: 'primary' })).toMatchObject({ ok: false, message: 'Repairing the Knife takes 1 scrap metal, and you have none.' });
    player.backpack.add(SCRAP, 5);
    repairWeapon(player, { slot: 'primary' });
    expect(repairWeapon(player, { slot: 'primary' })).toMatchObject({ ok: false, message: 'The Knife is in perfect condition.' });
  });
});

describe('found weapons', () => {
  it('come worn, each with its own condition, the same for the same seed', () => {
    const table = { rolls: [6, 6] as [number, number], entries: [{ itemId: 'knife', min: 1, max: 2, weight: 1 }] };
    const loot = rollLoot(table, new Random(3));
    expect(loot).toEqual(rollLoot(table, new Random(3)));
    for (const [key] of loot) {
      expect(itemIdOf(key)).toBe('knife');
      expect(conditionOf(key)).toBeGreaterThanOrEqual(FOUND_CONDITION[0]);
      expect(conditionOf(key)).toBeLessThanOrEqual(FOUND_CONDITION[1]);
    }
    const ammo = rollLoot({ rolls: [1, 1], entries: [{ itemId: 'ammo_10mm', min: 5, max: 5, weight: 1 }] }, new Random(1));
    expect(ammo).toEqual([['ammo_10mm', 5]]); // the rest as before
  });

  it('keep their condition in a save, in chests and on corpses', () => {
    const map = GridMap.parse({ name: 'shed', rows: ['#####', '#Pa_#', '#####'], chests: { a: { name: 'Box', contents: [['knife@44', 1]] } } });
    const player = average();
    player.pos = { ...map.playerStart };
    const game = { player, worldSeed: 1, difficulty: 'normal' as const, maps: { shed: map }, currentMap: 'shed' };
    const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(game))), () => GridMap.parse({ name: 'shed', rows: ['#####', '#Pa_#', '#####'], chests: { a: { name: 'Box', contents: [['knife@44', 1]] } } }), 'shed');
    expect(loaded.maps.shed.chests[0].contents.count('knife@44')).toBe(1);
  });
});
