// S33-04: Bellum season, Doom, upkeep, income, and Final Invasion checks.
// Run with: npx tsx tools/verify-bellum-season.ts

import { CAMPAIGN_MOVEMENT_POINTS_MAX } from '../src/game/campaign/campaign-balance';
import { campaignState, resetCampaign } from '../src/game/campaign/campaign-state';
import { advanceBellumSeason, formatResourceList } from '../src/game/campaign/campaign-season';
import { globalSeason, MAX_SEASONS, threatLevel } from '../src/game/core/game-state';
import { faith, gold, initResources, momentum } from '../src/game/core/resources';
import { resetDoctrineStore } from '../src/game/items/doctrine-store';
import { createProvince } from '../src/game/province/province';
import { provinces, resetProvinceStore } from '../src/game/province/province-store';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function resetSeasonHarness(resources = { gold: 20, faith: 20, influence: 0, momentum: 20, iuniores: 0 }): void {
  globalSeason.value = 0;
  threatLevel.value = 0;
  initResources(resources);
  resetCampaign();
  resetDoctrineStore();
  resetProvinceStore();
}

{
  resetSeasonHarness();
  campaignState.value = { ...campaignState.value, movementPoints: 0 };

  const result = advanceBellumSeason();

  assert(result.season === 1, 'Bellum tick reports next local season');
  assert(result.globalSeason === 1 && globalSeason.value === 1, 'Bellum tick advances global season');
  assert(result.threatIncrease === 1 && threatLevel.value === 1, 'Bellum tick advances Doom threat');
  assert(gold.value === 17, 'attacking upkeep spends 3 gold');
  assert(faith.value === 19, 'base upkeep spends 1 faith');
  assert(momentum.value === 19, 'attacking upkeep spends 1 momentum');
  assert(campaignState.value.movementPoints === CAMPAIGN_MOVEMENT_POINTS_MAX, 'season tick refreshes Bellum movement points');
}
console.log('PASS: Bellum season tick advances global season, Doom, upkeep, and movement refresh');

{
  resetSeasonHarness({ gold: 0, faith: 0, influence: 0, momentum: 0, iuniores: 0 });

  const result = advanceBellumSeason();

  assert(result.upkeepShortfall.length === 3, 'unpaid attacking upkeep reports all shortfalls');
  assert(formatResourceList(result.upkeepShortfall) === '3 gold, 1 faith, 1 momentum', 'shortfall list formats deficits');
}
console.log('PASS: Bellum season tick reports upkeep shortfalls');

{
  resetSeasonHarness();
  provinces.value = [
    createProvince('Income Test', {
      wealth: 100,
      baseExpenses: 0,
      lowerTax: 3,
      upperTax: 3,
      tradeGood: null,
      unrest: 0,
    }),
  ];

  const beforeGold = gold.value;
  const result = advanceBellumSeason('neutral');

  assert(result.provinceIncome !== null, 'Bellum tick returns province income result');
  assert(result.provinceIncome.incomeGained.some((item) => item.resource === 'gold' && item.amount > 0), 'province income grants gold');
  assert(gold.value > beforeGold - 2, 'province income is applied after seasonal upkeep');
}
console.log('PASS: Bellum season tick collects province income');

{
  resetSeasonHarness();
  globalSeason.value = MAX_SEASONS - 1;

  const result = advanceBellumSeason();

  assert(result.globalSeason === MAX_SEASONS, 'final tick reaches season cap');
  assert(result.finalInvasionReady, 'season cap flags Final Invasion readiness');
}
console.log('PASS: Bellum season tick flags Final Invasion at season cap');

console.log('\nAll Bellum season checks passed');
