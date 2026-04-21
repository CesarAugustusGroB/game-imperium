/**
 * morale — pre-battle army morale system (S24).
 *
 * Morale is a scalar on an army, starting at `BASE_MORALE` (100) and shifted by
 * strategic-layer contributor sources (legatus traits, council advisors,
 * doctrines, home-soil fighting, etc). The army's final morale maps to a tier,
 * and the tier's damage/defense multipliers are stashed on every spawned
 * `BattleUnit` at deploy time (see `src/battle/index.ts` and S24-03).
 *
 * Morale is a PRE-BATTLE value — it does NOT change during combat. The player
 * reads the tier in the spoke view before clicking fight and commits to those
 * odds for the whole battle.
 *
 * Distinct from the faction `blueCohesion`/`redCohesion` signals in
 * `battle-signals.ts`, which track faction HP% for victory detection.
 */

import type { Spoke } from '../progression/spoke';

// ── Tier table ─────────────────────────────────────────────────────────────

export type MoraleTier = 'broken' | 'shaken' | 'steady' | 'resolute' | 'inspired';

export interface TierMultipliers {
  /** Multiplier on damage dealt by units in this army. 1.0 = neutral. */
  damage: number;
  /** Multiplier on damage taken by units in this army. 1.0 = neutral. */
  defense: number;
}

interface TierRow {
  tier: MoraleTier;
  min: number;
  max: number;
  damage: number;
  defense: number;
}

const TIER_TABLE: readonly TierRow[] = [
  { tier: 'broken',   min: -Infinity, max: 59,       damage: 0.75, defense: 1.15 },
  { tier: 'shaken',   min: 60,        max: 89,       damage: 0.90, defense: 1.05 },
  { tier: 'steady',   min: 90,        max: 110,      damage: 1.00, defense: 1.00 },
  { tier: 'resolute', min: 111,       max: 140,      damage: 1.10, defense: 0.95 },
  { tier: 'inspired', min: 141,       max: Infinity, damage: 1.20, defense: 0.90 },
];

/** The morale an army starts at before any contributor shifts it. */
export const BASE_MORALE = 100;

/** Map a numeric morale to its tier. Values in the Steady band return 'steady'. */
export function getMoraleTier(morale: number): MoraleTier {
  for (const row of TIER_TABLE) {
    if (morale >= row.min && morale <= row.max) return row.tier;
  }
  return 'steady';
}

/** Return the damage/defense multipliers for a tier. */
export function getTierMultipliers(tier: MoraleTier): TierMultipliers {
  const row = TIER_TABLE.find((r) => r.tier === tier);
  return row ? { damage: row.damage, defense: row.defense } : NEUTRAL_MULTIPLIERS;
}

// ── Modifier & contributor model ───────────────────────────────────────────

/** A single signed shift in an army's morale, attributed to a source. */
export interface MoraleModifier {
  /** Stable key for the source system — e.g. 'legatus', 'doctrine', 'home-soil'. */
  source: string;
  /** Human-readable label shown in the spoke UI — e.g. 'Legatus: Vigilant'. */
  label: string;
  /** Signed delta from `BASE_MORALE`. */
  delta: number;
}

/**
 * A contributor produces zero or more morale modifiers for a given spoke
 * context. Contributors are stateless — they read from the spoke and derived
 * game state, and emit modifiers.
 */
export type MoraleContributor = (spoke: Spoke) => MoraleModifier[];

const contributors: MoraleContributor[] = [];

/** Register a new contributor. Called once at module load per source. */
export function registerMoraleContributor(contributor: MoraleContributor): void {
  contributors.push(contributor);
}

/** @internal visible for testing — reset the registry to empty. */
export function __resetMoraleContributors(): void {
  contributors.length = 0;
}

// ── Stub contributors (MVP wiring; concrete sources plug in via later tickets) ──
//
// Legatus is intentionally NOT registered here — S24-04 wires it once the
// legate trait schema supports morale bonuses.

function consiliumContributor(_spoke: Spoke): MoraleModifier[] {
  // Future: advisor opinions, mandate, crisis state.
  return [];
}

function doctrinaeContributor(_spoke: Spoke): MoraleModifier[] {
  // Future: morale-granting research effects.
  return [];
}

function homeSoilContributor(_spoke: Spoke): MoraleModifier[] {
  // Future: compare battle-location province owner vs player faction.
  return [];
}

registerMoraleContributor(consiliumContributor);
registerMoraleContributor(doctrinaeContributor);
registerMoraleContributor(homeSoilContributor);

// ── Public API ─────────────────────────────────────────────────────────────

export interface MoraleResult {
  /** Final numeric morale after all contributor deltas applied to BASE_MORALE. */
  total: number;
  /** Tier derived from `total`. */
  tier: MoraleTier;
  /** All modifiers that participated, in registration order. */
  modifiers: MoraleModifier[];
}

/** Collect all modifiers from registered contributors for the given spoke. */
export function collectMoraleModifiers(spoke: Spoke): MoraleModifier[] {
  const out: MoraleModifier[] = [];
  for (const contributor of contributors) {
    out.push(...contributor(spoke));
  }
  return out;
}

/**
 * Compute an army's pre-battle morale.
 *
 * Returns `{ total, tier, modifiers }`. Contributor-free spokes evaluate to
 * `BASE_MORALE` (100) / 'steady' / `[]`, which maps to neutral multipliers
 * (damage 1.0, defense 1.0) — so battles without morale wiring behave exactly
 * as before S24.
 */
export function computeArmyMorale(spoke: Spoke): MoraleResult {
  const modifiers = collectMoraleModifiers(spoke);
  const total = BASE_MORALE + modifiers.reduce((sum, m) => sum + m.delta, 0);
  const tier = getMoraleTier(total);
  return { total, tier, modifiers };
}

// ── Neutral fallbacks ──────────────────────────────────────────────────────

/** Neutral multipliers used when a BattleUnit has no morale context. */
export const NEUTRAL_MULTIPLIERS: TierMultipliers = { damage: 1.0, defense: 1.0 };

/** Neutral morale result for battles with no spoke (quick battles, tests). */
export const NEUTRAL_MORALE: MoraleResult = {
  total: BASE_MORALE,
  tier: 'steady',
  modifiers: [],
};
