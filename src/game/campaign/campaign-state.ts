import { signal } from '@preact/signals';
import type { CampaignState, HexTile } from './campaign-types';
import { CAMPAIGN_MOVEMENT_POINTS_MAX } from './campaign-balance';
import { consumeBellumTraversal, type BellumTraversalResult } from './bellum-army-view';
import { resetBellumDefeatState } from './campaign-defeat';
import { resetBellumGains } from './bellum-run-gains';
import type { TraversalAttritionLog } from '../army/supplies';

const INITIAL_STATE: CampaignState = {
  currentTileId: '0,0',
  selectedTileId: null,
  movementPoints: CAMPAIGN_MOVEMENT_POINTS_MAX,
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

/** S33-03: refresh Bellum's local movement budget. Season ticks will also call this in S33-04. */
export function refreshMovementPoints(): void {
  campaignState.value = {
    ...campaignState.value,
    movementPoints: CAMPAIGN_MOVEMENT_POINTS_MAX,
  };
}

export type CampaignMoveResult = {
  moved: boolean;
  movementSpent: number;
  movementRemaining: number;
  starvationTriggered: boolean;
  supplyLog: TraversalAttritionLog | null;
};

/**
 * S33-05: atomic move write — currentTileId and movementPoints updated in
 * one signal mutation. Supply and morale are now owned by `preparedArmy`
 * (via `consumeBellumTraversal`). Returns a merged result so the caller can
 * fire starvation warnings and supply-attrition notifications.
 */
export function applyMove(tile: HexTile): CampaignMoveResult {
  const prev = campaignState.value;
  const movementCost = Math.max(0, tile.movementCost);
  if (movementCost > prev.movementPoints) {
    return {
      moved: false,
      movementSpent: 0,
      movementRemaining: prev.movementPoints,
      starvationTriggered: false,
      supplyLog: null,
    };
  }

  const traversal: BellumTraversalResult = consumeBellumTraversal(tile.terrain);
  const movementRemaining = Math.max(0, prev.movementPoints - movementCost);
  campaignState.value = {
    ...prev,
    currentTileId: tile.id,
    movementPoints: movementRemaining,
  };
  return {
    moved: true,
    movementSpent: movementCost,
    movementRemaining,
    starvationTriggered: traversal.starvationTriggered,
    supplyLog: traversal.supplyLog,
  };
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
  resetBellumGains();
}
