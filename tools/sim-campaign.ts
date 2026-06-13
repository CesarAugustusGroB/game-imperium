/**
 * sim-campaign.ts — headless campaign-phase Monte-Carlo for balance analysis (plan S-J).
 *
 * Complements tools/sim-battle-balance.ts (which sims the decisive battle): this
 * drives the MARCH phase — the card-driven trek from the frontier to the objective
 * — across many runs with a simple "advance-first" strategy, and reports how often
 * a starter army reaches Saguntum, how many days it takes, and the supply/morale/
 * threat state on arrival. Answers the audit's questions: is the deadline tight? is
 * the supply cushion frustrating? Uses the same headless state machine the
 * campaign-flow integration test drives (loop-35/36/39).
 *
 * Run: npx tsx tools/sim-campaign.ts [runs]   (default 500)
 */
import {
  startIterBelliCampaign, playCard, iterBelliState, resetIterBelli,
} from '../src/game/iterBelli/iter-belli-state';
import { getActiveScenario } from '../src/game/iterBelli/iter-belli-scenario';
import { START } from '../src/game/iterBelli/iter-belli-balance';

const RUNS = Number(process.argv[2]) || 500;
const TURN_GUARD = 60; // hard cap so a non-advancing strategy can't loop forever

// A representative fresh-army embark (matches a typical early run: starter cohorts,
// no campaign erosion). spokeDuration/threat/morale/supplies fall back to START.
const SEED = {
  soldiers: 3400, gold: 7, iuniores: 2000, discipline: 8,
  archetype: 'Warlord' as const, spokeTerrain: 'plains', spokeDuration: 8,
};

interface Result {
  reached: boolean;
  daysUsed: number;
  suppliesEnd: number;
  moraleEnd: number;
  threatEnd: number;
  starvedFinish: boolean; // morale/army collapse before the objective
}

function runOne(): Result {
  startIterBelliCampaign({ ...SEED });
  const scen = getActiveScenario();
  const objId = scen.objectiveLocationId;
  const atObjective = () => scen.locations[iterBelliState.value.locationIdx]?.id === objId;

  let guard = 0;
  while (guard++ < TURN_GUARD) {
    const s = iterBelliState.value;
    if (s.finished || atObjective() || s.timeRemaining <= 0) break;
    // Advance-first: play a Movimiento card (the pity rule guarantees one), else
    // any non-crisis card (keeps the clock moving so a stuck pool still resolves).
    const mover = s.pool.find((c) => c.def.category === 'Movimiento');
    const card = mover ?? s.pool.find((c) => c.def.category !== 'Crisis');
    if (!card) break;
    playCard(card.instanceId);
  }

  const s = iterBelliState.value;
  const reached = atObjective();
  return {
    reached,
    daysUsed: START.timeRemaining - s.timeRemaining,
    suppliesEnd: s.supplies,
    moraleEnd: s.morale,
    threatEnd: s.threat,
    starvedFinish: s.finished && !reached,
  };
}

const results: Result[] = [];
for (let i = 0; i < RUNS; i++) { results.push(runOne()); resetIterBelli(); }

const reached = results.filter((r) => r.reached);
const pct = (n: number) => `${((n / RUNS) * 100).toFixed(1)}%`;
const avg = (xs: number[]) => xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length) : 0;

console.log(`\nsim-campaign — ${RUNS} runs · advance-first strategy · Saguntum starter army`);
console.log(`  (clock: ${START.timeRemaining}d hard deadline · mission bonus ≤ 8d)\n`);
console.log(`  reached objective : ${pct(reached.length)}  (${reached.length}/${RUNS})`);
console.log(`  collapsed en route: ${pct(results.filter((r) => r.starvedFinish).length)}`);
console.log(`  ran out of days   : ${pct(results.filter((r) => !r.reached && !r.starvedFinish).length)}`);
console.log(`\n  on arrival (reached runs):`);
console.log(`    days used   : avg ${avg(reached.map((r) => r.daysUsed)).toFixed(1)}  (≤8 = mission bonus)`);
console.log(`    supplies    : avg ${avg(reached.map((r) => r.suppliesEnd)).toFixed(1)}`);
console.log(`    morale      : avg ${avg(reached.map((r) => r.moraleEnd)).toFixed(1)} / 15`);
console.log(`    threat      : avg ${avg(reached.map((r) => r.threatEnd)).toFixed(1)} / 10`);
console.log(`    bonus-time arrivals (≤8d): ${pct(reached.filter((r) => r.daysUsed <= 8).length)}\n`);
