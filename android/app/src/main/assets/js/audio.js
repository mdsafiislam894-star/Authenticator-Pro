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

export function playDropletSound(settings = {}) {
  if (settings.sound === false) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Oscillator 1: High bubble pop frequency ramp
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Authentic liquid pop: fast upward glide then quick damping
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1450, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // Ignore audio permission or autoplay restriction errors
  }
}

export function playSuccessChime(settings = {}) {
  if (settings.sound === false) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.07;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.2);
    });
  } catch {}
}

export function haptic(type = 'light') {
  if (!navigator.vibrate) return;
  try {
    if (type === 'light') navigator.vibrate(18);
    else if (type === 'success') navigator.vibrate([20, 40, 30]);
    else if (type === 'warning') navigator.vibrate([40, 60, 40]);
  } catch {}
}
