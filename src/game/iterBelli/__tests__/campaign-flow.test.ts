import { describe, it, expect } from 'vitest';
import { startIterBelliCampaign, playCard, iterBelliState } from '../iter-belli-state';
import { isCrisisDef } from '../iter-belli-types';
import { resetCampaignTelemetry, snapshotCampaignTelemetry } from '../../progression/run-telemetry';

/**
 * Headless integration test of the Iter Belli campaign turn/card loop — the path
 * Playwright couldn't drive in loop-34 (cards are OperationCard divs). Exercises
 * startIterBelliCampaign → playCard → endTurn end-to-end against the real state
 * machine, including the telemetry hook (loop-18) and passive upkeep.
 */

const SEED = {
  soldiers: 4000, gold: 5, iuniores: 1000, discipline: 6,
  archetype: 'Warlord' as const, spokeTerrain: 'plains', spokeDuration: 8,
};

const firstPlayable = () => iterBelliState.value.pool.find((c) => !isCrisisDef(c.def));

describe('Iter Belli campaign flow (headless integration)', () => {
  it('seeds a fresh campaign: populated pool, day-0, campaign phase', () => {
    startIterBelliCampaign({ ...SEED });
    const s = iterBelliState.value;
    expect(s.soldiers).toBe(4000);
    expect(s.discipline).toBe(6);
    expect(s.finished).toBe(false);
    expect(s.phase).toBe('campaign');
    expect(s.turnNum).toBe(0);
    expect(s.pool.length).toBeGreaterThan(0);
    expect(s.pool.some((c) => !isCrisisDef(c.def))).toBe(true);
  });

  it('playing a non-crisis card tallies telemetry, advances the turn, consumes the card', () => {
    startIterBelliCampaign({ ...SEED });
    resetCampaignTelemetry();
    const before = iterBelliState.value;
    const turnBefore = before.turnNum;
    const timeBefore = before.timeRemaining;
    const card = firstPlayable()!;
    expect(card).toBeTruthy();

    playCard(card.instanceId);

    const after = iterBelliState.value;
    expect(snapshotCampaignTelemetry().cardsPlayed).toBe(1);       // telemetry hook fired
    expect(after.turnNum).toBe(turnBefore + 1);                    // endTurn advanced
    expect(after.timeRemaining).toBeLessThan(timeBefore);          // time cost paid
    expect(after.pool.some((c) => c.instanceId === card.instanceId)).toBe(false); // consumed
  });

  it('drives several turns without crashing; state stays in valid ranges', () => {
    startIterBelliCampaign({ ...SEED });
    resetCampaignTelemetry();
    let played = 0;
    for (let i = 0; i < 5; i++) {
      if (iterBelliState.value.finished) break;
      const card = firstPlayable();
      if (!card) break;
      playCard(card.instanceId);
      played++;
    }
    const s = iterBelliState.value;
    expect(played).toBeGreaterThan(0);
    expect(snapshotCampaignTelemetry().cardsPlayed).toBe(played);  // tally matches plays
    expect(s.soldiers).toBeGreaterThanOrEqual(0);
    expect(s.morale).toBeGreaterThanOrEqual(0);
    expect(s.morale).toBeLessThanOrEqual(15);
    expect(Number.isFinite(s.supplies)).toBe(true);
    expect(s.turnNum).toBe(played);
  });
});
