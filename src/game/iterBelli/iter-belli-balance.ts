/**
 * Iter Belli — tunable balance constants, ported from the prototype.
 * Centralised so the campaign/battle feel can be adjusted without touching logic.
 */

// ── Starting campaign defaults (the hybrid seed fills in soldiers + gold) ──
export const START = {
  morale: 8.0,
  discipline: 4,
  supplies: 12,
  threat: 2,
  timeRemaining: 12,
  /** Fallback soldiers if the run has no prepared army. */
  fallbackSoldiers: 8000,
  /** Fallback campaign gold if the run gold is very low. */
  fallbackGold: 180,
} as const;

// ── Pool ──
export const POOL_TARGET_SIZE = 4;
export const POOL_REFILL_ATTEMPTS = 20;

// ── Per-turn maintenance ──
export const SUPPLY_UPKEEP_PER_TURN = 1;
export const HUNGER_MORALE_LOSS = 1;
export const HUNGER_DESERTION_PCT = 0.02;
export const MUTINY_MORALE_THRESHOLD = 3;
export const MUTINY_CHANCE = 0.3;
export const MUTINY_DESERTION_PCT = 0.05;

// ── Partial-combat events ──
export const SKIRMISH_THREAT_THRESHOLD = 7;
export const SKIRMISH_CHANCE = 0.5;
export const SKIRMISH_DESERTION_PCT = 0.02;
export const SKIRMISH_MORALE_LOSS = 0.5;

export const AMBUSH_THREAT_THRESHOLD = 5;
export const AMBUSH_CHANCE = 0.3;
export const AMBUSH_DESERTION_PCT = 0.06;
export const AMBUSH_MORALE_LOSS = 1.5;

// ── Camp action ──
export const CAMP_SUPPLY_COST = 2;
export const CAMP_MORALE_GAIN = 0.5;

// ── Final battle ──
/** Enemy base soldiers before threat scaling / erosion. */
export const ENEMY_BASE_SOLDIERS = 7000;
export const ENEMY_MIN_SOLDIERS = 2000;
/** enemyMult = (1 + threat/THREAT_DIVISOR) * (1 - enemyWeaken*WEAKEN_PER_POINT) */
export const ENEMY_THREAT_DIVISOR = 20;
export const ENEMY_WEAKEN_PER_POINT = 0.07;
export const ENEMY_MORALE = 8.0;
export const ENEMY_DISCIPLINE = 5;
export const FORTIFIED_TERRAIN_MULT = 1.15;
export const BATTLE_MAX_ROUNDS = 15;

// ── Return-to-hub rewards ──
export const VICTORY_GOLD_BONUS = 200;

// ── Clamps ──
export const MORALE_MIN = 0;
export const MORALE_MAX = 10;
export const DISCIPLINE_MIN = 1;
export const DISCIPLINE_MAX = 5;
export const THREAT_MIN = 0;
export const THREAT_MAX = 10;

// ── UI alert thresholds ──
export const ALERT = {
  soldiersLow: 2000,
  moraleLow: 3,
  suppliesWarn: 5,
  threatWarn: 5,
  threatAlert: 7,
  clockAlert: 3,
} as const;

/** Roman numerals for discipline display (index 0 unused). */
export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'] as const;
