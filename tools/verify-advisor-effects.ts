/**
 * Verifies the advisor-effect refactor:
 *  - passiveModifier maps each new passive type to the right SeedDeltas field
 *  - computeConsiliumSetup sums a hand-built council into the expected setup
 *  - no advisor still advertises a deprecated resource via resource-per-spoke
 * Run: npx tsx tools/verify-advisor-effects.ts
 */
import { passiveModifier, computeConsiliumSetup } from '../src/data/iter-belli-consilium';
import { STARTER_ADVISORS, ADVISOR_SIEGE_MASTER, ADVISOR_SCHOLAR, ADVISOR_ZEALOT, ADVISOR_CONSUL, ADVISOR_PONTIFEX } from '../src/data/advisor-data';
import type { Advisor } from '../src/game/council/advisor';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (!cond) { console.error(`  ✗ ${label}`); failures++; } else { console.log(`  ✓ ${label}`); }
}

// passiveModifier mapping for the new types
check('enemy-weaken → enemyWeaken', passiveModifier({ type: 'enemy-weaken', amount: 3 }).enemyWeaken === 3);
check('campaign-time → extraDays', passiveModifier({ type: 'campaign-time', days: 2 }).extraDays === 2);
check('morale-bonus → morale', passiveModifier({ type: 'morale-bonus', amount: 2 }).morale === 2);
check('soldiers-bonus → soldiers', passiveModifier({ type: 'soldiers-bonus', amount: 450 }).soldiers === 450);
check('threat-reduction → threat', passiveModifier({ type: 'threat-reduction', amount: 2 }).threat === 2);

// No advisor advertises a deprecated resource via resource-per-spoke (gold/iuniores only).
const deprecated = ['faith', 'influence', 'momentum'];
const offenders = STARTER_ADVISORS.flatMap((a: Advisor) =>
  a.tiers.filter((t) => t.passive.type === 'resource-per-spoke'
    && deprecated.includes((t.passive as { resource: string }).resource)).map(() => a.id));
check('no advisor uses a deprecated resource-per-spoke', offenders.length === 0);

// computeConsiliumSetup: the first seat picks the mission AND keeps its passive
// (the advisor card promises its passive regardless of seat — the embark
// summary in EmbarkCard renders exactly this sum, so they stay coherent).
const t = <T extends Advisor>(a: T, tier: 1 | 2 | 3): T => ({ ...a, currentTier: tier });
const council = [t(ADVISOR_CONSUL, 1), t(ADVISOR_SIEGE_MASTER, 1), t(ADVISOR_ZEALOT, 1)];
const setup = computeConsiliumSetup(council);
check('first seat sets the mission and keeps its passive (Consul −1 threat)', setup.threat === 1 && setup.missionId !== null);
check('Siege T1 contributes enemyWeaken 1', setup.enemyWeaken === 1);
check('Zealot T1 contributes soldiers 250', setup.soldiers === 250);

const council2 = [t(ADVISOR_CONSUL, 1), t(ADVISOR_SCHOLAR, 3), t(ADVISOR_PONTIFEX, 2)];
const setup2 = computeConsiliumSetup(council2);
check('Scholar T3 contributes extraDays 3', setup2.extraDays === 3);
check('Pontifex T2 contributes morale 2', setup2.morale === 2);

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
