/**
 * Verifies the iuniores reinforcement bridge (seed + reset).
 * A later task extends this file with the levy-card checks.
 * Run: npx tsx tools/verify-iter-belli-reinforcements.ts
 */
import { startIterBelliCampaign, resetIterBelli, iterBelliState } from '../src/game/iterBelli/iter-belli-state';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

startIterBelliCampaign({ soldiers: 1200, gold: 40, iuniores: 1500 });
check('campaign seeds iuniores from run', iterBelliState.value.iuniores === 1500);

resetIterBelli();
check('resetIterBelli zeroes iuniores', iterBelliState.value.iuniores === 0);

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll reinforcement checks passed.');
