/**
 * The keyboard cursor on a screen with lists side by side (your pack and a chest, your pack
 * and a trader's stock, your backpack and your equipment): which column it's in and which row
 * of each. Pure, so it can be tested; the scenes bind it to keys (W/S, A/D) and draw it.
 *
 * It remembers a row by its key, so when a list changes (an item taken out) it stays on the
 * same item if that's still there, and otherwise on the same spot.
 */
export class ListCursor {
  private column: number;
  private lists: ReadonlyArray<readonly string[]>;
  private readonly rows: number[];
  private readonly keys: Array<string | null>;

  constructor(lists: ReadonlyArray<readonly string[]>, startColumn = 0) {
    this.lists = lists;
    this.rows = lists.map(() => 0);
    this.keys = lists.map((list) => list[0] ?? null);
    this.column = startColumn;
    if ((lists[startColumn]?.length ?? 0) === 0) this.moveColumn(1) || this.moveColumn(-1);
  }

  /** The column the cursor is in. */
  get activeColumn(): number {
    return this.column;
  }

  /** The key of the row the cursor is on, or null if its column is empty. */
  get selectedKey(): string | null {
    return this.lists[this.column]?.[this.rows[this.column]] ?? null;
  }

  /** The row the cursor is on in its column. */
  get selectedRow(): number {
    return this.rows[this.column];
  }

  /**
   * Takes the lists as they are now: the cursor stays on the same item, or the same spot. If
   * its column has emptied (the last item taken out of a chest), it moves to one that hasn't.
   */
  update(lists: ReadonlyArray<readonly string[]>): void {
    this.lists = lists;
    lists.forEach((list, column) => {
      const found = this.keys[column] === null ? -1 : list.indexOf(this.keys[column]!);
      this.rows[column] = found >= 0 ? found : Math.max(0, Math.min(this.rows[column], list.length - 1));
      this.keys[column] = list[this.rows[column]] ?? null;
    });
    if ((lists[this.column]?.length ?? 0) === 0) this.moveColumn(1) || this.moveColumn(-1);
  }

  /** Moves up (-1) or down (+1) its column, stopping at the ends. Returns whether it moved. */
  moveRow(delta: number): boolean {
    const length = this.lists[this.column]?.length ?? 0;
    const row = Math.max(0, Math.min(length - 1, this.rows[this.column] + delta));
    if (length === 0 || row === this.rows[this.column]) return false;
    this.rows[this.column] = row;
    this.keys[this.column] = this.lists[this.column][row];
    return true;
  }

  /**
   * Moves to the next column to the left (-1) or right (+1) that has something in it, back to
   * the row it was on there. Returns whether it moved.
   */
  moveColumn(delta: number): boolean {
    for (let column = this.column + delta; column >= 0 && column < this.lists.length; column += delta) {
      if (this.lists[column].length > 0) {
        this.column = column;
        return true;
      }
    }
    return false;
  }

  /** Puts the cursor on a particular row, e.g. one that was clicked. */
  focus(column: number, key: string): void {
    const row = this.lists[column]?.indexOf(key) ?? -1;
    if (row < 0) return;
    this.column = column;
    this.rows[column] = row;
    this.keys[column] = key;
  }
}
