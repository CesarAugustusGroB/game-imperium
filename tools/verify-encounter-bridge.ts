// S31-05a / S33-05: encounter-bridge dispatch tests.
// Run with: npx tsx tools/verify-encounter-bridge.ts
//
// S33-05 migration: morale/supply mutations now live on `preparedArmy`
// (via `addCampaignMorale`/`addArmySupplies`). Assertions updated accordingly.
// `computeBellumMorale` is used to read current morale; `BASE_MORALE` is the
// neutral starting point before any campaign delta.
//
// hex-battle uses an injected navigation hook so the transitive import chain
// stays node-runnable; without registering the hook, launchHexBattle returns
// false and dispatch falls back to the placeholder casualty deltas — exactly
// what these tests assert.

import { resolveEncounter } from '../src/game/campaign/encounter-bridge';
import { campaignState, hexTiles, setActiveEvent, setTiles } from '../src/game/campaign/campaign-state';
import { resetBellumDefeatState } from '../src/game/campaign/campaign-defeat';
import { gold } from '../src/game/core/resources';
import type { HexTile, EventType } from '../src/game/campaign/campaign-types';
import { preparedArmy } from '../src/game/progression/strategic-store';
import { computeBellumMorale } from '../src/game/campaign/bellum-army-view';
import { __resetMoraleContributors, BASE_MORALE, registerMoraleContributor } from '../src/game/army/morale';
import { SUPPLY_MAX_CARRY } from '../src/config/game-config';
import type { ArmyData, Cohort } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

// Controlled morale contributor — only campaignMoraleDelta, no legate/doctrine noise.
__resetMoraleContributors();
registerMoraleContributor((spoke) => {
  const delta = spoke.boundArmy?.campaignMoraleDelta ?? 0;
  if (delta === 0) return [];
  return [{ source: 'campaign', label: 'Campaign events', delta }];
});

