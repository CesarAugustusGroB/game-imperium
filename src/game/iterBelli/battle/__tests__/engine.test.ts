import { describe, it, expect } from 'vitest';
import { makeBattleArmy, makeBattleState, playRound } from '../engine';
import { FORMATIONS, ENEMY_ARCHETYPES, CENTERS } from '../orders';
import type { Rng } from '../types';

const fixedRng = (val: number): Rng => ({ rollDie: () => val });

describe('playRound', () => {
  it('advances the round and produces a log', () => {
    const you = makeBattleArmy('you', { hp:10000, morale:10, discipline:6, stats:{charge:10,harass:8,push:16,siege:5,movement:9}, armorPct:20, armorName:'Iron', ammo:32, formation:FORMATIONS.battleLine });
    const enemy = makeBattleArmy('enemy', ENEMY_ARCHETYPES.carthage);
    const s = makeBattleState(you, enemy, CENTERS.plain);
    const { log } = playRound(s, 'charge', fixedRng(4));
    expect(s.round).toBe(1);
    expect(log.length).toBeGreaterThan(0);
  });
  it('a winning sequence eventually finishes with a verdict', () => {
    const you = makeBattleArmy('you', { hp:10000, morale:10, discipline:10, stats:{charge:30,harass:8,push:20,siege:5,movement:9}, armorPct:30, armorName:'Steel', ammo:32, formation:FORMATIONS.battleLine });
    const enemy = makeBattleArmy('enemy', ENEMY_ARCHETYPES.gauls);
    const s = makeBattleState(you, enemy, CENTERS.plain);
    let guard = 0;
    while (!s.finished && guard++ < 40) playRound(s, 'charge', fixedRng(6));
    expect(s.finished).toBe(true);
    expect(typeof s.victory).toBe('boolean');
  });
  it('a successful retreat ends the battle in defeat but saves troops', () => {
    const you = makeBattleArmy('you', { hp:10000, morale:10, discipline:6, stats:{charge:10,harass:8,push:16,siege:5,movement:9}, armorPct:20, armorName:'Iron', ammo:32, formation:FORMATIONS.battleLine });
    const enemy = makeBattleArmy('enemy', ENEMY_ARCHETYPES.carthage);
    const s = makeBattleState(you, enemy, CENTERS.plain);
    playRound(s, 'retreat', fixedRng(6)); // 6+9=15 ≥ 11
    expect(s.finished).toBe(true);
    expect(s.victory).toBe(false);
    expect(s.you.hp).toBeGreaterThan(7000);
  });
});
