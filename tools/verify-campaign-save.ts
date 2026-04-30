// S31-04: pure migration tests for the campaign slice of the meta-save.
// Run with: npx tsx tools/verify-campaign-save.ts
//
// Note: imports `migrateCampaignSnapshot` directly. The function is pure and
// has no signal/store side effects, so it runs in plain node without browser
// shims. Verifying full round-trip through buildActiveRunSnapshot would require
// the entire run-state graph to be initialized — out of scope here.

import { migrateCampaignSnapshot } from '../src/game/core/meta-save';
import type { HexTile } from '../src/game/campaign/campaign-types';

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

// ── Valid roundtrip ─────────────────────────────────────────────────
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
  assert(out !== null, 'valid payload migrates');
  assert(out!.hexTiles.length === 2, 'hexTiles preserved');
  assert(out!.campaignState.currentTileId === '0,0', 'currentTileId preserved');
  assert(out!.campaignState.supplies === 30, 'supplies preserved');
  assert(out!.activeEventTileId === null, 'activeEventTileId null preserved');
}
console.log('PASS: valid payload roundtrip');

// ── activeEventTileId as string ─────────────────────────────────────
{
  const raw = {
    hexTiles: [makeTile(0, 0)],
    campaignState: {
      currentTileId: '0,0',
      selectedTileId: null,
      movementPoints: 2,
      supplies: 30,
      morale: 75,
    },
    activeEventTileId: '2,3',
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'payload with active event migrates');
  assert(out!.activeEventTileId === '2,3', 'activeEventTileId string preserved');
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
      supplies: 30,
      morale: 75,
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
    campaignState: { currentTileId: '0,0', movementPoints: 2, supplies: 30, morale: 75 },
    activeEventTileId: null,
  };
  assert(migrateCampaignSnapshot(raw) === null, 'missing hexTiles returns null');
}
console.log('PASS: missing hexTiles returns null');

// ── Malformed: hexTiles not an array ────────────────────────────────
{
  const raw = {
    hexTiles: 'oops',
    campaignState: { currentTileId: '0,0', movementPoints: 2, supplies: 30, morale: 75 },
    activeEventTileId: null,
  };
  assert(migrateCampaignSnapshot(raw) === null, 'non-array hexTiles returns null');
}
console.log('PASS: non-array hexTiles returns null');

// ── Malformed: missing campaignState fields ─────────────────────────
{
  const raw = {
    hexTiles: [],
    campaignState: { currentTileId: '0,0', supplies: 30, morale: 75 },
    activeEventTileId: null,
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'missing movementPoints still migrates');
  assert(out!.campaignState.movementPoints === 2, 'missing movementPoints defaults to max MP');
}
console.log('PASS: missing movementPoints defaults during migration');

{
  const raw = {
    hexTiles: [],
    campaignState: { currentTileId: '0,0' /* missing supplies/morale */ },
    activeEventTileId: null,
  };
  assert(migrateCampaignSnapshot(raw) === null, 'missing required supplies/morale returns null');
}
console.log('PASS: missing required campaignState fields returns null');

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
    campaignState: { currentTileId: '0,0', movementPoints: 2, supplies: 30, morale: 75 },
    activeEventTileId: null,
  };
  assert(migrateCampaignSnapshot(raw) === null, 'array of non-HexTile primitives returns null');
}
console.log('PASS: hexTiles array of primitives returns null');

// ── Malformed: hexTiles element missing required fields ─────────────
{
  const raw = {
    hexTiles: [{ id: '0,0' /* missing q, r, terrain, event */ }],
    campaignState: { currentTileId: '0,0', movementPoints: 2, supplies: 30, morale: 75 },
    activeEventTileId: null,
  };
  assert(migrateCampaignSnapshot(raw) === null, 'partial hexTile element returns null');
}
console.log('PASS: hexTiles element missing fields returns null');

// ── visitHistory: valid string array roundtrips ─────────────────────
{
  const raw = {
    hexTiles: [makeTile(0, 0), makeTile(1, 0)],
    campaignState: { currentTileId: '1,0', movementPoints: 2, supplies: 30, morale: 75 },
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
    campaignState: { currentTileId: '0,0', movementPoints: 2, supplies: 30, morale: 75 },
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
    campaignState: { currentTileId: '0,0', movementPoints: 2, supplies: 30, morale: 75 },
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
    campaignState: { currentTileId: '0,0', movementPoints: 2, supplies: 30, morale: 75 },
    activeEventTileId: null,
    visitHistory: ['0,0', 42, '1,0'],
  };
  const out = migrateCampaignSnapshot(raw);
  assert(out !== null, 'mixed-type visitHistory does not reject the snapshot');
  assert(out!.visitHistory.length === 0, 'mixed-type visitHistory falls back to []');
}
console.log('PASS: malformed visitHistory falls back to [] (snapshot preserved)');

console.log('\nAll campaign-save migration checks passed');
