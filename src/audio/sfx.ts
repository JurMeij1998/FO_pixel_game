import type { AttackSound } from '../core/fighter';
import { readSetting, writeSetting } from '../storage';

/**
 * Sound effects, synthesised with the Web Audio API so there are no audio files (just like
 * the textures in gfx/). Every sound is a few short bursts of filtered noise and tones, each
 * with a volume envelope: a near-instant attack followed by an exponential fade.
 */
export type SoundName =
  | AttackSound
  | 'stepGravel'
  | 'stepFloor'
  | 'creatureStep'
  | 'impact'
  | 'hurt'
  | 'ricochet'
  | 'creatureDeath'
  | 'playerDeath'
  | 'reload'
  | 'dryFire'
  | 'pickup'
  | 'equip'
  | 'stimpak'
  | 'chestOpen'
  | 'levelUp'
  | 'combatStart'
  | 'menuMove'
  | 'menuSelect';

const MASTER_VOLUME = 0.35;
const MUTED_SETTING = 'muted';

let context: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readSetting(MUTED_SETTING) === 'true';

export function playSound(name: SoundName, volume = 1): void {
  if (muted) return;
  const output = audioOutput();
  if (output) scheduleSound(output.context, output.master, name, volume);
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMuted(): void {
  muted = !muted;
  writeSetting(MUTED_SETTING, String(muted));
}

/** Schedules a sound to start now on any audio context; used directly by tests with an OfflineAudioContext. */
export function scheduleSound(ctx: BaseAudioContext, out: AudioNode, name: SoundName, volume = 1): void {
  SOUNDS[name](new Voice(ctx, out, volume));
}

/**
 * Browsers won't start audio until the player has clicked or pressed a key, and warn each time
 * a page tries. So until then, sounds are skipped (e.g. a fight that starts the moment the
 * test arena loads).
 */
let interacted = false;
if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'keydown']) {
    window.addEventListener(type, () => (interacted = true), { once: true, capture: true });
  }
}

/** The shared context, created on first use. Returns null where Web Audio isn't available (e.g. tests). */
function audioOutput(): { context: AudioContext; master: GainNode } | null {
  if (typeof AudioContext === 'undefined' || !interacted) return null;
  if (!context || !master) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = MASTER_VOLUME;
    // No compressor here: the browser's one reacts to a gunshot's first millisecond and then
    // squashes the rest of it. Instead the sounds are levelled so even a gunshot stays below clipping.
    master.connect(context.destination);
  }
  // A context can still start out suspended (some browsers); resuming is allowed after interaction.
  if (context.state === 'suspended') void context.resume();
  return { context, master };
}

interface NoiseOptions {
  /** Seconds from now. */
  at?: number;
  duration: number;
  volume: number;
  filter: BiquadFilterType;
  frequency: number;
  /** Sweeps the filter to this frequency over the duration. */
  endFrequency?: number;
  q?: number;
  /** Seconds to reach full volume; the default softens clicks, a smaller value hits harder. */
  attack?: number;
  /** Overdrives the burst for a harsher, more aggressive sound: 0 is clean, ~10 is heavily clipped. */
  drive?: number;
}

interface ToneOptions {
  at?: number;
  duration: number;
  volume: number;
  wave: OscillatorType;
  frequency: number;
  /** Slides the pitch to this frequency over the duration. */
  endFrequency?: number;
  attack?: number;
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Builds the parts of one sound on the audio graph. */
class Voice {
  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly out: AudioNode,
    private readonly volume: number,
  ) {}

  noise(o: NoiseOptions): void {
    const start = this.ctx.currentTime + (o.at ?? 0);
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer();
    const filter = this.ctx.createBiquadFilter();
    filter.type = o.filter;
    filter.Q.value = o.q ?? 1;
    filter.frequency.setValueAtTime(o.frequency, start);
    if (o.endFrequency) filter.frequency.exponentialRampToValueAtTime(o.endFrequency, start + o.duration);
    let signal: AudioNode = source.connect(filter);
    if (o.drive) signal = signal.connect(this.distortion(o.drive));
    signal.connect(this.envelope(start, o.duration, o.volume, o.attack));
    source.start(start);
    source.stop(start + o.duration);
  }

