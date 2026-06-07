import { describe, it, expect, vi, beforeEach } from 'vitest';
import { battleSession, beginBattleSession, chooseFormation, issueOrder, concludeBattleSession } from '../controller';
import { FORMATIONS, ENEMY_ARCHETYPES, CENTERS } from '../orders';

const playerSeed = () => ({
  hp:10000, morale:10, discipline:6,
  stats:{charge:10,harass:8,push:16,siege:5,movement:9},
  armorPct:20, armorName:'Iron', ammo:32, formation: FORMATIONS.battleLine,
});

describe('battle controller', () => {
  beforeEach(() => { battleSession.value = null; });
  it('begins in deployment with the given formation options', () => {
    beginBattleSession({
      playerSeedFor: (f) => ({ ...playerSeed(), formation: FORMATIONS[f] }),
      formationOptions: ['battleLine','shieldWall'],
      enemy: ENEMY_ARCHETYPES.gauls, center: CENTERS.plain,
      onConclude: () => {},
    });
    expect(battleSession.value?.phase).toBe('deployment');
    expect(battleSession.value?.formationOptions).toEqual(['battleLine','shieldWall']);
  });
  it('chooseFormation starts the fight; issueOrder advances a round', () => {
    beginBattleSession({
      playerSeedFor: (f) => ({ ...playerSeed(), formation: FORMATIONS[f] }),
      formationOptions: ['battleLine'], enemy: ENEMY_ARCHETYPES.gauls, center: CENTERS.plain,
      onConclude: () => {},
    });
    chooseFormation('battleLine');
    expect(battleSession.value?.phase).toBe('fighting');
    const before = battleSession.value!.state.round;
    issueOrder('charge');
    expect(battleSession.value!.state.round).toBe(before + 1);
  });
  it('concludeBattleSession calls onConclude with victory/survivors/morale and clears the signal', () => {
    const onConclude = vi.fn();
    beginBattleSession({
      playerSeedFor: (f) => ({ ...playerSeed(), formation: FORMATIONS[f], hp: 50, discipline: 10, stats:{charge:40,harass:8,push:20,siege:5,movement:9} }),
      formationOptions: ['battleLine'], enemy: ENEMY_ARCHETYPES.gauls, center: CENTERS.plain, onConclude,
    });
    chooseFormation('battleLine');
    let guard = 0;
    while (battleSession.value!.phase === 'fighting' && guard++ < 40) issueOrder('charge');
    concludeBattleSession();
    expect(onConclude).toHaveBeenCalledOnce();
    const arg = onConclude.mock.calls[0][0];
    expect(typeof arg.victory).toBe('boolean');
    expect(typeof arg.survivors).toBe('number');
    expect(typeof arg.finalMorale).toBe('number');
    expect(battleSession.value).toBeNull();
  });
});
