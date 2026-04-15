import type { Cohort } from './cohort';

/**
 * Roman cohort catalog — the 5 starter cohort types for S14.
 *
 * Stat profiles are balanced against the canonical ROLE_STATS in
 * battle-config.ts (vanguard 150/40/1080/40, reserve 130/50/840/70,
 * guard 100/80/1200/30) but given thematic personality:
 *
 *  - Hastati    — baseline front-line, cheap
 *  - Principes  — elite veterans, stronger across the board
 *  - Triarii    — defensive backbone, high def/hp, low agi
 *  - Velites    — fragile skirmishers, high agi, low hp/def
 *  - Equites    — mobile cavalry, high atk/agi
 */
export const COHORT_CATALOG: readonly Cohort[] = [
  {
    id: 'hastati',
    name: 'Hastati',
    role: 'vanguard',
    stats: { atk: 140, def: 40, hp: 1000, agi: 40 },
    aurumCost: 40,
    description: 'Young front-line spearmen. The first rank to meet the enemy.',
  },
  {
    id: 'principes',
    name: 'Principes',
    role: 'vanguard',
    stats: { atk: 170, def: 55, hp: 1150, agi: 45 },
    aurumCost: 80,
    description: 'Veteran heavy infantry. The elite core of the legion.',
  },
  {
    id: 'triarii',
    name: 'Triarii',
    role: 'reserve',
    stats: { atk: 130, def: 90, hp: 1300, agi: 25 },
    aurumCost: 100,
    description: 'The oldest and most experienced soldiers. Held in reserve until the line must hold.',
  },
  {
    id: 'velites',
    name: 'Velites',
    role: 'vanguard',
    stats: { atk: 130, def: 25, hp: 700, agi: 90 },
    aurumCost: 30,
    description: 'Light skirmishers. Fragile but fast — harass and withdraw.',
  },
  {
    id: 'equites',
    name: 'Equites',
    role: 'guard',
    stats: { atk: 160, def: 50, hp: 900, agi: 80 },
    aurumCost: 90,
    description: "Roman cavalry. Mobile flankers that strike the enemy's weak points.",
  },
] as const;

/** Lookup a cohort definition by id, or `undefined` if not found. */
export function getCohortById(id: string): Cohort | undefined {
  return COHORT_CATALOG.find(c => c.id === id);
}
