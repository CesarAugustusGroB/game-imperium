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
import { getActiveScenario } from '../src/game/iterBelli/iter-belli-scenario';
import { buildPlayerSeed, buildEnemyArchetype, terrainToCenterKey } from '../src/game/iterBelli/battle/adapter';
import { makeBattleArmy, makeBattleState, playRound } from '../src/game/iterBelli/battle/engine';
import { FORMATIONS, CENTERS } from '../src/game/iterBelli/battle/orders';
import { getCohortById } from '../src/game/army/cohort-data';
import { createCohortInstance } from '../src/game/army/cohort';
import { DOCTRINE_SWORD, DOCTRINE_IRON, DOCTRINE_BLOOD, DOCTRINE_DISCIPLINA_FERREA } from '../src/data/doctrine-data';
import type { Doctrine } from '../src/game/items/doctrine';
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

// ── Real equipped-doctrine kit (replaces the old statMult/passiveMorale proxy) ──
// The sim now equips REAL doctrines and sums their embark-bonus effects exactly
// like getEmbarkBonus() (4 slots; current-level effects). `statMult` stays as the
// commander's battle passive (Warlord Veteran Stacks ≈ ×1.25 at 5 stacks) — that
// is a real mechanic, not a doctrine. The veteran tier carries a maxed red kit.
interface EquippedDoctrine { d: Doctrine; level: number; }
function embarkKit(equipped: EquippedDoctrine[] = []): { soldiers: number; morale: number; discipline: number } {
  const out = { soldiers: 0, morale: 0, discipline: 0 };
  for (const { d, level } of equipped) {
    for (const e of d.levels[level - 1].effects) {
      if (e.type === 'embark-bonus' && (e.stat === 'soldiers' || e.stat === 'morale' || e.stat === 'discipline')) {
        out[e.stat] += e.amount;
      }
    }
  }
  return out;
}

// Player power tiers = a COMPOSITE of what a hub player upgrades together (roster
// size → attack stats + HP, armor, embark discipline, and now EQUIPPED DOCTRINES).
// The 3 lighter tiers are early-game loadouts MEANT to lose the hard scenarios and
// grind. The `veteran` tier ≈ a player who has won 1–2 campaigns and maxed a red
// doctrine school (Sword+Iron+Blood at tier III) + drilled discipline + the Warlord
// battle passive — the *appropriate* tier for the later scenarios.
interface Roster { label: string; ids: string[]; soldiers: number; discipline: number; armor: 'copper' | 'bronze' | 'iron'; statMult?: number; doctrines?: EquippedDoctrine[]; }
const ROSTERS: Roster[] = [
  { label: 'under-prepared (2 coh · disc2 · copper)     ', ids: ['hastati', 'hastati'], soldiers: 3400, discipline: 2, armor: 'copper' },
  { label: 'standard       (4 coh · disc3 · bronze)     ', ids: ['hastati', 'hastati', 'principes', 'triarii'], soldiers: 5400, discipline: 3, armor: 'bronze' },
  { label: 'fully-prepared (6 coh · disc4 · iron)       ', ids: ['hastati', 'hastati', 'principes', 'triarii', 'velites', 'equites'], soldiers: 7400, discipline: 4, armor: 'iron' },
  // Base discipline 4 = Warlord (START 2) + disciplined legate (+2); the 4th slot
  // (Disciplina Ferrea III, now +4) carries the rest, so the discipline doctrine is
  // modelled from real data rather than baked into the base.
  { label: 'veteran        (6 coh · disc4+kit · iron · maxRed)', ids: ['hastati', 'hastati', 'principes', 'triarii', 'velites', 'equites'], soldiers: 7400, discipline: 4, armor: 'iron', statMult: 1.25,
    doctrines: [{ d: DOCTRINE_SWORD, level: 3 }, { d: DOCTRINE_IRON, level: 3 }, { d: DOCTRINE_BLOOD, level: 3 }, { d: DOCTRINE_DISCIPLINA_FERREA, level: 3 }] },
];

const SCENARIO_TERRAIN: Record<string, string> = { saguntum: 'plains', gallia: 'forest', numantia: 'hills' };

interface Outcome { reachedBattle: boolean; campaignWin: boolean; weaken: number; threatEnd: number; moraleArrival: number; survivors: number; }

function runOne(r: Roster, strategy: Strategy, scenId: string): Outcome {
  const terrain = SCENARIO_TERRAIN[scenId] ?? 'plains';
  // Equipped-doctrine embark bonuses, applied to the seed exactly like EmbarkCard
  // (getEmbarkBonus → soldiers/morale/discipline added at campaign start).
  const kit = embarkKit(r.doctrines);
  // Pin the scenario via the seed (the real fixed path — EmbarkCard does the same).
  startIterBelliCampaign({
    soldiers: r.soldiers + kit.soldiers, gold: 40, iuniores: 2000,
    discipline: r.discipline + kit.discipline,
    archetype: 'Warlord', spokeTerrain: terrain, spokeDuration: 8, scenarioId: scenId,
    startMorale: B.START.morale + kit.morale,
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
  const seed = buildPlayerSeed(snap, roster, null, FORMATIONS.battleLine, { material: r.armor }, undefined, cs.fortified, r.statMult ?? 1);
  const enemyMult = (1 + cs.threat / B.ENEMY_THREAT_DIVISOR) * (1 - cs.enemyWeaken * B.ENEMY_WEAKEN_PER_POINT);
  const enemySoldiers = Math.max(scen.enemy.minSoldiers, Math.round(scen.enemy.baseSoldiers * enemyMult));
  const enemy = buildEnemyArchetype(scen.enemy.archetypeKey, cs.enemyWeaken, enemySoldiers);
  const center = CENTERS[terrainToCenterKey(cs.spokeTerrain)] ?? CENTERS.plain;
  const S = makeBattleState(makeBattleArmy('you', seed as never), makeBattleArmy('enemy', enemy as never), center);
  while (!S.finished && S.round < 30) playRound(S, pickOrder(S), rng);

  return {
    reachedBattle: true, campaignWin: S.victory === true,
    weaken: cs.enemyWeaken, threatEnd: cs.threat, moraleArrival: cs.morale, survivors: Math.max(0, Math.round(S.you.hp)),
  };
}

const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

for (const scenId of ['saguntum', 'gallia', 'numantia']) {
  for (const strategy of ['rush', 'balanced'] as const) {
    console.log(`\n████ ${scenId.toUpperCase()} · ${strategy.toUpperCase()} · ${RUNS} runs/tier ████`);
    console.log('player tier                             | reach batt | win|reach | OVERALL win | weaken thr morale');
    for (const r of ROSTERS) {
      const out: Outcome[] = [];
      for (let i = 0; i < RUNS; i++) { out.push(runOne(r, strategy, scenId)); resetIterBelli(); }
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
