import { applyVictoryCap, extractCohortHpSnapshot } from '../src/battle/casualties';
import { VICTORY_CAP_RATIO } from '../src/config/game-config';
import type { BattleUnit, UnitStats } from '../src/battle/battle-types';
import type { Cohort } from '../src/game/army/cohort';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeBattleUnit(overrides: {
  id: number;
  cohortInstanceId?: string;
  currentHp: number;
  hp: number;
  isDying?: boolean;
}): BattleUnit {
  const stats: UnitStats = { atk: 100, def: 50, hp: overrides.hp, agi: 60 };
  return {
    id: overrides.id,
    cohortInstanceId: overrides.cohortInstanceId,
    faction: 'blue',
    role: 'reserve',
    hex: { q: 0, r: 0 },
    stats,
    currentHp: overrides.currentHp,
    name: 'Test',
    prevHex: null,
    moveProgress: 1,
    path: [],
    shakeTimer: 0,
    flashTimer: 0,
    lungeTarget: null,
    lungeTimer: 0,
    isDying: overrides.isDying ?? false,
    deathProgress: 0,
    crackSeed: 0,
    pinnedBy: null,
    actionCooldown: 0,
    reviveThreshold: 0,
    hasRevived: false,
    hasEngaged: false,
  };
}

function makeCohort(overrides: {
  instanceId: string;
  hp: number;
  currentHp?: number;
  outOfAction?: boolean;
}): Cohort {
  return {
    id: 'hastati',
    instanceId: overrides.instanceId,
    name: 'Hastati',
    role: 'vanguard',
    stats: { atk: 100, def: 50, hp: overrides.hp, agi: 60 },
    aurumCost: 30,
    rarity: 'common',
    spriteId: 'roman_militia',
    description: '',
    movementProfile: 'vanguard-march',
    currentHp: overrides.currentHp,
    outOfAction: overrides.outOfAction,
  };
}

// ── AC-1: surviving cohort persists damage ──────────────────────
{
  const cohorts = [makeCohort({ instanceId: 'inst-1', hp: 1000 })];
  const units = [makeBattleUnit({ id: 1, cohortInstanceId: 'inst-1', currentHp: 600, hp: 1000 })];
  const next = extractCohortHpSnapshot(units, cohorts);
  assert(next[0].currentHp === 600, 'AC-1: surviving cohort should persist exact HP');
  assert(next[0].outOfAction !== true, 'AC-1: surviving cohort must NOT be marked out-of-action');
}

// ── AC-2: 0-HP unit → cohort at 1 HP, outOfAction = true ────────
{
  const cohorts = [makeCohort({ instanceId: 'inst-2', hp: 1000 })];
  const units = [makeBattleUnit({ id: 1, cohortInstanceId: 'inst-2', currentHp: 0, hp: 1000 })];
  const next = extractCohortHpSnapshot(units, cohorts);
  assert(next[0].currentHp === 1, 'AC-2: 0-HP unit should leave cohort at 1 HP');
  assert(next[0].outOfAction === true, 'AC-2: 0-HP unit should flag cohort outOfAction');
}

// ── AC-2 (variant): isDying → outOfAction even with positive HP ─
{
  const cohorts = [makeCohort({ instanceId: 'inst-3', hp: 1000 })];
  const units = [makeBattleUnit({ id: 1, cohortInstanceId: 'inst-3', currentHp: 100, hp: 1000, isDying: true })];
  const next = extractCohortHpSnapshot(units, cohorts);
  assert(next[0].currentHp === 1, 'isDying unit should be treated as 0-HP for write-back');
  assert(next[0].outOfAction === true, 'isDying unit should flag cohort outOfAction');
}

// ── R-3: alive unit at >0 HP must NOT trigger outOfAction ───────
{
  const cohorts = [makeCohort({ instanceId: 'inst-4', hp: 1000, currentHp: 1, outOfAction: true })];
  const units = [makeBattleUnit({ id: 1, cohortInstanceId: 'inst-4', currentHp: 50, hp: 1000 })];
  const next = extractCohortHpSnapshot(units, cohorts);
  assert(next[0].currentHp === 50, 'Surviving unit should overwrite stale HP');
  assert(next[0].outOfAction !== true, 'Surviving unit should clear stale outOfAction flag');
}

