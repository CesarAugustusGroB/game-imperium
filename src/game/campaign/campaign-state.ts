import { signal } from '@preact/signals';
import type { CampaignState, HexTile } from './campaign-types';
import { applyMoveDeltas, MORALE_MAX, SUPPLIES_MAX } from './campaign-balance';
import { resetBellumDefeatState } from './campaign-defeat';

const INITIAL_STATE: CampaignState = {
  currentTileId: '0,0',
  selectedTileId: null,
  movementPoints: 2,
  supplies: 38,
  morale: 100,
};

export const hexTiles = signal<HexTile[]>([]);
export const campaignState = signal<CampaignState>({ ...INITIAL_STATE });

// S30-10: id of the hex whose event should currently be shown in the modal.
// null means no encounter is active. Held outside CampaignState because it's
// purely UI flow, not gameplay state.
export const activeEventTileId = signal<string | null>(null);

// S32-05: ordered list of tile ids the legion has occupied this campaign.
// Drives the visit-history polyline in HexMapView. Lives here (not as a
// private field on HexMapView) so the save layer can round-trip it without
// reaching into the view's internals.
export const visitHistory = signal<string[]>([]);

export function setTiles(tiles: HexTile[]): void {
  hexTiles.value = tiles;
}

export function setCurrent(tileId: string): void {
  campaignState.value = { ...campaignState.value, currentTileId: tileId };
}

export function setSelected(tileId: string | null): void {
  campaignState.value = { ...campaignState.value, selectedTileId: tileId };
}

export function setActiveEvent(tileId: string | null): void {
  activeEventTileId.value = tileId;
}

/** S32-05: replace the visit history wholesale (used by save restore). */
export function setVisitHistory(ids: string[]): void {
  visitHistory.value = ids;
}

/**
 * S32-05: append a tile id to the visit history if it isn't already the tail
 * entry. Skipping duplicates means a re-step onto the current hex doesn't
 * introduce a degenerate zero-length segment in the polyline.
 */
export function appendVisit(id: string): void {
  const current = visitHistory.value;
  if (current[current.length - 1] === id) return;
  visitHistory.value = [...current, id];
}

/** S31-05a: clamped supplies delta. Used by encounter-bridge resolutions. */
export function addSupplies(delta: number): void {
  const next = Math.max(0, Math.min(SUPPLIES_MAX, campaignState.value.supplies + delta));
  campaignState.value = { ...campaignState.value, supplies: next };
}

/** S31-05a: clamped morale delta. Used by encounter-bridge resolutions. */
export function addMorale(delta: number): void {
  const next = Math.max(0, Math.min(MORALE_MAX, campaignState.value.morale + delta));
  campaignState.value = { ...campaignState.value, morale: next };
}

/**
 * S31-03: atomic move write — currentTileId, supplies, and morale updated in
 * one signal mutation so the HUD never observes a half-applied move.
 * Returns starvationTriggered so the caller can fire the warning notification.
 */
export function applyMove(tile: HexTile): { starvationTriggered: boolean } {
  const prev = campaignState.value;
  const outcome = applyMoveDeltas(prev, tile.terrain);
  campaignState.value = {
    ...prev,
    currentTileId: tile.id,
    supplies: outcome.supplies,
    morale: outcome.morale,
  };
  return { starvationTriggered: outcome.starvationTriggered };
}

/**
 * Mark a hex's event as consumed so re-entry doesn't re-fire the modal.
 * Also clears `activeEventTileId` if this is the tile that was being shown.
 */
export function consumeEvent(tileId: string): void {
  hexTiles.value = hexTiles.value.map((tile) =>
    tile.id === tileId ? { ...tile, event: 'none' as const } : tile,
  );
  if (activeEventTileId.value === tileId) {
    activeEventTileId.value = null;
  }
}

export function resetCampaign(): void {
  hexTiles.value = [];
  campaignState.value = { ...INITIAL_STATE };
  activeEventTileId.value = null;
  visitHistory.value = [];
  resetBellumDefeatState();
}
