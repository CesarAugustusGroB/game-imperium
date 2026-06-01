import { signal } from '@preact/signals';
import { selectedCommander } from '../game/core/game-state';
import { playSfx } from './sound/sfx';
import { activeForumTab } from './screens/forum/state';
import type { ForumTab } from './screens/forum/state';

export type ScreenName =
  | 'title'
  | 'commander-select'
  | 'forum'
  | 'hub'
  | 'iterbelli'
  | 'doctrine'
  | 'council'
  | 'provinces'
  | 'army-recruitment'
  | 'legate-hiring';

const VALID_SCREENS: ScreenName[] = ['title', 'commander-select', 'forum', 'hub', 'iterbelli', 'doctrine', 'council', 'provinces', 'army-recruitment', 'legate-hiring'];
const REQUIRES_RUN: ScreenName[] = ['forum', 'hub', 'iterbelli', 'doctrine', 'council', 'provinces', 'army-recruitment', 'legate-hiring'];

/**
 * Legacy screen → Forum tab. `hub` and the old per-section routes (`council`,
 * `provinces`, `doctrine`, `army-recruitment`, `legate-hiring`) now collapse
 * into the Forum shell with the corresponding tab active. This keeps deep
 * links (`#/council`, etc.) working during the S22 overhaul.
 */
const LEGACY_TAB_MAP: Partial<Record<ScreenName, ForumTab>> = {
  'hub':              'overview',
  'council':          'consilium',
  'provinces':        'provinciae',
  'doctrine':         'doctrinae',
  'army-recruitment': 'exercitus',
  'legate-hiring':    'exercitus',
};

/** Resolve a screen name to its real destination, applying legacy remapping. */
function resolveScreen(screen: ScreenName): ScreenName {
  const tab = LEGACY_TAB_MAP[screen];
  if (tab) {
    activeForumTab.value = tab;
    return 'forum';
  }
  return screen;
}

/**
 * Navigate to the Iter Belli campaign — the card-driven "march of war" launched
 * on Embark. A full-screen surface with its own resource bar (see App's
 * BARE_SCREENS). The campaign must already be seeded via startIterBelliCampaign.
 */
export function navigateToIterBelli(): void {
  navigateTo('iterbelli');
}

// Read initial screen from URL hash (e.g., #battle, #forum, #provinces).
// Legacy hashes like `#provinces` also resolve correctly: resolveScreen
// will rewrite them to `forum` and stamp the matching Forum tab so a
// bookmark from before S22 still lands the user in the right place.
function getInitialScreen(): ScreenName {
  const hash = window.location.hash.slice(1) as ScreenName;
  const requested = VALID_SCREENS.includes(hash) ? hash : 'title';
  return resolveScreen(requested);
}

export const currentScreen = signal<ScreenName>(getInitialScreen());
export const transitionState = signal<'idle' | 'exiting' | 'entering'>('idle');

function applyScreenDOM(_screen: ScreenName): void {
  const appRoot = document.getElementById('app-root');
  if (appRoot) appRoot.style.display = 'block';
}

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.slice(1) as ScreenName;
  const requested = VALID_SCREENS.includes(hash) ? hash : 'title';
  const screen = resolveScreen(requested);
  currentScreen.value = screen;
  applyScreenDOM(screen);
});

export function navigateTo(screen: ScreenName): void {
  if (REQUIRES_RUN.includes(screen) && !selectedCommander.value) {
    screen = 'title';
  }

  // Legacy routes collapse into the Forum shell with the right tab active.
  screen = resolveScreen(screen);

  // Guard against double-navigation
  if (transitionState.value !== 'idle') return;
  playSfx('ui_navigate');

  transitionState.value = 'exiting';
  window.setTimeout(() => {
    currentScreen.value = screen;
    window.location.hash = screen;
    applyScreenDOM(screen);
    transitionState.value = 'entering';
    window.setTimeout(() => {
      transitionState.value = 'idle';
    }, 300);
  }, 200);
}
