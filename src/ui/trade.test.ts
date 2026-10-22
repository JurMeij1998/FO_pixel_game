import { describe, expect, it } from 'vitest';
import { CAPS } from '../core/barter';
import { Character } from '../core/character';
import { ItemContainer } from '../core/container';
import { Creature, getCreatureDef } from '../core/creature';
import { amountFor, barterClick, barterDetail, barterHeaders, barterRows } from './trade';

const PLAIN = { shift: false, ctrl: false };
const CTRL = { shift: false, ctrl: true };
const SHIFT = { shift: true, ctrl: false };

/** Charisma 5, so prices are 120% of value to buy and 40% to sell. */
function customer(caps: number): Character {
  const player = new Character('Customer', {
    strength: 5,
    perception: 5,
    endurance: 5,
    charisma: 5,
    intelligence: 5,
    agility: 5,
    luck: 5,
  });
  if (caps > 0) player.backpack.add(CAPS, caps);
  return player;
}

/** Gus's stock is his pack: what his corpse would hold. */
const gus = () => ({ inventory: new Creature('shopkeeper@0,0', getCreatureDef('shopkeeper'), { x: 0, y: 0 }).contents });

describe('click modifiers', () => {
  it('trade one on a plain click, half with Ctrl, all with Shift (which wins over Ctrl)', () => {
    expect(amountFor(PLAIN)).toBe('one');
    expect(amountFor(CTRL)).toBe('half');
    expect(amountFor(SHIFT)).toBe('all');
    expect(amountFor({ shift: true, ctrl: true })).toBe('all');
  });
});

describe('barter screen lists', () => {
  it("shows Gus's stock with buying prices, and leaves his caps out", () => {
    const { theirs } = barterRows(customer(0), gus().inventory);
    // Sorted like every list: armour, aid, then ammo by name.
    expect(theirs).toEqual([
      { key: 'leather_jacket', label: 'Leather Jacket', detail: '300c' },
      { key: 'stimpak', label: 'Stimpak x2', detail: '210c' },
      { key: 'ammo_223', label: '.223 Rounds x20', detail: '5c' },
      { key: 'ammo_10mm', label: '10mm Rounds x40', detail: '3c' },
    ]);
  });

  it('shows your pack with selling prices, also without caps', () => {
    const player = customer(50);
    player.backpack.add('stimpak', 3);
    player.backpack.add('canteen');
    expect(barterRows(player, gus().inventory).yours).toEqual([
      { key: 'stimpak', label: 'Stimpak x3', detail: '70c' },
      { key: 'canteen', label: 'Canteen', detail: '4c' },
    ]);
  });

  it('shows both sides\' caps in the headers, and your carry weight', () => {
    const player = customer(120);
    const headers = barterHeaders(player, 'Gus', gus().inventory);
    expect(headers.yours).toBe(`YOU  (120 caps, ${player.carriedWeight}/${player.carryCapacity} lb)`);
    expect(headers.theirs).toBe('GUS  (300 caps)');
  });
});

describe('barter screen clicks', () => {
  it("buys one from Gus's list on a plain click", () => {
    const player = customer(1000);
    const shop = gus();
    expect(barterClick('theirs', player, shop.inventory, 'stimpak', PLAIN)).toMatchObject({ ok: true });
    expect(player.backpack.count('stimpak')).toBe(1);
    expect(shop.inventory.count('stimpak')).toBe(1);
    expect(barterRows(player, shop.inventory).theirs.find((r) => r.key === 'stimpak')?.label).toBe('Stimpak');
  });

  it('buys half the stack with Ctrl and all of it with Shift', () => {
    const player = customer(1000);
    const shop = gus();
    barterClick('theirs', player, shop.inventory, 'ammo_10mm', CTRL);
    expect(player.backpack.count('ammo_10mm')).toBe(20);
    barterClick('theirs', player, shop.inventory, 'ammo_10mm', SHIFT);
    expect(player.backpack.count('ammo_10mm')).toBe(40);
    // Sold out: the row is gone.
    expect(barterRows(player, shop.inventory).theirs.some((r) => r.key === 'ammo_10mm')).toBe(false);
  });

  it('sells from your list, for caps from Gus', () => {
    const player = customer(0);
    player.backpack.add('stimpak', 4);
    const shop = gus();
    expect(barterClick('yours', player, shop.inventory, 'stimpak', CTRL)).toMatchObject({
      ok: true,
      message: 'Sold 2 Stimpak for 140 caps.',
    });
    expect(player.backpack.count(CAPS)).toBe(140);
    expect(barterHeaders(player, 'Gus', shop.inventory).theirs).toBe('GUS  (160 caps)');
  });

  it('says why when a click does nothing', () => {
    const shop = new ItemContainer([['leather_jacket', 1]]);
    const broke = customer(5);
    const result = barterClick('theirs', broke, shop, 'leather_jacket', PLAIN);
    expect(result).toMatchObject({ ok: false, message: "You can't afford the Leather Jacket (300 caps)." });
    expect(shop.count('leather_jacket')).toBe(1);
  });
});

describe('barter screen details', () => {
  it("describes the selected item, with Gus's price to buy it", () => {
    const detail = barterDetail(customer(0), 'Gus', 'theirs', 'stimpak');
    expect(detail).toContain('STIMPAK');
    expect(detail).toContain('Heals 15 HP');
    expect(detail.split('\n').at(-1)).toBe('Gus sells it for 210 caps each.');
  });

  it('says what Gus would pay for one of yours', () => {
    expect(barterDetail(customer(0), 'Gus', 'yours', 'stimpak').split('\n').at(-1)).toBe('Gus pays 70 caps each.');
  });
});
