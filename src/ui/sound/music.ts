import { signal } from '@preact/signals';

const PLAYLIST: readonly string[] = [
  '/audio/main_theme.mp3',
  '/audio/Saffron_Morning (1).mp3',
  '/audio/Beneath_the_Banyan.mp3',
  '/audio/Titanium_Gravity.mp3',
];

const VOLUME = 0.35;

export const musicMuted = signal(true);

let audio: HTMLAudioElement | null = null;
let started = false;
let order: number[] = [];
let cursor = 0;

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildOrder(): void {
  order = shuffle(PLAYLIST.map((_, i) => i));
  cursor = 0;
}

function playCurrent(): void {
  if (!audio) return;
  audio.src = PLAYLIST[order[cursor]];
  audio.volume = VOLUME;
  audio.muted = musicMuted.value;
  audio.play().catch(() => {
    // Autoplay blocked — retry on first user interaction
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

function advance(): void {
  cursor++;
  if (cursor >= order.length) buildOrder();
  playCurrent();
}

export function startMusic(): void {
  if (started) return;
  started = true;

  buildOrder();

  audio = new Audio();
  audio.loop = false;
  audio.addEventListener('ended', advance);

  playCurrent();
}

export function toggleMusicMute(): void {
  musicMuted.value = !musicMuted.value;
  if (audio) audio.muted = musicMuted.value;
}

// Boot the music system on first user interaction (autoplay policy).
if (typeof document !== 'undefined') {
  const boot = () => {
    startMusic();
    document.removeEventListener('click', boot);
    document.removeEventListener('keydown', boot);
  };
  document.addEventListener('click', boot, { once: true });
  document.addEventListener('keydown', boot, { once: true });
}
