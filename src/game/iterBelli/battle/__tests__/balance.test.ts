import { describe, it, expect } from 'vitest';
import { BAL, ARMORS, FORTS } from '../balance';

describe('balance constants', () => {
  it('exposes the tuned battle knobs', () => {
    expect(BAL.DMG_SCALE).toBe(17);
    expect(BAL.MORALE_RESIST).toBeCloseTo(0.05);
    expect(BAL.MAX_ROUNDS).toBe(14);
  });
  it('has the armor + fort ladders', () => {
    expect(ARMORS.iron).toBe(20);
    expect(FORTS.wall).toBe(35);
  });
});
