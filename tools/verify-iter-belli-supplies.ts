/**
 * Verifies unified supplies: retuned constants (Task 1) + seed round-trip (Task 2).
 * Run: npx tsx tools/verify-iter-belli-supplies.ts
 */
import { SUPPLY_UPKEEP_PER_TURN, CAMP_SUPPLY_COST, START } from '../src/game/iterBelli/iter-belli-balance';
import { startIterBelliCampaign, resetIterBelli, iterBelliState } from '../src/game/iterBelli/iter-belli-state';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

// --- Retuned constants (Hub scale) ---
check('upkeep per turn is 2', SUPPLY_UPKEEP_PER_TURN === 2);
check('camp supply cost is 4', CAMP_SUPPLY_COST === 4);
check('START.supplies is 28', START.supplies === 28);

// --- Seed round-trip ---
const seedBase = { soldiers: 1000, gold: 0, iuniores: 0, discipline: 4, archetype: null, spokeTerrain: 'plains', spokeDuration: 1 };
startIterBelliCampaign({ ...seedBase, supplies: 50 });
check('seed applies supplies', iterBelliState.value.supplies === 50);
startIterBelliCampaign({ ...seedBase, supplies: -3.7 });
check('seed floors & clamps supplies to >= 0', iterBelliState.value.supplies === 0);
startIterBelliCampaign({ ...seedBase });
check('omitted supplies falls back to START default (28)', iterBelliState.value.supplies === 28);
resetIterBelli();
check('reset restores supplies default (28)', iterBelliState.value.supplies === 28);

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
