import { describe, it, expect } from 'vitest';
import { centerTier, mitigate } from '../resolver';
import type { BattleArmy } from '../types';

const army = (over: Partial<BattleArmy> = {}): BattleArmy => ({
  name:'x', side:'enemy', hp:10000, maxHp:10000, morale:10, discipline:6,
  stats:{charge:10,harass:8,push:16,siege:5,movement:9}, armorPct:20, armorName:'Iron',
  fortPct:0, fortName:null, ammo:32, maxAmmo:32,
  formation:{name:'',kind:'common',disc:2,trait:null,orders:[],desc:''},
  encircled:false, encircleTurns:0, drums:0, guardMult:1, defendedLast:false, retreated:false, strengthPct:100, ...over,
});

describe('centerTier', () => {
  it('grows by control band, capped at +3', () => {
    expect(centerTier(0,'you')).toBe(0);
    expect(centerTier(30,'you')).toBe(1);
    expect(centerTier(60,'you')).toBe(2);
    expect(centerTier(80,'you')).toBe(3);
    expect(centerTier(-80,'you')).toBe(0);
    expect(centerTier(-80,'enemy')).toBe(3);
  });
});
describe('mitigate', () => {
  it('applies armor + fort, but siege pierces both', () => {
    const d = army({ armorPct:20, fortPct:35 });
    expect(mitigate(1000, d, { pierce:true } as any)).toBe(1000);
    expect(mitigate(1000, d, {} as any)).toBeCloseTo(1000*0.8*0.65, 5);
  });
  it('applies the round guard multiplier (hit & run / relief)', () => {
    const d = army({ armorPct:0, guardMult:0.25 });
    expect(mitigate(1000, d, {} as any)).toBeCloseTo(250, 5);
  });
});
