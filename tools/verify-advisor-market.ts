import { ADVISOR_CONSUL, ADVISOR_TRIBUNE } from '../src/data/advisor-data';
import { COMMANDERS } from '../src/data/commanders';
import {
  advisorMarket,
  advisorPool,
  councilSlots,
  hireAdvisorFromMarket,
  hireAndSeatAdvisor,
  setAdvisorMarket,
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

const poolOffer = {
  ...ADVISOR_CONSUL,
  id: 'market_consul_test',
  cost: { resource: 'gold' as const, amount: 3 },
};

setAdvisorMarket([poolOffer]);
const goldBeforePoolHire = gold.value;
const hired = hireAdvisorFromMarket(poolOffer.id);

assert(hired?.id === poolOffer.id, 'hireAdvisorFromMarket did not return the hired advisor');
assert(gold.value === goldBeforePoolHire - 3, 'hireAdvisorFromMarket did not spend the offer cost');
assert(advisorMarket.value.every(a => a.id !== poolOffer.id), 'hired advisor remained in market');
assert(advisorPool.value.some(a => a.id === poolOffer.id), 'hired advisor was not added to advisorPool');

const displaced = councilSlots.value[0];
assert(displaced, 'Expected commander default loadout to seat slot 0');

const seatOffer = {
  ...ADVISOR_TRIBUNE,
  id: 'market_tribune_test',
  cost: { resource: 'gold' as const, amount: 4 },
};

setAdvisorMarket([seatOffer]);
const goldBeforeSeatHire = gold.value;
const seated = hireAndSeatAdvisor(seatOffer.id, 0);

assert(seated, 'hireAndSeatAdvisor returned false for a valid offer and slot');
assert(gold.value === goldBeforeSeatHire - 4, 'hireAndSeatAdvisor did not spend the offer cost');
assert(councilSlots.value[0]?.id === seatOffer.id, 'hireAndSeatAdvisor did not seat the hired advisor');
assert(advisorPool.value.some(a => a.id === displaced.id), 'displaced advisor did not return to advisorPool');
assert(advisorMarket.value.every(a => a.id !== seatOffer.id), 'seated advisor remained in market');

console.log('verify-advisor-market: ok');
