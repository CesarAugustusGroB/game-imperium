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

  // S31-10a: ordered list of tile ids the legion has occupied this session.
  // Drives the gold parchment polyline in pathLayer. Seeded from any tile
  // already flagged `visited` on first mount; appended on each `moveToTile`.
  // Not persisted — visit order is reconstructed in tile-array order on
  // reload, which is acceptable while save support is a follow-up.
  private visitHistory: string[] = [];

  private readonly app: Application;
  private tiles: HexTile[];
  private state: CampaignState;
  private onTileSelected: (tile: HexTile) => void;
  private onPlayerMoved: (tile: HexTile) => void;
  private onTilesChanged: (tiles: HexTile[]) => void;

  // Stored so destroy() can detach it from the shared ticker.
  private pulseTickerCallback: ((ticker: Ticker) => void) | null = null;

  // S30-09 camera state.
  private wheelHandler: ((event: WheelEvent) => void) | null = null;
  private dragMoved: boolean = false;
  private static readonly DRAG_CLICK_THRESHOLD: number = 6;
  private static readonly ZOOM_MIN: number = 0.55;
  private static readonly ZOOM_MAX: number = 1.35;

  // Flipped true on destroy() so zombie callbacks (signal effects firing
  // after the wrapping component unmounted) early-out instead of touching
  // a torn-down PIXI.Application.
  private destroyed: boolean = false;

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

    this.visitHistory = options.tiles.filter((t) => t.visited).map((t) => t.id);

    this.centerMap();
    this.setupCamera();
    this.render();
  }

  render(): void {
    if (this.destroyed) return;

    // S31-09: explicitly destroy old HexTileView instances before clearing
    // the layer. Container.removeChildren() only detaches; for tiles holding
    // ticker-driven effects (event-fx) we need destroy() to run their
    // cleanup. Keeps app.ticker clean across renders.
    for (const view of this.tileViews.values()) {
      view.destroy();
    }
    this.tileViews.clear();
    this.tileLayer.removeChildren();
    this.pathLayer.clear();
    this.effectsLayer.removeChildren();

    this.detachPulseTicker();

    this.drawTiles();
    this.drawVisitHistory();
    this.drawCurrentPositionPulse();
  }

  /**
   * Replace the tile set wholesale and re-render.
   * Used when a fresh map is generated or when external state mutates the tiles.
   */
  setTiles(tiles: HexTile[]): void {
    if (this.destroyed) return;
    this.tiles = tiles;
    this.render();
  }

  /**
   * Mirror an externally-mutated CampaignState into this view and re-render.
   * Called by PixiHexMap's campaignState signal mirror so that S31 systems
   * (save/load, supplies/morale decrements) keep this.state in sync.
   *
   * Feedback-loop note: moveToTile mutates this.state.currentTileId then calls
   * onPlayerMoved → setCurrent(tile.id) → signal write → campaignState mirror
   * fires → setState(newState) → render() again. render() is idempotent so this
   * produces one extra paint per move — acceptable and no logical feedback loop.
   */
  setState(state: CampaignState): void {
    if (this.destroyed) return;
    this.state = state;
    this.render();
  }

  /**
   * Detach pulse ticker callback and the canvas wheel listener.
   * Idempotent — safe to call multiple times. Caller is responsible
   * for destroying the underlying PIXI.Application.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.detachPulseTicker();
    // S31-09: tear down per-tile event-fx ticker callbacks before component
    // unmount so PixiHexMap's app.destroy() doesn't race with active emitters.
    for (const view of this.tileViews.values()) {
      view.destroy();
    }
    this.tileViews.clear();
    if (this.wheelHandler) {
      // app.canvas may already be gone if app.destroy() ran first.
      this.app.canvas?.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
  }

  private drawTiles(): void {
    for (const tile of this.tiles) {
      const view = new HexTileView(tile, this.hexSize, this.app.ticker, (clickedTile) => {
        // Suppress click if the user just dragged the camera past
        // the threshold — the pointertap fires after pointerup either way.
        if (this.dragMoved) return;
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

    // S31-10a: append to visitHistory if not already the tail entry. Skipping
    // duplicates means a re-step onto the current hex (shouldn't happen via
    // handleTileClick today, but possible via external setState) doesn't
    // introduce a degenerate zero-length segment.
    if (this.visitHistory[this.visitHistory.length - 1] !== destination.id) {
      this.visitHistory.push(destination.id);
    }

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

  private drawVisitHistory(): void {
    if (this.visitHistory.length < 2) return;

    // Resolve ids → discovered tiles. Drop any history entry that is no
    // longer in `this.tiles` (regen) or got re-fogged (defensive — doesn't
    // happen today but matches AC's "Lines respect fog").
    const tileById = new Map(this.tiles.map((t) => [t.id, t]));
    const points: { x: number; y: number }[] = [];
    for (const id of this.visitHistory) {
      const tile = tileById.get(id);
      if (!tile || !tile.discovered) continue;
      points.push(hexToPixel(tile.q, tile.r, this.hexSize));
    }
    if (points.length < 2) return;

    // Dual-stroke glow emulation: wide outer at low alpha + thin inner at
    // higher alpha. Avoids adding pixi-filters as a dep just for a soft glow.
    this.strokePolyline(points, { width: 9, alpha: 0.18 });
    this.strokePolyline(points, { width: 4, alpha: 0.55 });
  }

  private strokePolyline(
    points: readonly { x: number; y: number }[],
    style: { width: number; alpha: number },
  ): void {
    this.pathLayer.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.pathLayer.lineTo(points[i].x, points[i].y);
    }
    this.pathLayer.stroke({ width: style.width, color: 0xd8aa55, alpha: style.alpha });
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
      // app.ticker may already be null if app.destroy() ran first;
      // happens when a stale signal-mirror effect fires after teardown.
      this.app.ticker?.remove(this.pulseTickerCallback);
      this.pulseTickerCallback = null;
    }
  }

  private centerMap(): void {
    this.root.x = this.app.screen.width / 2;
    this.root.y = this.app.screen.height / 2;
  }

  private setupCamera(): void {
    const stage = this.app.stage;
    stage.eventMode = 'static';
    stage.hitArea = this.app.screen;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;

    stage.on('pointerdown', (event) => {
      if (this.destroyed) return;
      dragging = true;
      this.dragMoved = false;
      startX = event.global.x;
      startY = event.global.y;
      lastX = event.global.x;
      lastY = event.global.y;
    });

    const endDrag = (): void => {
      dragging = false;
      // dragMoved stays true until the next pointerdown so the suppression
      // guard in HexTileView's click callback can still see it.
    };
    stage.on('pointerup', endDrag);
    stage.on('pointerupoutside', endDrag);

    stage.on('pointermove', (event) => {
      if (this.destroyed || !dragging) return;

      const dx = event.global.x - lastX;
      const dy = event.global.y - lastY;
      this.root.x += dx;
      this.root.y += dy;
      lastX = event.global.x;
      lastY = event.global.y;

      const totalDx = event.global.x - startX;
      const totalDy = event.global.y - startY;
      if (Math.hypot(totalDx, totalDy) > HexMapView.DRAG_CLICK_THRESHOLD) {
        this.dragMoved = true;
      }
    });

    const wheelHandler = (event: WheelEvent): void => {
      if (this.destroyed) return;
      event.preventDefault();
      const zoomFactor = event.deltaY > 0 ? 0.95 : 1.05;
      const nextScale = Math.max(
        HexMapView.ZOOM_MIN,
        Math.min(HexMapView.ZOOM_MAX, this.root.scale.x * zoomFactor),
      );
      this.root.scale.set(nextScale);
    };

    // passive:false so preventDefault() actually suppresses page-scroll.
    this.app.canvas.addEventListener('wheel', wheelHandler, { passive: false });
    this.wheelHandler = wheelHandler;
  }
}
