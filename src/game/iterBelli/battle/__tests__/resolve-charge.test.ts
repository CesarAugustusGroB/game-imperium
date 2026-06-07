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

describe('charge', () => {
  it('deals impact and inflicts recoil on the attacker', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    resolveOrder(s, you, enemy, ORDERS.charge, 5, ORDERS.advance);
    expect(enemy.hp).toBeLessThan(10000);
    expect(you.hp).toBeLessThan(10000);
  });
  it('a braced defender amplifies recoil and cuts impact', () => {
    const a=mkArmy('you'), bracedDef=mkArmy('enemy'); const s1=mkState(a,bracedDef);
    resolveOrder(s1, a, bracedDef, ORDERS.charge, 5, ORDERS.holdLine);
    const openA=mkArmy('you'), openDef=mkArmy('enemy'); const s2=mkState(openA,openDef);
    resolveOrder(s2, openA, openDef, ORDERS.charge, 5, ORDERS.advance);
    expect(10000-bracedDef.hp).toBeLessThan(10000-openDef.hp);
    expect(10000-a.hp).toBeGreaterThan(10000-openA.hp);
  });
  it('the wedge ignores the brace and can seize the center', () => {
    const a=mkArmy('you'), def=mkArmy('enemy'); const s=mkState(a,def,0);
    resolveOrder(s, a, def, ORDERS.wedge, 6, ORDERS.holdLine);
    expect(s.control).toBeGreaterThan(0);
  });
});