// ── Full-HP normalization: unit at maxHp → currentHp stripped ───
{
  const cohorts = [makeCohort({ instanceId: 'inst-5', hp: 1000, currentHp: 500 })];
  const units = [makeBattleUnit({ id: 1, cohortInstanceId: 'inst-5', currentHp: 1000, hp: 1000 })];
  const next = extractCohortHpSnapshot(units, cohorts);
  assert(next[0].currentHp === undefined, 'Fully healed cohort should have currentHp stripped');
  assert(next[0].outOfAction !== true, 'Fully healed cohort should not be outOfAction');
}

// ── Defensive: cohort with no matching unit is preserved verbatim ─
{
  const cohorts = [
    makeCohort({ instanceId: 'inst-6', hp: 1000, currentHp: 700 }),
    makeCohort({ instanceId: 'inst-7-no-unit', hp: 800, currentHp: 400, outOfAction: true }),
  ];
  const units = [makeBattleUnit({ id: 1, cohortInstanceId: 'inst-6', currentHp: 750, hp: 1000 })];
  const next = extractCohortHpSnapshot(units, cohorts);
  assert(next[0].currentHp === 750, 'Matched cohort should be updated');
  assert(next[1] === cohorts[1], 'Unmatched cohort should preserve reference verbatim');
  assert(next[1].currentHp === 400, 'Unmatched cohort fields untouched');
  assert(next[1].outOfAction === true, 'Unmatched cohort flag untouched');
}

// Defeat fallback: faded-out units missing from BattleState mark their cohorts out of action.
{
  const cohorts = [
    makeCohort({ instanceId: 'defeat-missing-1', hp: 1000 }),
    makeCohort({ instanceId: 'defeat-missing-2', hp: 1200 }),
  ];
  const next = extractCohortHpSnapshot([], cohorts, { missingUnit: 'out-of-action' });
  assert(next[0].currentHp === 1, 'Missing defeated cohort 1 should be pinned at 1 HP');
  assert(next[0].outOfAction === true, 'Missing defeated cohort 1 should be outOfAction');
  assert(next[1].currentHp === 1, 'Missing defeated cohort 2 should be pinned at 1 HP');
  assert(next[1].outOfAction === true, 'Missing defeated cohort 2 should be outOfAction');
}

// Defeat fallback keeps matched survivors exact, only missing cohorts become out of action.
{
  const cohorts = [
    makeCohort({ instanceId: 'defeat-survivor', hp: 1000 }),
    makeCohort({ instanceId: 'defeat-gone', hp: 1000 }),
  ];
  const units = [makeBattleUnit({ id: 1, cohortInstanceId: 'defeat-survivor', currentHp: 333, hp: 1000 })];
  const next = extractCohortHpSnapshot(units, cohorts, { missingUnit: 'out-of-action' });
  assert(next[0].currentHp === 333, 'Matched defeated survivor should persist exact HP');
  assert(next[0].outOfAction !== true, 'Matched defeated survivor should not be outOfAction');
  assert(next[1].currentHp === 1, 'Missing defeated cohort should be pinned at 1 HP');
  assert(next[1].outOfAction === true, 'Missing defeated cohort should be outOfAction');
}

// Reference stability: untouched cohort keeps reference.
{
  const cohorts = [makeCohort({ instanceId: 'inst-8', hp: 1000, currentHp: 500 })];
  // Unit reports the exact same HP — no change required.
  const units = [makeBattleUnit({ id: 1, cohortInstanceId: 'inst-8', currentHp: 500, hp: 1000 })];
  const next = extractCohortHpSnapshot(units, cohorts);
  assert(next[0] === cohorts[0], 'No-op write-back should preserve reference for Preact memoization');
}

// ── Battle spawns without cohortInstanceId (Augustus allies, etc.) ─
{
  const cohorts = [makeCohort({ instanceId: 'inst-9', hp: 1000, currentHp: 600 })];
  const units = [
    makeBattleUnit({ id: 1, cohortInstanceId: 'inst-9', currentHp: 800, hp: 1000 }),
    // Ally with no cohortInstanceId — must be ignored by the lookup.
    makeBattleUnit({ id: 2, currentHp: 100, hp: 1000 }),
  ];
  const next = extractCohortHpSnapshot(units, cohorts);
  assert(next[0].currentHp === 800, 'Roster cohort still matched correctly when ally units are present');
  assert(next.length === 1, 'Allies without instance id must not append extra cohorts');
}

