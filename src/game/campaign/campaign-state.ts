import { signal } from '@preact/signals';
import type { CampaignState, HexTile } from './campaign-types';
import { applyMoveDeltas } from './campaign-balance';

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

/**
 * S31-03: atomic move write — currentTileId, supplies, and morale updated in
 * one signal mutation so the HUD never observes a half-applied move.
 * Returns starvationTriggered so the caller can fire the warning notification.
 */
export function applyMove(tile: HexTile): { starvationTriggered: boolean } {
  const prev = campaignState.value;
  const outcome = applyMoveDeltas(prev, tile.terrain, tile.event);
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
}
