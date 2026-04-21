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
    id: 'militia',
    name: 'Militia',
    role: 'vanguard',
    stats: { atk: 100, def: 30, hp: 800, agi: 35 },
    aurumCost: 20,
    rarity: 'common',
    spriteId: 'roman_militia_common',
    description: 'Servian civic levy — smallholders called from the plow. Cheap, fragile, but fills the line.',
    movementProfile: 'vanguard-march',
  },
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

/**
 * Sprite ids that are reserved for special/narrative use and must NOT appear
 * in the regular ally roster (or random enemy rosters). These are the
 * "fully-gold coin" medallion sprites — see `soldiers.json`.
 */
export const GOLD_RESERVED_SPRITE_IDS: ReadonlySet<string> = new Set([
  'spartan_royal_super_rare',
  'companion_super_rare',
]);

/**
 * Ally recruitment pool — mirrors the player's Exercitus tab roster (all
 * cohorts in `COHORT_CATALOG`) minus any sprite id in `GOLD_RESERVED_SPRITE_IDS`.
 *
 * Consumed by the Augustus "Web of Alliances" perk and the `ally-units`
 * doctrine effect to spawn flavorful, stats-appropriate allied reinforcements
 * instead of generic placeholder units.
 */
export const ALLY_COHORT_POOL: readonly Cohort[] = COHORT_CATALOG.filter(
  c => !c.spriteId || !GOLD_RESERVED_SPRITE_IDS.has(c.spriteId),
);

/** Pick a random cohort from the ally pool. Returns `null` if the pool is empty. */
export function pickAllyCohort(): Cohort | null {
  if (ALLY_COHORT_POOL.length === 0) return null;
  return ALLY_COHORT_POOL[Math.floor(Math.random() * ALLY_COHORT_POOL.length)];
}
