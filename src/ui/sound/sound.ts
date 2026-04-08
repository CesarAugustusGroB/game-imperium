import { signal } from '@preact/signals';

let ctx: AudioContext | null = null;

/** Lazy-init AudioContext on first user interaction. */
export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const sfxMuted = signal(false);
export const sfxVolume = signal(0.7);
