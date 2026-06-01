/**
 * Verifies the Iter Belli scenario seam: SAGUNTUM is well-formed and the active
 * scenario holder defaults to it and is settable/resettable. Run with:
 *   npx tsx tools/verify-iter-belli-scenario.ts
 */
import { SAGUNTUM } from '../src/data/iter-belli-scenario-saguntum';
import {
  getActiveScenario, setActiveScenario, resetActiveScenario,
} from '../src/game/iterBelli/iter-belli-scenario';
import { CARD_DEFS } from '../src/data/iter-belli-cards';
import type { CampaignScenario } from '../src/game/iterBelli/iter-belli-types';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) { console.log(`  ok  ${label}`); }
  else { console.error(`FAIL  ${label}`); failures++; }
}

console.log('SAGUNTUM scenario');
check('5 locations', SAGUNTUM.locations.length === 5);
check('objective id = sagunto', SAGUNTUM.objectiveLocationId === 'sagunto');
const obj = SAGUNTUM.locations.find((l) => l.id === SAGUNTUM.objectiveLocationId);
check('objective location exists & is type objetivo', !!obj && obj.type === 'objetivo');
check('decisive card id = asalto_decisivo', SAGUNTUM.decisiveCardId === 'asalto_decisivo');
check('decisive card exists in CARD_DEFS', CARD_DEFS.some((c) => c.id === SAGUNTUM.decisiveCardId));

console.log('SAGUNTUM enemy');
check('enemy name', SAGUNTUM.enemy.name === 'Aníbal Barca');
check('enemy doctrine Maniobrera', SAGUNTUM.enemy.doctrine === 'Maniobrera');
check('enemy baseSoldiers 7000', SAGUNTUM.enemy.baseSoldiers === 7000);
check('enemy minSoldiers 2000', SAGUNTUM.enemy.minSoldiers === 2000);
check('enemy morale 8', SAGUNTUM.enemy.morale === 8);
check('enemy discipline 5', SAGUNTUM.enemy.discipline === 5);

console.log('SAGUNTUM narrative');
const n = SAGUNTUM.narrative;
check('victoryTitle non-empty', n.victoryTitle.length > 0);
check('defeatTitle non-empty', n.defeatTitle.length > 0);
check('victoryText non-empty', n.victoryText.length > 0);
check('defeatText non-empty', n.defeatText.length > 0);
check('battleWonLog interpolates count + place', n.battleWonLog(123).includes('123') && n.battleWonLog(123).includes('Sagunto'));
check('battleLostLog interpolates count', n.battleLostLog(7).includes('7'));

console.log('Active-scenario holder');
check('defaults to SAGUNTUM', getActiveScenario() === SAGUNTUM);
const fake = { ...SAGUNTUM, id: 'fake' } as CampaignScenario;
setActiveScenario(fake);
check('setActiveScenario switches', getActiveScenario().id === 'fake');
resetActiveScenario();
check('resetActiveScenario restores SAGUNTUM', getActiveScenario() === SAGUNTUM);

if (failures > 0) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll scenario checks passed.');
