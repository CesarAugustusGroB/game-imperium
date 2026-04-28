// Data model for the PixiJS hex campaign map (S30).
// Parallel to the legacy spoke* progression types — kept independent until cutover (S30-12).

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
};

export type CampaignState = {
  currentTileId: string;
  selectedTileId: string | null;
  movementPoints: number;
  supplies: number;
  morale: number;
};
