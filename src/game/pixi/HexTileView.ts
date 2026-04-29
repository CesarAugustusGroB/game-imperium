// S30-06: PixiJS Container that renders one hex tile and its visual states.
// No Preact/React imports — pure Pixi v8. Click selection bubbles up via the
// onSelect callback so HexMapView (S30-07) owns the routing decisions.

import { Container, Graphics, Text } from 'pixi.js';
import type { HexTile } from '../campaign/campaign-types';
import { getTerrainColor } from '../campaign/terrain';
import { getEventColor, getEventIcon } from '../campaign/events';

export class HexTileView extends Container {
  public tile: HexTile;
  private size: number;
  private onSelect: (tile: HexTile) => void;

  constructor(tile: HexTile, size: number, onSelect: (tile: HexTile) => void) {
    super();

    this.tile = tile;
    this.size = size;
    this.onSelect = onSelect;

    this.eventMode = 'static';
    this.cursor = tile.discovered ? 'pointer' : 'default';

    this.draw();

    this.on('pointerover', () => this.setHover(true));
    this.on('pointerout', () => this.setHover(false));
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
    this.removeChildren();

    const points = this.getHexPoints();
    const terrainColor = getTerrainColor(this.tile.terrain);

    const base = new Graphics();
    base.poly(points);
    base.fill({
      color: terrainColor,
      alpha: this.tile.discovered ? 0.42 : 0.05,
    });
    base.stroke({
      width: this.tile.reachable || this.tile.current ? 2 : 1,
      color: this.getStrokeColor(),
      alpha: this.tile.discovered ? 0.65 : 0.1,
    });
    this.addChild(base);

    if (this.tile.reachable) {
      this.drawReachableOverlay(points);
    }

    if (this.tile.current) {
      this.drawCurrentOverlay();
    }

    if (this.tile.event !== 'none' && this.tile.discovered) {
      this.drawEventIcon();
    }

    if (!this.tile.discovered) {
      this.drawFog(points);
    }
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

  private drawEventIcon(): void {
    const icon = new Text({
      text: getEventIcon(this.tile.event),
      style: {
        fontSize: 26,
        fill: getEventColor(this.tile.event),
        fontWeight: 'bold',
      },
    });
    icon.anchor.set(0.5);
    this.addChild(icon);
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
