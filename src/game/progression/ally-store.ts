/**
 * Forged-ally store (plan S-L) — the simple diplomacy layer.
 *
 * Distinct from `npc-faction-store.ts` (the fixed 4-faction narrative-relation
 * system): these are alliances the player FORGES mid-run by casting treaty
 * decreta. Two kinds:
 *   • tribe   → pledges warriors (manpower): +iuniores each season
 *   • kingdom → pledges coin: +gold each season
 * Both count toward Augustus's "Web of Alliances" passive (one allied battle
 * contingent per forged ally). Acquired via the `gain-ally` decretum effect.
 */
import { signal, computed } from '@preact/signals';
import { addResource } from '../core/resources';

export type AllyKind = 'tribe' | 'kingdom';

export interface ForgedAlly {
  id: string;
  name: string;
  kind: AllyKind;
}

/** Per-season payout per ally. Tunable. */
export const ALLY_TRIBE_IUNIORES = 2;
export const ALLY_KINGDOM_GOLD = 2;

const TRIBE_NAMES = ['Helvetii', 'Aedui', 'Batavi', 'Cherusci', 'Treveri', 'Sequani'];
const KINGDOM_NAMES = ['Numidia', 'Armenia', 'Bosporus', 'Nabataea', 'Cappadocia', 'Pontus'];

// ── Signals ──

export const forgedAllies = signal<ForgedAlly[]>([]);

/** Number of forged alliances — drives Augustus's Web of Alliances passive. */
export const allyCount = computed(() => forgedAllies.value.length);

let _seq = 0;

/**
 * Forge a new alliance of the given kind, picking a themed name not already in
 * use (falls back to a numbered name if the pool is exhausted). Returns the ally.
 */
export function addAlly(kind: AllyKind): ForgedAlly {
  const pool = kind === 'tribe' ? TRIBE_NAMES : KINGDOM_NAMES;
  const used = new Set(forgedAllies.value.map((a) => a.name));
  const free = pool.filter((n) => !used.has(n));
  const name = free.length > 0
    ? free[Math.floor(Math.random() * free.length)]
    : `${kind === 'tribe' ? 'Tribe' : 'Kingdom'} ${forgedAllies.value.length + 1}`;
  const ally: ForgedAlly = { id: `ally_${kind}_${_seq++}`, name, kind };
  forgedAllies.value = [...forgedAllies.value, ally];
  return ally;
}

/**
 * Collect one season of ally income: each tribe pledges iuniores, each kingdom
 * pledges gold. Called once per season elapsed (see EndgameCard's season loop).
 */
export function collectAllyIncome(): { gold: number; iuniores: number } {
  let g = 0;
  let iun = 0;
  for (const a of forgedAllies.value) {
    if (a.kind === 'kingdom') { addResource('gold', ALLY_KINGDOM_GOLD); g += ALLY_KINGDOM_GOLD; }
    else { addResource('iuniores', ALLY_TRIBE_IUNIORES); iun += ALLY_TRIBE_IUNIORES; }
  }
  return { gold: g, iuniores: iun };
}

/** Replace the ally roster (used by save-restore). */
export function setForgedAllies(list: ForgedAlly[]): void {
  forgedAllies.value = list.map((a) => ({ ...a }));
}

/** Reset all forged alliances (new run / title return). */
export function resetAllies(): void {
  forgedAllies.value = [];
}
