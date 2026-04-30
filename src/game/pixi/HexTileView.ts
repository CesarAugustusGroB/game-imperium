// S30-06: PixiJS Container that renders one hex tile and its visual states.
// No Preact/React imports — pure Pixi v8. Click selection bubbles up via the
// onSelect callback so HexMapView (S30-07) owns the routing decisions.
//
// S31-06: terrain base layer is now a Sprite from HEX_ASSETS instead of a
// flat colored polygon. State (visited / reachable / current / fog) and
// event icons render as separate layers on top.

import { Container, Graphics, Sprite, type Ticker } from 'pixi.js';
import type { EventType, HexTile } from '../campaign/campaign-types';
import { getEventColor } from '../campaign/events';
import { createDangerEmitter, createGlowHalo } from './effects/event-fx';
import { HEX_ASSETS, type EventAssetKey } from './hex-assets';

const DANGER_EVENTS: ReadonlySet<EventType> = new Set(['battle', 'ambush', 'elite']);
const HALO_EVENTS: ReadonlySet<EventType> = new Set(['merchant', 'supply', 'rest']);

export class HexTileView extends Container {
  public tile: HexTile;
  private size: number;
  private onSelect: (tile: HexTile) => void;
  private ticker: Ticker;
  // S31-09: cleanup fn for the active particle/halo effect on this tile.
  // Always reset before each draw() and on destroy() so ticker callbacks
  // don't leak when render() rebuilds the tile views.
  private effectCleanup: (() => void) | null = null;
  // S31-10b: bubbles hover state up to HexMapView so it can drive the
  // hover-preview path-line. Optional so older callers keep compiling.
  private onHover: ((tile: HexTile, isHovering: boolean) => void) | null;

  constructor(
    tile: HexTile,
    size: number,
    ticker: Ticker,
    onSelect: (tile: HexTile) => void,
    onHover?: (tile: HexTile, isHovering: boolean) => void,
  ) {
    super();

    this.tile = tile;
    this.size = size;
    this.ticker = ticker;
    this.onSelect = onSelect;
    this.onHover = onHover ?? null;

    this.eventMode = 'static';
    this.cursor = tile.discovered ? 'pointer' : 'default';

    this.draw();

    this.on('pointerover', () => {
      this.setHover(true);
      if (this.tile.discovered) this.onHover?.(this.tile, true);
    });
    this.on('pointerout', () => {
      this.setHover(false);
      if (this.tile.discovered) this.onHover?.(this.tile, false);
    });
    this.on('pointertap', () => {
      if (!this.tile.discovered) return;
      this.onSelect(this.tile);
    });
  }

  updateTile(tile: HexTile): void {
    this.tile = tile;
    this.cursor = tile.discovered ? 'pointer' : 'default';
    this.draw();
  }

