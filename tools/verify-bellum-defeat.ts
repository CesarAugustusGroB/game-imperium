// S33-02 / S33-05: Bellum defeat helper checks.
// Run with: npx tsx tools/verify-bellum-defeat.ts
//
// S33-05: supplies/morale are now read from preparedArmy + computeBellumMorale
// rather than campaignState. The evaluateBellumDefeat signature still accepts
// a CampaignState for callers that pass campaignState.value, but internally
// reads from the army/morale system.

import type { CampaignState } from '../src/game/campaign/campaign-types';
import {
  BELLUM_ZERO_SUPPLY_DEFEAT_THRESHOLD,
  bellumDefeatReason,
  bellumWarningState,
  evaluateBellumDefeat,
  resetBellumDefeatState,
  setBellumDefeatNavigation,
} from '../src/game/campaign/campaign-defeat';
import { preparedArmy } from '../src/game/progression/strategic-store';
import { addCampaignMorale } from '../src/game/campaign/bellum-army-view';
import { __resetMoraleContributors, BASE_MORALE, registerMoraleContributor } from '../src/game/army/morale';
import type { ArmyData, Cohort } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

// Controlled morale contributor — only campaignMoraleDelta, no legate noise.
__resetMoraleContributors();
registerMoraleContributor((spoke) => {
  const delta = spoke.boundArmy?.campaignMoraleDelta ?? 0;
  if (delta === 0) return [];
  return [{ source: 'campaign', label: 'Campaign events', delta }];
});

function state(): CampaignState {
  return {
    currentTileId: '0,0',
    selectedTileId: null,
    movementPoints: 2,
  };
}

function cohort(id: string, outOfAction = false): Cohort {
  return {
    id,
    instanceId: id,
    name: id,
    role: 'vanguard',
    stats: { hp: 1000, atk: 100, def: 50, agi: 30 },
    spriteId: 'hastati',
    currentHp: outOfAction ? 1 : undefined,
    outOfAction: outOfAction ? true : undefined,
  } as Cohort;
}

function army(cohorts: Cohort[], supplies = 10, campaignMoraleDelta = 0): ArmyData {
  return {
    id: 1,
    owner: 'player',
    name: 'Legio Test',
    size: cohorts.reduce((sum, c) => sum + c.stats.hp, 0),
    cohorts,
    legateId: null,
    supplies,
    campaignMoraleDelta,
    provinceIndex: 0,
    targetProvinceIndex: null,
    progress: 0,
    path: [],
    inCombat: false,
    combatTarget: null,
    lastRoll: 0,
  };
}

function reset(nav: { count: number }): void {
  resetBellumDefeatState();
  preparedArmy.value = null;
  nav.count = 0;
  setBellumDefeatNavigation(() => {
    nav.count += 1;
  });
}

const nav = { count: 0 };

// ── Morale collapse ─────────────────────────────────────────────────
// campaignMoraleDelta = -(BASE_MORALE) drives total to 0 → collapse
{
  reset(nav);
  // Delta large enough to push morale to 0: need -BASE_MORALE = -100
  preparedArmy.value = army([cohort('a')], 10, -BASE_MORALE);
  const result = evaluateBellumDefeat(state());
  assert(result.defeated, 'morale 0 should defeat');
  assert(result.triggered, 'morale collapse should trigger first evaluation');
  assert(result.reason === 'morale-collapse', 'morale collapse reason');
  assert(nav.count === 1, 'morale collapse navigates once');

  const again = evaluateBellumDefeat(state());
  assert(again.defeated, 'repeat morale check still reports defeated');
  assert(!again.triggered, 'repeat morale check is idempotent');
  assert(nav.count === 1, 'repeat morale check does not navigate twice');
}
console.log('PASS: morale collapse defeats exactly once');

// ── Starvation collapse ─────────────────────────────────────────────
{
  reset(nav);
  // supplies = 0, morale neutral
  preparedArmy.value = army([cohort('a')], 0, 0);
  for (let i = 1; i < BELLUM_ZERO_SUPPLY_DEFEAT_THRESHOLD; i++) {
    const result = evaluateBellumDefeat(state(), { countZeroSupplyMove: true });
    assert(!result.defeated, `zero-supply move ${i} should be warning-only`);
    assert(result.warning.starvationWarning, 'zero-supply move sets warning state');
    assert(result.warning.zeroSupplyMoveStreak === i, `streak should be ${i}`);
  }

  const defeat = evaluateBellumDefeat(state(), { countZeroSupplyMove: true });
  assert(defeat.defeated, 'sustained zero-supply movement should defeat at threshold');
  assert(defeat.triggered, 'starvation threshold triggers defeat');
  assert(defeat.reason === 'starvation-collapse', 'starvation collapse reason');
  assert(nav.count === 1, 'starvation collapse navigates once');
}
console.log('PASS: starvation collapse uses warning grace threshold');

// ── Supply recovery resets starvation warning ──────────────────────
{
  reset(nav);
  preparedArmy.value = army([cohort('a')], 0, 0);
  evaluateBellumDefeat(state(), { countZeroSupplyMove: true });
  assert(bellumWarningState.value.zeroSupplyMoveStreak === 1, 'first zero-supply move increments streak');

  // Now restore supplies on preparedArmy
  preparedArmy.value = army([cohort('a')], 5, 0);
  const recovered = evaluateBellumDefeat(state());
  assert(!recovered.defeated, 'supply recovery should not defeat');
  assert(recovered.warning.zeroSupplyMoveStreak === 0, 'supply recovery resets starvation streak');
  assert(!recovered.warning.starvationWarning, 'supply recovery clears starvation warning');
}
console.log('PASS: supplies recovery resets starvation warning');

// ── Army-wiped defeat ───────────────────────────────────────────────
{
  reset(nav);
  preparedArmy.value = army([], 10, 0);
  const empty = evaluateBellumDefeat(state(), { checkArmy: true });
  assert(empty.defeated, 'empty preparedArmy cohorts should defeat');
  assert(empty.reason === 'army-wiped', 'empty army defeat reason');

  reset(nav);
  preparedArmy.value = army([cohort('a', true), cohort('b', true)], 10, 0);
  const allOut = evaluateBellumDefeat(state(), { checkArmy: true });
  assert(allOut.defeated, 'all out-of-action cohorts should defeat');
  assert(allOut.reason === 'army-wiped', 'all out-of-action army defeat reason');

  reset(nav);
  preparedArmy.value = army([cohort('a', true), cohort('b', false)], 10, 0);
  const oneActive = evaluateBellumDefeat(state(), { checkArmy: true });
  assert(!oneActive.defeated, 'one deployable cohort should not defeat');
  assert(bellumDefeatReason.value === null, 'one deployable cohort leaves defeat reason clear');
}
console.log('PASS: wiped-army defeat checks empty/all-out rosters only');

// ── Morale critical warning ─────────────────────────────────────────
{
  reset(nav);
  // Delta of -85 pushes total to 15 (below 20 threshold, above 0)
  preparedArmy.value = army([cohort('a')], 10, -85);
  const warn = evaluateBellumDefeat(state());
  assert(!warn.defeated, 'morale 15 should not defeat yet');
  assert(warn.warning.moraleCritical, 'morale ≤ 20 sets moraleCritical warning');
}
console.log('PASS: morale critical warning fires before collapse');

setBellumDefeatNavigation(null);
preparedArmy.value = null;
resetBellumDefeatState();

console.log('\nAll Bellum defeat checks passed');
