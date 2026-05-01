import { ENEMY_COHORTS } from './enemy-cohort-data';
import { computeArmySize } from './cohort';
import type { Cohort } from './cohort';
import type { ArmyData } from '../../types/index';
import type { EncounterType } from '../progression/landmark-types';

// ── Cohort type references (static map — built once at module load) ─────────

const COHORT_MAP = new Map<string, Cohort>(ENEMY_COHORTS.map(c => [c.id, c]));

function get(id: string): Cohort {
  const c = COHORT_MAP.get(id);
  if (!c) throw new Error(`enemy-army-generator: unknown ENEMY_COHORTS id "${id}"`);
  return c;
}

/**
 * Role pools — one random pick per slot so enemy armies vary in culture and
 * sprite rather than repeating the same entry. Commons and low-elite picks
 * blend Gaul/Norse/Punic; high-elite picks include the Gallic Gaesatae and
 * the Spartan chieftain.
 */
const COMMON_VANGUARDS = ['barbarian-warrior', 'gallic-clansmen'];
const SHOCK_VANGUARDS  = ['barbarian-champion', 'gallic-gaesatae'];
const ELITE_VANGUARDS  = ['barbarian-warlord', 'gallic-gaesatae'];
const RESERVES         = ['barbarian-raider', 'gallic-neitos'];
const LOW_GUARDS       = ['barbarian-shieldbearer'];
const ELITE_GUARDS     = ['barbarian-chieftain', 'gallic-noble-horse', 'gallic-noble-horse-elite', 'gallic-vergobret'];

function pick(pool: readonly string[]): Cohort {
  return get(pool[Math.floor(Math.random() * pool.length)]);
}

function warrior(): Cohort      { return pick(COMMON_VANGUARDS); }
function raider(): Cohort       { return pick(RESERVES); }
function shieldbearer(): Cohort { return pick(LOW_GUARDS); }
function champion(): Cohort     { return pick(SHOCK_VANGUARDS); }
function chieftain(): Cohort    { return pick(ELITE_GUARDS); }
function warlord(): Cohort      { return pick(ELITE_VANGUARDS); }

// ── Scaling helpers ─────────────────────────────────────────────────────────

// Tuning constants — adjust here for balance
const REGULAR_SEASON_MULTIPLIER = 1.0;   // baseCount = 1 + floor(season × this)
const REGULAR_BASE_CAP = 8;              // max base count for regular battles
const BOSS_SEASON_MULTIPLIER = 1.2;      // bossBase = 2 + floor(season × this)
const BOSS_BASE_CAP = 9;                 // max base count for boss battles

/**
 * effectiveThreat uses spoke count as a floor so players who complete many
 * spokes quickly don't face trivially easy enemies even at low threatLevel.
 */
function computeEffectiveThreat(threatLevel: number, completedSpokes: number): number {
  return Math.max(threatLevel, Math.floor(completedSpokes * 0.5));
}

/**
 * eliteRatio: 0% at threat 0, ~25% at threat 10, capped at 40% at threat 16+.
 */
function computeEliteRatio(effectiveThreat: number): number {
  return Math.min(0.4, effectiveThreat * 0.025);
}

/**
 * extraUnits: +1 extra unit per 5 threat levels, capped at 2.
 */
function computeExtraUnits(effectiveThreat: number): number {
  return Math.min(2, Math.floor(effectiveThreat / 5));
}

/**
 * Dynamic base count for regular battles.
 * Starts at 1 (season 0), grows by 1 per season, capped at REGULAR_BASE_CAP (8).
 */
function computeBaseCount(globalSeason: number): number {
  return Math.min(REGULAR_BASE_CAP, 1 + Math.floor(globalSeason * REGULAR_SEASON_MULTIPLIER));
}

/**
 * Dynamic base count for boss battles.
 * Starts at 2, grows ~1.2 per season, capped at BOSS_BASE_CAP (9).
 */
function computeBossBaseCount(globalSeason: number): number {
  return Math.min(BOSS_BASE_CAP, 2 + Math.floor(globalSeason * BOSS_SEASON_MULTIPLIER));
}

// ── Army builders ───────────────────────────────────────────────────────────

/**
 * Build a regular enemy army with proportional role distribution.
 *
 * Role allocation at any size:
 *   vanguard ≈ 60%, reserve ≈ 20%, guard ≈ 20%  (rounded, min 0 for reserve/guard)
 *   guard slots only appear at size ≥ 4
 *   reserve slots only appear at size ≥ 2
 */
function buildRegularArmy(effectiveThreat: number, globalSeason: number, totalCountOverride?: number): Cohort[] {
  const totalCount = totalCountOverride !== undefined
    ? Math.max(1, Math.min(REGULAR_BASE_CAP + 6, totalCountOverride))
    : computeBaseCount(globalSeason) + computeExtraUnits(effectiveThreat);
  const eliteRatio = computeEliteRatio(effectiveThreat);

  // Proportional role split
  const guardCount = totalCount >= 4 ? Math.max(1, Math.floor(totalCount * 0.2)) : 0;
  const reserveCount = totalCount >= 2 ? Math.max(1, Math.floor(totalCount * 0.2)) : 0;
  const vanguardCount = totalCount - reserveCount - guardCount;

  const cohorts: Cohort[] = [];

  // Vanguard: champions based on elite ratio, rest warriors
  const champCount = Math.ceil(vanguardCount * eliteRatio);
  for (let i = 0; i < champCount; i++) cohorts.push(champion());
  for (let i = champCount; i < vanguardCount; i++) cohorts.push(warrior());

  // Reserve: raiders
  for (let i = 0; i < reserveCount; i++) cohorts.push(raider());

  // Guard: chieftains at high elite ratio, else shieldbearers
  const guardUnit = eliteRatio >= 0.3 ? chieftain() : shieldbearer();
  for (let i = 0; i < guardCount; i++) cohorts.push(guardUnit);

  return cohorts;
}

