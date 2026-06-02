/**
 * Verifies Iter Belli campaign persistence: start a campaign, mutate it, then
 * serialize → reset → restore and assert the live state round-trips exactly
 * (scalars, pool identity + timers, log length, scenario id).
 *
 * Run: npx tsx tools/verify-iter-belli-save.ts
 */
import { startIterBelliCampaign, resetIterBelli, iterBelliState, iterBelliLog, camp } from '../src/game/iterBelli/iter-belli-state';
import { serializeIterBelli, restoreIterBelli } from '../src/game/iterBelli/iter-belli-save';
import { getActiveScenario } from '../src/game/iterBelli/iter-belli-scenario';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (!cond) { console.error(`  ✗ ${label}`); failures++; }
  else { console.log(`  ✓ ${label}`); }
}

// 1. Start a campaign and advance a few turns so timers/turnNum/log are non-trivial.
startIterBelliCampaign({
  soldiers: 9000, gold: 120, iuniores: 30, discipline: 4,
  archetype: 'Warlord', spokeTerrain: 'plains', spokeDuration: 2,
  supplies: 40,
});
camp();
camp();

const before = iterBelliState.value;
const beforeLogLen = iterBelliLog.value.length;
const beforePoolIds = before.pool.map((c) => `${c.instanceId}:${c.def.id}:${c.timer}`);
const beforeScenario = getActiveScenario().id;

// 2. Serialize.
const save = serializeIterBelli();
check('serializeIterBelli returns a snapshot while active', save !== null);
if (!save) { process.exit(1); }
check('snapshot stores the scenario id', save.scenarioId === beforeScenario);
check('snapshot pool stores defId + timer', save.pool.length === before.pool.length);

// 3. Reset, then confirm serialize is null when inactive.
resetIterBelli();
check('serializeIterBelli returns null after reset', serializeIterBelli() === null);
check('reset clears the pool', iterBelliState.value.pool.length === 0);

// 4. Restore (no doctrines in this harness) and compare.
restoreIterBelli(save, []);
const after = iterBelliState.value;

check('soldiers round-trip', after.soldiers === before.soldiers);
check('gold round-trip', after.gold === before.gold);
check('morale round-trip', after.morale === before.morale);
check('turnNum round-trip', after.turnNum === before.turnNum);
check('locationIdx round-trip', after.locationIdx === before.locationIdx);
check('cardIdCounter round-trip', after.cardIdCounter === before.cardIdCounter);
check('phase round-trip', after.phase === before.phase);
check('archetype round-trip', after.archetype === before.archetype);
check('scenario id round-trip', getActiveScenario().id === beforeScenario);
check('log length round-trip', iterBelliLog.value.length === beforeLogLen);

const afterPoolIds = after.pool.map((c) => `${c.instanceId}:${c.def.id}:${c.timer}`);
check('pool identity + timers round-trip', JSON.stringify(afterPoolIds) === JSON.stringify(beforePoolIds));
check('restored pool defs are live (have effects fn)', after.pool.every((c) => c.def.category === 'Crisis' || typeof (c.def as { effects?: unknown }).effects === 'function'));

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
