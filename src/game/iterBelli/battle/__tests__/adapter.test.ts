import { describe, it, expect } from 'vitest';
import { sumRosterStats, strengthFrac, scaleDiscipline } from '../adapter';

const cohort = (o: Partial<{charge:number;harass:number;push:number;siege:number;movement:number}>) =>
  ({ id:'c', name:'c', role:'vanguard', aurumCost:0, description:'',
     stats: { hp:1000, charge:0, harass:0, push:0, siege:0, movement:0, ...o } } as any);

describe('adapter stat summation', () => {
  it('sums each power stat across the roster', () => {
    const r = sumRosterStats([cohort({push:3,charge:1}), cohort({push:2,movement:2})]);
    expect(r).toEqual({ charge:1, harass:0, push:5, siege:0, movement:2 });
  });
  it('strengthFrac clamps soldiers/initial to 0..1', () => {
    expect(strengthFrac(6000, 10000)).toBeCloseTo(0.6);
    expect(strengthFrac(12000, 10000)).toBe(1);
    expect(strengthFrac(0, 0)).toBe(0);
  });
  it('scaleDiscipline maps campaign 1..5 onto engine 0..10 (×2), clamped', () => {
    expect(scaleDiscipline(2)).toBe(4);
    expect(scaleDiscipline(5)).toBe(10);
    expect(scaleDiscipline(7)).toBe(10);
    expect(scaleDiscipline(0)).toBe(0);
  });
});
