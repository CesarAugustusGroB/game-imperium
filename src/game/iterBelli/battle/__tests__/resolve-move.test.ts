import { describe, it, expect } from 'vitest';
import { resolveOrder } from '../resolver';
import { ORDERS, CENTERS } from '../orders';
import type { BattleArmy, BattleState } from '../types';
const mkArmy = (side:'you'|'enemy', over:Partial<BattleArmy>={}):BattleArmy => ({
  name:side, side, hp:10000, maxHp:10000, morale:10, discipline:6,
  stats:{charge:10,harass:8,push:16,siege:5,movement:9}, armorPct:0, armorName:'-',
  fortPct:0, fortName:null, ammo:32, maxAmmo:32,
  formation:{name:'',kind:'common',disc:2,trait:null,orders:[],desc:''},
  encircled:false, encircleTurns:0, drums:0, guardMult:1, defendedLast:false, retreated:false, strengthPct:100, ...over,
});
const mkState = (you:BattleArmy, enemy:BattleArmy, control=0):BattleState => ({
  you, enemy, round:0, control, center:CENTERS.plain, finished:false, victory:null, endMsg:'',
  lastDice:{you:null,enemy:null},
});

describe('movement orders', () => {
  it('envelop succeeds above threshold and encircles for ~2 rounds', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    resolveOrder(s, you, enemy, ORDERS.envelop, 6, ORDERS.advance); // 6+mov9=15 ≥ 12
    expect(enemy.encircled).toBe(true);
    expect(enemy.encircleTurns).toBe(2);
  });
  it('envelop fails below threshold', () => {
    const you=mkArmy('you',{stats:{charge:0,harass:0,push:0,siege:0,movement:2}}), enemy=mkArmy('enemy');
    const s=mkState(you,enemy);
    resolveOrder(s, you, enemy, ORDERS.envelop, 1, ORDERS.advance); // 1+2=3 < 12
    expect(enemy.encircled).toBe(false);
  });
  it('flank crits when the defender holds the center', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy');
    const s=mkState(you,enemy,-60); // enemy holds center
    const before=enemy.hp;
    resolveOrder(s, you, enemy, ORDERS.flank, 5, ORDERS.advance);
    const youB=mkArmy('you'), enB=mkArmy('enemy'); const s2=mkState(youB,enB,0); // no center
    resolveOrder(s2, youB, enB, ORDERS.flank, 5, ORDERS.advance);
    expect(before-enemy.hp).toBeGreaterThan(10000-enB.hp);
  });
  it('hit & run sets a guard reduction on the attacker', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    resolveOrder(s, you, enemy, ORDERS.hitRun, 6, ORDERS.advance);
    expect(you.guardMult).toBeCloseTo(0.25);
  });
  it('retreat success flags the army; encircled raises the bar', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    resolveOrder(s, you, enemy, ORDERS.retreat, 6, ORDERS.advance); // 6+9=15 ≥ 11
    expect(you.retreated).toBe(true);
    const ring=mkArmy('you',{encircled:true}), e2=mkArmy('enemy'); const s2=mkState(ring,e2);
    resolveOrder(s2, ring, e2, ORDERS.retreat, 1, ORDERS.advance); // 1+9=10 < 17
    expect(ring.retreated).toBe(false);
  });
});
