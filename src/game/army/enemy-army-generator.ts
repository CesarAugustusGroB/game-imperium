import { ENEMY_COHORTS } from './enemy-cohort-data';
import { computeArmySize } from './cohort';
import type { Cohort } from './cohort';
import type { ArmyData } from '../../types/index';

// ── Cohort type references (static map — built once at module load) ─────────

const COHORT_MAP = new Map<string, Cohort>(ENEMY_COHORTS.map(c => [c.id, c]));

function warrior(): Cohort     { return COHORT_MAP.get('barbarian-warrior')!; }
function raider(): Cohort      { return COHORT_MAP.get('barbarian-raider')!; }
function shieldbearer(): Cohort { return COHORT_MAP.get('barbarian-shieldbearer')!; }
function champion(): Cohort    { return COHORT_MAP.get('barbarian-champion')!; }
function chieftain(): Cohort   { return COHORT_MAP.get('barbarian-chieftain')!; }
function warlord(): Cohort     { return COHORT_MAP.get('barbarian-warlord')!; }

// ── Scaling helpers ─────────────────────────────────────────────────────────

/**
 * effectiveThreat uses spoke count as a floor so players who complete many
 * spokes quickly don't face trivially easy enemies even at low threatLevel.
 */
function computeEffectiveThreat(threatLevel: number, completedSpokes: number): number {
  return Math.max(threatLevel, Math.floor(completedSpokes * 0.5));
}

/**
 * eliteRatio: 0% at threat 0, ~40% at threat 10, capped at 60% at threat 15+.
 */
function computeEliteRatio(effectiveThreat: number): number {
  return Math.min(0.6, effectiveThreat * 0.04);
}

/**
 * extraUnits: +1 extra unit per 3 threat levels, capped at 6.
 */
function computeExtraUnits(effectiveThreat: number): number {
  return Math.min(6, Math.floor(effectiveThreat / 3));
}

// ── Army builders ───────────────────────────────────────────────────────────

function buildRegularArmy(effectiveThreat: number): Cohort[] {
  const eliteRatio = computeEliteRatio(effectiveThreat);
  const extraUnits = computeExtraUnits(effectiveThreat);

  const cohorts: Cohort[] = [];

  // Vanguard slot: 6 base
  const champCount = Math.ceil(6 * eliteRatio);
  for (let i = 0; i < champCount; i++) cohorts.push(champion());
  for (let i = champCount; i < 6; i++) cohorts.push(warrior());

  // Reserve slot: 2 base Raiders
  cohorts.push(raider(), raider());

  // Guard slot: 2 base — Chieftains once ratio reaches 30%, else Shieldbearers
  const guardUnit = eliteRatio >= 0.3 ? chieftain() : shieldbearer();
  cohorts.push(guardUnit, guardUnit);

  // Extra units: alternate vanguard/reserve fills
  for (let i = 0; i < extraUnits; i++) {
    cohorts.push(i % 2 === 0 ? warrior() : raider());
  }

  return cohorts;
}

function buildBossArmy(effectiveThreat: number, isFinalBattle: boolean): Cohort[] {
  const extraUnits = Math.min(4, computeExtraUnits(effectiveThreat));

  const cohorts: Cohort[] = [];

  // Vanguard: final invasion gets 10 slots, regular boss gets 8
  const vanguardBase = isFinalBattle ? 10 : 8;
  cohorts.push(warlord());                                         // always 1 warlord
  const champCount = Math.ceil((vanguardBase - 1) * 0.5);         // ~half champions
  for (let i = 0; i < champCount; i++) cohorts.push(champion());
  for (let i = champCount + 1; i < vanguardBase; i++) cohorts.push(warrior());

  // Reserve: 2 Raiders
  cohorts.push(raider(), raider());

  // Guard: 2 Chieftains
  cohorts.push(chieftain(), chieftain());

  // Extra: additional Champions/Raiders
  for (let i = 0; i < extraUnits; i++) {
    cohorts.push(i % 2 === 0 ? champion() : raider());
  }

  return cohorts;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a data-driven enemy ArmyData scaled by the current threat level.
 *
 * Base stats only — the post-spawn +5%/threatLevel stat multiplier in
 * `applyThreatScaling()` is applied after this army is placed on the grid.
 *
 * @param threatLevel      Current global threat level (season ticks)
 * @param completedSpokes  Number of spokes completed (used as scaling floor)
 * @param isBoss           True when current node type is 'boss'
 * @param isFinalBattle    True when globalSeason >= MAX_SEASONS
 */
export function generateEnemyArmy(
  threatLevel: number,
  completedSpokes: number,
  isBoss: boolean,
  isFinalBattle: boolean,
): ArmyData {
  const effectiveThreat = computeEffectiveThreat(threatLevel, completedSpokes);
  const cohorts = (isBoss || isFinalBattle)
    ? buildBossArmy(effectiveThreat, isFinalBattle)
    : buildRegularArmy(effectiveThreat);

  const name = (isBoss || isFinalBattle) ? 'Barbarian War Host' : 'Barbarian Horde';

  return {
    id: -1,
    owner: 'barbarian',
    name,
    size: computeArmySize(cohorts),
    cohorts,
    legateId: null,
    provinceIndex: 0,
    targetProvinceIndex: null,
    progress: 0,
    path: [],
    inCombat: false,
    combatTarget: null,
    lastRoll: 0,
  };
}