  tone(o: ToneOptions): void {
    const start = this.ctx.currentTime + (o.at ?? 0);
    const oscillator = this.ctx.createOscillator();
    oscillator.type = o.wave;
    oscillator.frequency.setValueAtTime(o.frequency, start);
    if (o.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(o.endFrequency, start + o.duration);
    oscillator.connect(this.envelope(start, o.duration, o.volume, o.attack));
    oscillator.start(start);
    oscillator.stop(start + o.duration);
  }

  /** A gain node that fades in over a few milliseconds and then decays to silence. */
  private envelope(start: number, duration: number, volume: number, attack = 0.004): GainNode {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume * this.volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(this.out);
    return gain;
  }

  /** A soft-clipping curve (tanh), which squares off loud peaks like an overdriven speaker. */
  private distortion(drive: number): WaveShaperNode {
    const shaper = this.ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
    }
    shaper.curve = curve;
    return shaper;
  }

  /** One second of white noise, made once per audio context and reused by every noise burst. */
  private noiseBuffer(): AudioBuffer {
    let buffer = noiseBuffers.get(this.ctx);
    if (!buffer) {
      buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      noiseBuffers.set(this.ctx, buffer);
    }
    return buffer;
  }
}

/** A random value within `amount` (as a fraction) of `value`, so repeated sounds don't sound identical. */
function vary(value: number, amount: number): number {
  return value * (1 + (Math.random() * 2 - 1) * amount);
}

/** A short high click: gun mechanics, buckles. */
function click(v: Voice, at = 0, volume = 0.4): void {
  v.noise({ at, duration: 0.025, volume, filter: 'highpass', frequency: 3000 });
}

/**
 * A gunshot in four layers, like a real one:
 *   crack  - the supersonic snap: very short, bright, hitting full volume within a millisecond
 *   punch  - the muzzle blast: overdriven mid-range noise, which is what makes it sound violent
 *   boom   - a low thump that drops in pitch
 *   tail   - the echo off the surroundings, fading out over `tail` seconds
 */
function gunshot(v: Voice, o: { punch: number; boom: number; tail: number }): void {
  // Levelled so the loudest gunshot peaks around 0.75 after the master volume: loud, but not clipping.
  v.noise({ duration: 0.04, volume: 0.7, filter: 'highpass', frequency: 2500, attack: 0.0005, drive: 6 });
  v.noise({ duration: o.punch, volume: 0.9, filter: 'bandpass', frequency: 1100, endFrequency: 500, q: 0.7, attack: 0.001, drive: 10 });
  v.tone({ duration: o.punch * 1.5, volume: 0.75, wave: 'sine', frequency: o.boom, endFrequency: 35, attack: 0.001 });
  v.noise({ at: 0.02, duration: o.tail, volume: 0.25, filter: 'lowpass', frequency: 1800, endFrequency: 250 });
}

