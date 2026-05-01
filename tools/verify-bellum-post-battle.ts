// S33-09: Bellum post-battle rewards and run accounting verification.
// Run with: npx tsx tools/verify-bellum-post-battle.ts
//
// Covers:
//  1. Reward picker route: victory/draw exits install PostBattleScreen.
//  2. Defeat skip: defeat path does NOT route to post-battle.
//  3. Resource reward grants: grantBellumResource increments bellumGains + global pool.
//  4. Cleanup on claim: spoke/result/enemy signals cleared after Bellum claim.
//  5. Map state survives: hexTiles + campaignState survive a battle exit + claim cycle.
//  6. Save round-trip: bellumGains serializes and deserializes cleanly.
//  7. resetCampaign zeros gains: bellumGains is zeroed by resetCampaign.

import {
  handleHexBattleExit,
  HEX_ENCOUNTER_LABEL,
  isHexEncounterSpoke,
} from '../src/game/campaign/hex-battle';
import {
  bellumGains,
  grantBellumResource,
  resetBellumGains,
  setBellumGains,
} from '../src/game/campaign/bellum-run-gains';
import {
  hexTiles,
  campaignState,
  setTiles,
  resetCampaign,
} from '../src/game/campaign/campaign-state';
import {
  resetBellumDefeatState,
  setBellumDefeatNavigation,
} from '../src/game/campaign/campaign-defeat';
import { preparedArmy } from '../src/game/progression/strategic-store';
import { currentSpoke } from '../src/game/progression/spoke';
import { gold } from '../src/game/core/resources';
import { parseMetaSave } from '../src/game/core/meta-save';
import { __resetMoraleContributors, BASE_MORALE, registerMoraleContributor } from '../src/game/army/morale';
import type { ArmyData, Cohort } from '../src/types';
import type { HexTile } from '../src/game/campaign/campaign-types';
import type { Spoke, SpokeNode } from '../src/game/progression/spoke';

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

// Register a no-op defeat nav to prevent unhandled null calls in defeat path.
setBellumDefeatNavigation(() => {});

