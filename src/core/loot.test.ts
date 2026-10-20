import { describe, expect, it } from 'vitest';
import { Character } from './character';
import { ItemContainer } from './container';
import { storeItem, takeAll, takeItem, transferQuantity } from './loot';

// Strength 1 gives a 50 lb carry capacity.
function weakling(): Character {
  return new Character('Weakling', {
    strength: 1,
    perception: 5,
    endurance: 5,
    charisma: 5,
    intelligence: 5,
    agility: 5,
    luck: 5,
  });
}

describe('takeItem', () => {
  it('moves a whole stack into the backpack', () => {
    const player = weakling();
    const chest = new ItemContainer([['stimpak', 3]]);
    expect(takeItem(player, chest, 'stimpak').ok).toBe(true);
    expect(player.backpack.count('stimpak')).toBe(3);
    expect(chest.isEmpty).toBe(true);
  });

  it('takes only as much as the player can carry', () => {
    const player = weakling();
    const chest = new ItemContainer([['scrap_metal', 10]]); // 60 lb
    const result = takeItem(player, chest, 'scrap_metal');
    expect(result.ok).toBe(true);
    expect(player.backpack.count('scrap_metal')).toBe(8); // 48 lb
    expect(chest.count('scrap_metal')).toBe(2);
  });

  it('fails when nothing fits', () => {
    const player = weakling();
    player.backpack.add('scrap_metal', 8);
    const chest = new ItemContainer([['scrap_metal', 1]]);
    expect(takeItem(player, chest, 'scrap_metal').ok).toBe(false);
    expect(chest.count('scrap_metal')).toBe(1);
  });
});

describe('transferQuantity', () => {
  it('moves one, half rounded up, or all of a stack', () => {
    expect(transferQuantity(24, 'one')).toBe(1);
    expect(transferQuantity(24, 'half')).toBe(12);
    expect(transferQuantity(23, 'half')).toBe(12);
    expect(transferQuantity(1, 'half')).toBe(1);
    expect(transferQuantity(24, 'all')).toBe(24);
    expect(transferQuantity(0, 'one')).toBe(0);
  });

  it('stores part of a stack in a container', () => {
    const player = weakling();
    player.backpack.add('ammo_10mm', 24);
    const chest = new ItemContainer();
    storeItem(player, chest, 'ammo_10mm', transferQuantity(24, 'half'));
    expect(chest.count('ammo_10mm')).toBe(12);
    expect(player.backpack.count('ammo_10mm')).toBe(12);
  });
});

describe('storeItem', () => {
  it('moves items from the backpack into the container', () => {
    const player = weakling();
    player.backpack.add('rope', 2);
    const chest = new ItemContainer();
    expect(storeItem(player, chest, 'rope', 1).ok).toBe(true);
    expect(player.backpack.count('rope')).toBe(1);
    expect(chest.count('rope')).toBe(1);
  });

  it('fails for items the player does not have', () => {
    expect(storeItem(weakling(), new ItemContainer(), 'rope').ok).toBe(false);
  });
});

describe('takeAll', () => {
  it('skips what does not fit but still takes the rest', () => {
    const player = weakling();
    const chest = new ItemContainer([
      ['scrap_metal', 10],
      ['stimpak', 2],
    ]);
    const result = takeAll(player, chest);
    expect(result.ok).toBe(true);
    expect(result.message).toContain('what you could carry');
    expect(player.backpack.count('stimpak')).toBe(2);
    expect(chest.count('scrap_metal')).toBe(2);
  });

  it('fails on an empty container', () => {
    expect(takeAll(weakling(), new ItemContainer()).ok).toBe(false);
  });
});