const SOUNDS: Record<SoundName, (v: Voice) => void> = {
  // Movement
  stepGravel: (v) => {
    // A soft thud plus a handful of tiny random "grains" crunching underfoot.
    v.noise({ duration: 0.06, volume: 0.25, filter: 'lowpass', frequency: vary(400, 0.2) });
    const grains = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < grains; i++) {
      v.noise({
        at: Math.random() * 0.07,
        duration: vary(0.018, 0.4),
        volume: vary(0.55, 0.4),
        filter: 'bandpass',
        frequency: vary(3000, 0.5),
        q: vary(3, 0.3),
        attack: 0.001,
      });
    }
  },
  stepFloor: (v) => {
    // A harder, cleaner tap on concrete.
    v.noise({ duration: 0.05, volume: 0.4, filter: 'bandpass', frequency: vary(900, 0.15), q: 1.2, attack: 0.001 });
    v.tone({ duration: 0.04, volume: 0.2, wave: 'sine', frequency: vary(140, 0.1), endFrequency: 80 });
  },
  creatureStep: (v) => {
    // A light skitter: two quick taps.
    v.noise({ duration: 0.03, volume: 0.5, filter: 'bandpass', frequency: vary(1400, 0.2), q: 3 });
    v.noise({ at: 0.05, duration: 0.03, volume: 0.4, filter: 'bandpass', frequency: vary(1400, 0.2), q: 3 });
  },

  // Attacks
  // Band-passed noise carries little energy, so these need higher volumes than the gunshots to be heard.
  swing: (v) => v.noise({ duration: 0.16, volume: 1.4, filter: 'bandpass', frequency: 600, endFrequency: 2400, q: 1.5 }),
  punch: (v) => {
    v.noise({ duration: 0.1, volume: 1.2, filter: 'bandpass', frequency: 500, endFrequency: 1500, q: 1.5 });
    v.tone({ duration: 0.08, volume: 0.25, wave: 'sine', frequency: 120, endFrequency: 60 });
  },
  pistol: (v) => gunshot(v, { punch: 0.12, boom: 170, tail: 0.35 }),
  rifle: (v) => {
    gunshot(v, { punch: 0.2, boom: 120, tail: 0.8 });
    // A rifle is loud enough to throw back a distinct echo.
    v.noise({ at: 0.18, duration: 0.25, volume: 0.15, filter: 'bandpass', frequency: 700, q: 0.8 });
  },
  bite: (v) => {
    v.noise({ duration: 0.05, volume: 1.5, filter: 'bandpass', frequency: 1100, q: 4 });
    v.noise({ at: 0.07, duration: 0.05, volume: 1.3, filter: 'bandpass', frequency: 900, q: 4 });
    v.tone({ duration: 0.1, volume: 0.2, wave: 'sawtooth', frequency: 260, endFrequency: 110 });
  },

  // Results of attacks
  impact: (v) => {
    v.noise({ duration: 0.09, volume: 0.5, filter: 'lowpass', frequency: 800 });
    v.tone({ duration: 0.12, volume: 0.5, wave: 'sine', frequency: 110, endFrequency: 45 });
  },
  hurt: (v) => {
    SOUNDS.impact(v);
    v.tone({ duration: 0.15, volume: 0.12, wave: 'square', frequency: 330, endFrequency: 160 }); // a grunt
  },
  ricochet: (v) => v.tone({ at: 0.03, duration: 0.3, volume: 0.12, wave: 'sine', frequency: 2600, endFrequency: 1100 }),
  creatureDeath: (v) => {
    v.tone({ duration: 0.55, volume: 0.16, wave: 'sawtooth', frequency: 380, endFrequency: 55 });
    v.noise({ duration: 0.35, volume: 0.25, filter: 'lowpass', frequency: 500 });
  },
  playerDeath: (v) => {
    v.tone({ duration: 1, volume: 0.2, wave: 'sawtooth', frequency: 220, endFrequency: 40 });
    v.tone({ duration: 1, volume: 0.1, wave: 'square', frequency: 110, endFrequency: 30 });
  },

  // Guns and items
  reload: (v) => {
    click(v);
    v.noise({ at: 0.05, duration: 0.12, volume: 0.2, filter: 'bandpass', frequency: 1200, endFrequency: 600, q: 2 });
    click(v, 0.2, 0.5);
  },
  dryFire: (v) => click(v, 0, 0.35),
  pickup: (v) => {
    v.tone({ duration: 0.06, volume: 0.1, wave: 'square', frequency: 660 });
    v.tone({ at: 0.06, duration: 0.08, volume: 0.1, wave: 'square', frequency: 990 });
  },
  equip: (v) => {
    v.noise({ duration: 0.04, volume: 0.3, filter: 'bandpass', frequency: 2000, q: 2 });
    v.tone({ duration: 0.03, volume: 0.05, wave: 'square', frequency: 440 });
  },
  stimpak: (v) => {
    v.noise({ duration: 0.25, volume: 0.15, filter: 'highpass', frequency: 5000 }); // the hiss
    v.tone({ at: 0.2, duration: 0.12, volume: 0.06, wave: 'sine', frequency: 880, endFrequency: 1320 });
  },
  chestOpen: (v) => {
    click(v, 0, 0.3);
    v.tone({ at: 0.03, duration: 0.3, volume: 0.07, wave: 'sawtooth', frequency: 140, endFrequency: 210 }); // a creak
  },

  // Events and menus
  levelUp: (v) => {
    [523, 659, 784, 1047].forEach((frequency, i) => {
      v.tone({ at: i * 0.09, duration: i === 3 ? 0.3 : 0.09, volume: 0.16, wave: 'square', frequency });
    });
  },
  combatStart: (v) => {
    // Two slightly detuned low notes clash for an uneasy stab.
    v.tone({ duration: 0.5, volume: 0.14, wave: 'sawtooth', frequency: 98 });
    v.tone({ duration: 0.5, volume: 0.14, wave: 'sawtooth', frequency: 104 });
    v.noise({ duration: 0.3, volume: 0.3, filter: 'lowpass', frequency: 300 });
  },
  menuMove: (v) => v.tone({ duration: 0.03, volume: 0.06, wave: 'square', frequency: 880 }),
  menuSelect: (v) => v.tone({ duration: 0.09, volume: 0.08, wave: 'square', frequency: 660, endFrequency: 1320 }),
};

/** Every sound name, for tests. */
export const SOUND_NAMES = Object.keys(SOUNDS) as SoundName[];
