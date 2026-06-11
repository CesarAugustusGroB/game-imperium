/**
 * Verifies commander identity: per-archetype discipline + legate ±1 + (Task 2) signature cards.
 * Run: npx tsx tools/verify-iter-belli-commander.ts
 */
import { startIterBelliCampaign, resetIterBelli, iterBelliState, computeStartingDiscipline } from '../src/game/iterBelli/iter-belli-state';
import { START } from '../src/game/iterBelli/iter-belli-balance';
import { CARD_DEFS } from '../src/data/iter-belli-cards';
import { LOCATIONS } from '../src/data/iter-belli-locations';
import { SIGNATURE } from '../src/game/iterBelli/iter-belli-balance';
import type { Archetype, CardContext } from '../src/game/iterBelli/iter-belli-types';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

// 0–10 native scale (Thread B): START.discipline 2 + archetype bonus {Warlord 0, Religious 0, Merchant 1, Diplomat 2}.
check('Warlord → 2', computeStartingDiscipline('Warlord', []) === 2);
check('Religious → 2', computeStartingDiscipline('Religious', []) === 2);
check('Merchant → 3', computeStartingDiscipline('Merchant', []) === 3);
check('Diplomat → 4', computeStartingDiscipline('Diplomat', []) === 4);
check('null archetype → START.discipline', computeStartingDiscipline(null, []) === START.discipline);

check('disciplined legate → +1 (Religious 2→3)', computeStartingDiscipline('Religious', ['disciplined']) === 3);
check('aggressive legate → −1 (Religious 2→1)', computeStartingDiscipline('Religious', ['aggressive']) === 1);
check('mixed traits net 0 (Religious 2)', computeStartingDiscipline('Religious', ['disciplined', 'aggressive']) === 2);
check('multiple +1 traits clamp to +2 (Religious 2→4)', computeStartingDiscipline('Religious', ['disciplined', 'cautious', 'tactician']) === 4);
check('neutral trait → 0 (Religious 2)', computeStartingDiscipline('Religious', ['veteran']) === 2);

check('Diplomat 4 + disciplined = 5', computeStartingDiscipline('Diplomat', ['disciplined']) === 5);
check('Warlord 2 − aggressive = 1', computeStartingDiscipline('Warlord', ['aggressive']) === 1);

startIterBelliCampaign({ soldiers: 1000, gold: 0, iuniores: 0, discipline: 5, archetype: 'Diplomat' });
check('seed applies discipline', iterBelliState.value.discipline === 5);
check('seed applies archetype', iterBelliState.value.archetype === 'Diplomat');
resetIterBelli();
check('reset clears archetype to null', iterBelliState.value.archetype === null);

// --- Signature cards ---
const mkCtx = (archetype: Archetype | null, gold = 0): CardContext =>
  ({ state: { ...iterBelliState.value, gold }, loc: LOCATIONS[0], archetype });

const sig: Array<[string, Archetype]> = [
  ['firma_furia_gala', 'Warlord'],
  ['firma_te_deum', 'Religious'],
  ['firma_mercenarios', 'Merchant'],
  ['firma_tratado', 'Diplomat'],
];
for (const [id, arch] of sig) {
  const card = CARD_DEFS.find((c) => c.id === id);
  check(`${id} exists`, !!card);
  if (card) {
    check(`${id} gated to ${arch}`, card.requires!(mkCtx(arch, 999)) === true);
    check(`${id} blocked for other archetype`, card.requires!(mkCtx(arch === 'Warlord' ? 'Religious' : 'Warlord', 999)) === false);
    check(`${id} locations '*'`, card.locations.includes('*'));
  }
}
check('furia gala effects', CARD_DEFS.find((c) => c.id === 'firma_furia_gala')!.effects(mkCtx('Warlord')).morale === SIGNATURE.furiaGalaMorale);
check('te deum morale', CARD_DEFS.find((c) => c.id === 'firma_te_deum')!.effects(mkCtx('Religious')).morale === SIGNATURE.teDeumMorale);
check('mercenarios soldiers', CARD_DEFS.find((c) => c.id === 'firma_mercenarios')!.effects(mkCtx('Merchant')).soldiers === SIGNATURE.mercenariosSoldiers);
check('mercenarios requires gold', CARD_DEFS.find((c) => c.id === 'firma_mercenarios')!.requires!(mkCtx('Merchant', 0)) === false);
check('tratado threat', CARD_DEFS.find((c) => c.id === 'firma_tratado')!.effects(mkCtx('Diplomat')).threat === SIGNATURE.tratadoThreat);

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll commander-identity checks passed.');
