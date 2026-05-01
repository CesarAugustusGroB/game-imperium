// S31-04 / S33-05: pure migration tests for the campaign slice of the meta-save.
// Run with: npx tsx tools/verify-campaign-save.ts
//
// S33-05: `supplies` and `morale` are no longer fields on `CampaignState`.
// `migrateCampaignSnapshot` now silently ignores those fields from old saves
// and no longer requires them. Tests updated accordingly.
//
// S33-11: extended with tile sanitization and activeEventTileId cross-validation tests.
//
// Note: imports `migrateCampaignSnapshot` directly. The function is pure and
// has no signal/store side effects, so it runs in plain node without browser
// shims.

import { migrateCampaignSnapshot, KNOWN_EVENTS, KNOWN_BATTLE_MODIFIERS } from '../src/game/core/meta-save';
import type { HexTile } from '../src/game/campaign/campaign-types';
import { CAMPAIGN_MOVEMENT_POINTS_MAX } from '../src/game/campaign/campaign-balance';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function makeTile(q: number, r: number): HexTile {
  return {
    id: `${q},${r}`,
    q,
    r,
    terrain: 'plains',
    event: 'none',
    discovered: true,
    visited: false,
    reachable: false,
    current: false,
    movementCost: 1,
  };
}

// ── Valid roundtrip (new shape — no supplies/morale) ────────────────
{
  const raw = {
    hexTiles: [makeTile(0, 0), makeTile(1, 0)],
    campaignState: {
      currentTileId: '0,0',
      selectedTileId: '1,0',
      movementPoints: 2,
    },
    activeEventTileId: null,
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'valid new-shape payload migrates');
  assert(out!.hexTiles.length === 2, 'hexTiles preserved');
  assert(out!.campaignState.currentTileId === '0,0', 'currentTileId preserved');
  assert(out!.activeEventTileId === null, 'activeEventTileId null preserved');
}
console.log('PASS: valid new-shape payload roundtrip');

// ── Legacy save roundtrip (old shape — has supplies/morale) ─────────
// Old saves include supplies/morale; migration should silently ignore them.
{
  const raw = {
    hexTiles: [makeTile(0, 0), makeTile(1, 0)],
    campaignState: {
      currentTileId: '0,0',
      selectedTileId: '1,0',
      movementPoints: 2,
      supplies: 30,
      morale: 75,
    },
    activeEventTileId: null,
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'legacy payload with supplies/morale migrates');
  assert(out!.hexTiles.length === 2, 'hexTiles preserved in legacy save');
  assert(out!.campaignState.currentTileId === '0,0', 'currentTileId preserved in legacy save');
  // supplies and morale are silently dropped from CampaignState
  assert(!('supplies' in out!.campaignState), 'supplies not present in migrated CampaignState');
  assert(!('morale' in out!.campaignState), 'morale not present in migrated CampaignState');
}
console.log('PASS: legacy save with supplies/morale migrates (fields silently dropped)');

// ── activeEventTileId as string (matching tile with non-'none' event) ─────────
{
  const eventTile: HexTile = { ...makeTile(2, 3), event: 'battle' };
  const raw = {
    hexTiles: [makeTile(0, 0), eventTile],
    campaignState: {
      currentTileId: '0,0',
      selectedTileId: null,
      movementPoints: 2,
    },
    activeEventTileId: '2,3',
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'payload with active event migrates');
  assert(out!.activeEventTileId === '2,3', 'activeEventTileId string preserved when tile exists with non-none event');
}
console.log('PASS: activeEventTileId as string is preserved');

// ── selectedTileId null fallback ────────────────────────────────────
{
  const raw = {
    hexTiles: [],
    campaignState: {
      currentTileId: '0,0',
      // selectedTileId omitted
      movementPoints: 2,
    },
    activeEventTileId: null,
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'omitted selectedTileId still migrates');
  assert(out!.campaignState.selectedTileId === null, 'selectedTileId defaults to null');
}
console.log('PASS: selectedTileId defaults to null');

// ── Null / undefined / non-object → null ─────────────────────────────
assert(migrateCampaignSnapshot(null) === null, 'null returns null');
assert(migrateCampaignSnapshot(undefined) === null, 'undefined returns null');
assert(migrateCampaignSnapshot('not an object') === null, 'string returns null');
assert(migrateCampaignSnapshot(42) === null, 'number returns null');
console.log('PASS: null / undefined / primitives return null');

// ── Malformed: missing hexTiles ─────────────────────────────────────
{
  const raw = {
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: null,
  };
  assert(migrateCampaignSnapshot(raw) === null, 'missing hexTiles returns null');
}
console.log('PASS: missing hexTiles returns null');

// ── Malformed: hexTiles not an array ────────────────────────────────
{
  const raw = {
    hexTiles: 'oops',
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: null,
  };
  assert(migrateCampaignSnapshot(raw) === null, 'non-array hexTiles returns null');
}
console.log('PASS: non-array hexTiles returns null');

