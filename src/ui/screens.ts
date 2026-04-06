import { signal } from '@preact/signals';
import { selectedCommander } from '../game/game-state';
import { playSfx } from './sfx';
import { switchTrackForScreen } from './music';

export type ScreenName =
  | 'title'
  | 'commander-select'
  | 'hub'
  | 'doctrine'
  | 'council'
  | 'provinces'
  | 'node-map'
  | 'battle'
  | 'post-battle'
  | 'victory'
  | 'defeat';

const VALID_SCREENS: ScreenName[] = ['title', 'commander-select', 'hub', 'doctrine', 'council', 'provinces', 'node-map', 'battle', 'post-battle', 'victory', 'defeat'];
const REQUIRES_RUN: ScreenName[] = ['hub', 'doctrine', 'council', 'provinces', 'node-map', 'post-battle', 'victory', 'defeat'];

// Read initial screen from URL hash (e.g., #battle, #hub, #node-map)
function getInitialScreen(): ScreenName {
  const hash = window.location.hash.slice(1) as ScreenName;
  return VALID_SCREENS.includes(hash) ? hash : 'title';
}

export const currentScreen = signal<ScreenName>(getInitialScreen());
export const transitionState = signal<'idle' | 'exiting' | 'entering'>('idle');

function applyScreenDOM(screen: ScreenName): void {
  const appRoot = document.getElementById('app-root');
  const battleScreen = document.getElementById('battle-screen');

  if (screen === 'battle') {
    if (appRoot) appRoot.style.display = 'none';
    if (battleScreen) battleScreen.style.display = 'block';
  } else {
    if (appRoot) appRoot.style.display = 'block';
    if (battleScreen) battleScreen.style.display = 'none';
  }
}

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.slice(1) as ScreenName;
  const screen = VALID_SCREENS.includes(hash) ? hash : 'title';
  currentScreen.value = screen;
  applyScreenDOM(screen);
});

export function navigateTo(screen: ScreenName): void {
  playSfx('ui_navigate');

  if (REQUIRES_RUN.includes(screen) && !selectedCommander.value) {
    screen = 'title';
  }

  // Battle uses DOM toggle — keep instant
  if (screen === 'battle') {
    currentScreen.value = screen;
    window.location.hash = screen;
    applyScreenDOM(screen);
    switchTrackForScreen(screen);
    return;
  }

  // Guard against double-navigation
  if (transitionState.value !== 'idle') return;

  transitionState.value = 'exiting';
  window.setTimeout(() => {
    currentScreen.value = screen;
    window.location.hash = screen;
    applyScreenDOM(screen);
    switchTrackForScreen(screen);
    transitionState.value = 'entering';
    window.setTimeout(() => {
      transitionState.value = 'idle';
    }, 300);
  }, 200);
}
