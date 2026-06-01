/**
 * Verifies Consilium Hub integration + passive revival: passiveModifier revived,
 * advisor aggregators, and Hub consumers combining doctrine + advisor sources.
 * Run: npx tsx tools/verify-consilium-hub.ts
 */
import { passiveModifier } from '../src/data/iter-belli-consilium';
import type { AdvisorPassive } from '../src/game/council/advisor';
import {
  councilSlots, advisorShopDiscount, advisorUpkeepReduction,
  advisorIncomeBonus, advisorThreatReduction, advisorSpokeGrants,
} from '../src/game/council/council-store';
import type { Advisor } from '../src/game/council/advisor';
import { buySupplies, preparedArmy } from '../src/game/progression/strategic-store';
import { getDiscountedAdvisorCost } from '../src/game/council/council-store';
import { gold, getResource } from '../src/game/core/resources';
import { wireRunBonuses } from '../src/game/core/game-state';
import type { ArmyData } from '../src/types/index';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

const pm = (p: AdvisorPassive) => passiveModifier(p);
check('upkeep-reduction → supplies', pm({ type: 'upkeep-reduction', percent: 20 }).supplies > 0);
check('threat-reduction → threat', pm({ type: 'threat-reduction', amount: 2 }).threat === 2);
check('loot-bonus → gold', pm({ type: 'loot-bonus', percent: 25 }).gold === 5);
check('heal-between-nodes → morale', pm({ type: 'heal-between-nodes', amount: 200 }).morale === 2);
check('resource-per-spoke gold → gold', pm({ type: 'resource-per-spoke', resource: 'gold', amount: 3 }).gold === 3);
check('REVIVED: resource-per-spoke faith → gold', pm({ type: 'resource-per-spoke', resource: 'faith', amount: 3 }).gold === 3);
check('REVIVED: resource-per-spoke influence → gold', pm({ type: 'resource-per-spoke', resource: 'influence', amount: 2 }).gold === 2);
check('REVIVED: extra-event-choices → gold (n*5)', pm({ type: 'extra-event-choices', count: 2 }).gold === 10);
check('shop-discount no longer seeds gold (real Hub discount instead)', pm({ type: 'shop-discount', percent: 10 }).gold === 0);

// --- advisor aggregators ---
const mkA = (passive: AdvisorPassive): Advisor =>
  ({ currentTier: 1, color: 'white', tiers: [{ passive }, { passive }, { passive }] } as unknown as Advisor);

councilSlots.value = [null, null, null];
check('empty council → 0 shop discount', advisorShopDiscount() === 0);
check('empty council → 0 income bonus', advisorIncomeBonus('gold') === 0);
councilSlots.value = [
  mkA({ type: 'shop-discount', percent: 10 }),
  mkA({ type: 'upkeep-reduction', percent: 20 }),
  mkA({ type: 'threat-reduction', amount: 1 }),
];
check('advisorShopDiscount sums', advisorShopDiscount() === 10);
check('advisorUpkeepReduction sums', advisorUpkeepReduction() === 20);
check('advisorThreatReduction sums', advisorThreatReduction() === 1);
councilSlots.value = [mkA({ type: 'loot-bonus', percent: 25 }), null, null];
check('advisorIncomeBonus(gold) = loot %/100', Math.abs(advisorIncomeBonus('gold') - 0.25) < 1e-9);
check('advisorIncomeBonus(faith) = 0', advisorIncomeBonus('faith') === 0);
councilSlots.value = [
  mkA({ type: 'resource-per-spoke', resource: 'faith', amount: 3 }),
  mkA({ type: 'extra-event-choices', count: 2 }),
  null,
];
const grants = advisorSpokeGrants();
check('advisorSpokeGrants: deprecated res-per-spoke → gold', grants.some((g) => g.resource === 'gold' && g.amount === 3));
check('advisorSpokeGrants: extra-event-choices → gold n*5', grants.some((g) => g.resource === 'gold' && g.amount === 10));
councilSlots.value = [null, null, null];

// --- Hub integration (requires the setters wired) ---
wireRunBonuses();

councilSlots.value = [mkA({ type: 'shop-discount', percent: 50 }), null, null];
preparedArmy.value = { supplies: 0, cohorts: [], size: 0 } as unknown as ArmyData;
gold.value = 1000;
buySupplies(10);
const discounted = 1000 - getResource('gold');
councilSlots.value = [null, null, null];
preparedArmy.value = { supplies: 0, cohorts: [], size: 0 } as unknown as ArmyData;
gold.value = 1000;
buySupplies(10);
const full = 1000 - getResource('gold');
check('advisor shop-discount lowers buySupplies cost', discounted < full && discounted >= 1);

councilSlots.value = [null, null, null];
const advBase = getDiscountedAdvisorCost({ cost: 100 } as unknown as Advisor);
councilSlots.value = [mkA({ type: 'shop-discount', percent: 50 }), null, null];
const advDisc = getDiscountedAdvisorCost({ cost: 100 } as unknown as Advisor);
check('advisor shop-discount lowers advisor hire cost', advDisc < advBase);

councilSlots.value = [null, null, null];
preparedArmy.value = null;

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
