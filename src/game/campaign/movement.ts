// S30-07/S30-08: pure movement math — reachable calc, neighbor reveal.
// Created in S30-07 because HexMapView.handleTileClick needs it to compile;
// S30-08 owns the wiring of these helpers into the campaign signal store
// and click→event flow.

import type { HexTile } from './campaign-types';
import { getHexNeighbors } from '../pixi/hex-math';
import { isBlockedTerrain } from './terrain';

export function calculateReachableTiles(
  currentTile: HexTile,
  tiles: HexTile[],
  movementPoints: number,
): HexTile[] {
  const neighbors = getHexNeighbors(currentTile, tiles);

  return neighbors.filter((tile) => {
    if (!tile.discovered) return false;
    if (tile.visited) return false;
    if (isBlockedTerrain(tile.terrain)) return false;
    if (tile.movementCost > movementPoints) return false;
    return true;
  });
}

export function updateReachableTiles(
  tiles: HexTile[],
  currentTileId: string,
  movementPoints: number,
): HexTile[] {
  const currentTile = tiles.find((tile) => tile.id === currentTileId);
  if (!currentTile) return tiles;

  const reachableTiles = calculateReachableTiles(currentTile, tiles, movementPoints);
  const reachableIds = new Set(reachableTiles.map((tile) => tile.id));

  return tiles.map((tile) => ({
    ...tile,
    current: tile.id === currentTileId,
    reachable: reachableIds.has(tile.id),
  }));
}

export function revealNeighbors(tiles: HexTile[], originTile: HexTile): HexTile[] {
  const neighbors = getHexNeighbors(originTile, tiles);
  const neighborIds = new Set(neighbors.map((tile) => tile.id));

  return tiles.map((tile) => {
    if (neighborIds.has(tile.id)) {
      return { ...tile, discovered: true };
    }
    return tile;
  });
}
