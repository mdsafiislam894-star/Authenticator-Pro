// Web Audio API Synthesizer — Real-time physical water-drop pop & subtle glass clicks
// 100% offline, zero audio asset downloads, ultra-lightweight & latency-free.

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx && (globalThis.AudioContext || globalThis.webkitAudioContext)) {
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Authentic wet liquid bubble pop with resonant harmonic tail
export function playDropletSound(settings = {}) {
  if (settings.sound === false) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Primary Oscillator: Fast upward liquid sweep
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(680, now);
    osc1.frequency.exponentialRampToValueAtTime(1750, now + 0.035);
    osc1.frequency.exponentialRampToValueAtTime(850, now + 0.08);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.22, now + 0.012);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.09);

    // Secondary Sub-Drop: Gives wet acoustic resonance
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1100, now + 0.01);
    osc2.frequency.exponentialRampToValueAtTime(1900, now + 0.045);
    osc2.frequency.exponentialRampToValueAtTime(1400, now + 0.09);

    gain2.gain.setValueAtTime(0.001, now + 0.01);
    gain2.gain.linearRampToValueAtTime(0.08, now + 0.025);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.01);
    osc2.stop(now + 0.1);
  } catch {
    // Ignore audio permission or autoplay restriction errors
  }
}

// Glass chime for completed operations
export function playSuccessChime(settings = {}) {
  if (settings.sound === false) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [987.77, 1318.51, 1760].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.06;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch {}
}

// Delicate glass tap for subtle navigation
export function playGlassTap(settings = {}) {
  if (settings.sound === false) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.04);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch {}
}

export function haptic(type = 'light') {
  if (!navigator.vibrate) return;
  try {
    if (type === 'light') navigator.vibrate(16);
    else if (type === 'success') navigator.vibrate([20, 35, 25]);
    else if (type === 'warning') navigator.vibrate([35, 50, 35]);
    else if (type === 'lock') navigator.vibrate([60, 40, 80]);
  } catch {}
}
