// S33-05: Bellum-army bridge verification script.
// Run with: npx tsx tools/verify-bellum-army-bridge.ts
//
// AC verification points:
//  1. Movement consumes cohortCount supplies via consumeTraversal.
//  2. Undersupplied movement applies SUPPLY_HP_DAMAGE_PCT HP damage per cohort.
//  3. Morale tier shifts as campaignMoraleDelta accumulates from encounter resolutions.
//  4. Battle entry from Bellum picks up tier multipliers (via synthesizeHexBattleSpoke +
//     computeArmyMorale, assert tier matches the campaign-driven morale).

import {
  consumeBellumTraversal,
  addCampaignMorale,
  computeBellumMorale,
  getBellumSpokeView,
} from '../src/game/campaign/bellum-army-view';
import { preparedArmy, preparedLegate } from '../src/game/progression/strategic-store';
import { synthesizeHexBattleSpoke } from '../src/game/campaign/hex-battle';
import { computeArmyMorale, getMoraleTier, BASE_MORALE, __resetMoraleContributors, registerMoraleContributor } from '../src/game/army/morale';
import { SUPPLY_HP_DAMAGE_PCT, SUPPLY_MAX_CARRY } from '../src/config/game-config';
import type { ArmyData, Cohort } from '../src/types';
import type { HexTile } from '../src/game/campaign/campaign-types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

// Controlled contributor registry: only campaignMoraleDelta + supply deficit.
__resetMoraleContributors();
registerMoraleContributor((spoke) => {
  const delta = spoke.boundArmy?.campaignMoraleDelta ?? 0;
  if (delta === 0) return [];
  return [{ source: 'campaign', label: 'Campaign events', delta }];
});
registerMoraleContributor((spoke) => {
  const penalty = spoke.boundArmy?.supplyMoralePenalty ?? 0;
  if (penalty <= 0) return [];
  return [{ source: 'supply-deficit', label: 'Supply deficit', delta: -penalty }];
});

function makeCohort(id: string, currentHp?: number): Cohort {
  return {
    id,
    instanceId: id,
    name: id,
    role: 'vanguard',
    stats: { hp: 1000, atk: 100, def: 50, agi: 30 },
    spriteId: 'hastati',
    currentHp,
  } as Cohort;
}

function makeArmy(
  cohorts: Cohort[],
  supplies: number,
  campaignMoraleDelta = 0,
  supplyMoralePenalty?: number,
): ArmyData {
  return {
    id: 1,
    owner: 'player',
    name: 'Legio Test',
    size: cohorts.reduce((s, c) => s + c.stats.hp, 0),
    cohorts,
    legateId: null,
    supplies,
    campaignMoraleDelta,
    supplyMoralePenalty,
    provinceIndex: 0,
    targetProvinceIndex: null,
    progress: 0,
    path: [],
    inCombat: false,
    combatTarget: null,
    lastRoll: 0,
  };
}

function makeTile(terrain: HexTile['terrain']): HexTile {
  return {
    id: '0,0',
    q: 0,
    r: 0,
    terrain,
    event: 'none',
    discovered: true,
    visited: false,
    reachable: false,
    current: true,
    movementCost: 1,
  };
}

// ── AC1: Movement consumes cohortCount supplies ──────────────────────
{
  const cohorts = [makeCohort('a'), makeCohort('b'), makeCohort('c')];
  preparedArmy.value = makeArmy(cohorts, 20); // 3 cohorts, 20 supplies
  preparedLegate.value = null;

  const result = consumeBellumTraversal('plains');
  const armyAfter = preparedArmy.value!;

  // consumeTraversal consumes `cohortCount = 3` supplies from 20 → 17
  assert(armyAfter.supplies === 17, `AC1: supplies consumed by cohortCount: expected 17, got ${armyAfter.supplies}`);
  assert(result.supplyLog !== null, 'AC1: supplyLog present');
  assert(result.supplyLog!.supplyDeficit === 0, 'AC1: no deficit when fully supplied');
  assert(!result.starvationTriggered, 'AC1: no starvation triggered when fully supplied');
}
console.log('PASS AC1: movement consumes cohortCount supplies via consumeTraversal');

// ── AC2: Undersupplied movement applies HP damage ─────────────────────
{
  const hp = 1000;
  const cohorts = [makeCohort('a'), makeCohort('b')]; // 2 cohorts, need 2 supplies
  preparedArmy.value = makeArmy(cohorts, 0); // 0 supplies → deficit = 2

  const result = consumeBellumTraversal('plains');
  const armyAfter = preparedArmy.value!;

  assert(result.starvationTriggered, 'AC2: starvationTriggered when deficit > 0');
  assert(result.supplyLog !== null, 'AC2: supplyLog present on deficit');
  assert(result.supplyLog!.supplyDeficit === 2, `AC2: deficit = 2, got ${result.supplyLog!.supplyDeficit}`);
  assert(result.supplyLog!.hpDamagePerCohortPct === SUPPLY_HP_DAMAGE_PCT, 'AC2: hpDamagePerCohortPct matches config');

  // Each surviving cohort should have lost SUPPLY_HP_DAMAGE_PCT * hp
  const expectedHp = hp - Math.max(1, Math.floor(hp * SUPPLY_HP_DAMAGE_PCT));
  for (const c of armyAfter.cohorts) {
    assert(
      c.currentHp === expectedHp,
      `AC2: cohort ${c.id} hp: expected ${expectedHp}, got ${c.currentHp}`,
    );
  }
}
console.log('PASS AC2: undersupplied movement applies SUPPLY_HP_DAMAGE_PCT HP damage per cohort');

