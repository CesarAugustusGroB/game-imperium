// S33-06: Bellum encounter-effects pipeline verification.
// Run with: npx tsx tools/verify-bellum-encounter-effects.ts
//
// Covers:
//  1. Each effect type applies correctly (morale, supplies, iuniores+,
//     iuniores-, reveal, scout, battle-modifier, threat).
//  2. Double-apply guard: second resolveEncounter on the same tile returns
//     consumed:false and state unchanged.
//  3. iuniores negative clamp: balance=5, effect=-10 → only 5 drained.
//  4. iuniores zero balance: no spend, no AppliedLine emitted.
//  5. reveal radius=2 marks origin + 2 rings discovered.
//  6. battle-modifier appends to tile and survives a second encounter.
//  7. Encounter table coverage: every entry's effects round-trip through
//     applyBellumEffects without throwing.

import { applyBellumEffects } from '../src/game/campaign/bellum-encounter-effects';
import { resolveEncounter } from '../src/game/campaign/encounter-bridge';
import { hexTiles, setTiles, campaignState } from '../src/game/campaign/campaign-state';
import { resetBellumDefeatState } from '../src/game/campaign/campaign-defeat';
import { preparedArmy } from '../src/game/progression/strategic-store';
import { computeBellumMorale } from '../src/game/campaign/bellum-army-view';
import {
  __resetMoraleContributors,
  BASE_MORALE,
  registerMoraleContributor,
} from '../src/game/army/morale';
import { iuniores, gold } from '../src/game/core/resources';
import { threatLevel } from '../src/game/core/game-state';
import type { HexTile, EventType } from '../src/game/campaign/campaign-types';
import type { ArmyData, Cohort } from '../src/types';
import { BELLUM_ENCOUNTER_TABLE } from '../src/game/campaign/encounter-effects-data';
import { bellumGains, resetBellumGains } from '../src/game/campaign/bellum-run-gains';

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

function makeTile(event: EventType, id = '0,0', q = 0, r = 0): HexTile {
  return {
    id,
    q,
    r,
    terrain: 'plains',
    event,
    discovered: true,
    visited: true,
    reachable: false,
    current: true,
    movementCost: 1,
  };
}

// Build a small 5-tile cross grid for reveal tests:
//         (0,-1)
//  (-1,0) (0,0) (1,0)
//         (0,1)
// plus (0,-2) to test radius=2
function makeCrossGrid(): HexTile[] {
  const tiles: HexTile[] = [
    { id: '0,0',  q: 0,  r: 0,  terrain: 'plains', event: 'none', discovered: false, visited: false, reachable: false, current: false, movementCost: 1 },
    { id: '0,-1', q: 0,  r: -1, terrain: 'plains', event: 'none', discovered: false, visited: false, reachable: false, current: false, movementCost: 1 },
    { id: '0,1',  q: 0,  r: 1,  terrain: 'plains', event: 'none', discovered: false, visited: false, reachable: false, current: false, movementCost: 1 },
    { id: '-1,0', q: -1, r: 0,  terrain: 'plains', event: 'none', discovered: false, visited: false, reachable: false, current: false, movementCost: 1 },
    { id: '1,0',  q: 1,  r: 0,  terrain: 'plains', event: 'none', discovered: false, visited: false, reachable: false, current: false, movementCost: 1 },
    { id: '0,-2', q: 0,  r: -2, terrain: 'plains', event: 'none', discovered: false, visited: false, reachable: false, current: false, movementCost: 1 },
    { id: '0,2',  q: 0,  r: 2,  terrain: 'plains', event: 'none', discovered: false, visited: false, reachable: false, current: false, movementCost: 1 },
    { id: '-1,1', q: -1, r: 1,  terrain: 'plains', event: 'none', discovered: false, visited: false, reachable: false, current: false, movementCost: 1 },
    { id: '1,-1', q: 1,  r: -1, terrain: 'plains', event: 'none', discovered: false, visited: false, reachable: false, current: false, movementCost: 1 },
    { id: '-2,0', q: -2, r: 0,  terrain: 'plains', event: 'none', discovered: false, visited: false, reachable: false, current: false, movementCost: 1 },
    { id: '2,0',  q: 2,  r: 0,  terrain: 'plains', event: 'none', discovered: false, visited: false, reachable: false, current: false, movementCost: 1 },
    { id: '-1,-1',q: -1, r: -1, terrain: 'plains', event: 'none', discovered: false, visited: false, reachable: false, current: false, movementCost: 1 },
    { id: '1,1',  q: 1,  r: 1,  terrain: 'plains', event: 'none', discovered: false, visited: false, reachable: false, current: false, movementCost: 1 },
  ];
  return tiles;
}

