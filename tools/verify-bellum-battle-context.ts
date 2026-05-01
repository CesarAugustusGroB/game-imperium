// S33-08: Verify battle-context enrichment — terrain modifiers, strength rating,
// synthesizeHexBattleSpoke output, and deployArmy postureOffset.
// Run with: npx tsx tools/verify-bellum-battle-context.ts

import {
  terrainToAutoModifiers,
  synthesizeHexBattleSpoke,
} from '../src/game/campaign/hex-battle';
import {
  computeEnemyStrengthRating,
  generateEnemyArmy,
} from '../src/game/army/enemy-army-generator';
import { BattleState } from '../src/battle/battle-state';
import { CENTRAL_SPAWN, deployArmy } from '../src/battle/deployment';
import { preparedArmy } from '../src/game/progression/strategic-store';
import { threatLevel, globalSeason, completedSpokes } from '../src/game/core/game-state';
import type { HexTile } from '../src/game/campaign/campaign-types';
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

function makeArmy(): ArmyData {
  return {
    id: 1,
    owner: 'player',
    name: 'Legio Test',
    size: 1000,
    cohorts: [makeCohort('a')],
    legateId: null,
    supplies: 20,
    provinceIndex: 0,
    targetProvinceIndex: null,
    progress: 0,
    path: [],
    inCombat: false,
    combatTarget: null,
    lastRoll: 0,
  };
}

function makeTile(
  overrides: Partial<HexTile> & { id?: string } = {},
): HexTile {
  return {
    id: overrides.id ?? '0,0',
    q: 0,
    r: 0,
    terrain: 'plains',
    event: 'none',
    discovered: true,
    visited: true,
    reachable: false,
    current: true,
    movementCost: 1,
    ...overrides,
  };
}

// ── 1. terrainToAutoModifiers mapping ────────────────────────────────────────
{
  // Forest + regular battle → forest_cover only
  const mods = terrainToAutoModifiers('forest', 'battle');
  assert(mods.includes('forest_cover'), '1: forest/battle has forest_cover');
  assert(!mods.includes('dense_trees'), '1: forest/battle has no dense_trees');

  // Forest + ambush → forest_cover AND dense_trees
  const ambushMods = terrainToAutoModifiers('forest', 'ambush');
  assert(ambushMods.includes('forest_cover'), '1: forest/ambush has forest_cover');
  assert(ambushMods.includes('dense_trees'), '1: forest/ambush has dense_trees');

  // Hills → high_ground
  assert(terrainToAutoModifiers('hills', 'battle').includes('high_ground'), '1: hills has high_ground');

  // Plains + battle → open_field
  assert(terrainToAutoModifiers('plains', 'battle').includes('open_field'), '1: plains/battle has open_field');

  // Plains + ambush → no open_field
  assert(!terrainToAutoModifiers('plains', 'ambush').includes('open_field'), '1: plains/ambush no open_field');

  // Road + battle → open_field
  assert(terrainToAutoModifiers('road', 'battle').includes('open_field'), '1: road/battle has open_field');

  // Road + ambush → no open_field
  assert(!terrainToAutoModifiers('road', 'ambush').includes('open_field'), '1: road/ambush no open_field');

  // River → river_crossing
  assert(terrainToAutoModifiers('river', 'battle').includes('river_crossing'), '1: river has river_crossing');

  // Ruins → urban_fighting
  assert(terrainToAutoModifiers('ruins', 'battle').includes('urban_fighting'), '1: ruins has urban_fighting');

  // Camp / mountains → empty
  assert(terrainToAutoModifiers('camp', 'battle').length === 0, '1: camp returns no modifiers');
  assert(terrainToAutoModifiers('mountains', 'battle').length === 0, '1: mountains returns no modifiers');
}
console.log('PASS 1: terrainToAutoModifiers mapping — all terrain/encounterType combos correct');

