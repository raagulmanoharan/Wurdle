/**
 * ASMR-style audio effects using Web Audio API
 */

/**
 * Tight crunchy typing sound - short noise burst through bandpass
 */
export function playTypingSound(ctxRef: { current: AudioContext | null }): void {
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
 * Reveal sound: typing sound in a very short burst, mimic a zip
 */
export function playRevealSound(ctxRef: { current: AudioContext | null }): void {
  const ZIP_INTERVAL = 35;
  const ZIP_COUNT = 6;
  let i = 0;
  const run = () => {
    if (i >= ZIP_COUNT) return;
    playTypingSound(ctxRef);
    i++;
    setTimeout(run, ZIP_INTERVAL);
  };
  run();
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
  onTick?: () => void
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
      playTypingSound(ctxRef);
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
