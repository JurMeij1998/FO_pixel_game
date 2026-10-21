import { describe, expect, it } from 'vitest';
import { GLOW_COLOR, glowColor, mixColor, PULSE_MS, SHINE_EVERY_MS, SHINE_MS } from './glow';

const green = (color: number) => (color >> 8) & 0xff;

describe('glow', () => {
  it('blends colours channel by channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x000000, 0x204060, 0.5)).toBe(0x102030);
  });

  it('pulses between the border green and a brighter green, outside the glint', () => {
    const quiet = SHINE_MS + 10; // after a glint has passed
    const low = glowColor(quiet + (3 * PULSE_MS) / 4 - (quiet % PULSE_MS), 0, 100, 5);
    const high = glowColor(quiet + PULSE_MS / 4 - (quiet % PULSE_MS) + PULSE_MS, 0, 100, 5);
    expect(green(high)).toBeGreaterThan(green(low));
    expect(green(low)).toBeGreaterThanOrEqual(green(GLOW_COLOR.border));
  });

  it('sweeps a white glint along the diagonal while it shines', () => {
    const middle = SHINE_EVERY_MS * 3 + SHINE_MS / 2; // halfway through a glint
    const span = 100;
    const atGlint = glowColor(middle, span / 2, span, 5);
    const farFromIt = glowColor(middle, 0, span, 5);
    expect(atGlint).toBe(GLOW_COLOR.shine);
    expect(farFromIt).not.toBe(GLOW_COLOR.shine);
  });

  it("is the same for every pixel when there's no glint", () => {
    const between = SHINE_EVERY_MS * 2 + SHINE_MS + 100;
    expect(glowColor(between, 0, 100, 5)).toBe(glowColor(between, 90, 100, 5));
  });
});
