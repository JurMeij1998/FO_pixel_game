import { describe, expect, it } from 'vitest';
import { ListCursor } from './listCursor';

// Your pack on the left, a chest on the right.
const PACK = ['knife', 'stimpak', 'canteen'];
const CHEST = ['rope', 'ammo_10mm'];

describe('ListCursor', () => {
  it('starts on the first row of the column it is given', () => {
    const cursor = new ListCursor([PACK, CHEST], 1);
    expect(cursor.activeColumn).toBe(1);
    expect(cursor.selectedKey).toBe('rope');
  });

  it('starts in another column when the one it was given is empty', () => {
    const cursor = new ListCursor([PACK, []], 1);
    expect(cursor.activeColumn).toBe(0);
    expect(cursor.selectedKey).toBe('knife');
  });

  it('moves up and down a list, stopping at the ends', () => {
    const cursor = new ListCursor([PACK, CHEST]);
    expect(cursor.moveRow(1)).toBe(true);
    expect(cursor.selectedKey).toBe('stimpak');
    cursor.moveRow(1);
    expect(cursor.moveRow(1)).toBe(false); // already on the last row
    expect(cursor.selectedKey).toBe('canteen');
    cursor.moveRow(-5);
    expect(cursor.selectedKey).toBe('knife');
    expect(cursor.moveRow(-1)).toBe(false);
  });

  it('moves between the lists, back to the row it was on there', () => {
    const cursor = new ListCursor([PACK, CHEST]);
    cursor.moveRow(2); // canteen
    expect(cursor.moveColumn(1)).toBe(true);
    expect(cursor.selectedKey).toBe('rope');
    cursor.moveRow(1);
    cursor.moveColumn(-1);
    expect(cursor.selectedKey).toBe('canteen');
    cursor.moveColumn(1);
    expect(cursor.selectedKey).toBe('ammo_10mm');
  });

  it("doesn't move past the outer lists, nor into an empty one", () => {
    const cursor = new ListCursor([PACK, []]);
    expect(cursor.moveColumn(-1)).toBe(false);
    expect(cursor.moveColumn(1)).toBe(false);
    expect(cursor.activeColumn).toBe(0);
  });

  it('stays on the same item when the list changes around it', () => {
    const cursor = new ListCursor([PACK, CHEST]);
    cursor.moveRow(1); // stimpak
    cursor.update([['rope', 'knife', 'stimpak', 'canteen'], ['ammo_10mm']]); // the rope was stored first
    expect(cursor.selectedKey).toBe('stimpak');
    expect(cursor.selectedRow).toBe(2);
  });

  it('stays on the same spot when its item is gone, or the last one if that was the end', () => {
    const cursor = new ListCursor([PACK, CHEST]);
    cursor.moveRow(1); // stimpak, then used up
    cursor.update([['knife', 'canteen'], CHEST]);
    expect(cursor.selectedKey).toBe('canteen');
    cursor.update([['knife'], CHEST]); // canteen dropped: back to the last one
    expect(cursor.selectedKey).toBe('knife');
  });

  it('moves to the other list once its own has been emptied', () => {
    const cursor = new ListCursor([PACK, CHEST], 1);
    cursor.update([[...PACK, 'rope', 'ammo_10mm'], []]); // took everything
    expect(cursor.activeColumn).toBe(0);
    expect(cursor.selectedKey).not.toBeNull();
  });

  it('goes where a click puts it, and ignores rows that are not there', () => {
    const cursor = new ListCursor([PACK, CHEST]);
    cursor.focus(1, 'ammo_10mm');
    expect([cursor.activeColumn, cursor.selectedKey]).toEqual([1, 'ammo_10mm']);
    cursor.focus(0, 'rope'); // not in the pack
    expect([cursor.activeColumn, cursor.selectedKey]).toEqual([1, 'ammo_10mm']);
  });

  it('has no selection when every list is empty', () => {
    const cursor = new ListCursor([[], []]);
    expect(cursor.selectedKey).toBeNull();
    expect(cursor.moveRow(1)).toBe(false);
  });
});
