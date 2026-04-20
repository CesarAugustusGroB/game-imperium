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
    rarity: 'common',
    spriteId: 'roman_hastatii_common',
    description: 'Young front-line spearmen. The first rank to meet the enemy.',
    movementProfile: 'vanguard-march',
  },
  {
    id: 'principes',
    name: 'Principes',
    role: 'vanguard',
    stats: { atk: 170, def: 55, hp: 1150, agi: 45 },
    aurumCost: 80,
    rarity: 'rare',
    spriteId: 'roman_princeps_rare',
    description: 'Veteran heavy infantry. The elite core of the legion.',
    movementProfile: 'vanguard-march',
  },
  {
    id: 'triarii',
    name: 'Triarii',
    role: 'reserve',
    stats: { atk: 130, def: 90, hp: 1300, agi: 25 },
    aurumCost: 100,
    rarity: 'super-rare',
    spriteId: 'roman_triarii_super_rare',
    description: 'The wealthiest Servian-census line. Patrician reservists in gilded hoplite kit — the iron wall of last resort.',
    movementProfile: 'reserve-intercept',
  },
  {
    id: 'velites',
    name: 'Velites',
    role: 'vanguard',
    stats: { atk: 130, def: 25, hp: 700, agi: 90 },
    aurumCost: 30,
    rarity: 'uncommon',
    spriteId: 'roman_velite_uncommon',
    description: 'Light skirmishers. Hurl javelins at range, kite melee attackers.',
    movementProfile: 'ranged-skirmisher',
  },
  {
    id: 'equites',
    name: 'Equites',
    role: 'guard',
    stats: { atk: 160, def: 50, hp: 900, agi: 80 },
    aurumCost: 90,
    rarity: 'rare',
    spriteId: 'roman_equite_rare',
    description: "Roman citizen-cavalry. Mobile flankers that strike the enemy's weak points.",
    movementProfile: 'flanker',
  },
  {
    id: 'cretan_archer',
    name: 'Cretan Archer',
    role: 'vanguard',
    stats: { atk: 120, def: 20, hp: 700, agi: 85 },
    aurumCost: 70,
    rarity: 'rare',
    spriteId: 'cretan_archer_rare',
    description: 'Expert archers from Crete. Holds range, kites melee, fires arrows up to 3 hexes.',
    movementProfile: 'ranged-skirmisher',
  },
] as const;

/** Lookup a cohort definition by id, or `undefined` if not found. */
export function getCohortById(id: string): Cohort | undefined {
  return COHORT_CATALOG.find(c => c.id === id);
}
