// S31-05a: encounter-bridge dispatch tests.
// Run with: npx tsx tools/verify-encounter-bridge.ts
//
// Hits real campaign-state signals and addResource/spendResource for the
// merchant case. hex-battle uses an injected navigation hook so the
// transitive import chain stays node-runnable; without registering the
// hook, launchHexBattle returns false and dispatch falls back to the
// placeholder casualty deltas — exactly what these tests assert.

import { resolveEncounter } from '../src/game/campaign/encounter-bridge';
import { campaignState, hexTiles, setActiveEvent, setTiles } from '../src/game/campaign/campaign-state';
import { gold } from '../src/game/core/resources';
import type { HexTile, EventType } from '../src/game/campaign/campaign-types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

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

function reset(supplies: number, morale: number, goldAmount: number): void {
  const tile = makeTile('battle');
  setTiles([tile]);
  setActiveEvent(tile.id);
  campaignState.value = {
    currentTileId: '0,0',
    selectedTileId: null,
    movementPoints: 2,
    supplies,
    morale,
  };
  gold.value = goldAmount;
}

// ── rest ────────────────────────────────────────────────────────────
{
  reset(20, 50, 0);
  const out = resolveEncounter(makeTile('rest'), 0);
  assert(out.consumed, 'rest consumes event');
  assert(campaignState.value.morale === 70, `rest morale +20: expected 70, got ${campaignState.value.morale}`);
  assert(hexTiles.value[0].event === 'none', 'rest clears hex event');
}
console.log('PASS: rest applies +20 morale');

// ── forage (supply) ────────────────────────────────────────────────
{
  reset(30, 50, 0);
  resolveEncounter(makeTile('supply'), 0);
  assert(campaignState.value.supplies === 40, `forage supplies +10: expected 40, got ${campaignState.value.supplies}`);
  assert(campaignState.value.morale === 51, `forage morale +1: expected 51, got ${campaignState.value.morale}`);
}
console.log('PASS: forage applies +10 supplies and +1 morale');

// ── merchant: trade with sufficient gold ───────────────────────────
{
  reset(20, 50, 50);
  resolveEncounter(makeTile('merchant'), 0);
  assert(gold.value === 40, `merchant trade -10 gold: expected 40, got ${gold.value}`);
  assert(campaignState.value.supplies === 25, `merchant +5 supplies: expected 25, got ${campaignState.value.supplies}`);
}
console.log('PASS: merchant trade with sufficient gold');

// ── merchant: trade with insufficient gold ─────────────────────────
{
  reset(20, 50, 5);
  resolveEncounter(makeTile('merchant'), 0);
  assert(gold.value === 5, 'merchant: gold unchanged when broke');
  assert(campaignState.value.supplies === 20, 'merchant: supplies unchanged when broke');
}
console.log('PASS: merchant trade no-op when broke');

// ── merchant: ignore ───────────────────────────────────────────────
{
  reset(20, 50, 50);
  resolveEncounter(makeTile('merchant'), 1);
  assert(gold.value === 50, 'merchant ignore: gold unchanged');
  assert(campaignState.value.supplies === 20, 'merchant ignore: supplies unchanged');
  assert(campaignState.value.morale === 50, 'merchant ignore: morale unchanged');
}
console.log('PASS: merchant ignore is a no-op');

// ── story (event) ──────────────────────────────────────────────────
{
  reset(20, 50, 50);
  const out = resolveEncounter(makeTile('story'), 0);
  assert(out.consumed, 'story consumes event');
  assert(campaignState.value.morale === 50, 'story: morale unchanged');
  assert(campaignState.value.supplies === 20, 'story: supplies unchanged');
}
console.log('PASS: story is flavor-only');

// ── battle: Fight ───────────────────────────────────────────────────
{
  reset(20, 50, 0);
  resolveEncounter(makeTile('battle'), 0);
  assert(campaignState.value.morale === 40, `battle Fight morale -10: got ${campaignState.value.morale}`);
  assert(campaignState.value.supplies === 17, `battle Fight supplies -3: got ${campaignState.value.supplies}`);
}
console.log('PASS: battle Fight applies casualty deltas');

// ── battle: Retreat ─────────────────────────────────────────────────
{
  reset(20, 50, 0);
  resolveEncounter(makeTile('battle'), 1);
  assert(campaignState.value.morale === 45, `battle Retreat morale -5: got ${campaignState.value.morale}`);
  assert(campaignState.value.supplies === 20, 'battle Retreat: supplies unchanged');
}
console.log('PASS: battle Retreat applies smaller morale hit');

// ── elite: Engage ───────────────────────────────────────────────────
{
  reset(20, 50, 0);
  resolveEncounter(makeTile('elite'), 0);
  assert(campaignState.value.morale === 38, `elite Engage morale -12: got ${campaignState.value.morale}`);
  assert(campaignState.value.supplies === 16, `elite Engage supplies -4: got ${campaignState.value.supplies}`);
}
console.log('PASS: elite Engage applies harder casualty deltas');

// ── elite: Avoid ────────────────────────────────────────────────────
{
  reset(20, 50, 0);
  resolveEncounter(makeTile('elite'), 1);
  assert(campaignState.value.morale === 48, `elite Avoid morale -2: got ${campaignState.value.morale}`);
}
console.log('PASS: elite Avoid is a small morale knock');

// ── ambush ──────────────────────────────────────────────────────────
{
  reset(20, 50, 0);
  resolveEncounter(makeTile('ambush'), 0);
  assert(campaignState.value.morale === 42, `ambush morale -8: got ${campaignState.value.morale}`);
  assert(campaignState.value.supplies === 18, `ambush supplies -2: got ${campaignState.value.supplies}`);
}
console.log('PASS: ambush applies fixed casualty deltas');

// ── unmapped event (none) ──────────────────────────────────────────
{
  reset(20, 50, 0);
  const out = resolveEncounter(makeTile('none'), 0);
  assert(!out.consumed, 'none returns consumed:false');
  assert(campaignState.value.morale === 50, 'none: state untouched');
}
console.log('PASS: unmapped event leaves state untouched');

// ── clamps ──────────────────────────────────────────────────────────
{
  reset(0, 0, 0);
  resolveEncounter(makeTile('battle'), 0);
  assert(campaignState.value.supplies === 0, 'supplies floor at 0');
  assert(campaignState.value.morale === 0, 'morale floor at 0');
}
{
  reset(99, 99, 0);
  resolveEncounter(makeTile('rest'), 0);
  assert(campaignState.value.morale === 100, 'morale ceiling at 100');
}
console.log('PASS: clamps hold at 0 / 100');

console.log('\nAll encounter-bridge checks passed');