// ── Cohort with no instanceId (legacy / pre-S26-01) preserved ──
{
  const legacyCohort: Cohort = {
    id: 'hastati',
    name: 'Hastati',
    role: 'vanguard',
    stats: { atk: 100, def: 50, hp: 1000, agi: 60 },
    aurumCost: 30,
    rarity: 'common',
    spriteId: 'roman_militia',
    description: '',
    movementProfile: 'vanguard-march',
    currentHp: 250,
  };
  const cohorts = [legacyCohort];
  const units = [makeBattleUnit({ id: 1, cohortInstanceId: 'inst-x', currentHp: 100, hp: 1000 })];
  const next = extractCohortHpSnapshot(units, cohorts);
  assert(next[0] === legacyCohort, 'Legacy cohort without instanceId should preserve reference');
}

// ════════════════════════════════════════════════════════════════
//  S26-04 / FT-HEAL FR-11 — Victory damage cap
// ════════════════════════════════════════════════════════════════

// Sanity check on the cap constant — tune-time guard so we notice if it ever drifts.
assert(VICTORY_CAP_RATIO === 0.5, 'VICTORY_CAP_RATIO is the documented 0.5 ceiling');

// ── AC-13: crushing victory (0% units lost) absorbs all HP loss ─
{
  const pre = [makeCohort({ instanceId: 'cap-crush', hp: 1000 })];
  const post = [makeCohort({ instanceId: 'cap-crush', hp: 1000, currentHp: 600 })];
  const result = applyVictoryCap(pre, post, /* unitLossRatio */ 0);
  assert(result.cohorts[0].currentHp === undefined, 'AC-13: crushing victory restores cohort to full maxHp (currentHp stripped)');
  assert(result.cohorts[0].outOfAction !== true, 'AC-13: crushing victory does not flag outOfAction');
  assert(result.absorbedPerCohort.length === 1, 'AC-13: absorbed entry recorded for the rescued cohort');
  assert(result.absorbedPerCohort[0].absorbedHp === 400, 'AC-13: full 400 HP loss reported as absorbed');
  assert(result.totalAbsorbedHp === 400, 'AC-13: totalAbsorbedHp aggregates per-cohort absorption');
  assert(result.unitLossRatio === 0, 'AC-13: ratio echoed back to caller');
}

// ── AC-14: pyrrhic victory (raw 80% loss) caps at 50% maxHp ─────
{
  const pre = [makeCohort({ instanceId: 'cap-pyrr', hp: 1000 })];
  // Raw post-battle: 200/1000 → raw loss 800 (80% of maxHp)
  const post = [makeCohort({ instanceId: 'cap-pyrr', hp: 1000, currentHp: 200 })];
  const result = applyVictoryCap(pre, post, /* unitLossRatio */ 1);
  assert(result.cohorts[0].currentHp === 500, 'AC-14: cap binds at exactly 50% maxHp on pyrrhic victory');
  assert(result.absorbedPerCohort[0].rawLoss === 800, 'AC-14: rawLoss reported faithfully (800)');
  assert(result.absorbedPerCohort[0].cappedLoss === 500, 'AC-14: cappedLoss reflects the floor (500)');
  assert(result.absorbedPerCohort[0].absorbedHp === 300, 'AC-14: absorbedHp = rawLoss − cappedLoss = 300');
}

// ── AC-15: defeat / retreat — caller must NOT invoke cap; raw HP persists ─
// (Consumers in main.tsx gate the call; this assertion documents the invariant.)
{
  const pre = [makeCohort({ instanceId: 'cap-defeat', hp: 1000 })];
  const post = [makeCohort({ instanceId: 'cap-defeat', hp: 1000, currentHp: 200 })];
  // If applyVictoryCap is mistakenly invoked on defeat, raw HP would be modified.
  // The contract documented in casualties.ts is "call only on victory" — this
  // test pins the behavior: when called with a high ratio, the cap kicks in,
  // proving the caller-side gate is the only thing keeping raw losses on
  // defeats/retreats. Acts as a regression guard for future refactors.
  const result = applyVictoryCap(pre, post, 1);
  assert(result.cohorts[0].currentHp === 500, 'AC-15: cap function itself always applies if called — defeat/retreat must skip the call site (main.tsx gate)');
}

