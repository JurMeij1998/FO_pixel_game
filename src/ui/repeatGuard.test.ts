import { describe, expect, it } from 'vitest';
import { RepeatGuard } from './repeatGuard';

describe('RepeatGuard', () => {
  it('ignores the repeats of a key held over from before the screen opened', () => {
    const guard = new RepeatGuard();
    expect(guard.allow('S', true)).toBe(false);
    expect(guard.allow('S', true)).toBe(false);
  });

  it('lets a key repeat once it has been pressed on this screen', () => {
    const guard = new RepeatGuard();
    expect(guard.allow('S', false)).toBe(true);
    expect(guard.allow('S', true)).toBe(true); // holding it to scroll
  });

  it('tracks each key separately', () => {
    const guard = new RepeatGuard();
    guard.allow('W', false);
    expect(guard.allow('W', true)).toBe(true);
    expect(guard.allow('S', true)).toBe(false);
  });
});
