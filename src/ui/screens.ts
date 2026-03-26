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

export const currentScreen = signal<ScreenName>('title');

export function navigateTo(screen: ScreenName): void {
  currentScreen.value = screen;

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
