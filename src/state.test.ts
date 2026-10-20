import { beforeEach, describe, expect, it } from 'vitest';
import { autosave, loadSavedGame, savedGameSummary, startNewGame, state } from './state';

// Tests run in Node, which has no localStorage: give it a minimal in-memory one.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => void store.set(key, value),
  removeItem: (key) => void store.delete(key),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

describe('game state', () => {
  beforeEach(() => {
    store.clear();
    startNewGame();
  });

  it('has no saved game until something is saved', () => {
    expect(savedGameSummary()).toBeNull();
    expect(loadSavedGame()).toBe(false);
  });

  it('loads what was autosaved, replacing the running game', () => {
    state.player.gainExperience(100);
    state.player.pos = { x: 10, y: 8 };
    autosave();
    expect(savedGameSummary()).toBe('Wanderer, level 2');

    state.player.pos = { x: 1, y: 1 }; // unsaved change
    expect(loadSavedGame()).toBe(true);
    expect(state.player.pos).toEqual({ x: 10, y: 8 });
    expect(state.loadedFromSave).toBe(true);
  });

  it('throws the save away on a new game', () => {
    autosave();
    startNewGame();
    expect(savedGameSummary()).toBeNull();
  });

  it("doesn't autosave during combat", () => {
    autosave();
    state.player.pos = { x: 3, y: 3 };
    state.combat = {} as typeof state.combat; // any combat in progress
    autosave();
    state.combat = null;
    loadSavedGame();
    expect(state.player.pos).not.toEqual({ x: 3, y: 3 });
  });

  it('starts a new game with a fresh map', () => {
    state.map.chests[0].opened = true;
    startNewGame();
    expect(state.map.chests[0].opened).toBe(false);
    expect(state.player.level).toBe(1);
    expect(state.combat).toBeNull();
  });
});
