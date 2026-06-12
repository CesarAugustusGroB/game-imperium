import { signal } from '@preact/signals';

let ctx: AudioContext | null = null;

/** Lazy-init AudioContext on first user interaction. */
export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function readStored(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export const sfxMuted = signal(readStored('imperium.sfxMuted') === 'true');
export const sfxVolume = signal((() => {
  const v = Number(readStored('imperium.sfxVolume'));
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.7;
})());

/** Persist the audio preferences (called by the Options panel on change). */
export function persistAudioPrefs(): void {
  try {
    localStorage.setItem('imperium.sfxMuted', String(sfxMuted.value));
    localStorage.setItem('imperium.sfxVolume', String(sfxVolume.value));
  } catch { /* storage unavailable — session-only prefs */ }
}