function resetState(supplies = 20, moraleDelta = 0, goldAmt = 0): void {
  resetBellumDefeatState();
  campaignState.value = { currentTileId: '0,0', selectedTileId: null, movementPoints: 5 };
  preparedArmy.value = makeArmy(supplies, moraleDelta);
  gold.value = goldAmt;
  iuniores.value = 0;
  threatLevel.value = 0;
}

// ── 1a. morale effect ────────────────────────────────────────────────────
{
  resetState(20);
  const tile = makeTile('none');
  setTiles([tile]);
  const lines = applyBellumEffects(
    [{ type: 'morale', delta: 15, label: 'Test morale' }],
    tile,
  );
  assert(lines.length === 1, '1a: one AppliedLine for morale');
  assert(lines[0].kind === 'morale', '1a: kind === morale');
  assert(lines[0].delta === 15, '1a: delta === 15');
  assert(computeBellumMorale().total === BASE_MORALE + 15, `1a: morale total ${BASE_MORALE + 15}`);
}
console.log('PASS 1a: morale effect');

// ── 1b. supplies effect ──────────────────────────────────────────────────
{
  resetState(20);
  const tile = makeTile('none');
  setTiles([tile]);
  const lines = applyBellumEffects(
    [{ type: 'supplies', delta: 8, label: 'Test supplies' }],
    tile,
  );
  assert(lines.length === 1, '1b: one AppliedLine for supplies');
  assert(lines[0].kind === 'supplies', '1b: kind === supplies');
  assert(preparedArmy.value!.supplies === 28, `1b: supplies 28, got ${preparedArmy.value!.supplies}`);
}
console.log('PASS 1b: supplies effect');

// ── 1c. iuniores positive ────────────────────────────────────────────────
{
  resetState();
  iuniores.value = 5;
  const lines = applyBellumEffects(
    [{ type: 'iuniores', delta: 10, label: 'Iuniores gain' }],
    null,
  );
  assert(lines.length === 1, '1c: one AppliedLine for iuniores+');
  assert(lines[0].kind === 'iuniores', '1c: kind === iuniores');
  // addResource applies floor(amount * multiplier); no faction so plain +10
  assert(iuniores.value === 15, `1c: iuniores 15, got ${iuniores.value}`);
}
console.log('PASS 1c: iuniores positive effect');

// ── 1d. iuniores negative (partial drain) ───────────────────────────────
{
  resetState();
  iuniores.value = 8;
  const lines = applyBellumEffects(
    [{ type: 'iuniores', delta: -5, label: 'Iuniores drain' }],
    null,
  );
  assert(lines.length === 1, '1d: one AppliedLine for iuniores-');
  assert(lines[0].kind === 'iuniores', '1d: kind === iuniores');
  assert(iuniores.value === 3, `1d: iuniores 3, got ${iuniores.value}`);
}
console.log('PASS 1d: iuniores negative drain effect');

// ── 1e. reveal effect ────────────────────────────────────────────────────
{
  resetState();
  const grid = makeCrossGrid();
  setTiles(grid);
  const originTile = grid.find((t) => t.id === '0,0')!;
  const lines = applyBellumEffects(
    [{ type: 'reveal', radius: 1, label: 'Reveal ring 1' }],
    originTile,
  );
  assert(lines.length === 1, '1e: one AppliedLine for reveal');
  assert(lines[0].kind === 'reveal', '1e: kind === reveal');
  // origin + 6 immediate neighbors should all be discovered
  const discovered = hexTiles.value.filter((t) => t.discovered).map((t) => t.id);
  assert(discovered.includes('0,0'),  '1e: origin discovered');
  assert(discovered.includes('0,-1'), '1e: north discovered');
  assert(discovered.includes('1,0'),  '1e: east discovered');
  assert(discovered.includes('0,1'),  '1e: south discovered');
  assert(discovered.includes('-1,0'), '1e: west discovered');
}
console.log('PASS 1e: reveal effect');

// ── 1f. scout effect ─────────────────────────────────────────────────────
{
  resetState();
  const grid = makeCrossGrid();
  setTiles(grid);
  const originTile = grid.find((t) => t.id === '0,0')!;
  const lines = applyBellumEffects(
    [{ type: 'scout', radius: 1, toLevel: 2, label: 'Scout recon' }],
    originTile,
  );
  assert(lines.length === 1, '1f: one AppliedLine for scout');
  assert(lines[0].kind === 'scout', '1f: kind === scout');
  const origin = hexTiles.value.find((t) => t.id === '0,0')!;
  assert(origin.discovered, '1f: origin discovered');
  assert(origin.scoutedLevel === 2, `1f: origin scoutedLevel=2, got ${origin.scoutedLevel}`);
  const neighbor = hexTiles.value.find((t) => t.id === '0,-1')!;
  assert(neighbor.scoutedLevel === 2, '1f: neighbor scoutedLevel=2');
}
console.log('PASS 1f: scout effect');

