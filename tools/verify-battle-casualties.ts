import { extractCohortHpSnapshot } from '../src/battle/casualties';
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

// ── Reference stability: untouched cohort keeps reference ───────
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

console.log('verify-battle-casualties: ok');