// ── R-8: outOfAction cohorts are NOT rescued by the cap ─────────
{
  const pre = [makeCohort({ instanceId: 'cap-ooa', hp: 1000 })];
  // Post-battle: cohort hit 0 HP → write-back already flagged outOfAction at 1 HP
  const post = [makeCohort({ instanceId: 'cap-ooa', hp: 1000, currentHp: 1, outOfAction: true })];
  const result = applyVictoryCap(pre, post, /* unitLossRatio */ 0);  // crushing
  assert(result.cohorts[0].currentHp === 1, 'R-8: outOfAction cohort stays at 1 HP, cap does not rescue it');
  assert(result.cohorts[0].outOfAction === true, 'R-8: outOfAction flag preserved through cap');
  assert(result.absorbedPerCohort.length === 0, 'R-8: no absorption entry for OoA cohorts');
}

// ── Mid-cap: medium loss (50% units killed) → loss capped at 25% maxHp ──
{
  const pre = [makeCohort({ instanceId: 'cap-mid', hp: 1000 })];
  const post = [makeCohort({ instanceId: 'cap-mid', hp: 1000, currentHp: 500 })]; // raw 500 loss
  const result = applyVictoryCap(pre, post, /* unitLossRatio */ 0.5);
  // cap = 1000 × 0.5 × 0.5 = 250
  assert(result.cohorts[0].currentHp === 750, 'Mid-loss victory caps at maxHp × 0.5 × 0.5 = 250 → final 750/1000');
  assert(result.absorbedPerCohort[0].absorbedHp === 250, 'Mid-loss absorbs 500 - 250 = 250 HP');
}

// ── Cap doesn't bind when raw loss is already below the cap ─────
{
  const pre = [makeCohort({ instanceId: 'cap-light', hp: 1000 })];
  const post = [makeCohort({ instanceId: 'cap-light', hp: 1000, currentHp: 900 })]; // raw 100 loss
  // pyrrhic ratio (1.0) → cap = 500. Raw loss 100 is below cap → cap doesn't bind, raw persists.
  const result = applyVictoryCap(pre, post, 1);
  assert(result.cohorts[0].currentHp === 900, 'Below-cap raw loss persists unchanged');
  assert(result.absorbedPerCohort.length === 0, 'No absorption entry when cap doesn\'t bind');
  assert(result.totalAbsorbedHp === 0, 'totalAbsorbedHp = 0 when nothing was absorbed');
}

// ── Reference stability: untouched cohorts (no damage) preserve refs ─
{
  const pre = [makeCohort({ instanceId: 'cap-ref', hp: 1000 })];
  const post = [makeCohort({ instanceId: 'cap-ref', hp: 1000 })]; // no currentHp diff
  const result = applyVictoryCap(pre, post, 0.5);
  assert(result.cohorts[0] === post[0], 'Cohort with no damage preserves reference through cap');
}

// ── Multi-cohort: cap applies per-cohort independently, totals aggregate ─
{
  const pre = [
    makeCohort({ instanceId: 'cap-multi-1', hp: 1000 }),
    makeCohort({ instanceId: 'cap-multi-2', hp: 2000 }),
    makeCohort({ instanceId: 'cap-multi-3', hp: 800, currentHp: 1, outOfAction: true }),
  ];
  const post = [
    makeCohort({ instanceId: 'cap-multi-1', hp: 1000, currentHp: 100 }),  // raw loss 900
    makeCohort({ instanceId: 'cap-multi-2', hp: 2000, currentHp: 1500 }),  // raw loss 500
    makeCohort({ instanceId: 'cap-multi-3', hp: 800, currentHp: 1, outOfAction: true }),
  ];
  const result = applyVictoryCap(pre, post, 1);
  // cap-multi-1: cap = 500, raw 900 → final 500 currentHp, absorbed 400
  // cap-multi-2: cap = 1000, raw 500 < cap → no absorption, currentHp stays 1500
  // cap-multi-3: outOfAction, untouched
  assert(result.cohorts[0].currentHp === 500, 'Multi-cohort cohort 1 capped at half maxHp');
  assert(result.cohorts[1].currentHp === 1500, 'Multi-cohort cohort 2 below cap, currentHp untouched');
  assert(result.cohorts[2].outOfAction === true, 'Multi-cohort outOfAction cohort preserved');
  assert(result.absorbedPerCohort.length === 1, 'Only the cohort that triggered the cap appears in absorbed list');
  assert(result.totalAbsorbedHp === 400, 'totalAbsorbedHp = 400 from cap-multi-1 only');
}

console.log('verify-battle-casualties: ok');
