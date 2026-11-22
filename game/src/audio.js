// All sound is synthesized with WebAudio: no audio files, no network. The context is
// created on the first user gesture (browsers block sound before one), and every effect is
// a short oscillator or noise envelope through one quiet master gain.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let lastStep = 0;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.14;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, gain, delay, slideTo) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime + (delay || 0);
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(gain || 0.5, t0 + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(amp);
    amp.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, gain, delay, lowpass) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime + (delay || 0);
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const amp = context.createGain();
    amp.gain.value = gain || 0.3;
    source.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    source.start(t0);
  }

  return {
    /** Call from any user gesture so later sounds are allowed. */
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
    },
    isMuted() {
      return muted;
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.5);
      tone(1318, 0.18, 'sine', 0.45, 0.08);
    },
    pebble() {
      noise(0.08, 0.5, 0, 3000);
      tone(1900, 0.05, 'square', 0.12);
    },
    suspicious() {
      tone(220, 0.16, 'triangle', 0.5, 0, 196);
      tone(196, 0.2, 'triangle', 0.4, 0.14);
    },
    alarm() {
      tone(520, 0.22, 'sawtooth', 0.35, 0, 780);
      tone(780, 0.22, 'sawtooth', 0.35, 0.2, 520);
      tone(520, 0.3, 'sawtooth', 0.3, 0.42, 780);
    },
    caught() {
      tone(160, 0.35, 'sawtooth', 0.5, 0, 70);
      noise(0.25, 0.4, 0, 500);
    },
    levelDone() {
      tone(523, 0.14, 'sine', 0.5);
      tone(659, 0.14, 'sine', 0.5, 0.12);
      tone(784, 0.22, 'sine', 0.5, 0.24);
    },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.25, 'sine', 0.45, i * 0.13));
    },
    footstep() {
      const now = performance.now();
      if (now - lastStep < 340) return;
      lastStep = now;
      noise(0.05, 0.16, 0, 700);
    },
  };
}
