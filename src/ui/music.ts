import { signal } from '@preact/signals';

let audio: HTMLAudioElement | null = null;
let started = false;
let currentTrackUrl: string | null = null;
let targetVolume = 0.4;

/** Reactive muted state for UI binding. Starts muted by default. */
export const musicMuted = signal(true);

/** Start the main theme loop. Safe to call multiple times — only plays once. */
export function startMusic(): void {
  if (started) return;
  started = true;
  currentTrackUrl = '/audio/main_theme.mp3';

  audio = new Audio(currentTrackUrl);
  audio.loop = true;
  audio.volume = targetVolume;
  audio.muted = musicMuted.value;
  audio.play().catch(() => {
    // Autoplay blocked — retry on next user interaction
    started = false;
    currentTrackUrl = null;
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
  targetVolume = Math.max(0, Math.min(1, v));
  if (audio) audio.volume = targetVolume;
}

/** Toggle mute on/off. */
export function toggleMute(): void {
  musicMuted.value = !musicMuted.value;
  if (audio) audio.muted = musicMuted.value;
}

/**
 * Crossfade from the current track to a new one over 500ms.
 * Creates a new Audio element and fades old → 0, new → targetVolume.
 */
export function playTrack(url: string): void {
  if (currentTrackUrl === url) return;
  currentTrackUrl = url;

  const oldAudio = audio;
  const newAudio = new Audio(url);
  newAudio.loop = true;
  newAudio.volume = 0;
  newAudio.muted = musicMuted.value;

  audio = newAudio;

  newAudio.play().catch(() => {});

  // Fade old out, new in over 500ms using 50ms intervals (10 steps)
  const FADE_DURATION = 500;
  const INTERVAL_MS = 50;
  const steps = FADE_DURATION / INTERVAL_MS;
  const oldStartVol = oldAudio ? oldAudio.volume : 0;
  const newTargetVol = targetVolume;
  let step = 0;

  const fade = setInterval(() => {
    step++;
    const t = step / steps;

    if (oldAudio) {
      oldAudio.volume = Math.max(0, oldStartVol * (1 - t));
    }
    newAudio.volume = Math.min(newTargetVol, newTargetVol * t);

    if (step >= steps) {
      clearInterval(fade);
      if (oldAudio) {
        oldAudio.pause();
        oldAudio.src = '';
      }
      newAudio.volume = newTargetVol;
    }
  }, INTERVAL_MS);
}

const SCREEN_TRACKS: Record<string, string | null> = {
  title: '/audio/main_theme.mp3',
  'commander-select': '/audio/main_theme.mp3',
  hub: '/audio/main_theme.mp3',
  battle: null, // music paused during battle (existing behavior)
  // all other screens: inherit current track (no change)
};

/**
 * Switch to the appropriate track for the given screen name.
 * If the screen maps to `null`, pauses music.
 * If the screen is not in the mapping, does nothing (inherits current track).
 */
export function switchTrackForScreen(screen: string): void {
  if (!(screen in SCREEN_TRACKS)) return;

  const trackUrl = SCREEN_TRACKS[screen];
  if (trackUrl === null) {
    pauseMusic();
    return;
  }

  if (!started) {
    startMusic();
    return;
  }

  playTrack(trackUrl);
}
