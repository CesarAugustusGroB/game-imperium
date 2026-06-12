/**
 * Verifies the advisor market flow against the live council-store API:
 * unseat returns the advisor to the market, hireAndSeatAdvisor buys an offer
 * into an EMPTY slot (no displacement), fireAdvisor sells from the market.
 * Run: npx tsx tools/verify-advisor-market.ts
 */
import { ADVISOR_TRIBUNE } from '../src/data/advisor-data';
import { COMMANDERS } from '../src/data/commanders';
import {
  advisorMarket,
  councilSlots,
  fireAdvisor,
  getDiscountedAdvisorCost,
  hireAndSeatAdvisor,
  setAdvisorMarket,
  unseatAdvisor,
} from '../src/game/council/council-store';
import { addResource, gold } from '../src/game/core/resources';
import { startNewRun } from '../src/game/core/game-state';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const commander = COMMANDERS.find(c => c.id === 'boudicca');
assert(commander, 'Missing Boudicca commander');

startNewRun(commander, { recordRunStart: false, seedHomeProvince: false });
addResource('gold', 20);

// Default loadout seats 3/3 â€” free a slot first; unseat returns it to the market.
const displaced = councilSlots.value[0];
assert(displaced, 'Expected commander default loadout to seat slot 0');
unseatAdvisor(0);
assert(councilSlots.value[0] === null, 'unseatAdvisor should empty the slot');
assert(
  advisorMarket.value.some(a => a.id === displaced.id),
  'unseated advisor should return to the market',
);

const offer = { ...ADVISOR_TRIBUNE, id: 'market_tribune_test', cost: 4 };

setAdvisorMarket([offer]);
const goldBeforeHire = gold.value;
const expectedCost = getDiscountedAdvisorCost(offer);
const seated = hireAndSeatAdvisor(offer, 0);

assert(seated, 'hireAndSeatAdvisor returned false for a valid offer and empty slot');
assert(gold.value === goldBeforeHire - expectedCost, 'hireAndSeatAdvisor did not spend the offer cost');
assert(councilSlots.value[0]?.id === offer.id, 'hireAndSeatAdvisor did not seat the hired advisor');
assert(advisorMarket.value.every(a => a.id !== offer.id), 'seated advisor remained in market');

// Occupied slot must refuse the hire and spend nothing.
setAdvisorMarket([{ ...offer, id: 'market_tribune_test_2', cost: 4 }]);
const goldBeforeRefused = gold.value;
assert(
  hireAndSeatAdvisor({ ...offer, id: 'market_tribune_test_2', cost: 4 }, 0) === false,
  'hireAndSeatAdvisor should refuse an occupied slot',
);
assert(gold.value === goldBeforeRefused, 'refused hire must not spend gold');

// fireAdvisor sells from the market only (never a seated advisor).
assert(fireAdvisor(offer.id) === 0, 'fireAdvisor must refuse a seated advisor');
// Neutralize seated income modifiers (Raider/Centurion loot-bonus) so the
// sale-gold assertion is deterministic — addResource applies them to sales.
unseatAdvisor(1);
unseatAdvisor(2);
const marketOffer = advisorMarket.value[0];
assert(marketOffer, 'Expected an offer left in the market');
const goldBeforeFire = gold.value;
const gained = fireAdvisor(marketOffer.id);
assert(gained === 4 + (marketOffer.currentTier - 1) * 2, 'fireAdvisor sell price formula drifted');
assert(gold.value === goldBeforeFire + gained, 'fireAdvisor did not add the sale gold');
assert(advisorMarket.value.every(a => a.id !== marketOffer.id), 'fired advisor remained in market');

console.log('verify-advisor-market: ok');