// ── 1g. battle-modifier effect ───────────────────────────────────────────
{
  resetState();
  const tile = makeTile('none');
  setTiles([tile]);
  const lines = applyBellumEffects(
    [{ type: 'battle-modifier', modifierId: 'high_ground', label: 'High ground' }],
    tile,
  );
  assert(lines.length === 1, '1g: one AppliedLine for battle-modifier');
  assert(lines[0].kind === 'battle-modifier', '1g: kind === battle-modifier');
  const stored = hexTiles.value.find((t) => t.id === '0,0');
  assert(stored?.battleModifiers?.includes('high_ground'), '1g: high_ground stored on tile');
}
console.log('PASS 1g: battle-modifier effect');

// ── 1h. threat effect ────────────────────────────────────────────────────
{
  resetState();
  threatLevel.value = 10;
  const lines = applyBellumEffects(
    [{ type: 'threat', delta: 5, label: 'Threat rise' }],
    null,
  );
  assert(lines.length === 1, '1h: one AppliedLine for threat');
  assert(lines[0].kind === 'threat', '1h: kind === threat');
  assert(threatLevel.value === 15, `1h: threatLevel 15, got ${threatLevel.value}`);
}
console.log('PASS 1h: threat effect');

// ── 2. Double-apply guard ────────────────────────────────────────────────
// consumeEvent clears tile.event to 'none' in hexTiles. To simulate a second
// click, we must pass the LIVE tile from hexTiles (which has event='none')
// rather than the original stale reference.
{
  resetState(20, 0, 0);
  const tile = makeTile('rest');
  setTiles([tile]);
  preparedArmy.value = makeArmy(20, 0);

  const first = resolveEncounter(tile, 0);
  assert(first.consumed, '2: first call consumed');
  const moraleAfterFirst = computeBellumMorale().total;

  // The live tile now has event='none' after consumeEvent ran.
  const liveTile = hexTiles.value.find((t) => t.id === tile.id)!;
  const second = resolveEncounter(liveTile, 0);
  assert(!second.consumed, '2: second call not consumed (event already cleared)');
  const moraleAfterSecond = computeBellumMorale().total;
  assert(moraleAfterFirst === moraleAfterSecond, '2: state unchanged on second call');
}
console.log('PASS 2: double-apply guard');

// ── 3. iuniores negative clamp: balance=5, effect=-10 → drain 5 ──────────
{
  resetState();
  iuniores.value = 5;
  const lines = applyBellumEffects(
    [{ type: 'iuniores', delta: -10, label: 'Drain' }],
    null,
  );
  assert(lines.length === 1, '3: AppliedLine emitted');
  assert(lines[0].delta === -5, `3: delta clamped to -5, got ${lines[0].delta}`);
  assert(iuniores.value === 0, `3: iuniores drained to 0, got ${iuniores.value}`);
}
console.log('PASS 3: iuniores negative clamp (balance 5, drain -10 → -5)');

// ── 4. iuniores negative zero balance: no spend, no AppliedLine ──────────
{
  resetState();
  iuniores.value = 0;
  const lines = applyBellumEffects(
    [{ type: 'iuniores', delta: -10, label: 'Drain at zero' }],
    null,
  );
  assert(lines.length === 0, '4: no AppliedLine when balance is 0');
  assert(iuniores.value === 0, '4: iuniores stays at 0');
}
console.log('PASS 4: iuniores negative zero balance skips AppliedLine');

// ── 5. reveal radius=2 marks origin + 2 rings discovered ─────────────────
{
  resetState();
  const grid = makeCrossGrid();
  setTiles(grid);
  const originTile = grid.find((t) => t.id === '0,0')!;
  applyBellumEffects(
    [{ type: 'reveal', radius: 2, label: 'Reveal 2 rings' }],
    originTile,
  );
  // Ring 0: origin
  assert(hexTiles.value.find((t) => t.id === '0,0')?.discovered, '5: origin discovered');
  // Ring 1: immediate neighbors
  assert(hexTiles.value.find((t) => t.id === '0,-1')?.discovered, '5: (0,-1) ring 1');
  assert(hexTiles.value.find((t) => t.id === '0,1')?.discovered,  '5: (0,1) ring 1');
  assert(hexTiles.value.find((t) => t.id === '-1,0')?.discovered, '5: (-1,0) ring 1');
  assert(hexTiles.value.find((t) => t.id === '1,0')?.discovered,  '5: (1,0) ring 1');
  // Ring 2: tiles two steps away that exist in grid
  assert(hexTiles.value.find((t) => t.id === '0,-2')?.discovered, '5: (0,-2) ring 2');
  assert(hexTiles.value.find((t) => t.id === '0,2')?.discovered,  '5: (0,2) ring 2');
}
console.log('PASS 5: reveal radius=2 marks origin + 2 rings discovered');

