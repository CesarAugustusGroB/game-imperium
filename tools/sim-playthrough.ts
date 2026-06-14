/**
 * sim-playthrough.ts — END-TO-END Iter Belli Monte-Carlo (march → decisive battle).
 *
 * sim-campaign.ts sims only the march; sim-battle-balance.ts sims only the battle
 * with hand-picked weaken values. This joins them through the REAL engine: it plays
 * a full campaign with a "reasonable player" strategy (advance, but also erode the
 * enemy / resupply / steady morale when there's slack), carries the arrival state
 * (survivors, morale, threat, accumulated enemyWeaken) into buildPlayerSeed +
 * buildEnemyArchetype exactly like BattleModal, fights the battle, and reports the
 * OVERALL win rate. That overall number is the game's actual difficulty.
 *
 * Run: npx tsx tools/sim-playthrough.ts [runs]   (default 1000)
 */
import {
  startIterBelliCampaign, playCard, camp, iterBelliState, resetIterBelli,
} from '../src/game/iterBelli/iter-belli-state';
import { getActiveScenario, setActiveScenarioById } from '../src/game/iterBelli/iter-belli-scenario';
import { buildPlayerSeed, buildEnemyArchetype } from '../src/game/iterBelli/battle/adapter';
import { makeBattleArmy, makeBattleState, playRound } from '../src/game/iterBelli/battle/engine';
import { FORMATIONS, CENTERS } from '../src/game/iterBelli/battle/orders';
import { getCohortById } from '../src/game/army/cohort-data';
import { createCohortInstance } from '../src/game/army/cohort';
import * as B from '../src/game/iterBelli/iter-belli-balance';
import type { BattleState, OrderKey, Rng } from '../src/game/iterBelli/battle/types';

const RUNS = Number(process.argv[2]) || 1000;
const TURN_GUARD = 80;
const rng: Rng = { rollDie: (sides) => 1 + Math.floor(Math.random() * sides) };

// ── Player battle policy (same competent heuristic as sim-battle-balance) ──
function pickOrder(S: BattleState): OrderKey {
  const you = S.you;
  if (you.morale < 4 && you.formation.orders.includes('rally')) return 'rally';
  if (S.enemy.morale < 5 && you.formation.orders.includes('charge')) return 'charge';
  if (S.round % 3 === 2) return 'advance';
  return 'holdLine';
}

type Strategy = 'rush' | 'balanced';

// Distance (locations) still to travel before the objective — used to budget days.
function stopsToGo(): number {
  const s = iterBelliState.value;
  const scen = getActiveScenario();
  return Math.max(0, (scen.locations.length - 1) - s.locationIdx);
}

// rush: always march (matches sim-campaign's advance-first, ~99% reach).
// balanced: march, but spend a *spare* day eroding the enemy or resupplying when
// the deadline comfortably allows it (days left > stops left + buffer).
function pickCard(strategy: Strategy): number | 'camp' | null {
  const s = iterBelliState.value;
  const pool = s.pool.filter((c) => c.def.category !== 'Crisis');
  const mover = pool.find((c) => c.def.category === 'Movimiento');

  if (strategy === 'balanced') {
    const daySlack = s.timeRemaining - stopsToGo() - 2; // keep a 2-day safety buffer
    if (s.supplies <= 8) {
      const log = pool.find((c) => c.def.category === 'Logística');
      if (log) return log.instanceId;
    }
    if (daySlack > 0 && s.supplies > 6) {
      const eroder = pool.find((c) => /Coerción|Inteligencia|Postura|Diplomacia/.test(c.def.category)
        && c.def.cardType !== 'compromiso');
      if (eroder && s.enemyWeaken < 6) return eroder.instanceId;
    }
  }

  if (mover) return mover.instanceId;
  if (s.morale < 4 && s.supplies > B.CAMP_SUPPLY_COST) return 'camp';
  const any = pool[0];
  return any ? any.instanceId : (s.supplies > B.CAMP_SUPPLY_COST ? 'camp' : null);
}

interface Roster { label: string; ids: string[]; soldiers: number; discipline: number; armor: 'copper' | 'bronze' | 'iron'; }
const ROSTERS: Roster[] = [
  { label: 'starter (2 cohorts, disc 4, copper)', ids: ['hastati', 'hastati'], soldiers: 3400, discipline: 4, armor: 'copper' },
  { label: 'mid (4 cohorts, disc 6, bronze)', ids: ['hastati', 'hastati', 'principes', 'triarii'], soldiers: 5400, discipline: 6, armor: 'bronze' },
  { label: 'full (6 cohorts, disc 8, iron)', ids: ['hastati', 'hastati', 'principes', 'triarii', 'velites', 'equites'], soldiers: 7400, discipline: 8, armor: 'iron' },
];

