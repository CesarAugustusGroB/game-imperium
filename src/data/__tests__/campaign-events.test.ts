import { describe, it, expect } from 'vitest';
import { CAMPAIGN_EVENTS } from '../campaign-events';
import { SOURCE_REF } from '../../game/events/campaign-events-types';

describe('CAMPAIGN_EVENTS catalog', () => {
  it('has 6–8 events with unique ids', () => {
    expect(CAMPAIGN_EVENTS.length).toBeGreaterThanOrEqual(6);
    expect(CAMPAIGN_EVENTS.length).toBeLessThanOrEqual(8);
    const ids = CAMPAIGN_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every event 2–3 choices', () => {
    for (const e of CAMPAIGN_EVENTS) {
      expect(e.choices.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.choices.length, e.id).toBeLessThanOrEqual(3);
    }
  });

  it('keeps soldiers and iuniores deltas in the hundreds (|x| ∈ [100, 2000])', () => {
    for (const e of CAMPAIGN_EVENTS) {
      for (const c of e.choices) {
        const s = c.immediate?.soldiers;
        if (s != null && s !== 0) {
          expect(Math.abs(s), `${e.id}: soldiers`).toBeGreaterThanOrEqual(100);
          expect(Math.abs(s), `${e.id}: soldiers`).toBeLessThanOrEqual(2000);
        }
        for (const h of c.consequence ?? []) {
          if (h.type === 'resource' && h.resource === 'iuniores') {
            expect(Math.abs(h.delta), `${e.id}: iuniores`).toBeGreaterThanOrEqual(100);
            expect(Math.abs(h.delta), `${e.id}: iuniores`).toBeLessThanOrEqual(2000);
          }
        }
      }
    }
  });

  it('keeps advisor-xp deltas on the xp scale (|x| ≤ 5)', () => {
    for (const e of CAMPAIGN_EVENTS) {
      for (const c of e.choices) {
        for (const h of c.consequence ?? []) {
          if (h.type === 'advisor-xp') {
            expect(Math.abs(h.delta), e.id).toBeLessThanOrEqual(5);
          }
        }
      }
    }
  });

  it('targets the triggering conflict via SOURCE_REF for source-bound consequences', () => {
    for (const e of CAMPAIGN_EVENTS) {
      for (const c of e.choices) {
        for (const h of c.consequence ?? []) {
          if (h.type === 'province-unrest') expect(h.provinceId, e.id).toBe(SOURCE_REF);
          if (h.type === 'advisor-xp') expect(h.advisorId, e.id).toBe(SOURCE_REF);
        }
      }
    }
  });

  it('only attaches premium choices to events that also offer base choices', () => {
    for (const e of CAMPAIGN_EVENTS) {
      const base = e.choices.filter((c) => !c.premium);
      expect(base.length, e.id).toBeGreaterThanOrEqual(2);
    }
  });
});