// ── Malformed: missing currentTileId (still required) ─────────────────────────
{
  const raw = {
    hexTiles: [],
    campaignState: { movementPoints: 2 /* currentTileId missing */ },
    activeEventTileId: null,
  };
  assert(migrateCampaignSnapshot(raw) === null, 'missing currentTileId returns null');
}
console.log('PASS: missing currentTileId returns null');

// ── Missing movementPoints defaults to max MP ────────────────────────
{
  const raw = {
    hexTiles: [],
    campaignState: { currentTileId: '0,0' /* movementPoints omitted */ },
    activeEventTileId: null,
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'missing movementPoints still migrates');
  assert(
    out!.campaignState.movementPoints === CAMPAIGN_MOVEMENT_POINTS_MAX,
    'missing movementPoints defaults to max MP',
  );
}
console.log('PASS: missing movementPoints defaults during migration');

// ── Malformed: campaignState wrong type ─────────────────────────────
{
  const raw = {
    hexTiles: [],
    campaignState: 'not an object',
    activeEventTileId: null,
  };
  assert(migrateCampaignSnapshot(raw) === null, 'non-object campaignState returns null');
}
console.log('PASS: non-object campaignState returns null');

// ── Malformed: hexTiles array of garbage (numbers) ──────────────────
{
  const raw = {
    hexTiles: [1, 2, 3],
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: null,
  };
  assert(migrateCampaignSnapshot(raw) === null, 'array of non-HexTile primitives returns null');
}
console.log('PASS: hexTiles array of primitives returns null');

// ── Malformed: hexTiles element missing required fields ─────────────
{
  const raw = {
    hexTiles: [{ id: '0,0' /* missing q, r, terrain, event */ }],
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: null,
  };
  assert(migrateCampaignSnapshot(raw) === null, 'partial hexTile element returns null');
}
console.log('PASS: hexTiles element missing fields returns null');

// ── visitHistory: valid string array roundtrips ─────────────────────
{
  const raw = {
    hexTiles: [makeTile(0, 0), makeTile(1, 0)],
    campaignState: { currentTileId: '1,0', movementPoints: 2 },
    activeEventTileId: null,
    visitHistory: ['0,0', '1,0'],
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'visitHistory roundtrip migrates');
  assert(out!.visitHistory.length === 2, 'visitHistory length preserved');
  assert(out!.visitHistory[0] === '0,0' && out!.visitHistory[1] === '1,0', 'visitHistory order preserved');
}
console.log('PASS: visitHistory string array roundtrips');

// ── visitHistory: missing field defaults to [] ──────────────────────
{
  const raw = {
    hexTiles: [],
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: null,
    // visitHistory omitted (legacy save)
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'legacy save without visitHistory still migrates');
  assert(Array.isArray(out!.visitHistory) && out!.visitHistory.length === 0, 'visitHistory defaults to []');
}
console.log('PASS: missing visitHistory defaults to []');

// ── visitHistory: non-array or wrong-element-type defaults to [] ────
{
  const raw = {
    hexTiles: [],
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: null,
    visitHistory: 'corrupted',
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'malformed visitHistory does not reject the snapshot');
  assert(out!.visitHistory.length === 0, 'malformed visitHistory falls back to []');
}
{
  const raw = {
    hexTiles: [],
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: null,
    visitHistory: ['0,0', 42, '1,0'],
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'mixed-type visitHistory does not reject the snapshot');
  assert(out!.visitHistory.length === 0, 'mixed-type visitHistory falls back to []');
}
console.log('PASS: malformed visitHistory falls back to [] (snapshot preserved)');

// ── S33-11: Unknown terrain rejects snapshot ────────────────────────
{
  const badTile = { ...makeTile(0, 0), terrain: 'lava' };
  const raw = {
    hexTiles: [badTile],
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: null,
  };
  assert(migrateCampaignSnapshot(raw) === null, 'unknown terrain returns null');
}
console.log('PASS: unknown terrain rejects snapshot');

// ── S33-11: Unknown event normalizes to 'none' ─────────────────────
{
  const badTile = { ...makeTile(1, 0), event: 'monster' };
  const raw = {
    hexTiles: [makeTile(0, 0), badTile],
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: null,
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'unknown event snapshot migrates');
  assert(out!.hexTiles[0].event === 'none', 'normal tile event untouched');
  assert(out!.hexTiles[1].event === 'none', 'unknown event normalized to none');
}
console.log('PASS: unknown event normalizes to none, other tiles untouched');

// ── S33-11: All known EventTypes round-trip ─────────────────────────
{
  const tiles = KNOWN_EVENTS.map((ev, i) => ({ ...makeTile(i, 0), event: ev }));
  const raw = {
    hexTiles: tiles,
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: null,
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'all known events round-trip migrates');
  for (let i = 0; i < KNOWN_EVENTS.length; i++) {
    assert(out!.hexTiles[i].event === KNOWN_EVENTS[i], `event ${KNOWN_EVENTS[i]} preserved`);
  }
}
console.log('PASS: all known EventTypes round-trip');

