import { signal } from '@preact/signals';
import type { CampaignState, HexTile } from './campaign-types';

// S31-05a: clamps for the new addSupplies/addMorale setters. Kept local for
// now to avoid a hard dependency on S31-03's campaign-balance module — when
// that lands, this can switch to importing from there.
const SUPPLIES_MAX = 99;
const MORALE_MAX = 100;

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
