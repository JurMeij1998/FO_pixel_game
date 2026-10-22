/**
 * Lets a held key's auto-repeat through only once that key has been pressed afresh on this
 * screen. A key still held from the map (walking up to a chest holding S) sends repeats into
 * the screen that just opened; those shouldn't scroll its list. Pure, so it can be tested.
 */
export class RepeatGuard {
  private readonly pressedHere = new Set<string>();

  /** Whether to act on a keydown of `key`; `repeat` is the event's auto-repeat flag. */
  allow(key: string, repeat: boolean): boolean {
    if (!repeat) {
      this.pressedHere.add(key);
      return true;
    }
    return this.pressedHere.has(key);
  }
}
