import { signal } from '@preact/signals';
import type { CampaignState, HexTile } from './campaign-types';

const INITIAL_STATE: CampaignState = {
  currentTileId: '0,0',
  selectedTileId: null,
  movementPoints: 2,
  supplies: 38,
  morale: 100,
};

export const hexTiles = signal<HexTile[]>([]);
export const campaignState = signal<CampaignState>({ ...INITIAL_STATE });

export function setTiles(tiles: HexTile[]): void {
  hexTiles.value = tiles;
}

export function setCurrent(tileId: string): void {
  campaignState.value = { ...campaignState.value, currentTileId: tileId };
}

export function setSelected(tileId: string | null): void {
  campaignState.value = { ...campaignState.value, selectedTileId: tileId };
}

export function resetCampaign(): void {
  hexTiles.value = [];
  campaignState.value = { ...INITIAL_STATE };
}
