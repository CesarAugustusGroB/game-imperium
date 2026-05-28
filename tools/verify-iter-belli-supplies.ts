/**
 * Verifies unified supplies: retuned constants (Task 1) + seed round-trip (Task 2).
 * Run: npx tsx tools/verify-iter-belli-supplies.ts
 */
import { SUPPLY_UPKEEP_PER_TURN, CAMP_SUPPLY_COST, START } from '../src/game/iterBelli/iter-belli-balance';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

// --- Retuned constants (Hub scale) ---
check('upkeep per turn is 2', SUPPLY_UPKEEP_PER_TURN === 2);
check('camp supply cost is 4', CAMP_SUPPLY_COST === 4);
check('START.supplies is 28', START.supplies === 28);

// --- Seed round-trip (added in Task 2) ---

if (failures > 0) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll checks passed');
