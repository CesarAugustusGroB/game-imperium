// Data model for the PixiJS hex campaign map (S30).
// Parallel to the legacy spoke* progression types — kept independent until cutover (S30-12).

import type { BattleTerrainModifier } from '../progression/battle-terrain-modifiers';

export type TerrainType =
  | 'plains'
  | 'forest'
  | 'hills'
  | 'mountains'
  | 'river'
  | 'road'
  | 'camp'
  | 'ruins';

export type EventType =
  | 'none'
  | 'battle'
  | 'supply'
  | 'ambush'
  | 'rest'
  | 'merchant'
  | 'story'
  | 'elite';

export type HexTile = {
  id: string;
  q: number;
  r: number;

  terrain: TerrainType;
  event: EventType;

  discovered: boolean;
  visited: boolean;
  reachable: boolean;
  current: boolean;

  movementCost: number;

  /** S33-06: scout intel level set by `scout` SpokeEffect. 0/undefined = unscouted, 1 = scouted, 2 = full recon. */
  scoutedLevel?: 0 | 1 | 2;
  /** S33-06: per-tile pending battle modifiers stashed by `battle-modifier` SpokeEffect.
   *  Read by `synthesizeHexBattleSpoke` when the player engages on this tile. */
  battleModifiers?: BattleTerrainModifier[];
};

export type CampaignState = {
  currentTileId: string;
  selectedTileId: string | null;
  movementPoints: number;
};
