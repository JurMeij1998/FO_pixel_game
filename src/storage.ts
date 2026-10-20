/**
 * The browser side of saving: one JSON blob in localStorage. Storage can be unavailable
 * (private windows, blocked site data), so every call fails quietly instead of crashing.
 */
const SAVE_KEY = 'wasteland.save';

export function readSave(): unknown {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function writeSave(data: unknown): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Nothing to do; the game just won't persist.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Same as above.
  }
}
