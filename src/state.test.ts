import { beforeEach, describe, expect, it } from 'vitest';
import { Combat } from './core/combat';
import { autosave, loadSavedGame, savedGameSummary, startNewGame, startTestArena, state, travelTo } from './state';

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
    expect(savedGameSummary()).toBe('Wanderer, level 2, Wasteland');

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

  it('travels to the forest and back, keeping each map as it was left', () => {
    const wasteland = state.map;
    const forest = travelTo('forest');
    expect(state.map).toBe(forest);
    expect(state.map.id).toBe('forest');
    // Arrived beside the exit that leads back.
    const back = forest.exits.find((e) => e.to === 'wasteland')!;
    expect(Math.abs(back.x - state.player.pos.x) + Math.abs(back.y - state.player.pos.y)).toBe(1);

    forest.chests[0].contents.clear();
    travelTo('wasteland');
    expect(state.map).toBe(wasteland);
    const returned = travelTo('forest');
    expect(returned).toBe(forest); // not regenerated
    expect(returned.chests[0].contents.isEmpty).toBe(true);
  });

  it('names the map the player is on in the save summary', () => {
    const forest = travelTo('forest');
    expect(savedGameSummary()).toBe(`Wanderer, level 1, ${forest.name}`);
  });

  it('forgets the old world on a new game', () => {
    travelTo('forest');
    const seed = state.worldSeed;
    startNewGame();
    expect(Object.keys(state.maps)).toEqual(['wasteland']);
    expect(state.worldSeed).not.toBe(seed);
  });

  it('restores the same generated forest on load', () => {
    const forest = travelTo('forest');
    forest.creatures[0].hitPoints = 0;
    const tiles = JSON.stringify(forest.tiles);
    autosave();
    state.player.pos = { x: 1, y: 1 };
    loadSavedGame();
    expect(state.map.id).toBe('forest');
    expect(JSON.stringify(state.map.tiles)).toBe(tiles);
    expect(state.map.creatures[0].isDead).toBe(true);
  });

  describe('test arena', () => {
    it('starts in sight of an enemy, so a fight begins on arrival', () => {
      startTestArena();
      expect(state.map.id).toBe('test_arena');
      expect(state.sandbox).toBe(true);
      expect(Combat.spotters(state.map, state.player).length).toBeGreaterThan(0);
      expect(state.player.maxActionPoints).toBe(10);
      expect(state.player.activeWeapon?.id).toBe('hunting_rifle'); // in hand, loaded
      expect(state.player.loadedRounds('primary')).toBe(5);
      expect(state.player.loadedRounds('secondary')).toBe(12); // the pistol comes loaded too
    });

    it('never touches the real save', () => {
      state.player.pos = { x: 10, y: 8 };
      autosave();
      const before = localStorage.getItem('wasteland.save');

      startTestArena();
      state.player.pos = { x: 3, y: 3 };
      autosave();
      travelTo('wasteland'); // travel autosaves too
      expect(localStorage.getItem('wasteland.save')).toBe(before);

      expect(loadSavedGame()).toBe(true); // leaving the arena goes back to the real game
      expect(state.sandbox).toBe(false);
      expect(state.player.pos).toEqual({ x: 10, y: 8 });
    });
  });

  it('starts a new game with a fresh map', () => {
    state.map.chests[0].opened = true;
    startNewGame();
    expect(state.map.chests[0].opened).toBe(false);
    expect(state.player.level).toBe(1);
    expect(state.combat).toBeNull();
  });
});
