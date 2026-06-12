/**
 * Headless balance simulator for the Iter Belli decisive battle.
 * Replicates BattleModal's seeding (buildPlayerSeed + buildEnemyArchetype +
 * threat/weaken multipliers) and plays N battles per configuration with a
 * simple competent policy, reporting win rates.
 * Run: npx tsx tools/sim-battle-balance.ts
 */
import { buildPlayerSeed, buildEnemyArchetype } from '../src/game/iterBelli/battle/adapter';
import { makeBattleArmy, makeBattleState, playRound } from '../src/game/iterBelli/battle/engine';
import { FORMATIONS, CENTERS } from '../src/game/iterBelli/battle/orders';
import { getCohortById } from '../src/game/army/cohort-data';
import { createCohortInstance } from '../src/game/army/cohort';
import * as B from '../src/game/iterBelli/iter-belli-balance';
import type { BattleState, OrderKey, Rng } from '../src/game/iterBelli/battle/types';

const rng: Rng = { rollDie: (sides: number) => 1 + Math.floor(Math.random() * sides) };

/** Simple competent policy: rally when wavering, otherwise hold/advance mix. */
function pickOrder(S: BattleState): OrderKey {
  const you = S.you;
  if (you.morale < 4 && you.formation.orders.includes('rally')) return 'rally';
  // Holding punishes the AI's frequent charges; push when the enemy wavers.
  if (S.enemy.morale < 5 && you.formation.orders.includes('charge')) return 'charge';
  if (S.round % 3 === 2) return 'advance';
  return 'holdLine';
}

function makeRoster(ids: string[]) {
  return ids.map((id) => createCohortInstance(getCohortById(id)!));
}

function simulate(roster: ReturnType<typeof makeRoster>, playerSoldiers: number, threat: number, weaken: number): { winPct: number; avgRounds: number } {
  const N = 400;
  let wins = 0; let rounds = 0;
  for (let i = 0; i < N; i++) {
    const snap = { soldiers: playerSoldiers, initialSoldiers: playerSoldiers, morale: 8, discipline: 3, ammunition: 24 };
    const seed = buildPlayerSeed(snap, roster, null, FORMATIONS.battleLine, { material: 'copper' }, 24, false, 1);
    const enemyMult = (1 + threat / B.ENEMY_THREAT_DIVISOR) * (1 - weaken * B.ENEMY_WEAKEN_PER_POINT);
    const enemySoldiers = Math.max(B.ENEMY_MIN_SOLDIERS, Math.round(B.ENEMY_BASE_SOLDIERS * enemyMult));
    const enemy = buildEnemyArchetype('carthage', weaken, enemySoldiers);
    const S = makeBattleState(makeBattleArmy('you', seed as never), makeBattleArmy('enemy', enemy as never), CENTERS.plain);
    while (!S.finished && S.round < 30) playRound(S, pickOrder(S), rng);
    if (S.victory === true) wins++;
    rounds += S.round;
  }
  return { winPct: Math.round((wins / N) * 100), avgRounds: Math.round(rounds / N) };
}

console.log(`ENEMY_BASE_SOLDIERS=${B.ENEMY_BASE_SOLDIERS} · archetype carthage (disc/stats live on the archetype)\n`);
const ROSTERS: Record<string, string[]> = {
  'starter (2 hastati)': ['hastati', 'hastati'],
  'starter+2 line (h,h,principes,triarii)': ['hastati', 'hastati', 'principes', 'triarii'],
  'starter+2 mobile (h,h,velites,equites)': ['hastati', 'hastati', 'velites', 'equites'],
  'full (h,h,principes,triarii,velites,equites)': ['hastati', 'hastati', 'principes', 'triarii', 'velites', 'equites'],
};
console.log('roster                                        player  threat weaken | win%  rounds');
for (const [label, ids] of Object.entries(ROSTERS)) {
  const roster = makeRoster(ids);
  const soldiers = ids.length * 1000 + 1400; // cohort HP + typical embark bonuses
  for (const [threat, weaken] of [[0, 0], [2, 2], [3, 2], [2, 5], [3, 7]] as const) {
    const r = simulate(roster, soldiers, threat, weaken);
    console.log(`${label.padEnd(45)} ${String(soldiers).padEnd(7)} ${String(threat).padEnd(6)} ${String(weaken).padEnd(6)} | ${String(r.winPct).padStart(3)}%  ${r.avgRounds}`);
  }
}