// ── 6. battle-modifier appends and survives second encounter ─────────────
{
  resetState();
  const tile = makeTile('none');
  setTiles([tile]);

  // First modifier
  applyBellumEffects(
    [{ type: 'battle-modifier', modifierId: 'high_ground', label: 'High ground' }],
    tile,
  );
  // Second modifier on same tile
  applyBellumEffects(
    [{ type: 'battle-modifier', modifierId: 'mud', label: 'Mud' }],
    tile,
  );

  const stored = hexTiles.value.find((t) => t.id === '0,0');
  assert(stored?.battleModifiers?.includes('high_ground'), '6: high_ground on tile');
  assert(stored?.battleModifiers?.includes('mud'), '6: mud on tile');
  assert(stored?.battleModifiers?.length === 2, `6: exactly 2 modifiers, got ${stored?.battleModifiers?.length}`);

  // Dedup: applying high_ground again should not duplicate
  applyBellumEffects(
    [{ type: 'battle-modifier', modifierId: 'high_ground', label: 'High ground again' }],
    tile,
  );
  const after = hexTiles.value.find((t) => t.id === '0,0');
  assert(after?.battleModifiers?.length === 2, '6: no duplicate modifiers');
}
console.log('PASS 6: battle-modifier appends, deduplicates, survives second encounter');

// ── 7. Encounter table coverage ──────────────────────────────────────────
{
  resetState(100, 0, 100);
  iuniores.value = 50;
  threatLevel.value = 0;
  const grid = makeCrossGrid();
  setTiles(grid);
  const originTile = grid.find((t) => t.id === '0,0')!;

  let totalActions = 0;
  for (const [encounterType, actions] of Object.entries(BELLUM_ENCOUNTER_TABLE)) {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      // Reset army so we don't run into null army no-ops masking real failures
      preparedArmy.value = makeArmy(100, 0);
      // Reset tiles so reveals start fresh
      const freshGrid = makeCrossGrid();
      setTiles(freshGrid);
      const freshOrigin = freshGrid.find((t) => t.id === '0,0')!;

      let threw = false;
      try {
        applyBellumEffects(action.effects, freshOrigin);
      } catch (e) {
        threw = true;
        console.error(`  ERROR in ${encounterType}[${i}]:`, e);
      }
      assert(!threw, `7: ${encounterType}[${i}] threw an error`);
      totalActions++;
    }
  }
  console.log(`  (${totalActions} table actions round-tripped without throwing)`);
}
console.log('PASS 7: encounter table coverage — every entry round-trips without throwing');

// ── 8. Recruit iuniores grants flow through bellumGains tracker ──────────

// 8a. Positive grant: bellumGains.iuniores tracks the gain
{
  resetState(20, 0, 0);
  resetBellumGains();
  iuniores.value = 0;

  const tile = makeTile('recruit');
  setTiles([tile]);
  preparedArmy.value = makeArmy(20, 0);

  applyBellumEffects(
    [
      { type: 'iuniores', delta: 250, label: 'Local braves' },
      { type: 'morale',   delta: 2,   label: 'Welcomed allies' },
    ],
    tile,
  );

  assert(iuniores.value === 250, `8a: iuniores.value === 250, got ${iuniores.value}`);
  assert(bellumGains.value.iuniores === 250, `8a: bellumGains.iuniores === 250, got ${bellumGains.value.iuniores}`);
}
console.log('PASS 8a: recruit iuniores grant flows through bellumGains tracker');

// 8b. Negative drain: bellumGains is unchanged (gains tracker, not net P&L)
{
  resetState(20, 0, 0);
  resetBellumGains();
  iuniores.value = 100;

  applyBellumEffects(
    [{ type: 'iuniores', delta: -50, label: 'Drain test' }],
    null,
  );

  assert(iuniores.value === 50, `8b: iuniores.value === 50 after drain, got ${iuniores.value}`);
  assert(
    bellumGains.value.iuniores === 0,
    `8b: bellumGains.iuniores unchanged (0) after drain, got ${bellumGains.value.iuniores}`,
  );
}
console.log('PASS 8b: negative iuniores drain does not decrement bellumGains tracker');

preparedArmy.value = null;
console.log('\nAll bellum-encounter-effects checks passed');
