// Procedural sound, WebAudio only — no audio files, no network.
// The context is created on the first player gesture (browsers block audio
// before that), and every effect is a short synthesized tone. M toggles mute.

let ctx = null;
let master = null;
let muted = false;
let lastHorn = 0;

function ensure() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  startWaves();
  return ctx;
}

export function unlockAudio() {
  ensure();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone({ freq = 440, freq2 = null, dur = 0.15, type = 'sine', vol = 0.2, when = 0 }) {
  const c = ensure();
  if (!c || !master) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freq2 !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq2), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// Gentle wave noise under everything, started once with the context.
function startWaves() {
  const c = ctx;
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  const g = c.createGain();
  g.gain.value = 0.045;
  // Slow swell: the gain breathes on a 6-second cycle.
  const lfo = c.createOscillator();
  lfo.frequency.value = 1 / 6;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain);
  lfoGain.connect(g.gain);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start();
  lfo.start();
}

export const sfx = {
  click() {
    tone({ freq: 1250, dur: 0.06, type: 'triangle', vol: 0.15 });
  },
  horn() {
    // A ship's foghorn, throttled so a busy harbour does not bellow nonstop.
    const now = performance.now();
    if (now - lastHorn < 2000) return;
    lastHorn = now;
    tone({ freq: 116, freq2: 110, dur: 0.7, type: 'sawtooth', vol: 0.12 });
    tone({ freq: 174, freq2: 165, dur: 0.7, type: 'sine', vol: 0.1 });
  },
  bossHorn() {
    // The Storm Galleon's horn: lower, longer and heavier than a ship's.
    tone({ freq: 82, freq2: 76, dur: 1.2, type: 'sawtooth', vol: 0.16 });
    tone({ freq: 123, freq2: 116, dur: 1.2, type: 'sine', vol: 0.12 });
    tone({ freq: 55, freq2: 52, dur: 1.4, type: 'triangle', vol: 0.12, when: 0.1 });
  },
  chime() {
    tone({ freq: 660, dur: 0.14, type: 'sine', vol: 0.2 });
    tone({ freq: 880, dur: 0.22, type: 'sine', vol: 0.2, when: 0.12 });
  },
  wrong() {
    tone({ freq: 220, freq2: 160, dur: 0.25, type: 'square', vol: 0.12 });
  },
  alarm() {
    tone({ freq: 440, dur: 0.16, type: 'square', vol: 0.18 });
    tone({ freq: 330, dur: 0.16, type: 'square', vol: 0.18, when: 0.18 });
    tone({ freq: 440, dur: 0.2, type: 'square', vol: 0.18, when: 0.36 });
  },
  levelUp() {
    tone({ freq: 523, dur: 0.12, type: 'triangle', vol: 0.18 });
    tone({ freq: 659, dur: 0.12, type: 'triangle', vol: 0.18, when: 0.11 });
    tone({ freq: 784, dur: 0.2, type: 'triangle', vol: 0.18, when: 0.22 });
  },
};