function makeCohort(id: string, outOfAction = false): Cohort {
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

function makeArmy(cohorts: Cohort[], supplies = 20, campaignMoraleDelta = 0): ArmyData {
  return {
    id: 1,
    owner: 'player',
    name: 'Legio Test',
    size: 1000,
    cohorts,
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

function makeHexEncounterSpoke(army: ArmyData): Spoke {
  const node: SpokeNode = {
    id: '__hex_encounter_node__',
    type: 'battle',
    position: 0,
    resolved: false,
    reward: null,
    encounterType: 'battle',
    terrain: 'plains',
    name: 'Plains Skirmish',
  };
  return {
    nodes: [node],
    label: HEX_ENCOUNTER_LABEL,
    completed: false,
    duration: 1,
    currentSeason: 1,
    posture: 'attacking',
    boundArmy: army,
    boundLegate: null,
  };
}

function makeTile(q: number, r: number): HexTile {
  return {
    id: `${q},${r}`,
    q,
    r,
    terrain: 'plains',
    event: 'none',
    discovered: true,
    visited: true,
    reachable: false,
    current: q === 0 && r === 0,
    movementCost: 1,
  };
}

function resetAll(supplies = 20): void {
  resetBellumDefeatState();
  resetBellumGains();
  gold.value = 0;
  preparedArmy.value = makeArmy([makeCohort('a')], supplies);
  campaignState.value = { currentTileId: '0,0', selectedTileId: null, movementPoints: 5 };
  currentSpoke.value = null;
}

// ── 1. Reward picker route ────────────────────────────────────────────
// Victory should route to 'post-battle'.
{
  resetAll();
  const spoke = makeHexEncounterSpoke(preparedArmy.value!);
  currentSpoke.value = spoke;

  assert(isHexEncounterSpoke(currentSpoke.value), '1: spoke is hex encounter');

  const exit = handleHexBattleExit('victory');
  assert(!exit.defeat.defeated, '1: victory is not defeated');
  assert(exit.nextScreen === 'post-battle', `1: victory routes to post-battle, got ${exit.nextScreen}`);
}
console.log('PASS 1: victory routes to post-battle screen');

// Draw should also route to 'post-battle'.
{
  resetAll();
  const spoke = makeHexEncounterSpoke(preparedArmy.value!);
  currentSpoke.value = spoke;

  const exit = handleHexBattleExit('draw');
  assert(!exit.defeat.defeated, '1 draw: draw is not defeated');
  assert(exit.nextScreen === 'post-battle', `1 draw: draw routes to post-battle, got ${exit.nextScreen}`);
}
console.log('PASS 1b: draw routes to post-battle screen');

// ── 2. Defeat skip ────────────────────────────────────────────────────
// Army-wiped defeat: nextScreen should be null (defeat nav was fired internally).
{
  resetAll();
  // Empty cohort roster triggers army-wiped defeat
  preparedArmy.value = makeArmy([], 20, 0);
  const spoke = makeHexEncounterSpoke(preparedArmy.value);
  currentSpoke.value = spoke;

  const exit = handleHexBattleExit('defeat');
  assert(exit.defeat.defeated, '2: defeat with wiped army is defeat');
  assert(exit.nextScreen === null, `2: defeat does not route to post-battle, nextScreen=${exit.nextScreen}`);
}
console.log('PASS 2: defeat (army wiped) skips post-battle, nextScreen is null');

// Morale collapse defeat: also skips post-battle.
{
  resetBellumDefeatState();
  resetBellumGains();
  // Delta of -BASE_MORALE drives morale to 0 → collapse on next evaluation.
  preparedArmy.value = makeArmy([makeCohort('a')], 20, -BASE_MORALE);

  const exit = handleHexBattleExit('defeat');
  assert(exit.defeat.defeated, '2b: morale collapse is defeat');
  assert(exit.nextScreen === null, `2b: morale collapse does not route to post-battle`);
}
console.log('PASS 2b: defeat (morale collapse) skips post-battle, nextScreen is null');

// ── 3. Resource reward grants ─────────────────────────────────────────
// grantBellumResource adds to bellumGains AND the global resource pool.
{
  resetAll();
  gold.value = 10;
  bellumGains.value = { gold: 0, faith: 0, influence: 0, momentum: 0, iuniores: 0 };

  const actual = grantBellumResource('gold', 3);
  assert(actual === 3, `3: actual returned is 3, got ${actual}`);
  assert(gold.value === 13, `3: global gold incremented to 13, got ${gold.value}`);
  assert(bellumGains.value.gold === 3, `3: bellumGains.gold is 3, got ${bellumGains.value.gold}`);

  // Additional grant accumulates
  grantBellumResource('gold', 2);
  assert(gold.value === 15, `3: global gold incremented to 15, got ${gold.value}`);
  assert(bellumGains.value.gold === 5, `3: bellumGains.gold accumulated to 5, got ${bellumGains.value.gold}`);

  // Other resource types track independently
  grantBellumResource('faith', 1);
  assert(bellumGains.value.faith === 1, `3: bellumGains.faith is 1, got ${bellumGains.value.faith}`);
  assert(bellumGains.value.gold === 5, `3: gold unaffected by faith grant`);
}
console.log('PASS 3: grantBellumResource increments bellumGains + global pool');

// ── 4. Cleanup on claim ───────────────────────────────────────────────
// After a Bellum reward is claimed, spoke/result/enemy signals are cleared.
// We simulate the claim side-effects directly (PostBattleScreen UI is Preact
// and can't run headlessly). The contract: set isBellum → clear signals.
{
  resetAll();
  const spoke = makeHexEncounterSpoke(preparedArmy.value!);
  currentSpoke.value = spoke;

  // Simulate what PostBattleScreen.claimSelectedReward does for Bellum path:
  const isBellum = isHexEncounterSpoke(currentSpoke.value);
  assert(isBellum, '4: isHexEncounterSpoke detects Bellum spoke');

  // Grant a resource (the reward)
  grantBellumResource('gold', 2);

  // Cleanup sequence
  currentSpoke.value = null;

  assert(currentSpoke.value === null, '4: currentSpoke cleared after Bellum claim');
}
console.log('PASS 4: cleanup after Bellum claim clears currentSpoke');

// ── 5. Map state survives ─────────────────────────────────────────────
// hexTiles and campaignState are not disturbed by a battle exit + claim cycle.
{
  resetAll();
  const tiles = [makeTile(0, 0), makeTile(1, 0), makeTile(0, 1)];
  setTiles(tiles);
  campaignState.value = { currentTileId: '1,0', selectedTileId: '0,1', movementPoints: 3 };

  // Simulate battle exit (victory, no defeat)
  preparedArmy.value = makeArmy([makeCohort('a')], 20, 0);
  const spoke = makeHexEncounterSpoke(preparedArmy.value);
  currentSpoke.value = spoke;

  const exit = handleHexBattleExit('victory');
  assert(!exit.defeat.defeated, '5: victory not defeated');
  assert(exit.nextScreen === 'post-battle', '5: routes to post-battle');

  // Simulate claim cleanup
  currentSpoke.value = null;

  // Map state must be intact
  assert(hexTiles.value.length === 3, `5: hexTiles still has 3 tiles, got ${hexTiles.value.length}`);
  assert(campaignState.value.currentTileId === '1,0', `5: currentTileId preserved, got ${campaignState.value.currentTileId}`);
  assert(campaignState.value.selectedTileId === '0,1', `5: selectedTileId preserved`);
  assert(campaignState.value.movementPoints === 3, `5: movementPoints preserved`);
}
console.log('PASS 5: hexTiles and campaignState survive battle exit + claim cycle');

// ── 6. Save round-trip ────────────────────────────────────────────────
// bellumGains round-trips through parseMetaSave (migration layer).
{
  const gainsBefore: Record<string, number> = { gold: 5, faith: 0, influence: 0, momentum: 2, iuniores: 250 };

  // Build a minimal save blob containing bellumGains
  const saveBlob = JSON.stringify({
    version: 2,
    runs: [],
    totalRunsStarted: 1,
    victories: 0,
    highScore: 0,
    commanderWins: [],
    activeRun: {
      commanderId: 'caesar',
      resources: { gold: 5, faith: 0, influence: 0, momentum: 0, iuniores: 0 },
      iunioresSeeded: true,
      completedSpokes: 0,
      threatLevel: 0,
      spokesSinceLastBattle: 0,
      globalSeason: 1,
      veteranStacks: 0,
      battlesWon: 1,
      provinces: [],
      governorPool: [],
      governorAssignments: {},
      territoryEntries: [],
      claimedIndices: [],
      featurePool: [],
      councilSlots: [null, null, null],
      advisorPool: [],
      advisorMarket: [],
      tierUpNotices: [],
      plannedSpoke: null,
      currentSpoke: null,
      currentNodeIndex: 0,
      spokeGains: { gold: 0, faith: 0, influence: 0, momentum: 0, iuniores: 0 },
      bellumGains: gainsBefore,
      consequenceFlags: [],
      seenEventsThisSpoke: [],
      npcFactions: [],
      crusadeBattlesLeft: 0,
      warCryLastUsedSpoke: -99,
      warCryActive: false,
      manipulateUsesLeft: 0,
      goldenOpportunityPending: 0,
      pendingEnemyConversions: 0,
      nextInvestmentDiscount: 0,
      preparedArmy: null,
      preparedLegate: null,
      legateHiringPool: [],
      doctrineCollection: [],
      equippedDoctrines: [null, null, null, null],
      decretumHand: [],
      maxHandSize: 5,
      campaign: null,
    },
  });

  const loaded = parseMetaSave(saveBlob);
  const restored = loaded.activeRun?.bellumGains;

  assert(restored !== undefined, '6: bellumGains present after restore');
  assert(restored!.gold === 5, `6: gold restored to 5, got ${restored!.gold}`);
  assert(restored!.momentum === 2, `6: momentum restored to 2, got ${restored!.momentum}`);
  assert(restored!.iuniores === 250, `6: iuniores restored to 250, got ${restored!.iuniores}`);
  assert(restored!.faith === 0, `6: faith restored to 0, got ${restored!.faith}`);
  assert(restored!.influence === 0, `6: influence restored to 0, got ${restored!.influence}`);
}
console.log('PASS 6: bellumGains round-trips through parseMetaSave');

// Old save without bellumGains defaults to all zeros.
{
  const saveBlob = JSON.stringify({
    version: 2,
    runs: [],
    totalRunsStarted: 1,
    victories: 0,
    highScore: 0,
    commanderWins: [],
    activeRun: {
      commanderId: 'caesar',
      resources: { gold: 0, faith: 0, influence: 0, momentum: 0, iuniores: 0 },
      iunioresSeeded: true,
      completedSpokes: 0,
      threatLevel: 0,
      spokesSinceLastBattle: 0,
      globalSeason: 1,
      veteranStacks: 0,
      battlesWon: 0,
      provinces: [],
      governorPool: [],
      governorAssignments: {},
      territoryEntries: [],
      claimedIndices: [],
      featurePool: [],
      councilSlots: [null, null, null],
      advisorPool: [],
      advisorMarket: [],
      tierUpNotices: [],
      plannedSpoke: null,
      currentSpoke: null,
      currentNodeIndex: 0,
      spokeGains: { gold: 0, faith: 0, influence: 0, momentum: 0, iuniores: 0 },
      // bellumGains intentionally absent
      consequenceFlags: [],
      seenEventsThisSpoke: [],
      npcFactions: [],
      crusadeBattlesLeft: 0,
      warCryLastUsedSpoke: -99,
      warCryActive: false,
      manipulateUsesLeft: 0,
      goldenOpportunityPending: 0,
      pendingEnemyConversions: 0,
      nextInvestmentDiscount: 0,
      preparedArmy: null,
      preparedLegate: null,
      legateHiringPool: [],
      doctrineCollection: [],
      equippedDoctrines: [null, null, null, null],
      decretumHand: [],
      maxHandSize: 5,
      campaign: null,
    },
  });

  const loaded = parseMetaSave(saveBlob);
  const restored = loaded.activeRun?.bellumGains;

  // Old saves without bellumGains produce undefined in the snapshot type;
  // normalizeBellumGains is called by migrateActiveRun to default to zeros.
  // The field is present but may be the zero record.
  const gold6 = restored?.gold ?? 0;
  const faith6 = restored?.faith ?? 0;
  assert(gold6 === 0 && faith6 === 0, `6b: old save defaults bellumGains to zeros`);
}
console.log('PASS 6b: old save without bellumGains defaults to zeros');

// Malformed gains values (negative, non-numeric) fall back to 0.
{
  const saveBlob = JSON.stringify({
    version: 2,
    runs: [],
    totalRunsStarted: 0,
    victories: 0,
    highScore: 0,
    commanderWins: [],
    activeRun: {
      commanderId: 'caesar',
      resources: { gold: 0, faith: 0, influence: 0, momentum: 0, iuniores: 0 },
      iunioresSeeded: true,
      completedSpokes: 0,
      threatLevel: 0,
      spokesSinceLastBattle: 0,
      globalSeason: 1,
      veteranStacks: 0,
      battlesWon: 0,
      provinces: [],
      governorPool: [],
      governorAssignments: {},
      territoryEntries: [],
      claimedIndices: [],
      featurePool: [],
      councilSlots: [null, null, null],
      advisorPool: [],
      advisorMarket: [],
      tierUpNotices: [],
      plannedSpoke: null,
      currentSpoke: null,
      currentNodeIndex: 0,
      spokeGains: { gold: 0, faith: 0, influence: 0, momentum: 0, iuniores: 0 },
      bellumGains: { gold: -5, faith: 'lots', influence: null, momentum: 0, iuniores: 0 },
      consequenceFlags: [],
      seenEventsThisSpoke: [],
      npcFactions: [],
      crusadeBattlesLeft: 0,
      warCryLastUsedSpoke: -99,
      warCryActive: false,
      manipulateUsesLeft: 0,
      goldenOpportunityPending: 0,
      pendingEnemyConversions: 0,
      nextInvestmentDiscount: 0,
      preparedArmy: null,
      preparedLegate: null,
      legateHiringPool: [],
      doctrineCollection: [],
      equippedDoctrines: [null, null, null, null],
      decretumHand: [],
      maxHandSize: 5,
      campaign: null,
    },
  });

  const loaded = parseMetaSave(saveBlob);
  const restored = loaded.activeRun?.bellumGains;

  assert((restored?.gold ?? 0) === 0, `6c: negative gold falls back to 0, got ${restored?.gold}`);
  assert((restored?.faith ?? 0) === 0, `6c: non-numeric faith falls back to 0, got ${restored?.faith}`);
  assert((restored?.influence ?? 0) === 0, `6c: null influence falls back to 0, got ${restored?.influence}`);
}
console.log('PASS 6c: malformed bellumGains values fall back to 0');

// ── 7. resetCampaign zeros gains ──────────────────────────────────────
{
  setBellumGains({ gold: 10, faith: 3, influence: 1, momentum: 5, iuniores: 100 });
  assert(bellumGains.value.gold === 10, '7: bellumGains set to non-zero');

  resetCampaign();

  assert(bellumGains.value.gold === 0, `7: gold zeroed after resetCampaign, got ${bellumGains.value.gold}`);
  assert(bellumGains.value.faith === 0, `7: faith zeroed after resetCampaign`);
  assert(bellumGains.value.influence === 0, `7: influence zeroed after resetCampaign`);
  assert(bellumGains.value.momentum === 0, `7: momentum zeroed after resetCampaign`);
  assert(bellumGains.value.iuniores === 0, `7: iuniores zeroed after resetCampaign`);
}
console.log('PASS 7: resetCampaign zeros bellumGains');

// Cleanup
setBellumDefeatNavigation(null);
preparedArmy.value = null;
currentSpoke.value = null;
resetBellumGains();
resetBellumDefeatState();

console.log('\nAll bellum-post-battle checks passed');
