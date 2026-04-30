// S31-05b: pure checks for the hex-battle helpers — terrain mapping, outcome
// deltas, marker detection. Run with: npx tsx tools/verify-hex-battle.ts
//
// Doesn't exercise launchHexBattle (it depends on currentSpoke + navigateTo
// which need browser context). Manual smoke test in the preview covers that
// integration.

import {
  HEX_ENCOUNTER_LABEL,
  applyHexBattleOutcome,
  isHexEncounterSpoke,
  terrainToBattleTerrain,
} from '../src/game/campaign/hex-battle';
import { campaignState } from '../src/game/campaign/campaign-state';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function reset(supplies: number, morale: number): void {
  campaignState.value = {
    currentTileId: '0,0',
    selectedTileId: null,
    movementPoints: 2,
    supplies,
    morale,
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

// ── applyHexBattleOutcome ──────────────────────────────────────────
{
  reset(50, 60);
  applyHexBattleOutcome('victory');
  assert(campaignState.value.morale === 65, `victory +5 morale: expected 65, got ${campaignState.value.morale}`);
  assert(campaignState.value.supplies === 50, 'victory: supplies unchanged');
}
console.log('PASS: victory applies +5 morale, supplies unchanged');

{
  reset(50, 60);
  applyHexBattleOutcome('defeat');
  assert(campaignState.value.morale === 45, `defeat -15 morale: expected 45, got ${campaignState.value.morale}`);
  assert(campaignState.value.supplies === 45, `defeat -5 supplies: expected 45, got ${campaignState.value.supplies}`);
}
console.log('PASS: defeat applies -15 morale, -5 supplies');

{
  reset(50, 60);
  applyHexBattleOutcome('draw');
  assert(campaignState.value.morale === 55, `draw -5 morale: expected 55, got ${campaignState.value.morale}`);
  assert(campaignState.value.supplies === 50, 'draw: supplies unchanged');
}
console.log('PASS: draw applies -5 morale, supplies unchanged');

{
  reset(50, 60);
  applyHexBattleOutcome(null);
  assert(campaignState.value.morale === 55, `null outcome -5 morale: expected 55, got ${campaignState.value.morale}`);
  assert(campaignState.value.supplies === 50, 'null outcome: supplies unchanged');
}
console.log('PASS: null outcome (esc-exit) treated as draw');

{
  // Clamps still hold at 0
  reset(2, 8);
  applyHexBattleOutcome('defeat');
  assert(campaignState.value.morale === 0, 'defeat clamps morale at 0');
  assert(campaignState.value.supplies === 0, 'defeat clamps supplies at 0');
}
console.log('PASS: clamps hold at 0 on heavy defeat');

console.log('\nAll hex-battle checks passed');