// ── S33-11: battleModifiers junk filter ────────────────────────────
{
  const tile = { ...makeTile(0, 0), battleModifiers: ['forest_cover', 'bogus_id', 'fake'] };
  const raw = {
    hexTiles: [tile],
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: null,
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'junk battleModifiers snapshot migrates');
  const mods = out!.hexTiles[0].battleModifiers;
  assert(Array.isArray(mods) && mods.length === 1 && mods[0] === 'forest_cover', 'junk ids filtered, known id preserved');
}
console.log('PASS: battleModifiers junk filtered, known id preserved');

// ── S33-11: battleModifiers empty after filter → field dropped ──────
{
  const tile = { ...makeTile(0, 0), battleModifiers: ['junk1', 'junk2'] };
  const raw = {
    hexTiles: [tile],
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: null,
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'all-junk battleModifiers snapshot migrates');
  assert(out!.hexTiles[0].battleModifiers === undefined, 'all-junk battleModifiers dropped (undefined)');
}
console.log('PASS: battleModifiers empty after filter → field undefined');

// ── S33-11: scoutedLevel clamp ──────────────────────────────────────
{
  const tileWith = (sl: unknown) => ({ ...makeTile(0, 0), scoutedLevel: sl });
  const invalid = [5, 'two', -1, null, 3];
  for (const v of invalid) {
    const out = migrateCampaignSnapshot({
      hexTiles: [tileWith(v)],
      campaignState: { currentTileId: '0,0', movementPoints: 2 },
      activeEventTileId: null,
    });
    assert(out !== null, `scoutedLevel=${String(v)} snapshot migrates`);
    assert(out!.hexTiles[0].scoutedLevel === undefined, `scoutedLevel=${String(v)} dropped`);
  }
  const valid: Array<0 | 1 | 2> = [0, 1, 2];
  for (const v of valid) {
    const out = migrateCampaignSnapshot({
      hexTiles: [tileWith(v)],
      campaignState: { currentTileId: '0,0', movementPoints: 2 },
      activeEventTileId: null,
    });
    assert(out !== null, `scoutedLevel=${v} snapshot migrates`);
    assert(out!.hexTiles[0].scoutedLevel === v, `scoutedLevel=${v} preserved`);
  }
}
console.log('PASS: scoutedLevel clamp — invalid → undefined, 0/1/2 preserved');

// ── S33-11: activeEventTileId points to non-existent tile → null ────
{
  const raw = {
    hexTiles: [makeTile(0, 0)],
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: 'no-such-tile',
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'non-existent activeEventTileId snapshot migrates');
  assert(out!.activeEventTileId === null, 'non-existent tile id nulled');
}
console.log('PASS: activeEventTileId points to non-existent tile → null');

// ── S33-11: activeEventTileId points to 'none' event tile → null ────
{
  const noneTile = { ...makeTile(0, 0), event: 'none' as const };
  const raw = {
    hexTiles: [noneTile],
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: '0,0',
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'none-event activeEventTileId snapshot migrates');
  assert(out!.activeEventTileId === null, 'none-event tile id nulled');
}
console.log('PASS: activeEventTileId points to none-event tile → null');

// ── S33-11: activeEventTileId valid pointer preserved ───────────────
{
  const eventTile: HexTile = { ...makeTile(1, 1), event: 'supply' };
  const raw = {
    hexTiles: [makeTile(0, 0), eventTile],
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: '1,1',
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'valid activeEventTileId snapshot migrates');
  assert(out!.activeEventTileId === '1,1', 'valid active tile id preserved');
}
console.log('PASS: activeEventTileId valid pointer preserved');

// ── S33-11: empty hexTiles array stays valid ─────────────────────────
{
  const raw = {
    hexTiles: [],
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: null,
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'empty hexTiles array still valid');
  assert(out!.hexTiles.length === 0, 'empty hexTiles array preserved');
}
console.log('PASS: empty hexTiles array stays valid');

// ── S33-11: known battleModifiers round-trip ─────────────────────────
{
  const tile = { ...makeTile(0, 0), battleModifiers: [...KNOWN_BATTLE_MODIFIERS] };
  const raw = {
    hexTiles: [tile],
    campaignState: { currentTileId: '0,0', movementPoints: 2 },
    activeEventTileId: null,
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'all known battleModifiers snapshot migrates');
  const mods = out!.hexTiles[0].battleModifiers;
  assert(Array.isArray(mods) && mods.length === KNOWN_BATTLE_MODIFIERS.length, 'all known battleModifiers preserved');
}
console.log('PASS: all known battleModifiers round-trip');

console.log('\nAll campaign-save migration checks passed');
