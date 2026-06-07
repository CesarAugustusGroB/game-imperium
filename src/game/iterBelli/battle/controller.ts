import { signal } from '@preact/signals';
import type { BattleState, EnemyArchetype, CenterDef, FormationKey, OrderKey, RoundLogLine, Rng } from './types';
import type { PlayerSeed } from './adapter';
import { makeBattleArmy, makeBattleState, playRound, realRng } from './engine';

export interface ConcludeResult { victory: boolean; survivors: number; finalMorale: number; }
export interface BeginOpts {
  playerSeedFor: (formation: FormationKey) => PlayerSeed;
  formationOptions: FormationKey[];
  enemy: EnemyArchetype;
  center: CenterDef;
  onConclude: (r: ConcludeResult) => void;
  rng?: Rng;
}
export interface BattleSession {
  phase: 'deployment' | 'fighting' | 'resolved';
  formationOptions: FormationKey[];
  state: BattleState;
  log: RoundLogLine[];
}

let OPTS: BeginOpts | null = null;
let RNG: Rng = realRng;
export const battleSession = signal<BattleSession | null>(null);

export function beginBattleSession(opts: BeginOpts): void {
  OPTS = opts; RNG = opts.rng ?? realRng;
  const seed = opts.playerSeedFor(opts.formationOptions[0]);
  const you = makeBattleArmy('you', seed);
  const enemy = makeBattleArmy('enemy', opts.enemy);
  battleSession.value = {
    phase: 'deployment',
    formationOptions: opts.formationOptions,
    state: makeBattleState(you, enemy, opts.center),
    log: [],
  };
}

export function chooseFormation(formation: FormationKey): void {
  const s = battleSession.value; if (!s || s.phase !== 'deployment' || !OPTS) return;
  const you = makeBattleArmy('you', OPTS.playerSeedFor(formation));
  const enemy = makeBattleArmy('enemy', OPTS.enemy);
  battleSession.value = { ...s, phase: 'fighting', state: makeBattleState(you, enemy, OPTS.center), log: [] };
}

export function issueOrder(order: OrderKey): void {
  const s = battleSession.value; if (!s || s.phase !== 'fighting') return;
  const lines = playRound(s.state, order, RNG);
  const phase = s.state.finished ? 'resolved' : 'fighting';
  battleSession.value = { ...s, phase, state: s.state, log: [...s.log, ...lines] };
}

export function concludeBattleSession(): void {
  const s = battleSession.value; if (!s || !OPTS) return;
  const cb = OPTS.onConclude;
  const result: ConcludeResult = {
    victory: s.state.victory === true,
    survivors: Math.max(0, Math.round(s.state.you.hp)),
    finalMorale: s.state.you.morale,
  };
  battleSession.value = null; OPTS = null;
  cb(result);
}
