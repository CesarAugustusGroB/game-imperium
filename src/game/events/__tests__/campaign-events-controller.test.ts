import { describe, it, expect, beforeEach } from 'vitest';
import {
  selectCampaignEvent, resolveConsequences, maybeFireCampaignEvent,
  resolveCampaignEventChoice, pendingCampaignEvent, EVENT_FIRE_WINDOW,
} from '../campaign-events-controller';
import {
  campaignConflicts, consequenceFlags, seenEventsThisSpoke,
  campaignEventFiredThisSpoke, pendingHubConsequences, resetEventStore,
} from '../event-store';
import { SOURCE_REF } from '../campaign-events-types';
import type { CampaignConflict, CampaignEvent } from '../campaign-events-types';

const conflict = (source: 'province' | 'advisor', sourceId: string, severity: number): CampaignConflict =>
  ({ id: `${source}:${sourceId}`, source, sourceId, sourceName: sourceId, severity });

const CATALOG: CampaignEvent[] = [
  { id: 'p1', sourceType: 'province', title: '', body: '', choices: [{ label: 'a' }] },
  { id: 'p_locked', sourceType: 'province', title: '', body: '', requiresFlag: 'unlocked', choices: [{ label: 'a' }] },
  { id: 'a_blocked', sourceType: 'advisor', title: '', body: '', blockedByFlag: 'feud', choices: [{ label: 'a' }] },
];

describe('selectCampaignEvent', () => {
  it('returns null with no conflicts', () => {
    expect(selectCampaignEvent([], new Set(), new Set(), CATALOG)).toBeNull();
  });

  it('matches an event to a conflict of the same source type', () => {
    const out = selectCampaignEvent([conflict('province', 'hisp', 90)], new Set(), new Set(), CATALOG);
    expect(out?.event.id).toBe('p1');
    expect(out?.conflict.sourceId).toBe('hisp');
  });

  it('skips seen, requires-flag-unmet, and blocked events', () => {
    // p1 seen → no province event left for a province conflict
    expect(selectCampaignEvent([conflict('province', 'h', 50)], new Set(), new Set(['p1']), CATALOG)).toBeNull();
    // advisor conflict, a_blocked is blocked by an active flag
    expect(selectCampaignEvent([conflict('advisor', 'cato', 70)], new Set(['feud']), new Set(), CATALOG)).toBeNull();
    // requires-flag event becomes eligible once the flag is set
    const out = selectCampaignEvent([conflict('province', 'h', 50)], new Set(['unlocked']), new Set(['p1']), CATALOG);
    expect(out?.event.id).toBe('p_locked');
  });

  it('walks conflicts in the given (severity) order', () => {
    const out = selectCampaignEvent(
      [conflict('advisor', 'cato', 95), conflict('province', 'h', 40)], new Set(), new Set(), CATALOG);
    expect(out?.event.sourceType).toBe('advisor'); // first conflict wins when it has an eligible event
  });
});

describe('resolveConsequences', () => {
  it('rewrites SOURCE_REF to the conflict sourceId, leaves resources untouched', () => {
    const out = resolveConsequences([
      { type: 'province-unrest', provinceId: SOURCE_REF, delta: -20 },
      { type: 'advisor-xp', advisorId: SOURCE_REF, delta: 2 },
      { type: 'resource', resource: 'iuniores', delta: 500 },
    ], conflict('province', 'gallia', 60));
    expect(out[0]).toMatchObject({ type: 'province-unrest', provinceId: 'gallia' });
    expect(out[1]).toMatchObject({ type: 'advisor-xp', advisorId: 'gallia' });
    expect(out[2]).toMatchObject({ type: 'resource', resource: 'iuniores', delta: 500 });
  });
});

describe('maybeFireCampaignEvent', () => {
  beforeEach(() => {
    resetEventStore();
    pendingCampaignEvent.value = null;
    campaignConflicts.value = [conflict('province', 'hisp', 80)];
  });

  it('fires inside the window on a successful roll', () => {
    const mid = (EVENT_FIRE_WINDOW.min + EVENT_FIRE_WINDOW.max) / 2;
    const fired = maybeFireCampaignEvent({ rng: () => 0, progress: mid });
    expect(fired).not.toBeNull();
    expect(pendingCampaignEvent.value).not.toBeNull();
  });

  it('does not fire outside the window, on a failed roll, or once already fired', () => {
    expect(maybeFireCampaignEvent({ rng: () => 0, progress: 0.1 })).toBeNull();
    expect(maybeFireCampaignEvent({ rng: () => 0.99, progress: 0.5 })).toBeNull();
    campaignEventFiredThisSpoke.value = true;
    expect(maybeFireCampaignEvent({ rng: () => 0, progress: 0.5 })).toBeNull();
  });
});

describe('resolveCampaignEventChoice', () => {
  beforeEach(() => { resetEventStore(); pendingCampaignEvent.value = null; });

  it('enqueues the resolved consequence, sets the flag, and trips the cap', () => {
    const fired = { conflict: conflict('province', 'hisp', 80), event: CATALOG[0] };
    resolveCampaignEventChoice(fired, {
      label: 'x',
      consequence: [{ type: 'province-unrest', provinceId: SOURCE_REF, delta: -25 }],
      setsFlag: 'chose_mercy',
    });
    expect(pendingHubConsequences.value).toEqual([{ type: 'province-unrest', provinceId: 'hisp', delta: -25 }]);
    expect(consequenceFlags.value.has('chose_mercy')).toBe(true);
    expect(seenEventsThisSpoke.value.has('p1')).toBe(true);
    expect(campaignEventFiredThisSpoke.value).toBe(true);
    expect(pendingCampaignEvent.value).toBeNull();
  });
});
