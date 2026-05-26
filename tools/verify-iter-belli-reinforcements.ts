/**
 * Verifies the iuniores reinforcement bridge & levy card.
 * Run: npx tsx tools/verify-iter-belli-reinforcements.ts
 */
import { startIterBelliCampaign, resetIterBelli, iterBelliState } from '../src/game/iterBelli/iter-belli-state';
import { CARD_DEFS } from '../src/data/iter-belli-cards';
import { LOCATIONS } from '../src/data/iter-belli-locations';
import { LEVY_IUNIORES_COST, LEVY_IUNIORES_SOLDIERS } from '../src/game/iterBelli/iter-belli-balance';
import type { CardContext } from '../src/game/iterBelli/iter-belli-types';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

// --- Seed / reset ---
startIterBelliCampaign({ soldiers: 1200, gold: 40, iuniores: 1500 });
check('campaign seeds iuniores from run', iterBelliState.value.iuniores === 1500);

resetIterBelli();
check('resetIterBelli zeroes iuniores', iterBelliState.value.iuniores === 0);

// --- Levy card contract ---
const levy = CARD_DEFS.find((c) => c.id === 'leva_iuniores');
check('leva_iuniores card exists', !!levy);
if (levy) {
  check('levy costs iuniores', levy.cost.iuniores === LEVY_IUNIORES_COST);
  const mkCtx = (iun: number): CardContext =>
    ({ state: { ...iterBelliState.value, iuniores: iun }, loc: LOCATIONS[0] });
  check('levy grants soldiers', levy.effects(mkCtx(LEVY_IUNIORES_COST)).soldiers === LEVY_IUNIORES_SOLDIERS);
  check('levy requires enough iuniores (pass)', levy.requires!(mkCtx(LEVY_IUNIORES_COST)) === true);
  check('levy requires enough iuniores (fail)', levy.requires!(mkCtx(LEVY_IUNIORES_COST - 1)) === false);
}

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll reinforcement checks passed.');