function makeTile(event: EventType): HexTile {
  return {
    id: '0,0',
    q: 0,
    r: 0,
    terrain: 'plains',
    event,
    discovered: true,
    visited: true,
    reachable: false,
    current: true,
    movementCost: 1,
  };
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

function reset(supplies: number, campaignMoraleDelta: number, goldAmount: number): void {
  resetBellumDefeatState();
  const tile = makeTile('battle');
  setTiles([tile]);
  setActiveEvent(tile.id);
  campaignState.value = {
    currentTileId: '0,0',
    selectedTileId: null,
    movementPoints: 2,
  };
  preparedArmy.value = makeArmy(supplies, campaignMoraleDelta);
  gold.value = goldAmount;
}

function getSupplies(): number {
  return preparedArmy.value?.supplies ?? 0;
}

function getMoraleTotal(): number {
  return computeBellumMorale().total;
}

// ── rest ────────────────────────────────────────────────────────────
{
  reset(20, 0, 0); // morale starts at BASE_MORALE (100)
  const out = resolveEncounter(makeTile('rest'), 0);
  assert(out.consumed, 'rest consumes event');
  assert(getMoraleTotal() === BASE_MORALE + 20, `rest morale +20: expected ${BASE_MORALE + 20}, got ${getMoraleTotal()}`);
  assert(hexTiles.value[0].event === 'none', 'rest clears hex event');
}
console.log('PASS: rest applies +20 morale delta');

// ── forage (supply) ────────────────────────────────────────────────
{
  reset(30, 0, 0);
  resolveEncounter(makeTile('supply'), 0);
  assert(getSupplies() === 40, `forage supplies +10: expected 40, got ${getSupplies()}`);
  assert(getMoraleTotal() === BASE_MORALE + 1, `forage morale +1: expected ${BASE_MORALE + 1}, got ${getMoraleTotal()}`);
}
console.log('PASS: forage applies +10 supplies and +1 morale delta');

// ── merchant: trade with sufficient gold ───────────────────────────
{
  reset(20, 0, 50);
  resolveEncounter(makeTile('merchant'), 0);
  assert(gold.value === 40, `merchant trade -10 gold: expected 40, got ${gold.value}`);
  assert(getSupplies() === 25, `merchant +5 supplies: expected 25, got ${getSupplies()}`);
}
console.log('PASS: merchant trade with sufficient gold');

// ── merchant: trade with insufficient gold ─────────────────────────
{
  reset(20, 0, 5);
  resolveEncounter(makeTile('merchant'), 0);
  assert(gold.value === 5, 'merchant: gold unchanged when broke');
  assert(getSupplies() === 20, 'merchant: supplies unchanged when broke');
}
console.log('PASS: merchant trade no-op when broke');

// ── merchant: ignore ───────────────────────────────────────────────
{
  reset(20, 0, 50);
  resolveEncounter(makeTile('merchant'), 1);
  assert(gold.value === 50, 'merchant ignore: gold unchanged');
  assert(getSupplies() === 20, 'merchant ignore: supplies unchanged');
  assert(getMoraleTotal() === BASE_MORALE, 'merchant ignore: morale unchanged');
}
console.log('PASS: merchant ignore is a no-op');

// ── story (event) ──────────────────────────────────────────────────
{
  reset(20, 0, 50);
  const out = resolveEncounter(makeTile('story'), 0);
  assert(out.consumed, 'story consumes event');
  assert(getMoraleTotal() === BASE_MORALE, 'story: morale unchanged');
  assert(getSupplies() === 20, 'story: supplies unchanged');
}
console.log('PASS: story is flavor-only');

// ── battle: Fight ───────────────────────────────────────────────────
{
  reset(20, 0, 0);
  resolveEncounter(makeTile('battle'), 0);
  assert(getMoraleTotal() === BASE_MORALE - 10, `battle Fight morale -10: got ${getMoraleTotal()}`);
  assert(getSupplies() === 17, `battle Fight supplies -3: got ${getSupplies()}`);
}
console.log('PASS: battle Fight applies casualty deltas');

// ── battle: Retreat ─────────────────────────────────────────────────
{
  reset(20, 0, 0);
  resolveEncounter(makeTile('battle'), 1);
  assert(getMoraleTotal() === BASE_MORALE - 5, `battle Retreat morale -5: got ${getMoraleTotal()}`);
  assert(getSupplies() === 20, 'battle Retreat: supplies unchanged');
}
console.log('PASS: battle Retreat applies smaller morale hit');

// ── elite: Engage ───────────────────────────────────────────────────
{
  reset(20, 0, 0);
  resolveEncounter(makeTile('elite'), 0);
  assert(getMoraleTotal() === BASE_MORALE - 12, `elite Engage morale -12: got ${getMoraleTotal()}`);
  assert(getSupplies() === 16, `elite Engage supplies -4: got ${getSupplies()}`);
}
console.log('PASS: elite Engage applies harder casualty deltas');

// ── elite: Avoid ────────────────────────────────────────────────────
{
  reset(20, 0, 0);
  resolveEncounter(makeTile('elite'), 1);
  assert(getMoraleTotal() === BASE_MORALE - 2, `elite Avoid morale -2: got ${getMoraleTotal()}`);
}
console.log('PASS: elite Avoid is a small morale knock');

// ── ambush ──────────────────────────────────────────────────────────
{
  reset(20, 0, 0);
  resolveEncounter(makeTile('ambush'), 0);
  assert(getMoraleTotal() === BASE_MORALE - 8, `ambush morale -8: got ${getMoraleTotal()}`);
  assert(getSupplies() === 18, `ambush supplies -2: got ${getSupplies()}`);
}
console.log('PASS: ambush applies fixed casualty deltas');

// ── unmapped event (none) ──────────────────────────────────────────
{
  reset(20, 0, 0);
  const out = resolveEncounter(makeTile('none'), 0);
  assert(!out.consumed, 'none returns consumed:false');
  assert(getMoraleTotal() === BASE_MORALE, 'none: morale delta untouched');
}
console.log('PASS: unmapped event leaves state untouched');

// ── supply cap ─────────────────────────────────────────────────────
{
  reset(SUPPLY_MAX_CARRY - 5, 0, 0); // near cap
  resolveEncounter(makeTile('supply'), 0); // +10 supplies
  assert(getSupplies() === SUPPLY_MAX_CARRY, `forage caps at SUPPLY_MAX_CARRY (${SUPPLY_MAX_CARRY}), got ${getSupplies()}`);
}
console.log('PASS: supply cap holds at SUPPLY_MAX_CARRY');

// ── supply floor ───────────────────────────────────────────────────
{
  reset(0, 0, 0);
  resolveEncounter(makeTile('battle'), 0); // supplies -3
  assert(getSupplies() === 0, 'supplies floor at 0');
}
console.log('PASS: supplies floor at 0');

preparedArmy.value = null;

console.log('\nAll encounter-bridge checks passed');
