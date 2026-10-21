import { describe, expect, it } from 'vitest';
import { buyItem, buyPrice, CAPS, sellItem, sellPrice } from './barter';
import { Character } from './character';
import { ItemContainer } from './container';

function trader(charisma = 5, caps = 100): Character {
  const player = new Character('Trader', {
    strength: 5,
    perception: 5,
    endurance: 5,
    charisma,
    intelligence: 5,
    agility: 5,
    luck: 5,
  });
  if (caps > 0) player.backpack.add(CAPS, caps);
  return player;
}

describe('prices', () => {
  it('buys above value and sells below it, closer to value with more Charisma', () => {
    // Stimpak: value 175.
    expect(buyPrice('stimpak', 5)).toBe(210);
    expect(buyPrice('stimpak', 10)).toBe(175);
    expect(buyPrice('stimpak', 1)).toBe(238);
    expect(sellPrice('stimpak', 5)).toBe(70);
    expect(sellPrice('stimpak', 10)).toBe(96);
    expect(sellPrice('stimpak', 1)).toBe(49);
  });

  it('never lets buying and selling back make money', () => {
    for (const itemId of ['ammo_10mm', 'ammo_223', 'canteen', 'stimpak', 'hunting_rifle']) {
      for (let charisma = 1; charisma <= 10; charisma++) {
        expect(sellPrice(itemId, charisma)).toBeLessThan(buyPrice(itemId, charisma));
      }
    }
  });

  it('costs at least a cap to buy anything', () => {
    expect(buyPrice('ammo_10mm', 10)).toBeGreaterThanOrEqual(1);
  });
});

describe('buyItem', () => {
  it('swaps caps for goods', () => {
    const player = trader(5, 500);
    const stock = new ItemContainer([['stimpak', 2], [CAPS, 50]]);
    const result = buyItem(player, stock, 'stimpak', 1);
    expect(result).toMatchObject({ ok: true, message: 'Bought the Stimpak for 210 caps.' });
    expect(player.backpack.count('stimpak')).toBe(1);
    expect(player.backpack.count(CAPS)).toBe(290);
    expect(stock.count('stimpak')).toBe(1);
    expect(stock.count(CAPS)).toBe(260);
  });

  it('buys only as many as the player can afford', () => {
    const player = trader(5, 500);
    const stock = new ItemContainer([['stimpak', 5]]);
    const result = buyItem(player, stock, 'stimpak', 5);
    expect(result.message).toBe("Bought 2 Stimpak for 420 caps. You can't afford more.");
    expect(player.backpack.count('stimpak')).toBe(2);
  });

  it('refuses when the player is broke', () => {
    const player = trader(5, 10);
    const stock = new ItemContainer([['stimpak', 1]]);
    expect(buyItem(player, stock, 'stimpak', 1)).toMatchObject({ ok: false });
    expect(player.backpack.count(CAPS)).toBe(10);
    expect(stock.count('stimpak')).toBe(1);
  });

  it('buys only as much as the player can carry', () => {
    const player = trader(5, 10_000); // Strength 5 carries 150 lb
    const stock = new ItemContainer([['scrap_metal', 40]]); // 6 lb each
    const result = buyItem(player, stock, 'scrap_metal', 40);
    expect(result.message).toMatch(/You can't carry more\.$/);
    expect(player.backpack.count('scrap_metal')).toBe(25);
  });

  it("doesn't sell caps for caps", () => {
    const player = trader();
    expect(buyItem(player, new ItemContainer([[CAPS, 50]]), CAPS, 10)).toMatchObject({ ok: false });
    expect(sellItem(player, new ItemContainer([[CAPS, 50]]), CAPS, 10)).toMatchObject({ ok: false });
  });
});

describe('sellItem', () => {
  it('swaps goods for caps', () => {
    const player = trader(5, 0);
    player.backpack.add('stimpak', 2);
    const stock = new ItemContainer([[CAPS, 300]]);
    const result = sellItem(player, stock, 'stimpak', 2);
    expect(result).toMatchObject({ ok: true, message: 'Sold 2 Stimpak for 140 caps.' });
    expect(player.backpack.count(CAPS)).toBe(140);
    expect(player.backpack.count('stimpak')).toBe(0);
    expect(stock.count('stimpak')).toBe(2);
    expect(stock.count(CAPS)).toBe(160);
  });

  it('sells only as many as the trader can pay for', () => {
    const player = trader(5, 0);
    player.backpack.add('stimpak', 3);
    const stock = new ItemContainer([[CAPS, 150]]);
    expect(sellItem(player, stock, 'stimpak', 3).message).toBe("Sold 2 Stimpak for 140 caps. They can't afford more.");
    expect(sellItem(player, stock, 'stimpak', 1)).toMatchObject({ ok: false });
  });

  it('refuses what the player does not have', () => {
    const player = trader();
    expect(sellItem(player, new ItemContainer([[CAPS, 50]]), 'stimpak', 1)).toMatchObject({ ok: false });
  });
});
