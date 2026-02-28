/**
 * Standalone page to test sounds.
 * Visit /reveal-sound-test when dev server is running.
 */
import { useEffect, useState } from 'react';
import * as Tone from 'tone';
import { playSparkleSound } from './audioUtils';

async function playRevealSound() {
  const now = Tone.now();
  const hitInterval = 0.045;
  const hitDuration = 0.055;
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
  const vol = new Tone.Volume(-22);

  synth.chain(filter, vol, Tone.getDestination());
  noiseSynth.chain(filter, vol, Tone.getDestination());

  notes.forEach((note, i) => {
    const t = now + i * hitInterval;
    synth.triggerAttackRelease(note, hitDuration, t, 0.75);
    noiseSynth.triggerAttackRelease(hitDuration * 0.6, t, 0.25);
  });
}

export default function RevealSoundTest() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Tone.start().then(() => {
      setReady(true);
    });
  }, []);

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Sound Test</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
        <div>
          <p style={{ marginBottom: 8 }}>Reveal sound (result screen):</p>
          <button
            onClick={() => { if (ready) playRevealSound(); }}
            disabled={!ready}
            style={{ padding: 12, fontSize: 18, cursor: ready ? 'pointer' : 'not-allowed' }}
          >
            {ready ? 'Play Reveal Sound' : 'Loading...'}
          </button>
        </div>
        <div>
          <p style={{ marginBottom: 8 }}>Sparkle sound (random idea button):</p>
          <button
            onClick={() => { if (ready) playSparkleSound({ current: null }); }}
            disabled={!ready}
            style={{ padding: 12, fontSize: 18, cursor: ready ? 'pointer' : 'not-allowed' }}
          >
            {ready ? 'Play Sparkle Sound' : 'Loading...'}
          </button>
        </div>
      </div>
    </div>
  );
}
