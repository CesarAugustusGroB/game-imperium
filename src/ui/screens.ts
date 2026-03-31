import { signal } from '@preact/signals';
import { selectedCommander } from '../game/game-state';

export type ScreenName =
  | 'title'
  | 'commander-select'
  | 'hub'
  | 'doctrine'
  | 'node-map'
  | 'battle'
  | 'post-battle'
  | 'victory'
  | 'defeat';

const VALID_SCREENS: ScreenName[] = ['title', 'commander-select', 'hub', 'doctrine', 'node-map', 'battle', 'post-battle', 'victory', 'defeat'];
const REQUIRES_RUN: ScreenName[] = ['hub', 'doctrine', 'node-map', 'post-battle', 'victory', 'defeat'];

// Read initial screen from URL hash (e.g., #battle, #hub, #node-map)
function getInitialScreen(): ScreenName {
  const hash = window.location.hash.slice(1) as ScreenName;
  return VALID_SCREENS.includes(hash) ? hash : 'title';
}

export const currentScreen = signal<ScreenName>(getInitialScreen());

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
  if (REQUIRES_RUN.includes(screen) && !selectedCommander.value) {
    screen = 'title';
  }

  currentScreen.value = screen;
  window.location.hash = screen;
  applyScreenDOM(screen);
}
