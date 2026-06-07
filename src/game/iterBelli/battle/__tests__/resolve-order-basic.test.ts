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

describe('resolveOrder basic subsystems', () => {
  it('push deals damage and reports no morale by default', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    const r = resolveOrder(s, you, enemy, ORDERS.advance, 4, ORDERS.holdLine);
    expect(enemy.hp).toBeLessThan(10000);
    expect(r.eMoraleHit).toBe(0);
  });
  it('skirmish spends ammo and is blunted by armor', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy',{armorPct:30}); const s=mkState(you,enemy);
    const before = enemy.hp;
    resolveOrder(s, you, enemy, ORDERS.skirmish, 4, ORDERS.advance);
    expect(you.ammo).toBe(32 - 9);
    const unarmoredEnemy=mkArmy('enemy'); const s2=mkState(mkArmy('you'), unarmoredEnemy);
    resolveOrder(s2, mkArmy('you'), unarmoredEnemy, ORDERS.skirmish, 4, ORDERS.advance);
    expect(before - enemy.hp).toBeLessThan( (before - unarmoredEnemy.hp) );
  });
  it('testudo absorbs missiles', () => {
    const you=mkArmy('you'); const enemy=mkArmy('enemy');
    enemy.formation = { ...enemy.formation, antiMissile:true };
    const s=mkState(you,enemy); const before=enemy.hp;
    resolveOrder(s, you, enemy, ORDERS.skirmish, 6, ORDERS.advance);
    expect(before - enemy.hp).toBeLessThan(200);
  });
  it('siege ignores armor and fortification', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy',{armorPct:30, fortPct:35}); const s=mkState(you,enemy);
    const before = enemy.hp;
    resolveOrder(s, you, enemy, ORDERS.siege, 4, ORDERS.advance);
    expect(before - enemy.hp).toBeCloseTo(5*4*1.45*1.3*1*17, 0);
  });
});
