// S33-02: Bellum defeat helper checks.
// Run with: npx tsx tools/verify-bellum-defeat.ts

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
import type { ArmyData, Cohort } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function state(supplies: number, morale: number): CampaignState {
  return {
    currentTileId: '0,0',
    selectedTileId: null,
    movementPoints: 2,
    supplies,
    morale,
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

function army(cohorts: Cohort[]): ArmyData {
  return {
    id: 1,
    owner: 'player',
    name: 'Legio Test',
    size: cohorts.reduce((sum, c) => sum + c.stats.hp, 0),
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

function reset(nav: { count: number }): void {
  resetBellumDefeatState();
  preparedArmy.value = null;
  nav.count = 0;
  setBellumDefeatNavigation(() => {
    nav.count += 1;
  });
}

const nav = { count: 0 };

{
  reset(nav);
  const result = evaluateBellumDefeat(state(10, 0));
  assert(result.defeated, 'morale 0 should defeat');
  assert(result.triggered, 'morale collapse should trigger first evaluation');
  assert(result.reason === 'morale-collapse', 'morale collapse reason');
  assert(nav.count === 1, 'morale collapse navigates once');

  const again = evaluateBellumDefeat(state(10, 0));
  assert(again.defeated, 'repeat morale check still reports defeated');
  assert(!again.triggered, 'repeat morale check is idempotent');
  assert(nav.count === 1, 'repeat morale check does not navigate twice');
}
console.log('PASS: morale collapse defeats exactly once');

{
  reset(nav);
  for (let i = 1; i < BELLUM_ZERO_SUPPLY_DEFEAT_THRESHOLD; i++) {
    const result = evaluateBellumDefeat(state(0, 50), { countZeroSupplyMove: true });
    assert(!result.defeated, `zero-supply move ${i} should be warning-only`);
    assert(result.warning.starvationWarning, 'zero-supply move sets warning state');
    assert(result.warning.zeroSupplyMoveStreak === i, `streak should be ${i}`);
  }

  const defeat = evaluateBellumDefeat(state(0, 50), { countZeroSupplyMove: true });
  assert(defeat.defeated, 'sustained zero-supply movement should defeat at threshold');
  assert(defeat.triggered, 'starvation threshold triggers defeat');
  assert(defeat.reason === 'starvation-collapse', 'starvation collapse reason');
  assert(nav.count === 1, 'starvation collapse navigates once');
}
console.log('PASS: starvation collapse uses warning grace threshold');

{
  reset(nav);
  evaluateBellumDefeat(state(0, 50), { countZeroSupplyMove: true });
  assert(bellumWarningState.value.zeroSupplyMoveStreak === 1, 'first zero-supply move increments streak');

  const recovered = evaluateBellumDefeat(state(5, 50));
  assert(!recovered.defeated, 'supply recovery should not defeat');
  assert(recovered.warning.zeroSupplyMoveStreak === 0, 'supply recovery resets starvation streak');
  assert(!recovered.warning.starvationWarning, 'supply recovery clears starvation warning');
}
console.log('PASS: supplies recovery resets starvation warning');

{
  reset(nav);
  preparedArmy.value = army([]);
  const empty = evaluateBellumDefeat(state(10, 50), { checkArmy: true });
  assert(empty.defeated, 'empty preparedArmy cohorts should defeat');
  assert(empty.reason === 'army-wiped', 'empty army defeat reason');

  reset(nav);
  preparedArmy.value = army([cohort('a', true), cohort('b', true)]);
  const allOut = evaluateBellumDefeat(state(10, 50), { checkArmy: true });
  assert(allOut.defeated, 'all out-of-action cohorts should defeat');
  assert(allOut.reason === 'army-wiped', 'all out-of-action army defeat reason');

  reset(nav);
  preparedArmy.value = army([cohort('a', true), cohort('b', false)]);
  const oneActive = evaluateBellumDefeat(state(10, 50), { checkArmy: true });
  assert(!oneActive.defeated, 'one deployable cohort should not defeat');
  assert(bellumDefeatReason.value === null, 'one deployable cohort leaves defeat reason clear');
}
console.log('PASS: wiped-army defeat checks empty/all-out rosters only');

setBellumDefeatNavigation(null);
preparedArmy.value = null;
resetBellumDefeatState();

console.log('\nAll Bellum defeat checks passed');
