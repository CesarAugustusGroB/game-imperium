import { describe, it, expect } from 'vitest';
import * as B from '../iter-belli-balance';

describe('discipline constants are on the 0–10 engine scale', () => {
  it('clamps span 0..10', () => {
    expect(B.DISCIPLINE_MIN).toBe(0);
    expect(B.DISCIPLINE_MAX).toBe(10);
  });
  it('base start is the low "legate base 2"', () => {
    expect(B.START.discipline).toBe(2);
  });
  it('archetype values are small additive bonuses (not absolute 1–5)', () => {
    expect(B.DISCIPLINE_BY_ARCHETYPE).toEqual({ Warlord: 0, Religious: 0, Merchant: 1, Diplomat: 2 });
  });
  it('enemy discipline sits mid-high on the new scale', () => {
    expect(B.ENEMY_DISCIPLINE).toBe(6);
  });
  it('ROMAN covers 0..10', () => {
    expect(B.ROMAN).toHaveLength(11);
    expect(B.ROMAN[0]).toBe('—');
    expect(B.ROMAN[6]).toBe('VI');
    expect(B.ROMAN[10]).toBe('X');
  });
});
