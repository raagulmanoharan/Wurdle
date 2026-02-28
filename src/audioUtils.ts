/**
 * Audio effects: Web Audio API for typing/scramble, Tone.js for reveal
 */
import * as Tone from 'tone';

/**
 * Tight crunchy typing sound - short noise burst through bandpass
 */
export function playTypingSound(ctxRef: { current: AudioContext | null }, enabled = true): void {
  if (!enabled) return;
  try {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    // Tight crunchy thock: short noise burst, fast decay, higher Q
    const bufferSize = ctx.sampleRate * 0.025;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.08));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400 + Math.random() * 600;
    bp.Q.value = 4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.025);
  } catch {
    // Silently ignore audio errors
  }
}

/**
 * Reveal sound: individual hits in C major. Saw + noise per hit, filtered.
 * Each note = distinct punchy hit.
 * Uses shared ctxRef so mobile (iOS) plays correctly - same context as typing/scramble.
 */
export async function playRevealSound(ctxRef: { current: AudioContext | null }, enabled = true): Promise<void> {
  if (!enabled) return;
  try {
    // Use same context as typing/scramble - critical for mobile (iOS requires user-unlocked context)
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    Tone.setContext(ctx);
    await Tone.start();

    const now = Tone.now();
    const hitInterval = 0.045;
    const hitDuration = 0.055;

    // C major arpeggio
    const notes = ['C4', 'E4', 'G4', 'C5'];

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: {
        attack: 0.001,
        decay: 0.025,
        sustain: 0,
        release: 0.035,
      },
    });

    const noiseSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.02 },
    });

    const filter = new Tone.Filter({ frequency: 1400, type: 'bandpass', Q: 4 });
    // Match loading sound level: typing peaks ~0.05 (~-26 dB)
    const vol = new Tone.Volume(-22);

    synth.chain(filter, vol, Tone.getDestination());
    noiseSynth.chain(filter, vol, Tone.getDestination());

    notes.forEach((note, i) => {
      const t = now + i * hitInterval;
      synth.triggerAttackRelease(note, hitDuration, t, 0.75);
      noiseSynth.triggerAttackRelease(hitDuration * 0.6, t, 0.25);
    });
  } catch {
    // Silently ignore audio errors
  }
}

/**
 * Sparkle sound: jitter with sharp chirps for random idea button.
 * Quick percussive bursts with tonal chirps.
 */
export async function playSparkleSound(ctxRef: { current: AudioContext | null }, enabled = true): Promise<void> {
  if (!enabled) return;
  try {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    Tone.setContext(ctx);
    await Tone.start();

    const now = Tone.now();
    const chirpNotes = ['E6', 'G6', 'B6', 'E7', 'G7'];
    const jitter = () => (Math.random() - 0.5) * 0.02;

    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.018,
        sustain: 0,
        release: 0.012,
      },
    });

    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.012, sustain: 0, release: 0.008 },
    });

    const chirpFilter = new Tone.Filter({ frequency: 2800, type: 'bandpass', Q: 6 });
    const noiseFilter = new Tone.Filter({ frequency: 4000, type: 'bandpass', Q: 4 });
    const vol = new Tone.Volume(-18);

    synth.chain(chirpFilter, vol, Tone.getDestination());
    noise.chain(noiseFilter, vol, Tone.getDestination());

    let t = now;
    chirpNotes.forEach((note, i) => {
      synth.triggerAttackRelease(note, 0.025, t, 0.7 - i * 0.08);
      noise.triggerAttackRelease(0.015, t, 0.25);
      t += 0.032 + jitter();
    });
  } catch {
    // Silently ignore audio errors
  }
}

type ScrambleSoundHandle = { stop: () => void };

/** Interval curve: start tight (ms), end spacier. Used by both sound and animation. */
export function getScrambleInterval(progress: number): number {
  const minDelay = 50 + progress * 300;
  const maxDelay = 90 + progress * 410;
  return minDelay + Math.random() * (maxDelay - minDelay);
}

/**
 * Loading sound: same as typing sound (tight crunchy thock) but repeating.
 * Intervals start very small and get spacier as loading progresses.
 * onTick is called in sync with each sound for animation.
 */
export function startScrambleSound(
  ctxRef: { current: AudioContext | null },
  onTick?: () => void,
  soundEnabled = true
): ScrambleSoundHandle {
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const startTime = Date.now();
  const expectedDuration = 20000; // used only for progress curve

  const stop = () => {
    stopped = true;
    if (timeoutId) clearTimeout(timeoutId);
  };

  const getProgress = () => Math.min((Date.now() - startTime) / expectedDuration, 1);

  const scheduleNext = () => {
    if (stopped) return;
    onTick?.();
    try {
      if (soundEnabled) playTypingSound(ctxRef);
    } catch {
      // ignore
    }
    const progress = getProgress();
    const delay = getScrambleInterval(progress);
    timeoutId = setTimeout(scheduleNext, delay);
  };

  scheduleNext();
  return { stop };
}
