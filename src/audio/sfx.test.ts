import { describe, expect, it } from 'vitest';
import { isMuted, playSound, SOUND_NAMES, toggleMuted } from './sfx';

// Node has no Web Audio, so these only check the parts that don't make sound. The sounds
// themselves are rendered and measured in a real browser (see the README's Sound section).
describe('sound effects', () => {
  it('does nothing, without throwing, where there is no Web Audio', () => {
    for (const name of SOUND_NAMES) expect(() => playSound(name)).not.toThrow();
  });

  it('toggles mute', () => {
    const before = isMuted();
    toggleMuted();
    expect(isMuted()).toBe(!before);
    toggleMuted();
    expect(isMuted()).toBe(before);
  });

  it('has a sound for every attack type', () => {
    for (const sound of ['swing', 'punch', 'pistol', 'rifle', 'bite']) expect(SOUND_NAMES).toContain(sound);
  });
});
