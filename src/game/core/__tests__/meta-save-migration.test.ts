import { describe, it, expect } from 'vitest';
import { parseMetaSave } from '../meta-save';
// Real fixtures from tools/fixtures/ (plan S-K), loaded as raw strings via Vite's
// ?raw — exactly what parseMetaSave consumes, so no drift between file and test.
import v1Raw from '../../../../tools/fixtures/meta-save-v1.json?raw';
import v2Raw from '../../../../tools/fixtures/meta-save-v2.json?raw';
import v3Raw from '../../../../tools/fixtures/meta-save-v3-full.json?raw';

describe('meta-save migration from older formats (plan S-K)', () => {
  it('v1 (no campaignLogs / forgedAllies / tutorialDismissed) upgrades with defaults', () => {
    const m = parseMetaSave(v1Raw);
    expect(m.version).toBe(3);
    expect(m.totalRunsStarted).toBe(3);
    expect(m.victories).toBe(1);
    expect(m.campaignLogs).toEqual([]);      // new field defaulted
    expect(m.tutorialDismissed).toBe(false); // new field defaulted
    expect(m.activeRun).toBeNull();
  });

  it('v2 with an old activeRun fills the new run fields with safe defaults', () => {
    const m = parseMetaSave(v2Raw);
    expect(m.version).toBe(3);
    expect(m.campaignLogs).toEqual([]);      // defaulted
    const run = m.activeRun!;
    expect(run).not.toBeNull();
    expect(run.commanderId).toBe('augustus');
    expect(run.resources.gold).toBe(12);
    expect(run.forgedAllies).toEqual([]);                  // plan S-L field defaulted
    expect(typeof run.resources.iuniores).toBe('number');  // seeded when absent
    expect(run.equippedDoctrines).toEqual([null, null, null, null]);
    expect(run.npcFactions).toEqual([]);
    expect(run.iterBelli ?? null).toBeNull();
  });

  it('v3 round-trips all new fields without loss', () => {
    const m = parseMetaSave(v3Raw);
    expect(m.version).toBe(3);
    expect(m.tutorialDismissed).toBe(true);
    expect(m.campaignLogs).toHaveLength(1);
    expect(m.campaignLogs[0].outcome).toBe('defeat');
    expect(m.campaignLogs[0].ordersUsed).toEqual({ siege: 2, charge: 1 });
    expect(m.campaignLogs[0].cardsPlayed).toBe(4);
  });

  it('garbage / empty input falls back to a clean default save (never throws)', () => {
    for (const bad of ['not json at all', '{', '', 'null', '[]', '42']) {
      const m = parseMetaSave(bad);
      expect(m.version).toBe(3);
      expect(m.campaignLogs).toEqual([]);
      expect(m.activeRun).toBeNull();
    }
    const m = parseMetaSave(null);
    expect(m.version).toBe(3);
    expect(m.activeRun).toBeNull();
  });
});
