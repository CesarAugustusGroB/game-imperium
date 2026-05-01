// S33-03 / S33-05: Bellum movement-point economy checks.
// Run with: npx tsx tools/verify-bellum-movement-points.ts
//
// S33-05: CampaignState no longer carries supplies/morale. setState helper
// updated to the slimmer shape.

import {
  applyMove,
  campaignState,
  refreshMovementPoints,
  resetCampaign,
} from '../src/game/campaign/campaign-state';
import { CAMPAIGN_MOVEMENT_POINTS_MAX } from '../src/game/campaign/campaign-balance';
import { updateReachableTiles } from '../src/game/campaign/movement';
import type { EventType, HexTile, TerrainType } from '../src/game/campaign/campaign-types';
import { preparedArmy } from '../src/game/progression/strategic-store';
import type { ArmyData, Cohort } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function makeTile(
  q: number,
  r: number,
  overrides?: Partial<HexTile>,
): HexTile {
  return {
    id: `${q},${r}`,
    q,
    r,
    terrain: 'plains' as TerrainType,
    event: 'none' as EventType,
    discovered: true,
    visited: false,
    reachable: false,
    current: false,
    movementCost: 1,
    ...overrides,
  };
}

function setState(movementPoints: number): void {
  campaignState.value = {
    currentTileId: '0,0',
    selectedTileId: null,
    movementPoints,
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

function makeArmy(supplies: number): ArmyData {
  return {
    id: 1,
    owner: 'player',
    name: 'Legio Test',
    size: 1000,
    cohorts: [makeCohort('a')],
    legateId: null,
    supplies,
    provinceIndex: 0,
    targetProvinceIndex: null,
    progress: 0,
    path: [],
    inCombat: false,
    combatTarget: null,
    lastRoll: 0,
  };
}

{
  resetCampaign();
  preparedArmy.value = makeArmy(80);
  setState(CAMPAIGN_MOVEMENT_POINTS_MAX);
  const result = applyMove(makeTile(1, 0));
  assert(result.moved, 'single-hop move should succeed');
  assert(result.movementSpent === 1, 'single-hop plains move spends 1 MP');
  assert(result.movementRemaining === CAMPAIGN_MOVEMENT_POINTS_MAX - 1, 'single-hop remaining MP');
  assert(campaignState.value.currentTileId === '1,0', 'single-hop updates current tile');
  assert(campaignState.value.movementPoints === CAMPAIGN_MOVEMENT_POINTS_MAX - 1, 'single-hop writes MP to state');
}
console.log('PASS: single-hop movement spends entered-tile MP');

{
  resetCampaign();
  preparedArmy.value = makeArmy(80);
  setState(CAMPAIGN_MOVEMENT_POINTS_MAX);
  const first = applyMove(makeTile(1, 0));
  const second = applyMove(makeTile(2, 0));
  assert(first.moved && second.moved, 'two-step path should fit MP budget');
  assert(campaignState.value.currentTileId === '2,0', 'multi-hop ends on second step');
  assert(
    campaignState.value.movementPoints === CAMPAIGN_MOVEMENT_POINTS_MAX - 2,
    'multi-hop spends cumulative MP',
  );
}
console.log('PASS: multi-hop movement spends cumulative entered-tile costs');

{
  resetCampaign();
  preparedArmy.value = makeArmy(80);
  setState(0);
  const blocked = applyMove(makeTile(1, 0));
  assert(!blocked.moved, 'zero-MP movement should be blocked');
  assert(blocked.movementRemaining === 0, 'blocked move leaves MP at 0');
  assert(campaignState.value.currentTileId === '0,0', 'blocked move does not change current tile');

  const tiles = updateReachableTiles([makeTile(0, 0), makeTile(1, 0)], '0,0', 0);
  assert(!tiles.some((tile) => tile.reachable), 'zero-MP reachable calc exposes no destinations');
}
console.log('PASS: zero-MP blocks movement and reachability');

{
  resetCampaign();
  setState(0);
  refreshMovementPoints();
  assert(campaignState.value.movementPoints === CAMPAIGN_MOVEMENT_POINTS_MAX, 'refresh restores max MP');
}
console.log('PASS: movement refresh restores max MP');

preparedArmy.value = null;

console.log('\nAll Bellum movement-point checks passed');