/**
 * Build a boss enemy army. Separate scaling curve — always stronger than
 * regular at the same progression point.
 */
function buildBossArmy(effectiveThreat: number, globalSeason: number, isFinalBattle: boolean, totalCountOverride?: number): Cohort[] {
  let totalCount: number;
  if (totalCountOverride !== undefined) {
    totalCount = Math.max(1, Math.min(BOSS_BASE_CAP + 6, totalCountOverride));
  } else {
    const extraUnits = Math.min(4, computeExtraUnits(effectiveThreat));
    // Final invasion always gets max army; regular boss uses dynamic scaling
    const bossBase = isFinalBattle
      ? BOSS_BASE_CAP + 2  // 14 for final invasion
      : computeBossBaseCount(globalSeason);
    totalCount = bossBase + extraUnits;
  }

  // Role split: reserve + guard get fixed 2 each (if room), rest is vanguard
  const guardCount = Math.min(2, Math.max(0, totalCount - 1));
  const reserveCount = Math.min(2, Math.max(0, totalCount - guardCount - 1));
  const vanguardCount = totalCount - reserveCount - guardCount;

  const cohorts: Cohort[] = [];

  // Vanguard: warlord only when army is 6+, otherwise champion leads
  const hasWarlord = vanguardCount >= 4;
  if (vanguardCount >= 1) cohorts.push(hasWarlord ? warlord() : champion());
  if (vanguardCount > 1) {
    const champCount = Math.ceil((vanguardCount - 1) * 0.5);
    for (let i = 0; i < champCount; i++) cohorts.push(champion());
    for (let i = champCount + 1; i < vanguardCount; i++) cohorts.push(warrior());
  }

  // Reserve: raiders
  for (let i = 0; i < reserveCount; i++) cohorts.push(raider());

  // Guard: chieftains for boss
  for (let i = 0; i < guardCount; i++) cohorts.push(chieftain());

  return cohorts;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the strength rating used by both the campaign banner and (optionally)
 * as a strength override for `generateEnemyArmy`. Returns the same totalCount
 * the army builders would produce — they share these formulas.
 */
export function computeEnemyStrengthRating(
  encounterType: EncounterType,
  globalSeason: number,
  threatLevel: number,
  completedSpokes: number,
): number {
  const effectiveThreat = computeEffectiveThreat(threatLevel, completedSpokes);
  const isBoss = encounterType === 'boss';
  if (isBoss) {
    const extra = Math.min(4, computeExtraUnits(effectiveThreat));
    return computeBossBaseCount(globalSeason) + extra;
  }
  const base = computeBaseCount(globalSeason);
  const extra = computeExtraUnits(effectiveThreat);
  // Elite encounters scale ~1.5×; cap at REGULAR_BASE_CAP + extra.
  if (encounterType === 'elite_battle') {
    return Math.min(REGULAR_BASE_CAP + extra, Math.ceil((base + extra) * 1.5));
  }
  return base + extra;
}

/**
 * Generate a data-driven enemy ArmyData scaled by progression.
 *
 * Army size starts at 1 (season 0) and grows between spokes, reaching
 * ~10 by season 5. Boss nodes follow a separate, steeper curve.
 * Base stats only — the post-spawn +5%/threatLevel stat multiplier in
 * `applyThreatScaling()` is applied after this army is placed on the grid.
 *
 * @param threatLevel      Current global threat level (season ticks)
 * @param completedSpokes  Number of spokes completed (used as scaling floor)
 * @param globalSeason     Current season (drives army size growth)
 * @param isBoss           True when current node type is 'boss'
 * @param isFinalBattle    True when globalSeason >= MAX_SEASONS
 * @param strengthOverride Optional total cohort count override (bypasses base/extra derivation)
 */
export function generateEnemyArmy(
  threatLevel: number,
  completedSpokes: number,
  globalSeason: number,
  isBoss: boolean,
  isFinalBattle: boolean,
  strengthOverride?: number,
): ArmyData {
  const effectiveThreat = computeEffectiveThreat(threatLevel, completedSpokes);
  const cohorts = (isBoss || isFinalBattle)
    ? buildBossArmy(effectiveThreat, globalSeason, isFinalBattle, strengthOverride)
    : buildRegularArmy(effectiveThreat, globalSeason, strengthOverride);

  const name = (isBoss || isFinalBattle) ? 'Barbarian War Host' : 'Barbarian Horde';

  return {
    id: -1,
    owner: 'barbarian',
    name,
    size: computeArmySize(cohorts),
    cohorts,
    legateId: null,
    supplies: 0,
    provinceIndex: 0,
    targetProvinceIndex: null,
    progress: 0,
    path: [],
    inCombat: false,
    combatTarget: null,
    lastRoll: 0,
  };
}
