import { describe, it, expect } from 'vitest';
import { resolveCenter, applyMorale, checkEnd } from '../resolver';
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

describe('round systems', () => {
  it('only push orders move the center, toward the stronger pusher', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    resolveCenter(s, ORDERS.advance, ORDERS.charge, 4, 4); // you push, enemy charges
    expect(s.control).toBeGreaterThan(0);
  });
  it('discipline resists morale loss; broken morale ends the battle', () => {
    const you=mkArmy('you',{discipline:0,morale:1}), enemy=mkArmy('enemy');
    const s=mkState(you,enemy);
    applyMorale(s, you, 10000, ORDERS.charge, 5); // big casualties + incoming
    expect(you.morale).toBeLessThan(1);
  });
  it('checkEnd: enemy morale 0 → victory', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy',{morale:0}); const s=mkState(you,enemy);
    checkEnd(s);
    expect(s.finished).toBe(true);
    expect(s.victory).toBe(true);
  });
  it('checkEnd is a no-op once finished (retreat already ended it)', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    s.finished=true; s.victory=false;
    checkEnd(s);
    expect(s.victory).toBe(false);
  });
});
