// S30-07: composes the campaign map's Pixi scene graph and owns the
// per-tile render loop. Camera (drag/zoom) is deferred to S30-09; signal
// integration with the campaign store is deferred to S30-08/S30-11.

import { Application, Container, Graphics, type Ticker } from 'pixi.js';
import type { CampaignState, HexTile } from '../campaign/campaign-types';
import { revealNeighbors, updateReachableTiles } from '../campaign/movement';
import { hexToPixel } from './hex-math';
import { HexTileView } from './HexTileView';

export type HexMapViewOptions = {
  app: Application;
  tiles: HexTile[];
  state: CampaignState;
  onTileSelected: (tile: HexTile) => void;
  onPlayerMoved: (tile: HexTile) => void;
  // Fires after moveToTile mutates the internal tile array. Callers should
  // mirror the new array into their store of record (e.g. the hexTiles signal)
  // so HUD readers don't observe stale state.
  onTilesChanged: (tiles: HexTile[]) => void;
};

export class HexMapView {
  public readonly root: Container = new Container();

  private readonly terrainLayer: Container = new Container();
  private readonly tileLayer: Container = new Container();
  private readonly pathLayer: Graphics = new Graphics();
  private readonly effectsLayer: Container = new Container();

  private readonly tileViews: Map<string, HexTileView> = new Map();
  private readonly hexSize: number = 64;

  private readonly app: Application;
  private tiles: HexTile[];
  private state: CampaignState;
  private onTileSelected: (tile: HexTile) => void;
  private onPlayerMoved: (tile: HexTile) => void;
  private onTilesChanged: (tiles: HexTile[]) => void;

  // Stored so destroy() can detach it from the shared ticker.
  private pulseTickerCallback: ((ticker: Ticker) => void) | null = null;

  constructor(options: HexMapViewOptions) {
    this.app = options.app;
    this.tiles = options.tiles;
    this.state = options.state;
    this.onTileSelected = options.onTileSelected;
    this.onPlayerMoved = options.onPlayerMoved;
    this.onTilesChanged = options.onTilesChanged;

    this.root.addChild(this.terrainLayer);
    this.root.addChild(this.pathLayer);
    this.root.addChild(this.tileLayer);
    this.root.addChild(this.effectsLayer);

    this.centerMap();
    this.render();
  }

  render(): void {
    this.tileLayer.removeChildren();
    this.pathLayer.clear();
    this.effectsLayer.removeChildren();
    this.tileViews.clear();

    this.detachPulseTicker();

    this.drawTiles();
    this.drawCurrentPositionPulse();
  }

  /**
   * Replace the tile set wholesale and re-render.
   * Used when a fresh map is generated or when external state mutates the tiles.
   */
  setTiles(tiles: HexTile[]): void {
    this.tiles = tiles;
    this.render();
  }

  /**
   * Detach pulse ticker callback. Caller is responsible for destroying
   * the underlying PIXI.Application separately.
   */
  destroy(): void {
    this.detachPulseTicker();
  }

  private drawTiles(): void {
    for (const tile of this.tiles) {
      const view = new HexTileView(tile, this.hexSize, (clickedTile) => {
        this.handleTileClick(clickedTile);
      });

      const position = hexToPixel(tile.q, tile.r, this.hexSize);
      view.x = position.x;
      view.y = position.y;

      this.tileLayer.addChild(view);
      this.tileViews.set(tile.id, view);
    }
  }

  private handleTileClick(tile: HexTile): void {
    this.state.selectedTileId = tile.id;
    this.onTileSelected(tile);

    if (!tile.reachable) return;

    this.moveToTile(tile);
  }

  private moveToTile(destination: HexTile): void {
    this.state.currentTileId = destination.id;

    this.tiles = this.tiles.map((tile) => {
      if (tile.id === destination.id) {
        return { ...tile, visited: true, discovered: true, current: true };
      }
      return { ...tile, current: false };
    });

    const currentTile = this.tiles.find((tile) => tile.id === destination.id);
    if (!currentTile) return;

    this.tiles = revealNeighbors(this.tiles, currentTile);
    this.tiles = updateReachableTiles(
      this.tiles,
      currentTile.id,
      this.state.movementPoints,
    );

    this.onPlayerMoved(currentTile);
    this.onTilesChanged(this.tiles);
    this.render();
  }

  private drawCurrentPositionPulse(): void {
    const currentTile = this.tiles.find(
      (tile) => tile.id === this.state.currentTileId,
    );
    if (!currentTile) return;

    const position = hexToPixel(currentTile.q, currentTile.r, this.hexSize);

    const pulse = new Graphics();
    pulse.circle(0, 0, this.hexSize * 0.75);
    pulse.fill({ color: 0x55c783, alpha: 0.16 });
    pulse.stroke({ width: 2, color: 0x55c783, alpha: 0.7 });
    pulse.x = position.x;
    pulse.y = position.y;

    this.effectsLayer.addChild(pulse);

    let t = 0;
    const callback = (): void => {
      t += 0.04;
      pulse.scale.set(1 + Math.sin(t) * 0.08);
      pulse.alpha = 0.75 + Math.sin(t) * 0.15;
    };

    this.pulseTickerCallback = callback;
    this.app.ticker.add(callback);
  }

  private detachPulseTicker(): void {
    if (this.pulseTickerCallback) {
      this.app.ticker.remove(this.pulseTickerCallback);
      this.pulseTickerCallback = null;
    }
  }

  private centerMap(): void {
    this.root.x = this.app.screen.width / 2;
    this.root.y = this.app.screen.height / 2;
  }
}
