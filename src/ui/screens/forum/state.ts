import { signal } from '@preact/signals';

export type ForumTab =
  | 'overview'
  | 'provinciae'
  | 'consilium'
  | 'exercitus'
  | 'bellum'
  | 'mercator'
  | 'doctrinae'
  | 'decreta';

export const FORUM_TABS: readonly ForumTab[] = [
  'overview', 'provinciae', 'consilium', 'exercitus', 'bellum', 'mercator', 'doctrinae', 'decreta',
] as const;

export const activeForumTab = signal<ForumTab>('overview');
export const sidebarCollapsed = signal(false);

export function setForumTab(tab: ForumTab): void {
  activeForumTab.value = tab;
  if (tab === 'bellum') sidebarCollapsed.value = true;
}


/**
 * Derive a Roman-ish calendar label from the current turn.
 * Pure flavor — no new game state. Season cycles Hiems/Ver/Aestas/Auctumnus;
 * year counts up from 712 AUC (the design prototype's anchor) at one year
 * per full seasonal cycle.
 */
export function romanCalendar(turn: number): { season: string; year: string } {
  const SEASONS = ['Hiems', 'Ver', 'Aestas', 'Auctumnus'];
  const season = SEASONS[((turn % 4) + 4) % 4];
  const year = 712 + Math.floor(turn / 4);
  return { season, year: toRoman(year) + ' AUC' };
}

function toRoman(n: number): string {
  const pairs: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let rest = Math.max(0, Math.floor(n));
  for (const [value, numeral] of pairs) {
    while (rest >= value) { out += numeral; rest -= value; }
  }
  return out;
}
