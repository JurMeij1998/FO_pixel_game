/**
 * The shiny green border shared by the AP gauge and the health bar: it pulses slowly between
 * its normal and a brighter green, and every few seconds a white glint sweeps diagonally
 * across it. Pure colour maths, so it can be tested; the callers draw the pixels.
 */

export const GLOW_COLOR = {
  border: 0x3cd070,
  /** The border's colour at the top of its pulse. */
  pulse: 0x9dffb0,
  /** The glint that sweeps across it. */
  shine: 0xffffff,
};

/** How long one slow pulse takes, and how often a glint sweeps across. */
export const PULSE_MS = 1600;
export const SHINE_EVERY_MS = 2600;
/** How long the glint takes to cross. */
export const SHINE_MS = 700;
/** How wide the glint is, in world pixels (multiply by the zoom for something drawn at 1:1). */
export const SHINE_WIDTH = 2.5;

/**
 * True while a glint is sweeping across; the rest of the time the whole border is one colour.
 * Both glows run on the game loop's clock, so the AP gauge and the health bar shine together.
 */
export function glintActive(time: number): boolean {
  return time % SHINE_EVERY_MS < SHINE_MS;
}

/** Blends two 0xRRGGBB colours; t = 0 gives a, t = 1 gives b. */
export function mixColor(a: number, b: number, t: number): number {
  const channel = (shift: number) => {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    return Math.round(from + (to - from) * t) << shift;
  };
  return channel(16) | channel(8) | channel(0);
}

/**
 * The border's colour, `time` ms in, for a pixel `diagonal` pixels along the diagonal (x + y,
 * measured from the border's top left corner) of a border whose diagonal is `span` long. The
 * glint is `width` pixels wide; scale it with the drawing's zoom.
 */
export function glowColor(time: number, diagonal: number, span: number, width: number): number {
  const pulse = (Math.sin((time / PULSE_MS) * Math.PI * 2) + 1) / 2;
  const base = mixColor(GLOW_COLOR.border, GLOW_COLOR.pulse, pulse * 0.75);
  if (!glintActive(time)) return base;
  const sinceShine = time % SHINE_EVERY_MS;
  // The glint's position along the diagonal, travelling from before the start to past the end.
  const sweep = -width + (sinceShine / SHINE_MS) * (span + 2 * width);
  const shine = Math.max(0, 1 - Math.abs(diagonal - sweep) / width);
  return mixColor(base, GLOW_COLOR.shine, shine);
}
