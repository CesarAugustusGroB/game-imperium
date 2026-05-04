// S30-07: composes the campaign map's Pixi scene graph and owns the
// per-tile render loop. Camera (drag/zoom) is deferred to S30-09; signal
// integration with the campaign store is deferred to S30-08/S30-11.

import { Application, Container, Graphics, Rectangle, type Ticker } from 'pixi.js';
import type { CampaignState, HexTile } from '../campaign/campaign-types';
import { hexDistance, findPath } from '../campaign/hex-pathfinding';
import { revealNeighbors, updateReachableTiles } from '../campaign/movement';
import { appendVisit, setVisitHistory, visitHistory, pendingPathConfirmation, bypassPathConfirmation } from '../campaign/campaign-state';
import { hexToPixel } from './hex-math';
import { drawDecorationsForTile } from './hex-decorations';
import { HexTileView } from './HexTileView';

export type HexMapViewOptions = {
  app: Application;
  tiles: HexTile[];
  state: CampaignState;
  onTileSelected: (tile: HexTile) => void;
  onPlayerMoved: (tile: HexTile) => { moved: boolean; movementRemaining: number };
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
  // S31-07: terrain decoration sprites (trees, peaks, ripples, milestones).
  // Sits above tileLayer so decorations occlude state strokes/overlays, but
  // below effectsLayer so the current-pulse and event icons stay readable.
  private readonly decorationLayer: Container = new Container();
  private readonly effectsLayer: Container = new Container();

  private readonly tileViews: Map<string, HexTileView> = new Map();
  // S33 polish: bumped from 64 → 96 so the radius-6 grid fills (and slightly
  // overflows) the viewport. The bottom panel hides the bottom overflow,
  // leaving no visible gap between the grid and the panel.
  private readonly hexSize: number = 96;

  // S31-10b: id of the tile currently under the cursor (when reachable and
  // not the legion's own hex). Drives the brighter preview polyline drawn
  // alongside any visit-history line in pathLayer.
  private hoveredTileId: string | null = null;

  private readonly app: Application;
  private tiles: HexTile[];
  private state: CampaignState;
  private onTileSelected: (tile: HexTile) => void;
  private onPlayerMoved: (tile: HexTile) => { moved: boolean; movementRemaining: number };
  private onTilesChanged: (tiles: HexTile[]) => void;

  // Stored so destroy() can detach it from the shared ticker.
  private pulseTickerCallback: ((ticker: Ticker) => void) | null = null;

  // S30-09 camera state.
  private wheelHandler: ((event: WheelEvent) => void) | null = null;
  private dragMoved: boolean = false;
  private cameraTouched: boolean = false;
  // S32 polish: promoted from setupCamera's closure scope so handleTileHover
  // can early-return while the camera is mid-drag — avoids N renders/frame
  // when the cursor sweeps tiles during a pan.
  private isDragging: boolean = false;
  private static readonly DRAG_CLICK_THRESHOLD: number = 6;
  private static readonly ZOOM_MIN: number = 0.55;
  private static readonly ZOOM_MAX: number = 1.35;

  // Path-line stroke colors. Visit-history is muted parchment gold; hover
  // preview pops brighter to read as the "future" path.
  private static readonly PATH_COLOR_VISIT: number = 0xd8aa55;
  private static readonly PATH_COLOR_HOVER: number = 0xffd485;

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
    this.root.addChild(this.decorationLayer);
    this.root.addChild(this.effectsLayer);

    // S32-05: visit history lives in the campaign-state signal (round-tripped
    // through CampaignSnapshot). Seed from existing `visited` tiles only when
    // the signal is empty — saved campaigns restore via setVisitHistory before
    // this constructor runs, so the seeding short-circuits in that path.
    if (visitHistory.value.length === 0) {
      const seed = options.tiles.filter((t) => t.visited).map((t) => t.id);
      if (seed.length > 0) setVisitHistory(seed);
    }

    this.fitToView();
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
    this.decorationLayer.removeChildren();
    this.effectsLayer.removeChildren();

    this.detachPulseTicker();

    this.drawTiles();
    this.drawDecorations();
    this.drawVisitHistory();
    this.drawHoverPreview();
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
    const shouldRefreshReachability =
      state.currentTileId !== this.state.currentTileId ||
      state.movementPoints !== this.state.movementPoints;
    this.state = state;
    if (shouldRefreshReachability) {
      this.tiles = updateReachableTiles(
        this.tiles,
        this.state.currentTileId,
        this.state.movementPoints,
      );
      this.onTilesChanged(this.tiles);
    }
    this.render();
  }

  resizeViewport(): void {
    if (this.destroyed) return;
    this.updateHitArea();
    if (!this.cameraTouched) {
      this.fitToView();
      this.centerMap();
    }
  }

  /**
   * S33 polish: compute a root scale that guarantees the radius-N hex grid
   * fully covers the visible area (viewport minus bottom panel) regardless
   * of monitor size. Uses the larger of the two axis ratios so the smaller
   * axis overflows rather than leaving an empty band. Skipped once the
   * player touches the camera (zoom wheel / pan) so manual adjustments
   * stick across resizes.
   */
  private fitToView(): void {
    const BOTTOM_PANEL_HEIGHT = 72;
    const visibleW = this.app.screen.width;
    const visibleH = this.app.screen.height - BOTTOM_PANEL_HEIGHT;
    if (visibleW <= 0 || visibleH <= 0) return;

    // Bounding box of a radius-N hex grid in unscaled root coords. The
    // extra hexSize on each axis accounts for the half-hex that extends
    // past the outermost center.
    const radius = 6;
    const gridW = 2 * (this.hexSize * Math.sqrt(3) * radius + this.hexSize * Math.sqrt(3) / 2);
    const gridH = 2 * (this.hexSize * 1.5 * radius + this.hexSize);

    // Floor the scale at 1 so we NEVER shrink the grid below its natural
    // size — when the grid is already bigger than the viewport (common at
    // 1080p with hexSize=96), the natural overflow is what hides every
    // visible band. We only scale UP to fill bigger viewports.
    const overflow = 1.04;
    const scale = Math.max(
      1,
      Math.max(visibleW / gridW, visibleH / gridH) * overflow,
    );
    this.root.scale.set(scale);
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
      const view = new HexTileView(
        tile,
        this.hexSize,
        this.app.ticker,
        (clickedTile) => {
          // Suppress click if the user just dragged the camera past
          // the threshold — the pointertap fires after pointerup either way.
          if (this.dragMoved) return;
          this.handleTileClick(clickedTile);
        },
        (hoveredTile, isHovering) => this.handleTileHover(hoveredTile, isHovering),
      );

      const position = hexToPixel(tile.q, tile.r, this.hexSize);
      view.x = position.x;
      view.y = position.y;

      this.tileLayer.addChild(view);
      this.tileViews.set(tile.id, view);
    }
  }

  private drawDecorations(): void {
    for (const tile of this.tiles) {
      if (!tile.discovered) continue;
      const decoration = drawDecorationsForTile(tile, this.hexSize);
      if (!decoration) continue;
      const position = hexToPixel(tile.q, tile.r, this.hexSize);
      decoration.x = position.x;
      decoration.y = position.y;
      this.decorationLayer.addChild(decoration);
    }
  }

  private handleTileHover(tile: HexTile, isHovering: boolean): void {
    if (this.destroyed) return;
    // S32 polish: skip hover updates while the camera is being dragged.
    // Pixi keeps firing pointerover/pointerout as the cursor sweeps tiles
    // mid-drag; processing them would render() every frame for no reason.
    if (this.isDragging) return;

    if (isHovering) {
      // Only preview paths to reachable, non-current tiles. Hovering an
      // unreachable tile (or the legion's own hex) leaves the layer alone.
      if (!tile.reachable || tile.id === this.state.currentTileId) {
        if (this.hoveredTileId !== null) {
          this.hoveredTileId = null;
          this.render();
        }
        return;
      }
      if (this.hoveredTileId === tile.id) return;
      this.hoveredTileId = tile.id;
      this.render();
      return;
    }

    // hover-out — clear only if the leaving tile matches the stored hover
    // (guards against pointer events firing out of order during fast moves).
    if (this.hoveredTileId === tile.id) {
      this.hoveredTileId = null;
      this.render();
    }
  }

  private drawHoverPreview(): void {
    if (this.hoveredTileId === null) return;
    const goal = this.tiles.find((t) => t.id === this.hoveredTileId);
    const start = this.tiles.find((t) => t.id === this.state.currentTileId);
    if (!goal || !start) return;

    const path = findPath(start, goal, this.tiles, this.state.movementPoints);
    if (!path || path.length < 2) return;

    // S32 polish: truncate the preview at the first event-bearing tile
    // (inclusive) so the line ends where walkPath actually stops the legion.
    // Path[0] is the current tile — start scanning from index 1.
    const stopIndex = path.findIndex((tile, i) => i > 0 && tile.event !== 'none');
    const visiblePath = stopIndex === -1 ? path : path.slice(0, stopIndex + 1);
    if (visiblePath.length < 2) return;

    const points = visiblePath.map((tile) => hexToPixel(tile.q, tile.r, this.hexSize));

    // Dual-stroke for soft-glow emphasis. Brighter / wider than the
    // visit-history polyline (S31-10a) so it reads as the "future" path.
    this.strokePolyline(points, { width: 9, alpha: 0.30, color: HexMapView.PATH_COLOR_HOVER });
    this.strokePolyline(points, { width: 5, alpha: 0.85, color: HexMapView.PATH_COLOR_HOVER });
  }

  private handleTileClick(tile: HexTile): void {
    this.state.selectedTileId = tile.id;
    this.onTileSelected(tile);

    if (!tile.reachable) return;

    const currentTile = this.tiles.find((t) => t.id === this.state.currentTileId);
    if (!currentTile) return;

    if (hexDistance(currentTile, tile) === 1) {
      this.moveToTile(tile);
      return;
    }

    const path = findPath(currentTile, tile, this.tiles, this.state.movementPoints);
    if (!path) return;

    // S34-04: scan the *interior* of the path (exclude start and goal) for the
    // first unconsumed event. If the goal itself is an event, that's an explicit
    // click — no confirmation needed (the player chose the event). If the player
    // already opted out via the don't-ask-again checkbox, walk directly.
    const interior = path.slice(1, -1);
    const eventInPath = interior.find((t) => t.event !== 'none');

    if (!eventInPath || bypassPathConfirmation.value) {
      this.walkPath(path);
      return;
    }

    pendingPathConfirmation.value = {
      eventTile: eventInPath,
      resolve: (confirmed) => {
        if (confirmed) this.walkPath(path);
      },
    };
  }

  private walkPath(path: HexTile[]): void {
    for (let i = 1; i < path.length; i++) {
      const step = path[i];
      const moved = this.moveToTile(step);
      if (!moved) break;
      if (step.event !== 'none') break;
    }
  }

  private moveToTile(destination: HexTile): boolean {
    if (destination.movementCost > this.state.movementPoints) return false;
    const moveResult = this.onPlayerMoved(destination);
    if (!moveResult.moved) return false;

    this.state = {
      ...this.state,
      currentTileId: destination.id,
      movementPoints: moveResult.movementRemaining,
    };

    // S32-05: append via the campaign-state signal helper. The duplicate-tail
    // guard from S31-10a lives inside appendVisit so a re-step onto the
    // current hex doesn't introduce a zero-length polyline segment.
    appendVisit(destination.id);

    this.tiles = this.tiles.map((tile) => {
      if (tile.id === destination.id) {
        return { ...tile, visited: true, discovered: true, current: true };
      }
      return { ...tile, current: false };
    });

    const currentTile = this.tiles.find((tile) => tile.id === destination.id);
    if (!currentTile) return false;

    this.tiles = revealNeighbors(this.tiles, currentTile);
    this.tiles = updateReachableTiles(
      this.tiles,
      currentTile.id,
      this.state.movementPoints,
    );

    this.onTilesChanged(this.tiles);
    this.render();
    return true;
  }

  private drawVisitHistory(): void {
    const history = visitHistory.value;
    if (history.length < 2) return;

    // Resolve ids → discovered tiles. Drop any history entry that is no
    // longer in `this.tiles` (regen) or got re-fogged (defensive — doesn't
    // happen today but matches AC's "Lines respect fog").
    const tileById = new Map(this.tiles.map((t) => [t.id, t]));
    const points: { x: number; y: number }[] = [];
    for (const id of history) {
      const tile = tileById.get(id);
      if (!tile || !tile.discovered) continue;
      points.push(hexToPixel(tile.q, tile.r, this.hexSize));
    }
    if (points.length < 2) return;

    // Dual-stroke glow emulation: wide outer at low alpha + thin inner at
    // higher alpha. Avoids adding pixi-filters as a dep just for a soft glow.
    this.strokePolyline(points, { width: 9, alpha: 0.18, color: HexMapView.PATH_COLOR_VISIT });
    this.strokePolyline(points, { width: 4, alpha: 0.55, color: HexMapView.PATH_COLOR_VISIT });
  }

  private strokePolyline(
    points: readonly { x: number; y: number }[],
    style: { width: number; alpha: number; color: number },
  ): void {
    this.pathLayer.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.pathLayer.lineTo(points[i].x, points[i].y);
    }
    this.pathLayer.stroke({ width: style.width, color: style.color, alpha: style.alpha });
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
    // S33 polish: bias the y-center upward by half of the bottom panel's
    // height so the grid centers in the VISIBLE area (viewport minus panel)
    // instead of the geometric canvas center. Without this, the grid bottom
    // sits ~36px above the panel and leaves an empty band of canvas bg.
    const BOTTOM_PANEL_HEIGHT = 72;
    this.root.x = this.app.screen.width / 2;
    this.root.y = (this.app.screen.height - BOTTOM_PANEL_HEIGHT) / 2;
  }

  private updateHitArea(): void {
    this.app.stage.hitArea = new Rectangle(0, 0, this.app.screen.width, this.app.screen.height);
  }

  private setupCamera(): void {
    const stage = this.app.stage;
    stage.eventMode = 'static';
    this.updateHitArea();

    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;

    stage.on('pointerdown', (event) => {
      if (this.destroyed) return;
      this.isDragging = true;
      this.dragMoved = false;
      startX = event.global.x;
      startY = event.global.y;
      lastX = event.global.x;
      lastY = event.global.y;
    });

    const endDrag = (): void => {
      this.isDragging = false;
      // dragMoved stays true until the next pointerdown so the suppression
      // guard in HexTileView's click callback can still see it.
    };
    stage.on('pointerup', endDrag);
    stage.on('pointerupoutside', endDrag);

    stage.on('pointermove', (event) => {
      if (this.destroyed || !this.isDragging) return;

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
        this.cameraTouched = true;
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
      if (nextScale !== this.root.scale.x) this.cameraTouched = true;
      this.root.scale.set(nextScale);
    };

    // passive:false so preventDefault() actually suppresses page-scroll.
    this.app.canvas.addEventListener('wheel', wheelHandler, { passive: false });
    this.wheelHandler = wheelHandler;
  }
}
