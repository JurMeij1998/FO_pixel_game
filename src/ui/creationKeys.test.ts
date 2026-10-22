import { afterEach, describe, expect, it } from 'vitest';
import { creationKeyAction, isTextEntry, setTextEntry } from './creationKeys';

describe('creation screen keys', () => {
  afterEach(() => setTextEntry(false));

  it('moves and changes values with the arrows on any row', () => {
    for (const onName of [true, false]) {
      expect(creationKeyAction(onName, { key: 'ArrowUp' })).toEqual({ kind: 'move', delta: -1 });
      expect(creationKeyAction(onName, { key: 'ArrowDown' })).toEqual({ kind: 'move', delta: 1 });
      expect(creationKeyAction(onName, { key: 'ArrowLeft' })).toEqual({ kind: 'adjust', delta: -1 });
      expect(creationKeyAction(onName, { key: 'ArrowRight' })).toEqual({ kind: 'adjust', delta: 1 });
    }
  });

  it('uses W/S/A/D like the arrows, except on the name row where they are letters', () => {
    expect(creationKeyAction(false, { key: 'w' })).toEqual({ kind: 'move', delta: -1 });
    expect(creationKeyAction(false, { key: 'S' })).toEqual({ kind: 'move', delta: 1 });
    expect(creationKeyAction(false, { key: 'a' })).toEqual({ kind: 'adjust', delta: -1 });
    expect(creationKeyAction(false, { key: 'd' })).toEqual({ kind: 'adjust', delta: 1 });
    expect(creationKeyAction(true, { key: 'W' })).toEqual({ kind: 'type', char: 'W' });
    expect(creationKeyAction(true, { key: 'd' })).toEqual({ kind: 'type', char: 'd' });
  });

  it('types and erases only on the name row', () => {
    expect(creationKeyAction(true, { key: 'm' })).toEqual({ kind: 'type', char: 'm' });
    expect(creationKeyAction(true, { key: 'Backspace' })).toEqual({ kind: 'erase' });
    expect(creationKeyAction(false, { key: 'm' })).toEqual({ kind: 'none' });
    expect(creationKeyAction(false, { key: 'Backspace' })).toEqual({ kind: 'none' });
  });

  it('confirms with Enter, but not while it is held', () => {
    expect(creationKeyAction(false, { key: 'Enter' })).toEqual({ kind: 'confirm' });
    expect(creationKeyAction(true, { key: 'Enter', repeat: true })).toEqual({ kind: 'none' });
  });

  it('goes back with Esc', () => {
    expect(creationKeyAction(true, { key: 'Escape' })).toEqual({ kind: 'back' });
  });

  it('leaves browser shortcuts alone', () => {
    expect(creationKeyAction(true, { key: 'r', ctrlKey: true })).toEqual({ kind: 'none' });
    expect(creationKeyAction(true, { key: 'v', metaKey: true })).toEqual({ kind: 'none' });
    expect(creationKeyAction(false, { key: 'ArrowDown', altKey: true })).toEqual({ kind: 'none' });
  });

  it('remembers whether a text field has the keyboard', () => {
    expect(isTextEntry()).toBe(false);
    setTextEntry(true);
    expect(isTextEntry()).toBe(true);
  });
});
