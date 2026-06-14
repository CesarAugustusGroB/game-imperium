import { describe, it, expect } from 'vitest';
import { LEVY_IUNIORES_COST, LEVY_IUNIORES_SOLDIERS, SIGNATURE } from '../iter-belli-balance';
import { STARTER_ADVISORS } from '../../../data/advisor-data';

/**
 * BAL guard (D10 companion): every CAMPAIGN soldier/iuniores grant or cost must be
 * denominated in HUNDREDS — |x| ∈ [100, 2000]. This is the user's hard balance rule
 * for campaign flows. It deliberately does NOT cover doctrine/decretum *upgrade
 * costs* (iuniores 2–12), which are a separate small-scale hub sub-economy, nor
 * campaign gold/morale/supplies (different scales). Campaign-event deltas have their
 * own guard in src/data/__tests__/campaign-events.test.ts.
 *
 * Card-effect soldier literals live inside effect closures (e.g. `() => ({ soldiers: 800 })`)
 * and aren't statically reachable here; as of this audit they are all in hundreds
 * (-400, -300, -200, 800). This test guards the constant- and data-driven sources.
 */
const inHundreds = (x: number) => Math.abs(x) >= 100 && Math.abs(x) <= 2000;

describe('campaign soldier/iuniores flows stay in the hundreds', () => {
  it('the iuniores levy (cost and soldiers gained) is in hundreds', () => {
    expect(inHundreds(LEVY_IUNIORES_COST)).toBe(true);
    expect(inHundreds(LEVY_IUNIORES_SOLDIERS)).toBe(true);
  });

  it('the mercenaries signature card recruits in hundreds', () => {
    expect(inHundreds(SIGNATURE.mercenariosSoldiers)).toBe(true);
  });

  it('every advisor soldiers-bonus passive grants soldiers in hundreds', () => {
    const bonuses = STARTER_ADVISORS.flatMap((a) =>
      a.tiers.map((t) => t.passive).filter((p) => p.type === 'soldiers-bonus'),
    );
    expect(bonuses.length).toBeGreaterThan(0); // the source exists
    for (const p of bonuses) {
      expect(inHundreds((p as { amount: number }).amount), JSON.stringify(p)).toBe(true);
    }
  });
});