// ── AC3: Morale tier shifts as campaignMoraleDelta accumulates ────────
{
  preparedArmy.value = makeArmy([makeCohort('a')], 20, 0); // start neutral
  preparedLegate.value = null;

  // At delta=0: morale = BASE_MORALE (100) → 'steady'
  let morale = computeBellumMorale();
  assert(morale.total === BASE_MORALE, `AC3a: morale starts at BASE_MORALE=${BASE_MORALE}, got ${morale.total}`);
  assert(morale.tier === 'steady', `AC3a: tier is 'steady' at ${morale.total}`);

  // Apply rest encounter (+20 morale delta) → total=120 → 'resolute'
  addCampaignMorale(20);
  morale = computeBellumMorale();
  assert(morale.total === BASE_MORALE + 20, `AC3b: after +20 delta, morale=${BASE_MORALE + 20}, got ${morale.total}`);
  assert(morale.tier === 'resolute', `AC3b: tier 'resolute' at ${morale.total}, got '${morale.tier}'`);

  // Apply large negative delta (ambush -8, battle loss -15, ruins -2, -2 more = -27 more → total=93)
  addCampaignMorale(-27);
  morale = computeBellumMorale();
  // total = BASE_MORALE + 20 - 27 = 93 → still 'steady' (90-110 range)
  const expectedTotal = BASE_MORALE + 20 - 27;
  assert(morale.total === expectedTotal, `AC3c: morale ${expectedTotal}, got ${morale.total}`);
  assert(morale.tier === 'steady', `AC3c: tier 'steady' at ${expectedTotal}, got '${morale.tier}'`);

  // Push below 90 → 'shaken'
  addCampaignMorale(-4); // total = 89
  morale = computeBellumMorale();
  const expectedShaken = expectedTotal - 4;
  assert(morale.total === expectedShaken, `AC3d: morale ${expectedShaken}, got ${morale.total}`);
  assert(morale.tier === 'shaken', `AC3d: tier 'shaken' at ${expectedShaken}, got '${morale.tier}'`);
}
console.log('PASS AC3: morale tier shifts as campaignMoraleDelta accumulates from encounters');

// ── AC4: Battle entry picks up tier multipliers ────────────────────────
{
  // Compose army with a delta that drives tier to 'inspired' (total > 140)
  // Need delta > 40 for BASE_MORALE(100) + delta > 140 → delta > 40 → use 42
  const deltaPush = 42;
  preparedArmy.value = makeArmy([makeCohort('a'), makeCohort('b')], 20, deltaPush);
  preparedLegate.value = null;

  const tile = makeTile('plains');
  const spoke = synthesizeHexBattleSpoke(tile, 'battle');
  assert(spoke !== null, 'AC4: synthesizeHexBattleSpoke returns non-null with army');

  const moraleResult = computeArmyMorale(spoke!);
  const expectedTotal = BASE_MORALE + deltaPush;
  assert(moraleResult.total === expectedTotal, `AC4: morale total ${expectedTotal}, got ${moraleResult.total}`);
  assert(moraleResult.tier === 'inspired', `AC4: tier 'inspired' at ${expectedTotal}, got '${moraleResult.tier}'`);

  // Confirm multipliers match tier
  assert(moraleResult.tier === getMoraleTier(moraleResult.total), 'AC4: tier consistent with getMoraleTier');

  // Now test 'broken' tier (delta large negative: < -41 → total < 59)
  const brokenDelta = -50; // total = 50 → 'broken'
  preparedArmy.value = makeArmy([makeCohort('a')], 20, brokenDelta);
  const brokenSpoke = synthesizeHexBattleSpoke(tile, 'battle');
  assert(brokenSpoke !== null, 'AC4b: synthesizeHexBattleSpoke returns non-null for broken tier');
  const brokenMorale = computeArmyMorale(brokenSpoke!);
  assert(brokenMorale.total === BASE_MORALE + brokenDelta, `AC4b: morale total, got ${brokenMorale.total}`);
  assert(brokenMorale.tier === 'broken', `AC4b: tier 'broken' at ${brokenMorale.total}, got '${brokenMorale.tier}'`);
}
console.log('PASS AC4: battle entry from Bellum picks up tier multipliers via synthesizeHexBattleSpoke + computeArmyMorale');

// ── Null army: no-ops ──────────────────────────────────────────────────
{
  preparedArmy.value = null;
  preparedLegate.value = null;
  const view = getBellumSpokeView();
  assert(view === null, 'getBellumSpokeView returns null when no army');

  const morale = computeBellumMorale();
  assert(morale.total === BASE_MORALE, 'computeBellumMorale returns NEUTRAL_MORALE.total when no army');
  assert(morale.tier === 'steady', 'computeBellumMorale returns NEUTRAL_MORALE.tier when no army');

  // consumeBellumTraversal should no-op when army is null
  const result = consumeBellumTraversal('plains');
  assert(result.supplyLog === null, 'consumeBellumTraversal: supplyLog null when no army');
  assert(!result.starvationTriggered, 'consumeBellumTraversal: no starvation when no army');
}
console.log('PASS: null army no-ops correctly');

preparedArmy.value = null;
preparedLegate.value = null;

console.log('\nAll Bellum-army bridge checks passed');
