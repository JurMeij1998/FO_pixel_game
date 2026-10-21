import { describe, expect, it } from 'vitest';
import { glintActive, GLOW_COLOR, glowColor, mixColor, PULSE_MS, SHINE_EVERY_MS, SHINE_MS } from './glow';

const green = (color: number) => (color >> 8) & 0xff;

describe('glow', () => {
  it('blends colours channel by channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x000000, 0x204060, 0.5)).toBe(0x102030);
  });

  it('pulses between the border green and a brighter green, outside the glint', () => {
    // The pulse is a sine: lowest three quarters of the way through a period, highest a quarter in.
    const low = (3 * PULSE_MS) / 4; // 1200 ms: no glint then (it runs 0-700 of every 2600)
    const high = PULSE_MS + PULSE_MS / 4; // 2000 ms: no glint either
    expect(glintActive(low) || glintActive(high)).toBe(false);
    expect(green(glowColor(high, 0, 100, 5))).toBeGreaterThan(green(glowColor(low, 0, 100, 5)));
    expect(glowColor(low, 0, 100, 5)).toBe(GLOW_COLOR.border);
  });

  it('sweeps a white glint along the diagonal while it shines', () => {
    const middle = SHINE_EVERY_MS * 3 + SHINE_MS / 2; // halfway through a glint
    const span = 100;
    const atGlint = glowColor(middle, span / 2, span, 5);
    const farFromIt = glowColor(middle, 0, span, 5);
    expect(atGlint).toBe(GLOW_COLOR.shine);
    expect(farFromIt).not.toBe(GLOW_COLOR.shine);
  });

  it('travels the glint from the start of the border to past its end', () => {
    const glint = SHINE_EVERY_MS * 3;
    const span = 100;
    const brightestAt = (t: number) => {
      let best = 0;
      for (let d = 1; d <= span; d++) if (glowColor(t, d, span, 5) > glowColor(t, best, span, 5)) best = d;
      return best;
    };
    expect(brightestAt(glint + SHINE_MS * 0.1)).toBeLessThan(span * 0.2);
    expect(brightestAt(glint + SHINE_MS * 0.9)).toBeGreaterThan(span * 0.8);
  });

  it('only glints part of the time', () => {
    expect(glintActive(SHINE_EVERY_MS * 5 + 10)).toBe(true);
    expect(glintActive(SHINE_EVERY_MS * 5 + SHINE_MS + 10)).toBe(false);
  });

  it("is the same for every pixel when there's no glint", () => {
    const between = SHINE_EVERY_MS * 2 + SHINE_MS + 100;
    expect(glowColor(between, 0, 100, 5)).toBe(glowColor(between, 90, 100, 5));
  });
});
