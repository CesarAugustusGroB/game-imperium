// S33-11: preparedArmy field round-trip tests for normalizeArmySnapshot.
// Run with: npx tsx tools/verify-bellum-army-save.ts
//
// Tests that supplies, campaignMoraleDelta, supplyMoralePenalty, and
// supplyDeficitStreak are clamped / normalized correctly on load.

import { normalizeArmySnapshot } from '../src/game/core/meta-save';
import { SUPPLY_MAX_CARRY, SUPPLY_MORALE_PENALTY_CAP } from '../src/config/game-config';
import type { ArmyData } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function makeArmy(overrides: Partial<ArmyData> = {}): ArmyData {
  return {
    id: 1,
    owner: 'player',
    name: 'Legio I',
    size: 100,
    cohorts: [],
    legateId: null,
    supplies: 20,
    provinceIndex: 0,
    targetProvinceIndex: null,
    progress: 0,
    path: [],
    inCombat: false,
    combatTarget: null,
    lastRoll: 0,
    ...overrides,
  };
}

// ── 1. supplies clamp ───────────────────────────────────────────────
{
  const cases: Array<[unknown, number]> = [
    [-5, 0],
    [200, SUPPLY_MAX_CARRY],
    [40, 40],
    ['abc', 0],
    [NaN, 0],
    // Infinity is not isFinite → asFiniteNumber returns fallback 0, then clamp(0,0,MAX)=0
    [Infinity, 0],
  ];
  for (const [input, expected] of cases) {
    const army = makeArmy({ supplies: input as number });
    const result = normalizeArmySnapshot(army);
    assert(result !== null, `supplies=${String(input)} result not null`);
    assert(result!.supplies === expected, `supplies ${String(input)} → ${expected} (got ${result!.supplies})`);
  }
}
console.log('PASS: supplies clamp (-5→0, 200→MAX, 40→40, abc→0)');

// ── 2. campaignMoraleDelta round-trip ───────────────────────────────
{
  const result1 = normalizeArmySnapshot(makeArmy({ campaignMoraleDelta: 15 }));
  assert(result1!.campaignMoraleDelta === 15, '+15 preserved');

  const result2 = normalizeArmySnapshot(makeArmy({ campaignMoraleDelta: -30 }));
  assert(result2!.campaignMoraleDelta === -30, '-30 preserved');

  const army3 = makeArmy();
  delete (army3 as Partial<ArmyData>).campaignMoraleDelta;
  const result3 = normalizeArmySnapshot(army3);
  assert(result3!.campaignMoraleDelta === undefined, 'undefined stays undefined');

  const result4 = normalizeArmySnapshot(makeArmy({ campaignMoraleDelta: 'foo' as unknown as number }));
  assert(result4!.campaignMoraleDelta === 0, 'foo → 0');
}
console.log('PASS: campaignMoraleDelta round-trip (+15, -30, undefined, foo→0)');

// ── 3. supplyMoralePenalty clamp ────────────────────────────────────
{
  const result1 = normalizeArmySnapshot(makeArmy({ supplyMoralePenalty: -5 }));
  assert(result1!.supplyMoralePenalty === 0, '-5 → 0');

  const result2 = normalizeArmySnapshot(makeArmy({ supplyMoralePenalty: 100 }));
  assert(result2!.supplyMoralePenalty === SUPPLY_MORALE_PENALTY_CAP, `100 → ${SUPPLY_MORALE_PENALTY_CAP}`);

  const result3 = normalizeArmySnapshot(makeArmy({ supplyMoralePenalty: 15 }));
  assert(result3!.supplyMoralePenalty === 15, '15 preserved');

  const army4 = makeArmy();
  delete (army4 as Partial<ArmyData>).supplyMoralePenalty;
  const result4 = normalizeArmySnapshot(army4);
  assert(result4!.supplyMoralePenalty === undefined, 'undefined preserved');
}
console.log('PASS: supplyMoralePenalty clamp (-5→0, 100→CAP, 15 preserved, undefined preserved)');

// ── 4. supplyDeficitStreak clamp ─────────────────────────────────────
{
  const result1 = normalizeArmySnapshot(makeArmy({ supplyDeficitStreak: -2 }));
  assert(result1!.supplyDeficitStreak === 0, '-2 → 0');

  const result2 = normalizeArmySnapshot(makeArmy({ supplyDeficitStreak: 3.7 }));
  assert(result2!.supplyDeficitStreak === 3, '3.7 → 3 (floor)');

  const result3 = normalizeArmySnapshot(makeArmy({ supplyDeficitStreak: 2 }));
  assert(result3!.supplyDeficitStreak === 2, '2 preserved');

  const army4 = makeArmy();
  delete (army4 as Partial<ArmyData>).supplyDeficitStreak;
  const result4 = normalizeArmySnapshot(army4);
  assert(result4!.supplyDeficitStreak === undefined, 'undefined preserved');
}
console.log('PASS: supplyDeficitStreak clamp (-2→0, 3.7→3, 2 preserved, undefined preserved)');

// ── 5. Round-trip via full army with all four fields ─────────────────
{
  const army = makeArmy({
    supplies: 45,
    campaignMoraleDelta: -10,
    supplyMoralePenalty: 20,
    supplyDeficitStreak: 3,
  });
  const result = normalizeArmySnapshot(army);
  assert(result !== null, 'full round-trip not null');
  assert(result!.supplies === 45, 'supplies 45 preserved');
  assert(result!.campaignMoraleDelta === -10, 'campaignMoraleDelta -10 preserved');
  assert(result!.supplyMoralePenalty === 20, 'supplyMoralePenalty 20 preserved');
  assert(result!.supplyDeficitStreak === 3, 'supplyDeficitStreak 3 preserved');
}
console.log('PASS: full round-trip with all four fields preserved');

console.log('\nAll bellum-army-save migration checks passed');
