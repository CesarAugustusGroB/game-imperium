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

interface SimEnemy { archetype: string; baseSoldiers: number; minSoldiers: number; }

function simulate(
  roster: ReturnType<typeof makeRoster>, playerSoldiers: number, threat: number, weaken: number,
  enemyCfg: SimEnemy, playerCfg: { discipline?: number; armor?: 'copper' | 'bronze' | 'iron' } = {},
): { winPct: number; avgRounds: number } {
  const N = 400;
  let wins = 0; let rounds = 0;
  for (let i = 0; i < N; i++) {
    const snap = { soldiers: playerSoldiers, initialSoldiers: playerSoldiers, morale: 8, discipline: playerCfg.discipline ?? 3, ammunition: 24 };
    const seed = buildPlayerSeed(snap, roster, null, FORMATIONS.battleLine, { material: playerCfg.armor ?? 'copper' }, 24, false, 1);
    const enemyMult = (1 + threat / B.ENEMY_THREAT_DIVISOR) * (1 - weaken * B.ENEMY_WEAKEN_PER_POINT);
    const enemySoldiers = Math.max(enemyCfg.minSoldiers, Math.round(enemyCfg.baseSoldiers * enemyMult));
    const enemy = buildEnemyArchetype(enemyCfg.archetype, weaken, enemySoldiers);
    const S = makeBattleState(makeBattleArmy('you', seed as never), makeBattleArmy('enemy', enemy as never), CENTERS.plain);
    while (!S.finished && S.round < 30) playRound(S, pickOrder(S), rng);
    if (S.victory === true) wins++;
    rounds += S.round;
  }
  return { winPct: Math.round((wins / N) * 100), avgRounds: Math.round(rounds / N) };
}

const ROSTERS: Record<string, string[]> = {
  'starter (2 hastati)': ['hastati', 'hastati'],
  'starter+2 line (h,h,principes,triarii)': ['hastati', 'hastati', 'principes', 'triarii'],
  'starter+2 mobile (h,h,velites,equites)': ['hastati', 'hastati', 'velites', 'equites'],
  'full (h,h,principes,triarii,velites,equites)': ['hastati', 'hastati', 'principes', 'triarii', 'velites', 'equites'],
};

const SCENARIO_ENEMIES: Record<string, SimEnemy & { playerCfg?: { discipline?: number; armor?: 'copper' | 'bronze' | 'iron' } }> = {
  // Saguntum: first campaign, fresh player (disc 3, copper).
  'SAGUNTUM (carthage)': { archetype: 'carthage', baseSoldiers: B.ENEMY_BASE_SOLDIERS, minSoldiers: B.ENEMY_MIN_SOLDIERS },
  // Gallia: second campaign — the player arrives with first-victory loot
  // (better armor, drilled discipline), so simulate that baseline too.
  'GALLIA (gauls) · fresh': { archetype: 'gauls', baseSoldiers: 6500, minSoldiers: 2200 },
  'GALLIA (gauls) · veteran (disc 5, iron)': { archetype: 'gauls', baseSoldiers: 6500, minSoldiers: 2200, playerCfg: { discipline: 5, armor: 'iron' } },
  // Numantia: third campaign — elite iberians (smaller host, highest raw stats).
  // Only a geared veteran (disc 6, iron) is the appropriate tier; fresh loses.
  'NUMANTIA (iberians) · veteran (disc 6, iron)': { archetype: 'iberians', baseSoldiers: 5200, minSoldiers: 2000, playerCfg: { discipline: 6, armor: 'iron' } },
};

for (const [scenarioLabel, cfg] of Object.entries(SCENARIO_ENEMIES)) {
  console.log(`\n═══ ${scenarioLabel} · base ${cfg.baseSoldiers} ═══`);
  console.log('roster                                        player  threat weaken | win%  rounds');
  for (const [label, ids] of Object.entries(ROSTERS)) {
    const roster = makeRoster(ids);
    const soldiers = ids.length * 1000 + 1400; // cohort HP + typical embark bonuses
    for (const [threat, weaken] of [[0, 0], [2, 2], [2, 5]] as const) {
      const r = simulate(roster, soldiers, threat, weaken, cfg, cfg.playerCfg ?? {});
      console.log(`${label.padEnd(45)} ${String(soldiers).padEnd(7)} ${String(threat).padEnd(6)} ${String(weaken).padEnd(6)} | ${String(r.winPct).padStart(3)}%  ${r.avgRounds}`);
    }
  }
}
