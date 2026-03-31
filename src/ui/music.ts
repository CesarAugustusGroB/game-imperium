import { signal } from '@preact/signals';

let audio: HTMLAudioElement | null = null;
let started = false;

/** Reactive muted state for UI binding. Starts muted by default. */
export const musicMuted = signal(true);

/** Start the main theme loop. Safe to call multiple times — only plays once. */
export function startMusic(): void {
  if (started) return;
  started = true;

  audio = new Audio('/audio/main_theme.mp3');
  audio.loop = true;
  audio.volume = 0.4;
  audio.muted = musicMuted.value;
  audio.play().catch(() => {
    // Autoplay blocked — retry on next user interaction
    started = false;
    const resume = () => {
      startMusic();
      document.removeEventListener('click', resume);
      document.removeEventListener('keydown', resume);
    };
    document.addEventListener('click', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
  });
}

/** Pause the music (e.g. during battle which has its own audio). */
export function pauseMusic(): void {
  audio?.pause();
}

/** Resume after pause. */
export function resumeMusic(): void {
  if (audio && started) {
    audio.play().catch(() => {});
  }
}

/** Set volume (0–1). */
export function setMusicVolume(v: number): void {
  if (audio) audio.volume = Math.max(0, Math.min(1, v));
}

/** Toggle mute on/off. */
export function toggleMute(): void {
  musicMuted.value = !musicMuted.value;
  if (audio) audio.muted = musicMuted.value;
}
