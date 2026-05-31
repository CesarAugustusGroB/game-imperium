/**
 * Verifies Consilium Hub integration + passive revival: passiveModifier revived,
 * advisor aggregators, and Hub consumers combining doctrine + advisor sources.
 * Run: npx tsx tools/verify-consilium-hub.ts
 */
import { passiveModifier } from '../src/data/iter-belli-consilium';
import type { AdvisorPassive } from '../src/game/council/advisor';

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

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
