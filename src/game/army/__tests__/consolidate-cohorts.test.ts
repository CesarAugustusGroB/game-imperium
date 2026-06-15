import { describe, it, expect } from 'vitest';
import type { Cohort } from '../cohort';
import {
  consolidateCohorts, canConsolidate, totalCurrentHp, computeArmySize,
} from '../cohort';

const MAX = 1000;
let seq = 0;
function cohort(id: string, currentHp?: number, outOfAction = false): Cohort {
  return {
    id, instanceId: `${id}#${seq++}`, name: id,
    role: 'vanguard', aurumCost: 100,
    stats: { hp: MAX, charge: 5, harass: 5, push: 5, siege: 0, movement: 5 },
    description: '',
    ...(currentHp != null ? { currentHp } : {}),
    ...(outOfAction ? { outOfAction: true } : {}),
  };
}

describe('consolidateCohorts (FT-MERGE)', () => {
  it('two half cohorts merge into one full cohort', () => {
    const roster = [cohort('hastati', 500), cohort('hastati', 500)];
    const out = consolidateCohorts(roster, 'hastati');
    expect(out).toHaveLength(1);
    expect(out[0].currentHp ?? MAX).toBe(MAX);
  });

  it('conserves total current HP (lossless) — the real invariant', () => {
    const roster = [cohort('hastati', 800), cohort('hastati', 800), cohort('velites', 300)];
    const before = totalCurrentHp(roster);
    const out = consolidateCohorts(roster, 'hastati');
    expect(totalCurrentHp(out)).toBe(before);
  });

  it('repacks into full + one remainder, capping each at maxHp', () => {
    // 800 + 800 = 1600 → one full (1000) + one 600 remainder
    const out = consolidateCohorts([cohort('hastati', 800), cohort('hastati', 800)], 'hastati');
    expect(out).toHaveLength(2);
    const hps = out.map((c) => c.currentHp ?? MAX).sort((a, b) => b - a);
    expect(hps).toEqual([MAX, 600]);
    expect(Math.max(...hps)).toBeLessThanOrEqual(MAX);
  });

  it('frees a slot: three half cohorts → two (computeArmySize max-capacity drops)', () => {
    const roster = [cohort('hastati', 500), cohort('hastati', 500), cohort('hastati', 500)];
    const sizeBefore = computeArmySize(roster); // 3 × 1000
    const out = consolidateCohorts(roster, 'hastati');
    expect(out).toHaveLength(2); // 1500 → one full + one 500
    expect(totalCurrentHp(out)).toBe(1500); // current HP conserved
    expect(computeArmySize(out)).toBeLessThan(sizeBefore); // capacity intentionally shrinks
  });

  it('revives out-of-action fragments into a deployable cohort', () => {
    const out = consolidateCohorts([cohort('hastati', 600, true), cohort('hastati', 400, true)], 'hastati');
    expect(out).toHaveLength(1);
    expect(out[0].outOfAction).toBeUndefined(); // full & deployable
    expect(out[0].currentHp ?? MAX).toBe(MAX);
  });

  it('leaves other cohort types untouched and preserves order', () => {
    const roster = [cohort('velites', 700), cohort('hastati', 500), cohort('hastati', 500)];
    const out = consolidateCohorts(roster, 'hastati');
    expect(out.map((c) => c.id)).toEqual(['velites', 'hastati']);
    expect(out[0].currentHp).toBe(700);
  });

  it('is a no-op for a single instance or already-full group', () => {
    expect(consolidateCohorts([cohort('hastati', 500)], 'hastati')).toHaveLength(1);
    const full = [cohort('hastati'), cohort('hastati')];
    expect(consolidateCohorts(full, 'hastati')).toHaveLength(2);
  });

  it('canConsolidate gates on ≥2 instances that actually free a slot', () => {
    expect(canConsolidate([cohort('hastati', 500), cohort('hastati', 500)], 'hastati')).toBe(true);
    expect(canConsolidate([cohort('hastati', 500)], 'hastati')).toBe(false); // single
    expect(canConsolidate([cohort('hastati'), cohort('hastati')], 'hastati')).toBe(false); // both full → no slot freed
  });
});
