/**
 * Verifies Consilium mission + modifier bridge (Task 1) + seed round-trip (Task 2).
 * Run: npx tsx tools/verify-iter-belli-consilium.ts
 */
import { MISSIONS, getMissionById, passiveModifier, computeConsiliumSetup } from '../src/data/iter-belli-consilium';
import type { IterBelliState } from '../src/game/iterBelli/iter-belli-types';
import type { Advisor } from '../src/game/council/advisor';
import { startIterBelliCampaign, resetIterBelli, iterBelliState } from '../src/game/iterBelli/iter-belli-state';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

// --- Missions ---
check('5 missions', Object.keys(MISSIONS).length === 5);
check('distinct mission ids', new Set(Object.values(MISSIONS).map((m) => m.id)).size === 5);
check('red → asalto', MISSIONS.red.id === 'asalto');
check('purple → botin', MISSIONS.purple.id === 'botin');
check('getMissionById round-trip', getMissionById('pax')?.id === 'pax');
check('getMissionById null', getMissionById(null) === null);
check('getMissionById unknown', getMissionById('zzz') === null);

// --- Mission conditions (crafted final states) ---
const base = { turnNum: 5, threat: 3, morale: 8, gold: 200, soldiers: 1000, initialSoldiers: 1000 } as IterBelliState;
check('pax true at threat 4', MISSIONS.blue.condition({ ...base, threat: 4 }));
check('pax false at threat 5', !MISSIONS.blue.condition({ ...base, threat: 5 }));
check('legion true at 60%', MISSIONS.white.condition({ ...base, soldiers: 600, initialSoldiers: 1000 }));
check('legion false below 60%', !MISSIONS.white.condition({ ...base, soldiers: 599, initialSoldiers: 1000 }));
check('asalto true at 8 days', MISSIONS.red.condition({ ...base, turnNum: 8 }));
check('asalto false at 9 days', !MISSIONS.red.condition({ ...base, turnNum: 9 }));
check('botin true at 120 gold', MISSIONS.purple.condition({ ...base, gold: 120 }));
check('cruzada false at morale 5', !MISSIONS.gold.condition({ ...base, morale: 5 }));

// --- passiveModifier ---
check('upkeep 20% → +5 supplies', passiveModifier({ type: 'upkeep-reduction', percent: 20 }).supplies === 5);
check('threat-reduction 2 → 2', passiveModifier({ type: 'threat-reduction', amount: 2 }).threat === 2);
check('gold resource 3 → +3 gold', passiveModifier({ type: 'resource-per-spoke', resource: 'gold', amount: 3 }).gold === 3);
check('momentum resource → 0 gold', passiveModifier({ type: 'resource-per-spoke', resource: 'momentum', amount: 3 }).gold === 0);
check('loot 25% → +5 gold', passiveModifier({ type: 'loot-bonus', percent: 25 }).gold === 5);
check('shop 10% → +2 gold', passiveModifier({ type: 'shop-discount', percent: 10 }).gold === 2);
check('heal 200 → +2 morale', passiveModifier({ type: 'heal-between-nodes', amount: 200 }).morale === 2);
check('extra-event-choices → 0 supplies', passiveModifier({ type: 'extra-event-choices', count: 2 }).supplies === 0);

// --- computeConsiliumSetup ---
const mk = (color: string, passive: unknown): Advisor =>
  ({ color, currentTier: 1, tiers: [{ passive }] } as unknown as Advisor);

const empty = computeConsiliumSetup([null, null, null]);
check('empty → null mission', empty.missionId === null);
check('empty → zero deltas', empty.supplies === 0 && empty.gold === 0 && empty.threat === 0 && empty.morale === 0);

const c1 = computeConsiliumSetup([
  mk('red', { type: 'loot-bonus', percent: 25 }),
  mk('blue', { type: 'threat-reduction', amount: 2 }),
  mk('gold', { type: 'upkeep-reduction', percent: 20 }),
]);
check('first slot sets mission', c1.missionId === 'asalto');
check('first slot loot NOT counted', c1.gold === 0);
check('other slots sum threat', c1.threat === 2);
check('other slots sum supplies', c1.supplies === 5);

// --- Seed round-trip ---
const seedBase = { soldiers: 1000, gold: 0, iuniores: 0, discipline: 4, archetype: null, spokeTerrain: 'plains', spokeDuration: 1 };
startIterBelliCampaign({ ...seedBase, missionId: 'pax', startThreat: 0, startMorale: 10 });
check('seed applies missionId', iterBelliState.value.missionId === 'pax');
check('seed applies startThreat', iterBelliState.value.threat === 0);
check('seed applies startMorale', iterBelliState.value.morale === 10);
startIterBelliCampaign({ ...seedBase });
check('omitted missionId → null', iterBelliState.value.missionId === null);
resetIterBelli();
check('reset clears missionId', iterBelliState.value.missionId === null);

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
