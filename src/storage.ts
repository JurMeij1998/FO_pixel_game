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

/** A small preference, such as whether sound is muted. */
export function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(`wasteland.${key}`);
  } catch {
    return null;
  }
}

export function writeSetting(key: string, value: string): void {
  try {
    localStorage.setItem(`wasteland.${key}`, value);
  } catch {
    // Not remembered, but still applies for this session.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Same as above.
  }
}
