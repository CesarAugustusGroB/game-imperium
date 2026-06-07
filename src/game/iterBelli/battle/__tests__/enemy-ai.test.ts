import { describe, it, expect } from 'vitest';
import { enemyChoose } from '../enemy-ai';
import { CENTERS, FORMATIONS } from '../orders';
import type { BattleArmy, BattleState } from '../types';
const mkArmy = (side:'you'|'enemy', over:Partial<BattleArmy>={}):BattleArmy => ({
  name:side, side, hp:10000, maxHp:10000, morale:10, discipline:6,
  stats:{charge:10,harass:8,push:16,siege:5,movement:9}, armorPct:0, armorName:'-',
  fortPct:0, fortName:null, ammo:32, maxAmmo:32,
  formation:FORMATIONS.battleLine,
  encircled:false, encircleTurns:0, drums:0, guardMult:1, defendedLast:false, retreated:false, strengthPct:100, ...over,
});
const mkState = (you:BattleArmy, enemy:BattleArmy, control=0):BattleState => ({
  you, enemy, round:0, control, center:CENTERS.plain, finished:false, victory:null, endMsg:'',
  lastDice:{you:null,enemy:null},
});

describe('enemyChoose', () => {
  it('only returns an order in its formation that passes the gates', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    const k = enemyChoose(s);
    expect(enemy.formation.orders).toContain(k);
  });
  it('rallies when wavering', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy',{morale:2}); const s=mkState(you,enemy);
    expect(enemyChoose(s)).toBe('rally');
  });
  it('sieges an armored player when able', () => {
    const you=mkArmy('you',{armorPct:30}), enemy=mkArmy('enemy',{formation:FORMATIONS.testudo}); const s=mkState(you,enemy);
    expect(enemyChoose(s)).toBe('siege');
  });
});
