/**
 * What a key press does on the character creation screen. Pure, so it can be tested; the scene
 * carries the action out. On the name row you type, so W/S/A/D are letters there and only the
 * arrow keys move on; elsewhere W/S/A/D move and change values like the arrows.
 */
export type CreationKeyAction =
  | { kind: 'back' }
  | { kind: 'confirm' }
  | { kind: 'move'; delta: number }
  | { kind: 'adjust'; delta: number }
  | { kind: 'erase' }
  | { kind: 'type'; char: string }
  | { kind: 'none' };

export interface CreationKey {
  key: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

export function creationKeyAction(onName: boolean, event: CreationKey): CreationKeyAction {
  // Shortcuts (Ctrl+R, Alt+Tab...) belong to the browser, not to the name.
  if (event.ctrlKey || event.altKey || event.metaKey) return { kind: 'none' };
  const key = event.key;
  const letter = key.length === 1 ? key.toLowerCase() : '';
  if (key === 'Escape') return { kind: 'back' };
  // Holding Enter shouldn't race down the rows and start the game.
  if (key === 'Enter') return event.repeat ? { kind: 'none' } : { kind: 'confirm' };
  if (key === 'ArrowUp' || (!onName && letter === 'w')) return { kind: 'move', delta: -1 };
  if (key === 'ArrowDown' || (!onName && letter === 's')) return { kind: 'move', delta: 1 };
  if (key === 'ArrowLeft' || (!onName && letter === 'a')) return { kind: 'adjust', delta: -1 };
  if (key === 'ArrowRight' || (!onName && letter === 'd')) return { kind: 'adjust', delta: 1 };
  if (onName && key === 'Backspace') return { kind: 'erase' };
  if (onName && key.length === 1) return { kind: 'type', char: key };
  return { kind: 'none' };
}

/**
 * Whether a text field has the keyboard, so global shortcuts (M for mute) leave the keys alone.
 * Set by the creation screen while its name row is selected.
 */
let textEntry = false;

export function setTextEntry(active: boolean): void {
  textEntry = active;
}

export function isTextEntry(): boolean {
  return textEntry;
}