// ── 2. synthesizeHexBattleSpoke output ───────────────────────────────────────
{
  preparedArmy.value = makeArmy();
  threatLevel.value = 2;
  globalSeason.value = 1;
  completedSpokes.value = 0;

  const tile = makeTile({
    terrain: 'forest',
    event: 'ambush',
    battleModifiers: ['sacred_ground'],
  });

  const spoke = synthesizeHexBattleSpoke(tile, 'ambush');
  assert(spoke !== null, '2: spoke is not null');

  const node = spoke!.nodes[0];

  // name should come from getEventContent → 'Forest Ambush'
  assert(node.name === 'Forest Ambush', `2: node.name is 'Forest Ambush', got '${node.name}'`);

  // battleModifiers: terrain-first, deduped: forest_cover, dense_trees, sacred_ground
  const mods = node.battleModifiers ?? [];
  assert(mods[0] === 'forest_cover', `2: mods[0]=forest_cover, got ${mods[0]}`);
  assert(mods[1] === 'dense_trees', `2: mods[1]=dense_trees, got ${mods[1]}`);
  assert(mods[2] === 'sacred_ground', `2: mods[2]=sacred_ground, got ${mods[2]}`);
  assert(mods.length === 3, `2: exactly 3 modifiers, got ${mods.length}`);

  // enemyStrength must be a number matching computeEnemyStrengthRating
  const expectedStrength = computeEnemyStrengthRating('ambush', 1, 2, 0);
  assert(node.enemyStrength === expectedStrength, `2: enemyStrength=${expectedStrength}, got ${node.enemyStrength}`);
  assert(typeof node.enemyStrength === 'number', '2: enemyStrength is a number');

  // posture for ambush = 'defending'
  assert(spoke!.posture === 'defending', `2: posture=defending, got ${spoke!.posture}`);
}
console.log('PASS 2: synthesizeHexBattleSpoke — name, modifiers, strength, posture all correct');

// ── 3. enemyStrength override (regular) ──────────────────────────────────────
{
  const army = generateEnemyArmy(5, 0, 3, false, false, 2);
  assert(army.cohorts.length === 2, `3: cohorts.length=2 with override=2, got ${army.cohorts.length}`);
}
console.log('PASS 3: generateEnemyArmy regular strengthOverride=2 produces 2 cohorts');

// ── 4. enemyStrength override (boss) ─────────────────────────────────────────
{
  const army = generateEnemyArmy(5, 0, 3, true, false, 4);
  assert(army.cohorts.length === 4, `4: cohorts.length=4 with boss override=4, got ${army.cohorts.length}`);
}
console.log('PASS 4: generateEnemyArmy boss strengthOverride=4 produces 4 cohorts');

// ── 5. Posture deployment offset — red closer to blue with ambush ─────────────
{
  // Build two states: one without offset, one with offset=-1 for red
  function makeState() {
    const s = new BattleState({ cols: 50, rows: 30, hexSize: 31, vertical: true });
    s.generateGrid();
    return s;
  }

  // Red faction in vertical mode:
  //   zoneRows = floor(30/3) = 10
  //   enemyEdge = zoneRows - 1 = 9   (bottom of red zone, facing blue)
  //   depthDir = -1
  //   frontRow (no offset) = 9 + 2 * (-1) = 7
  //   frontRow (offset=-1) = 9 + (2 + -1) * (-1) = 9 + 1*(-1) = 8

  // Helper: from axial hex, get the offset row for flat-top grid
  function hexToRow(hex: { q: number; r: number }): number {
    return hex.r + Math.floor(hex.q / 2);
  }

  const smallArmy: ArmyData = {
    id: -1, owner: 'barbarian', name: 'Test', size: 1,
    cohorts: [{
      id: 'warrior-test', instanceId: 'warrior-test', name: 'Test Warrior',
      role: 'vanguard',
      stats: { hp: 500, atk: 80, def: 40, agi: 25 },
      spriteId: 'barbarian-warrior',
    } as Cohort],
    legateId: null, supplies: 0,
    provinceIndex: 0, targetProvinceIndex: null, progress: 0, path: [],
    inCombat: false, combatTarget: null, lastRoll: 0,
  };

  // Without posture offset
  const stateNoOffset = makeState();
  deployArmy(stateNoOffset, 'red', smallArmy, CENTRAL_SPAWN);
  const redUnitsNoOffset = stateNoOffset.getBattleFactionUnits('red');
  assert(redUnitsNoOffset.length > 0, '5: red units placed without offset');
  const minRowNoOffset = Math.min(...redUnitsNoOffset.map(u => hexToRow(u.hex)));

  // With postureOffset = -1 (ambush)
  const stateWithOffset = makeState();
  deployArmy(stateWithOffset, 'red', smallArmy, CENTRAL_SPAWN, -1);
  const redUnitsWithOffset = stateWithOffset.getBattleFactionUnits('red');
  assert(redUnitsWithOffset.length > 0, '5: red units placed with offset');
  const minRowWithOffset = Math.min(...redUnitsWithOffset.map(u => hexToRow(u.hex)));

  // With offset=-1, red front row should be ONE row closer to blue (higher row index)
  assert(
    minRowWithOffset === minRowNoOffset + 1,
    `5: ambush red front row ${minRowWithOffset} = no-offset ${minRowNoOffset} + 1 (one row closer to blue)`,
  );
}
console.log('PASS 5: postureOffset=-1 shifts red front row 1 row closer to blue');