interface Outcome { reachedBattle: boolean; campaignWin: boolean; weaken: number; threatEnd: number; moraleArrival: number; survivors: number; }

function runOne(r: Roster, strategy: Strategy): Outcome {
  startIterBelliCampaign({
    soldiers: r.soldiers, gold: 40, iuniores: 2000, discipline: r.discipline,
    archetype: 'Warlord', spokeTerrain: 'plains', spokeDuration: 8,
  });
  const scen = getActiveScenario();
  const objId = scen.objectiveLocationId;
  const atObjective = () => scen.locations[iterBelliState.value.locationIdx]?.id === objId;

  // ── March until we collapse, time out, or stand at the objective ──
  let guard = 0;
  while (guard++ < TURN_GUARD) {
    const s = iterBelliState.value;
    if (s.finished || s.phase !== 'campaign') break;
    if (atObjective()) break;
    const pick = pickCard(strategy);
    if (pick == null) break;
    if (pick === 'camp') camp(); else playCard(pick);
  }

  const arrival = iterBelliState.value;
  if (arrival.finished && arrival.phase !== 'battle') {
    return { reachedBattle: false, campaignWin: false, weaken: arrival.enemyWeaken, threatEnd: arrival.threat, moraleArrival: arrival.morale, survivors: arrival.soldiers };
  }
  if (!atObjective()) {
    return { reachedBattle: false, campaignWin: false, weaken: arrival.enemyWeaken, threatEnd: arrival.threat, moraleArrival: arrival.morale, survivors: arrival.soldiers };
  }

  // ── Decisive battle: replicate BattleModal seeding faithfully ──
  const cs = iterBelliState.value;
  const roster = r.ids.map((id) => createCohortInstance(getCohortById(id)!));
  const snap = { soldiers: cs.soldiers, initialSoldiers: cs.initialSoldiers, morale: cs.morale, discipline: cs.discipline, ammunition: cs.ammunition };
  const seed = buildPlayerSeed(snap, roster, null, FORMATIONS.battleLine, { material: r.armor }, undefined, cs.fortified, 1);
  const enemyMult = (1 + cs.threat / B.ENEMY_THREAT_DIVISOR) * (1 - cs.enemyWeaken * B.ENEMY_WEAKEN_PER_POINT);
  const enemySoldiers = Math.max(scen.enemy.minSoldiers, Math.round(scen.enemy.baseSoldiers * enemyMult));
  const enemy = buildEnemyArchetype(scen.enemy.archetypeKey, cs.enemyWeaken, enemySoldiers);
  const S = makeBattleState(makeBattleArmy('you', seed as never), makeBattleArmy('enemy', enemy as never), CENTERS.plain);
  while (!S.finished && S.round < 30) playRound(S, pickOrder(S), rng);

  return {
    reachedBattle: true, campaignWin: S.victory === true,
    weaken: cs.enemyWeaken, threatEnd: cs.threat, moraleArrival: cs.morale, survivors: Math.max(0, Math.round(S.you.hp)),
  };
}

const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

for (const scenId of ['saguntum', 'gallia']) {
  setActiveScenarioById(scenId);
  for (const strategy of ['rush', 'balanced'] as const) {
    console.log(`\n████ ${scenId.toUpperCase()} · ${strategy.toUpperCase()} · ${RUNS} runs/roster ████`);
    console.log('roster                                  | reach batt | win|reach | OVERALL win | weaken thr morale');
    for (const r of ROSTERS) {
      const out: Outcome[] = [];
      for (let i = 0; i < RUNS; i++) { out.push(runOne(r, strategy)); resetIterBelli(); }
      const reached = out.filter((o) => o.reachedBattle);
      const wins = out.filter((o) => o.campaignWin).length;
      const winGivenReach = reached.length ? pct(wins, reached.length) : '—';
      console.log(
        `${r.label.padEnd(39)} | ${pct(reached.length, RUNS).padStart(6)}     | ${winGivenReach.padStart(6)}    | ${pct(wins, RUNS).padStart(6)}      | `
        + `${avg(reached.map((o) => o.weaken)).toFixed(1).padStart(4)}   ${avg(reached.map((o) => o.threatEnd)).toFixed(1).padStart(3)}  ${avg(reached.map((o) => o.moraleArrival)).toFixed(1)}`,
      );
    }
  }
}
console.log('');