  private draw(): void {
    // S31-09: clear any prior tick-driven effect before rebuilding the tile.
    if (this.effectCleanup) {
      this.effectCleanup();
      this.effectCleanup = null;
    }

    this.removeChildren();

    const points = this.getHexPoints();

    // Base: painterly terrain Sprite from the shared HEX_ASSETS bundle.
    // Texture is reused across every tile of the same terrain — Pixi caches by
    // URL so there's no per-tile upload.
    const texture = HEX_ASSETS.current.terrain[this.tile.terrain];
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    // Hex inscribed in size×2 box; placeholder textures are 128px square. The
    // ratio is computed dynamically so commissioned art at any resolution drops in.
    const target = this.size * 2;
    sprite.width = target;
    sprite.height = target;
    sprite.alpha = this.tile.discovered ? 1 : 0.18;
    this.addChild(sprite);

    // Visited green tint — preserves the "visited" reading per S31-06 AC's
    // "Terrain color overlay survives at low alpha for state tinting".
    if (this.tile.discovered && this.tile.visited && !this.tile.current) {
      const visitedTint = new Graphics();
      visitedTint.poly(points);
      visitedTint.fill({ color: 0x47704f, alpha: 0.18 });
      this.addChild(visitedTint);
    }

    // Stroke (state-colored polygon outline). Drawn separately from the base
    // sprite so the painterly texture isn't dimmed by a poly fill.
    const stroke = new Graphics();
    stroke.poly(points);
    stroke.stroke({
      width: this.tile.reachable || this.tile.current ? 2 : 1,
      color: this.getStrokeColor(),
      alpha: this.tile.discovered ? 0.75 : 0.18,
    });
    this.addChild(stroke);

    if (this.tile.reachable) {
      this.drawReachableOverlay(points);
    }

    if (this.tile.current) {
      this.drawCurrentOverlay();
    }

    if (this.tile.event !== 'none' && this.tile.discovered) {
      // tile.event narrows to EventAssetKey here (Exclude<EventType,'none'>).
      this.drawEventIcon(this.tile.event);
    }

    if (!this.tile.discovered) {
      this.drawFog(points);
    }

    // S31-09: spawn ember/halo effect for danger or important event tiles.
    // Discovered-only per AC. Effect cleanup is registered for the next draw.
    if (this.tile.discovered) {
      if (DANGER_EVENTS.has(this.tile.event)) {
        this.effectCleanup = createDangerEmitter(this, getEventColor(this.tile.event), this.ticker);
      } else if (HALO_EVENTS.has(this.tile.event)) {
        this.effectCleanup = createGlowHalo(
          this,
          getEventColor(this.tile.event),
          this.ticker,
          this.size * 0.5,
        );
      }
    }
  }

  /**
   * Override Container.destroy so per-tile ticker effects are torn down
   * before the standard child destruction. HexMapView.render() calls this
   * on every prior view before rebuilding the layer.
   */
  override destroy(...args: Parameters<Container['destroy']>): void {
    if (this.effectCleanup) {
      this.effectCleanup();
      this.effectCleanup = null;
    }
    super.destroy(...args);
  }

  private getHexPoints(): number[] {
    // Pointy-top hex: vertices at every 60° starting from -30°.
    const points: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      points.push(this.size * Math.cos(angle), this.size * Math.sin(angle));
    }
    return points;
  }

  private getStrokeColor(): number {
    if (this.tile.current) return 0x55c783;
    if (this.tile.reachable) return 0xd8aa55;
    if (this.tile.visited) return 0x47704f;
    return 0x5a3a24;
  }

  private drawReachableOverlay(points: number[]): void {
    const overlay = new Graphics();
    overlay.poly(points);
    overlay.fill({ color: 0xd8aa55, alpha: 0.12 });
    overlay.stroke({ width: 2, color: 0xd8aa55, alpha: 0.85 });
    this.addChild(overlay);
  }

  private drawCurrentOverlay(): void {
    const glow = new Graphics();
    glow.circle(0, 0, this.size * 0.65);
    glow.fill({ color: 0x55c783, alpha: 0.18 });
    glow.stroke({ width: 3, color: 0x55c783, alpha: 0.95 });
    this.addChild(glow);
  }

  private drawEventIcon(event: EventAssetKey): void {
    // S31-08: sprite-based event icon. Texture comes from the shared
    // HEX_ASSETS bundle so all hexes with the same event share one upload.
    // S31-01's placeholder PNGs are pre-tinted per event color, so no
    // sprite.tint here — commissioned art that arrives desaturated can
    // wire `sprite.tint = getEventColor(...)` in this same spot.
    const texture = HEX_ASSETS.current.events[event];
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    // Parametric scale: event icon is ~55% of hex size on each axis.
    const target = this.size * 1.1;
    sprite.width = target;
    sprite.height = target;
    this.addChild(sprite);
  }

  private drawFog(points: number[]): void {
    const fog = new Graphics();
    fog.poly(points);
    fog.fill({ color: 0x000000, alpha: 0.68 });
    this.addChild(fog);
  }

  private setHover(isHovering: boolean): void {
    if (!this.tile.discovered) return;
    this.scale.set(isHovering ? 1.04 : 1);
  }
}