// ── 6. No-op posture (undefined / 0) ─────────────────────────────────────────
{
  const smallArmy: ArmyData = {
    id: -1, owner: 'barbarian', name: 'Test', size: 1,
    cohorts: [{
      id: 'warrior-noop', instanceId: 'warrior-noop', name: 'Test',
      role: 'vanguard',
      stats: { hp: 500, atk: 80, def: 40, agi: 25 },
      spriteId: 'barbarian-warrior',
    } as Cohort],
    legateId: null, supplies: 0,
    provinceIndex: 0, targetProvinceIndex: null, progress: 0, path: [],
    inCombat: false, combatTarget: null, lastRoll: 0,
  };

  function makeState2() {
    const s = new BattleState({ cols: 50, rows: 30, hexSize: 31, vertical: true });
    s.generateGrid();
    return s;
  }

  function hexToRow2(hex: { q: number; r: number }): number {
    return hex.r + Math.floor(hex.q / 2);
  }

  const stateUndef = makeState2();
  deployArmy(stateUndef, 'red', smallArmy, CENTRAL_SPAWN, undefined);
  const rowUndef = Math.min(...stateUndef.getBattleFactionUnits('red').map(u => hexToRow2(u.hex)));

  const stateZero = makeState2();
  deployArmy(stateZero, 'red', smallArmy, CENTRAL_SPAWN, 0);
  const rowZero = Math.min(...stateZero.getBattleFactionUnits('red').map(u => hexToRow2(u.hex)));

  const stateLegacy = makeState2();
  deployArmy(stateLegacy, 'red', smallArmy, CENTRAL_SPAWN);
  const rowLegacy = Math.min(...stateLegacy.getBattleFactionUnits('red').map(u => hexToRow2(u.hex)));

  assert(rowUndef === rowLegacy, `6: undefined offset same as legacy: ${rowUndef} === ${rowLegacy}`);
  assert(rowZero === rowLegacy, `6: zero offset same as legacy: ${rowZero} === ${rowLegacy}`);
}
console.log('PASS 6: postureOffset undefined/0 is identical to legacy call');

// ── 7. Banner suppress condition is false for Bellum synth output ─────────────
{
  preparedArmy.value = makeArmy();
  threatLevel.value = 0;
  globalSeason.value = 0;
  completedSpokes.value = 0;

  const tile = makeTile({ terrain: 'hills', event: 'battle' });
  const spoke = synthesizeHexBattleSpoke(tile, 'battle');
  assert(spoke !== null, '7: spoke is not null');

  const node = spoke!.nodes[0];
  // Reconstruct the banner suppress condition:
  // !landmarkName && !terrain && modifiers.length === 0 && enemyStrength === null
  const landmarkName = node.name ?? null;
  const terrain = node.terrain ?? null;
  const modifiers = node.battleModifiers ?? [];
  const enemyStrength = node.enemyStrength ?? null;

  const suppressCondition =
    !landmarkName && !terrain && modifiers.length === 0 && enemyStrength === null;

  assert(!suppressCondition, `7: banner NOT suppressed for Bellum synth output (name='${landmarkName}', terrain='${terrain}', mods=${modifiers.length}, strength=${enemyStrength})`);
}
console.log('PASS 7: BattleContextBanner suppress condition is false for any Bellum synth output');

preparedArmy.value = null;
console.log('\nAll bellum-battle-context checks passed');
