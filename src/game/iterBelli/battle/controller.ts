import { signal } from '@preact/signals';
import type { BattleState, EnemyArchetype, CenterDef, FormationKey, OrderKey, RoundLogLine, Rng } from './types';
import type { PlayerSeed } from './adapter';
import { makeBattleArmy, makeBattleState, playRound, realRng } from './engine';
import { hasBattleEffect, applyDecretumInBattle } from './decreta';
import { decretumHand, removeDecretum } from '../../items/decretum-store';
import { isDecretumCastable } from '../../items/decretum';
import { selectedCommander } from '../../core/game-state';
import { spendCampaignCost } from '../iter-belli-state';

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
  lastOrders: { you: OrderKey; enemy: OrderKey } | null;
  lastLosses: { you: number; enemy: number } | null;
  /** Id of the decretum cast this battle (one per battle), or null. */
  decretumCastId: string | null;
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
    lastOrders: null,
    lastLosses: null,
    decretumCastId: null,
  };
}

export function chooseFormation(formation: FormationKey): void {
  const s = battleSession.value; if (!s || s.phase !== 'deployment' || !OPTS) return;
  const you = makeBattleArmy('you', OPTS.playerSeedFor(formation));
  const enemy = makeBattleArmy('enemy', OPTS.enemy);
  battleSession.value = { ...s, phase: 'fighting', state: makeBattleState(you, enemy, OPTS.center), log: [], lastOrders: null, lastLosses: null, decretumCastId: null };
}

/**
 * Cast a decretum from the hand into the live battle. One per battle.
 * Color-lock applies; the cast cost is paid from the campaign pool.
 * Returns true on success (the scroll is consumed).
 */
export function castBattleDecretum(id: string): boolean {
  const s = battleSession.value;
  if (!s || s.phase !== 'fighting' || s.decretumCastId !== null) return false;
  const scroll = decretumHand.value.find((d) => d.id === id);
  if (!scroll || !hasBattleEffect(scroll)) return false;
  const faction = selectedCommander.value?.faction ?? null;
  if (!faction || !isDecretumCastable(scroll, faction)) return false;
  if (scroll.castCost && !spendCampaignCost(scroll.castCost)) return false;

  const lines = applyDecretumInBattle(s.state, scroll);
  removeDecretum(id);
  battleSession.value = { ...s, log: [...s.log, ...lines], decretumCastId: id };
  return true;
}

export function issueOrder(order: OrderKey): void {
  const s = battleSession.value; if (!s || s.phase !== 'fighting') return;
  const yHp = s.state.you.hp, eHp = s.state.enemy.hp;
  const { log: lines, enemyOrder } = playRound(s.state, order, RNG);
  const phase = s.state.finished ? 'resolved' : 'fighting';
  battleSession.value = {
    ...s, phase, state: s.state, log: [...s.log, ...lines],
    lastOrders: { you: order, enemy: enemyOrder },
    lastLosses: { you: yHp - s.state.you.hp, enemy: eHp - s.state.enemy.hp },
  };
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
