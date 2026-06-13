import { describe, it, expect, beforeEach } from 'vitest';
import {
  tallyCardPlayed, tallyOrderUsed, resetCampaignTelemetry, snapshotCampaignTelemetry,
  restoreCampaignTelemetry,
} from '../run-telemetry';
import { metaSave, recordCampaignLog, exportCampaignLogsJson, type CampaignLogEntry } from '../../core/meta-save';

beforeEach(() => {
  resetCampaignTelemetry();
  metaSave.value = { ...metaSave.value, campaignLogs: [] };
});

describe('run-telemetry tallies (plan S-J)', () => {
  it('starts empty after reset', () => {
    const snap = snapshotCampaignTelemetry();
    expect(snap.cardsPlayed).toBe(0);
    expect(snap.ordersUsed).toEqual({});
  });

  it('counts cards and orders by key', () => {
    tallyCardPlayed(); tallyCardPlayed();
    tallyOrderUsed('siege'); tallyOrderUsed('siege'); tallyOrderUsed('charge');
    const snap = snapshotCampaignTelemetry();
    expect(snap.cardsPlayed).toBe(2);
    expect(snap.ordersUsed).toEqual({ siege: 2, charge: 1 });
  });

  it('reset clears tallies and snapshot is a copy (not live)', () => {
    tallyOrderUsed('push');
    const snap = snapshotCampaignTelemetry();
    resetCampaignTelemetry();
    expect(snap.ordersUsed).toEqual({ push: 1 });        // snapshot unaffected by later reset
    expect(snapshotCampaignTelemetry().ordersUsed).toEqual({});
  });

  it('restore rehydrates tallies from a snapshot, and ignores undefined (D30 reload)', () => {
    tallyCardPlayed(); tallyOrderUsed('siege');
    const saved = snapshotCampaignTelemetry();
    resetCampaignTelemetry();                              // simulate page reload (module state lost)
    restoreCampaignTelemetry(saved);                      // restore from the campaign save
    expect(snapshotCampaignTelemetry()).toEqual(saved);
    restoreCampaignTelemetry(undefined);                  // pre-D30 save with no telemetry → cleared
    expect(snapshotCampaignTelemetry()).toEqual({ cardsPlayed: 0, ordersUsed: {} });
  });
});

const mkEntry = (over: Partial<CampaignLogEntry> = {}): CampaignLogEntry => ({
  date: '2026-06-13T00:00:00.000Z', commanderId: 'augustus', commanderName: 'Augustus',
  scenarioId: 'saguntum', outcome: 'defeat', cause: 'rout', seasonsAtEnd: 2, daysUsed: 10,
  finalGold: 5, finalIuniores: 0, survivors: 0, cardsPlayed: 4, ordersUsed: { push: 3 }, ...over,
});

describe('campaign log recording (plan S-J)', () => {
  it('records most-recent-first and exports valid JSON', () => {
    recordCampaignLog(mkEntry({ cause: 'first' }));
    recordCampaignLog(mkEntry({ cause: 'second' }));
    expect(metaSave.value.campaignLogs.map((e) => e.cause)).toEqual(['second', 'first']);
    const parsed = JSON.parse(exportCampaignLogsJson());
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].cause).toBe('second');
  });

  it('caps the log at 100 entries', () => {
    for (let i = 0; i < 120; i++) recordCampaignLog(mkEntry({ daysUsed: i }));
    expect(metaSave.value.campaignLogs.length).toBe(100);
    expect(metaSave.value.campaignLogs[0].daysUsed).toBe(119); // newest kept
  });
});
