import { signal } from '@preact/signals';

export type ScreenName =
  | 'title'
  | 'commander-select'
  | 'hub'
  | 'node-map'
  | 'battle'
  | 'post-battle'
  | 'victory'
  | 'defeat';

// Read initial screen from URL hash (e.g., #battle, #hub, #node-map)
function getInitialScreen(): ScreenName {
  const hash = window.location.hash.slice(1) as ScreenName;
  const valid: ScreenName[] = ['title', 'commander-select', 'hub', 'node-map', 'battle', 'post-battle', 'victory', 'defeat'];
  return valid.includes(hash) ? hash : 'title';
}

export const currentScreen = signal<ScreenName>(getInitialScreen());

export function navigateTo(screen: ScreenName): void {
  currentScreen.value = screen;
  window.location.hash = screen;

  // Toggle DOM visibility: battle uses Canvas, everything else uses Preact
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
