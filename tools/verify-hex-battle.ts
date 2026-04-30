// S31-05b / S33-05: pure checks for the hex-battle helpers — terrain mapping,
// outcome deltas, marker detection.
// Run with: npx tsx tools/verify-hex-battle.ts
//
// S33-05 migration: `applyHexBattleOutcome` now writes to `preparedArmy`
// (via `addCampaignMorale`/`addArmySupplies`) rather than `campaignState`.
// Assertions updated accordingly. `computeBellumMorale` reads the delta.

import {
  HEX_ENCOUNTER_LABEL,
  applyHexBattleOutcome,
  isHexEncounterSpoke,
  terrainToBattleTerrain,
} from '../src/game/campaign/hex-battle';
import { campaignState } from '../src/game/campaign/campaign-state';
import { preparedArmy } from '../src/game/progression/strategic-store';
import { computeBellumMorale } from '../src/game/campaign/bellum-army-view';
import { __resetMoraleContributors, BASE_MORALE, registerMoraleContributor } from '../src/game/army/morale';
import type { ArmyData, Cohort } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function makeCohort(id: string): Cohort {
  return {
    id,
    instanceId: id,
    name: id,
    role: 'vanguard',
    stats: { hp: 1000, atk: 100, def: 50, agi: 30 },
    spriteId: 'hastati',
  } as Cohort;
}

function makeArmy(supplies: number, campaignMoraleDelta = 0): ArmyData {
  return {
    id: 1,
    owner: 'player',
    name: 'Legio Test',
    size: 1000,
    cohorts: [makeCohort('a')],
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

function reset(supplies: number, campaignMoraleDelta = 0): void {
  preparedArmy.value = makeArmy(supplies, campaignMoraleDelta);
  // Reset campaignState movement fields to something stable
  campaignState.value = {
    currentTileId: '0,0',
    selectedTileId: null,
    movementPoints: 2,
  };
}

// ── Terrain mapping ─────────────────────────────────────────────────
assert(terrainToBattleTerrain('plains') === 'plains', 'plains → plains');
assert(terrainToBattleTerrain('forest') === 'forest', 'forest → forest');
assert(terrainToBattleTerrain('hills') === 'hills', 'hills → hills');
assert(terrainToBattleTerrain('mountains') === 'mountains', 'mountains → mountains');
assert(terrainToBattleTerrain('river') === 'river', 'river → river');
assert(terrainToBattleTerrain('road') === 'road', 'road → road');
assert(terrainToBattleTerrain('ruins') === 'ruins', 'ruins → ruins');
assert(terrainToBattleTerrain('camp') === 'plains', 'camp falls back to plains (no battle equivalent)');
console.log('PASS: terrainToBattleTerrain mapping');

// ── isHexEncounterSpoke marker check ────────────────────────────────
assert(!isHexEncounterSpoke(null), 'null spoke is not hex encounter');
assert(
  !isHexEncounterSpoke({
    nodes: [],
    label: 'Some real spoke',
    completed: false,
    duration: 1,
    currentSeason: 1,
    posture: 'attacking',
  }),
  'real spoke without marker is not hex encounter',
);
assert(
  isHexEncounterSpoke({
    nodes: [],
    label: HEX_ENCOUNTER_LABEL,
    completed: false,
    duration: 1,
    currentSeason: 1,
    posture: 'attacking',
  }),
  'spoke with marker label is hex encounter',
);
console.log('PASS: isHexEncounterSpoke marker check');

// ── applyHexBattleOutcome — morale/supplies on preparedArmy ───────
// Use a controlled morale contributor registry so we only see campaignMoraleDelta.
__resetMoraleContributors();
registerMoraleContributor((spoke) => {
  const delta = spoke.boundArmy?.campaignMoraleDelta ?? 0;
  if (delta === 0) return [];
  return [{ source: 'campaign', label: 'Campaign events', delta }];
});

{
  // Victory: +5 morale delta, supplies unchanged
  reset(50, 0); // supplies=50, delta=0 → morale=BASE_MORALE=100
  applyHexBattleOutcome('victory');
  const morale = computeBellumMorale();
  const supplies = preparedArmy.value!.supplies;
  assert(morale.total === BASE_MORALE + 5, `victory +5 morale: expected ${BASE_MORALE + 5}, got ${morale.total}`);
  assert(supplies === 50, `victory: supplies unchanged, expected 50, got ${supplies}`);
}
console.log('PASS: victory applies +5 morale delta, supplies unchanged');

{
  // Defeat: -15 morale delta, -5 supplies
  reset(50, 0);
  applyHexBattleOutcome('defeat');
  const morale = computeBellumMorale();
  const supplies = preparedArmy.value!.supplies;
  assert(morale.total === BASE_MORALE - 15, `defeat -15 morale: expected ${BASE_MORALE - 15}, got ${morale.total}`);
  assert(supplies === 45, `defeat -5 supplies: expected 45, got ${supplies}`);
}
console.log('PASS: defeat applies -15 morale delta, -5 supplies');

{
  // Draw: -5 morale delta, supplies unchanged
  reset(50, 0);
  applyHexBattleOutcome('draw');
  const morale = computeBellumMorale();
  const supplies = preparedArmy.value!.supplies;
  assert(morale.total === BASE_MORALE - 5, `draw -5 morale: expected ${BASE_MORALE - 5}, got ${morale.total}`);
  assert(supplies === 50, `draw: supplies unchanged, got ${supplies}`);
}
console.log('PASS: draw applies -5 morale delta, supplies unchanged');

{
  // Null outcome (esc-exit): -5 morale delta, supplies unchanged
  reset(50, 0);
  applyHexBattleOutcome(null);
  const morale = computeBellumMorale();
  const supplies = preparedArmy.value!.supplies;
  assert(morale.total === BASE_MORALE - 5, `null outcome -5 morale: expected ${BASE_MORALE - 5}, got ${morale.total}`);
  assert(supplies === 50, `null outcome: supplies unchanged, got ${supplies}`);
}
console.log('PASS: null outcome (esc-exit) treated as draw');

{
  // Clamp: supplies floor at 0, and delta accumulates (morale may go below 0 at compute time but
  // campaignMoraleDelta tracks raw accumulation — the morale total clamps at tier level)
  reset(2, 0);
  applyHexBattleOutcome('defeat'); // supplies 2 - 5 = clamped to 0; delta -15
  const supplies = preparedArmy.value!.supplies;
  assert(supplies === 0, `defeat clamps supplies at 0, got ${supplies}`);
  // Raw delta is -15; morale total = 100 + (-15) = 85 (not 0 since BASE_MORALE is 100)
  const morale = computeBellumMorale();
  assert(morale.total === BASE_MORALE - 15, `defeat from 2 supplies: morale total ${BASE_MORALE - 15}, got ${morale.total}`);
}
console.log('PASS: supplies clamp at 0 on heavy defeat');

preparedArmy.value = null;

console.log('\nAll hex-battle checks passed');
