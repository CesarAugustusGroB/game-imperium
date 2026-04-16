import type { BattleState } from './battle-state';
import type { BattleUnit, BattleFaction, LieutenantOrder } from './battle-types';
import type { Point } from './hex';
import { hexToPixel, hexCorners } from './hex';
import { hexToCol } from './battle-zones';
import { CAPTURE_DURATION, SCREEN_SHAKE_DURATION, SCREEN_SHAKE_INTENSITY } from './battle-config';
import { gfxShadows, gfxCracks, gfxParticles, gfxHighRes } from './battle-settings';

export class BattleRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: BattleState;

  // Logical (CSS) dimensions — used for all drawing coordinates
  private w = 0;
  private h = 0;

  private bgImage: HTMLImageElement | null = null;
  // Per-faction, per-role sprite cache: key = "faction:role"
  private shields = new Map<string, HTMLCanvasElement>();
  private starImage: HTMLCanvasElement | null = null;

  private hoveredHex: { q: number; r: number } | null = null;
  showCoords = false;

  // FPS counter
  private fpsFrames = 0;
  private fpsLastTime = performance.now();
  private fpsDisplay = 0;

  // Cached grid background (static — redrawn only on resize)
  private gridCache: HTMLCanvasElement | null = null;
  private gridCacheDirty = true;

  // Cached grid origin (recomputed once per render)
  private cachedOrigin: Point = { x: 0, y: 0 };
  /** When true, the canvas victory overlay is suppressed (Preact overlay handles it). */
  suppressVictoryOverlay = false;

  /** Camera pan offset (pixels). Modified by WASD input. */
  cameraX = 0;
  cameraY = 0;

  /** Whether the current battle uses flat-top hexes (vertical orientation). */
  private get flatTop(): boolean { return !!this.state.config.vertical; }

  /** Wrapper: hex→pixel with automatic flat-top detection. */
  private hp(hex: { q: number; r: number }, size: number, origin: { x: number; y: number }): Point {
    return hexToPixel(hex, size, origin, this.flatTop);
  }

  /** Wrapper: hex corners with automatic flat-top detection. */
  private hc(center: { x: number; y: number }, size: number): Point[] {
    return hexCorners(center, size, this.flatTop);
  }

  constructor(canvas: HTMLCanvasElement, state: BattleState) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context for battle canvas');
    this.ctx = ctx;
    this.state = state;
    this.loadAssets();
  }

  setState(state: BattleState): void {
    this.state = state;
  }

  /** Reload all sprite assets (call after toggling gfxHighRes). */
  reloadSprites(): void {
    this.shields.clear();
    this.loadShield('/asset/spartan_round.png', (c) => { this.shields.set('blue:vanguard', c); });
    this.loadShield('/asset/spartan_gold_round.png', (c) => { this.shields.set('blue:reserve', c); });
    this.loadShield('/asset/athens_hoplite_round.png', (c) => { this.shields.set('blue:guard', c); });
    this.loadShield('/asset/persina_inmortal_round.png', (c) => { this.shields.set('red:vanguard', c); });
    this.loadShield('/asset/persina_inmortal_round.png', (c) => { this.shields.set('red:reserve', c); });
    this.loadShield('/asset/persina_inmortal_round.png', (c) => { this.shields.set('red:guard', c); });
    this.loadShield('/asset/commander_round.png', (c) => { this.starImage = c; });
  }

  setHoveredHex(hex: { q: number; r: number } | null): void {
    this.hoveredHex = hex;
  }

  private loadAssets(): void {
    const backgrounds = [
      '/textures/battleground.png',
      '/textures/battleground2.png',
      '/textures/Battleground3.png',
    ];
    const bgSrc = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    const bg = new Image();
    bg.onload = () => { this.bgImage = bg; };
    bg.src = bgSrc;

    // Blue team: Spartans
    this.loadShield('/asset/spartan_round.png', (c) => { this.shields.set('blue:vanguard', c); });
    this.loadShield('/asset/spartan_gold_round.png', (c) => { this.shields.set('blue:reserve', c); });
    this.loadShield('/asset/athens_hoplite_round.png', (c) => { this.shields.set('blue:guard', c); });
    // Red team: Persians
    this.loadShield('/asset/persina_inmortal_round.png', (c) => { this.shields.set('red:vanguard', c); });
    this.loadShield('/asset/persina_inmortal_round.png', (c) => { this.shields.set('red:reserve', c); });
    this.loadShield('/asset/persina_inmortal_round.png', (c) => { this.shields.set('red:guard', c); });
    // Star objective
    this.loadShield('/asset/commander_round.png', (c) => { this.starImage = c; });
  }

  /** Pre-render a sprite to an offscreen canvas at 2x display size for crisp rendering. */
  private loadShield(src: string, onReady: (canvas: HTMLCanvasElement) => void): void {
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      const cacheSize = Math.round(60 * dpr * (gfxHighRes.value ? 2 : 1));
      const offscreen = document.createElement('canvas');
      offscreen.width = cacheSize;
      offscreen.height = cacheSize;
      const octx = offscreen.getContext('2d')!;
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = 'high';
      // Fit the image into the square cache canvas preserving aspect ratio
      const aspect = img.width / img.height;
      let dw: number, dh: number, dx: number, dy: number;
      if (aspect > 1) {
        dw = cacheSize;
        dh = cacheSize / aspect;
        dx = 0;
        dy = (cacheSize - dh) / 2;
      } else {
        dh = cacheSize;
        dw = cacheSize * aspect;
        dx = (cacheSize - dw) / 2;
        dy = 0;
      }
      octx.drawImage(img, dx, dy, dw, dh);
      onReady(offscreen);
    };
    img.src = src;
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.w = width;
    this.h = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.gridCacheDirty = true;
  }

  render(): void {
    const { ctx } = this;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, this.w, this.h);

    // Cache grid origin once per frame (avoids recomputing per draw call)
    this.cachedOrigin = this.state.getGridOrigin(this.w, this.h);

    // Apply camera pan
    ctx.save();
    ctx.translate(this.cameraX, this.cameraY);

    if (this.state.screenShake > 0) {
      const intensity = this.state.screenShake * SCREEN_SHAKE_INTENSITY / SCREEN_SHAKE_DURATION;
      const sx = (Math.random() - 0.5) * intensity * 2;
      const sy = (Math.random() - 0.5) * intensity * 2;
      ctx.save();
      ctx.translate(sx, sy);
    }
    this.drawBackground();
    this.drawGridCached();
    this.drawTargetingHighlights();
    this.drawZones();
    this.drawStars();
    this.drawHoveredHex();
    this.drawMovementRange();
    this.drawSelectedHex();
    this.drawPaths();
    this.drawUnits();
    this.drawFloatingTexts();
    this.drawParticles();
    this.drawVictoryOverlay();
    this.drawPauseOverlay();
    this.drawOrderIndicator();
    this.drawVeteranIndicator();
    if (this.state.screenShake > 0) {
      ctx.restore();
    }

    // Restore camera pan
    ctx.restore();

    // FPS drawn outside camera transform so it stays fixed on screen
    this.drawFps();
  }

  // ── Layers ──

  private drawBackground(): void {
    const { ctx } = this;

    if (this.state.config.vertical) {
      // Vertical mode: plain dark background, grass hexes drawn in drawGrid
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, this.w, this.h);
      return;
    }

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.w, this.h);
    if (!this.bgImage) return;

    // Cover scaling
    const imgAspect = this.bgImage.width / this.bgImage.height;
    const canAspect = this.w / this.h;
    let dw: number, dh: number, dx: number, dy: number;
    if (canAspect > imgAspect) {
      dw = this.w;
      dh = this.w / imgAspect;
      dx = 0;
      dy = (this.h - dh) / 2;
    } else {
      dh = this.h;
      dw = this.h * imgAspect;
      dx = (this.w - dw) / 2;
      dy = 0;
    }
    ctx.drawImage(this.bgImage, dx, dy, dw, dh);

    // Slight darkening for grid visibility
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, this.w, this.h);
  }

  // Grid cache blit offset (set during cache build)
  private gridBlitX = 0;
  private gridBlitY = 0;

  /** Render the grid to an offscreen canvas once, then blit each frame. */
  private drawGridCached(): void {
    if (this.gridCacheDirty || !this.gridCache) {
      const dpr = window.devicePixelRatio || 1;
      const size = this.state.config.hexSize;
      const { cols, rows } = this.state.config;

      // Cache covers the full grid with padding for axis labels
      const cacheW = (cols + 3) * size * 2;
      const cacheH = (rows + 3) * size * 2;
      // Cache-local origin: keeps all hex coords positive inside the cache
      const cacheOrigin = { x: size * 2, y: size * 2 };
      // Blit offset: aligns cache with the real grid position on screen
      this.gridBlitX = this.cachedOrigin.x - cacheOrigin.x;
      this.gridBlitY = this.cachedOrigin.y - cacheOrigin.y;

      const cache = document.createElement('canvas');
      cache.width = Math.round(cacheW * dpr);
      cache.height = Math.round(cacheH * dpr);
      const cctx = cache.getContext('2d')!;
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const origin = cacheOrigin;
      const isVertical = !!this.state.config.vertical;

      cctx.strokeStyle = 'rgba(200, 180, 120, 0.3)';
      cctx.lineWidth = 1;

      for (const hex of this.state.gridHexes) {
        const center = this.hp(hex, size, origin);
        const corners = this.hc(center, size);

        if (isVertical) {
          const noise = ((hex.q * 7 + hex.r * 13) & 0xFF) / 255;
          const g = Math.floor(100 + noise * 30);
          const r = Math.floor(40 + noise * 15);
          cctx.beginPath();
          cctx.moveTo(corners[0].x, corners[0].y);
          for (let i = 1; i < corners.length; i++) cctx.lineTo(corners[i].x, corners[i].y);
          cctx.closePath();
          cctx.fillStyle = `rgb(${r}, ${g}, 45)`;
          cctx.fill();
          cctx.strokeStyle = 'rgba(30, 60, 20, 0.4)';
          cctx.lineWidth = 1;
          cctx.stroke();
        } else {
          cctx.beginPath();
          cctx.moveTo(corners[0].x, corners[0].y);
          for (let i = 1; i < corners.length; i++) cctx.lineTo(corners[i].x, corners[i].y);
          cctx.closePath();
          cctx.stroke();
        }
      }
      // Axis labels (Cartesian-plane style)
      if (isVertical) {
        const { cols, rows } = this.state.config;
        cctx.font = "bold 10px 'Segoe UI', system-ui, sans-serif";
        cctx.textAlign = 'center';
        cctx.textBaseline = 'middle';

        // X axis — column numbers along the top
        for (let col = 0; col < cols; col++) {
          const x = col * size * 2 + origin.x;
          const y = -1 * size * 2 + origin.y;
          cctx.fillStyle = 'rgba(200, 190, 160, 0.4)';
          cctx.fillText(`${col}`, x, y);
        }

        // Y axis — row numbers along the left
        cctx.textAlign = 'right';
        for (let row = 0; row < rows; row++) {
          const x = -1 * size * 2 + origin.x;
          const y = row * size * 2 + origin.y;
          cctx.fillStyle = 'rgba(200, 190, 160, 0.4)';
          cctx.fillText(`${row}`, x, y);
        }
      }

      this.gridCache = cache;
      this.gridCacheDirty = false;
    }

    // Blit cached grid at the correct offset
    const dpr = window.devicePixelRatio || 1;
    const cw = this.gridCache.width / dpr;
    const ch = this.gridCache.height / dpr;
    this.ctx.drawImage(this.gridCache, this.gridBlitX, this.gridBlitY, cw, ch);
  }

  /** Highlight valid target hexes when an ability is in targeting mode. */
  private drawTargetingHighlights(): void {
    if (!this.state.targetingAbility) return;

    const abilityId = this.state.targetingAbility;
    const origin = this.cachedOrigin;
    const size = this.state.config.hexSize;

    // Determine which hexes are valid based on ability type
    for (const hex of this.state.gridHexes) {
      const center = this.hp(hex, size, origin);
      const col = hexToCol(hex);
      const unitAtHex = this.state.getUnitAt(hex);

      if (abilityId === 'Buy Reinforcements') {
        // Valid: empty hexes in columns 0-3 (blue back area)
        if (!unitAtHex && col < 4) {
          this.fillHex(center, size, 'rgba(240, 208, 128, 0.15)');
          this.strokeHexStyled(center, size, 'rgba(240, 208, 128, 0.35)', 1.5);
        }
      } else if (abilityId === 'Miracle') {
        // Valid: any hex with a unit
        if (unitAtHex && !unitAtHex.isDying) {
          this.fillHex(center, size, 'rgba(240, 208, 128, 0.15)');
          this.strokeHexStyled(center, size, 'rgba(240, 208, 128, 0.35)', 1.5);
        }
      } else if (abilityId === 'Turncoat') {
        // Valid: hexes with enemy (red) units only
        if (unitAtHex && !unitAtHex.isDying && unitAtHex.faction === 'red') {
          this.fillHex(center, size, 'rgba(240, 208, 128, 0.15)');
          this.strokeHexStyled(center, size, 'rgba(240, 208, 128, 0.35)', 1.5);
        }
      }
    }
  }

  /** Tint hexes for the 3 zones per side: camp, reserve, center. */
  private drawZones(): void {
    if (this.state.config.victoryMode !== 'capture') return;
    if (this.state.config.vertical) return; // vertical mode has no visible zones
    const origin = this.cachedOrigin;
    const size = this.state.config.hexSize;
    const cols = this.state.config.cols;

    // Zone boundaries (offset columns)
    const campCols = Math.round(cols * 0.2);     // 4
    const reserveCols = Math.round(cols * 0.15);  // 3

    for (const hex of this.state.gridHexes) {
      const col = hexToCol(hex);
      const center = this.hp(hex, size, origin);

      // Blue side
      if (col < campCols) {
        this.fillHex(center, size, 'rgba(80, 140, 255, 0.25)');  // camp
      } else if (col < campCols + reserveCols) {
        this.fillHex(center, size, 'rgba(200, 180, 80, 0.18)');  // reserve
      }

      // Red side
      if (col >= cols - campCols) {
        this.fillHex(center, size, 'rgba(255, 80, 80, 0.25)');   // camp
      } else if (col >= cols - campCols - reserveCols) {
        this.fillHex(center, size, 'rgba(200, 180, 80, 0.18)');  // reserve
      }
    }

    // Draw zone boundary lines
    this.drawZoneLine(origin, size, campCols, 'rgba(80, 140, 255, 0.50)');
    this.drawZoneLine(origin, size, campCols + reserveCols, 'rgba(200, 180, 80, 0.40)');
    this.drawZoneLine(origin, size, cols - campCols, 'rgba(255, 80, 80, 0.50)');
    this.drawZoneLine(origin, size, cols - campCols - reserveCols, 'rgba(200, 180, 80, 0.40)');
  }

  /** Draw a straight vertical dashed line at a given offset column boundary. */
  private drawZoneLine(origin: Point, hexSize: number, col: number, color: string): void {
    const { ctx } = this;
    const rows = this.state.config.rows;
    const sqrt3 = Math.sqrt(3);

    // Compute x from the top row (row 0) hex center, then offset to left edge
    const topHex = { q: col, r: 0 }; // row 0: offset col == axial q
    const topPt = this.hp(topHex, hexSize, origin);
    const x = topPt.x - hexSize * sqrt3 / 2;

    // Compute y range from top and bottom row hex centers
    const botHex = { q: col - Math.floor((rows - 1) / 2), r: rows - 1 };
    const botPt = this.hp(botHex, hexSize, origin);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x, topPt.y - hexSize);
    ctx.lineTo(x, botPt.y + hexSize);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawStars(): void {
    if (this.state.config.victoryMode !== 'capture') return;
    const { ctx } = this;
    const origin = this.cachedOrigin;
    const size = this.state.config.hexSize;

    for (const faction of ['blue', 'red'] as BattleFaction[]) {
      const star = this.state.stars.get(faction);
      if (!star) continue;
      const center = this.hp(star, size, origin);
      const progress = this.state.captureProgress.get(faction) ?? 0;
      const captureRatio = Math.min(1, progress / CAPTURE_DURATION);

      // Hex highlight — faction tint, pulses when being captured
      const baseAlpha = 0.12 + captureRatio * 0.2;
      const pulseAlpha = captureRatio > 0
        ? baseAlpha + 0.1 * Math.sin(Date.now() / 150)
        : baseAlpha;
      const color = faction === 'blue' ? '80, 140, 255' : '255, 80, 80';
      this.fillHex(center, size, `rgba(${color}, ${pulseAlpha})`);
      this.strokeHexStyled(center, size, `rgba(${color}, ${0.4 + captureRatio * 0.4})`, 2);

      // Draw commander round image (or fallback star shape)
      ctx.save();
      ctx.translate(center.x, center.y);

      const glowColor = faction === 'blue' ? '#5588ff' : '#ff5555';
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10 + captureRatio * 10;

      const iconSize = size * 1.2;
      if (this.starImage) {
        ctx.drawImage(this.starImage, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
      } else {
        // Fallback procedural star if image hasn't loaded yet
        const starRadius = size * 0.45;
        const innerRadius = starRadius * 0.4;
        this.drawStarShape(ctx, starRadius, innerRadius, faction === 'blue' ? '#6699ff' : '#ff6666');
      }

      ctx.restore();

      // Capture progress arc
      if (captureRatio > 0) {
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.6, -Math.PI / 2, -Math.PI / 2 + captureRatio * Math.PI * 2);
        const enemyColor = faction === 'blue' ? '#ff4444' : '#4488ff';
        ctx.strokeStyle = enemyColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = enemyColor;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawStarShape(ctx: CanvasRenderingContext2D, outerR: number, innerR: number, fillColor: string): void {
    const spikes = 5;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / spikes - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private drawHoveredHex(): void {
    if (!this.hoveredHex) return;
    if (!this.state.isValidHex(this.hoveredHex)) return;
    // Don't highlight if it's the selected unit's hex
    const selected = this.state.getSelectedUnit();
    if (selected && selected.hex.q === this.hoveredHex.q && selected.hex.r === this.hoveredHex.r) return;

    const origin = this.cachedOrigin;
    const center = this.hp(this.hoveredHex, this.state.config.hexSize, origin);
    this.fillHex(center, this.state.config.hexSize, 'rgba(255, 255, 255, 0.08)');
  }

  private drawMovementRange(): void {
    const selected = this.state.getSelectedUnit();
    if (!selected) return;

    const origin = this.cachedOrigin;
    const size = this.state.config.hexSize;
    const range = this.state.getMovementRange(selected.hex);

    for (const hex of range) {
      const center = this.hp(hex, size, origin);
      this.fillHex(center, size, 'rgba(100, 200, 255, 0.18)');
      this.strokeHexStyled(center, size, 'rgba(100, 200, 255, 0.5)', 1.5);
    }
  }

  private drawSelectedHex(): void {
    const selected = this.state.getSelectedUnit();
    if (!selected) return;

    const origin = this.cachedOrigin;
    const center = this.hp(selected.hex, this.state.config.hexSize, origin);
    this.fillHex(center, this.state.config.hexSize, 'rgba(255, 215, 0, 0.2)');
    this.strokeHexStyled(center, this.state.config.hexSize, 'rgba(255, 215, 0, 0.7)', 2);
  }

  /** Draw dashed path lines for units that have a queued path. */
  private drawPaths(): void {
    const { ctx } = this;
    const origin = this.cachedOrigin;
    const size = this.state.config.hexSize;

    for (const unit of this.state.units.values()) {
      if (unit.path.length === 0) continue;

      ctx.save();
      ctx.strokeStyle = unit.faction === 'blue'
        ? 'rgba(100, 180, 255, 0.5)'
        : 'rgba(255, 100, 100, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);

      // Start from current hex
      const start = this.hp(unit.hex, size, origin);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);

      for (const pathHex of unit.path) {
        const pt = this.hp(pathHex, size, origin);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      // Target circle at final destination
      const last = unit.path[unit.path.length - 1];
      const target = this.hp(last, size, origin);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  private drawUnits(): void {
    const origin = this.cachedOrigin;
    const size = this.state.config.hexSize;

    for (const unit of this.state.units.values()) {
      const dest = this.hp(unit.hex, size, origin);

      // Interpolate position during movement animation
      let center: Point;
      if (unit.prevHex && unit.moveProgress < 1) {
        const src = this.hp(unit.prevHex, size, origin);
        // Smooth easing for all hops — easeInOut for mid-path, easeOut for final
        const t = unit.path.length > 0
          ? this.easeInOutCubic(unit.moveProgress)  // smooth continuous walk
          : this.easeOutCubic(unit.moveProgress);   // decelerate into final position
        center = {
          x: src.x + (dest.x - src.x) * t,
          y: src.y + (dest.y - src.y) * t,
        };
      } else {
        center = dest;
      }
      this.drawUnit(unit, center);

      // Veteran flames
      if (unit.faction === 'blue' && this.state.veteranBonus > 0) {
        const flames = Math.floor(this.state.veteranBonus / 0.10);
        if (flames > 0) {
          const { ctx } = this;
          ctx.save();
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          for (let f = 0; f < Math.min(flames, 5); f++) {
            ctx.fillText('🔥', center.x - 8 + f * 8, center.y - size * 0.6);
          }
          ctx.restore();
        }
      }
    }
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private drawUnit(unit: BattleUnit, center: Point): void {
    const { ctx } = this;
    const isSelected = unit.id === this.state.selectedUnitId;
    const shieldImg = this.shields.get(`${unit.faction}:${unit.role}`) ?? null;
    const iconSize = 60;

    // Compute damage ratio for cracks
    const damageRatio = 1 - Math.max(0, unit.currentHp) / unit.stats.hp;

    ctx.save();

    // Death fade: reduce global alpha during fade phase (deathProgress 0.33→1.0)
    if (unit.isDying && unit.deathProgress > 0.33) {
      const fadeT = (unit.deathProgress - 0.33) / 0.67; // 0→1
      ctx.globalAlpha = 1 - fadeT;
    }

    let sx = center.x, sy = center.y;

    // Lunge: unit rushes toward target hex then snaps back
    if (unit.lungeTarget && unit.lungeTimer > 0) {
      const origin = this.cachedOrigin;
      const targetPt = this.hp(unit.lungeTarget, this.state.config.hexSize, origin);
      // t goes 0→1 as timer counts down
      const t = 1 - unit.lungeTimer / 0.4;
      // Forward in first half (0→0.5), snap back in second half (0.5→1)
      const lungeFrac = t < 0.5
        ? t * 2                          // 0→1 (rush forward)
        : 1 - (t - 0.5) * 2;            // 1→0 (snap back)
      const lungeAmount = lungeFrac * 0.45; // travel 45% of distance to target
      sx += (targetPt.x - center.x) * lungeAmount;
      sy += (targetPt.y - center.y) * lungeAmount;
    }

    // Shake offset: rapid random jitter decaying over time
    if (unit.shakeTimer > 0) {
      const intensity = unit.shakeTimer * 8;
      sx += (Math.random() - 0.5) * intensity;
      sy += (Math.random() - 0.5) * intensity;
    }

    ctx.translate(sx, sy);

    // Shadows / glow
    if (isSelected) {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 12;
    } else if (gfxShadows.value) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
    }

    // Shield image or fallback circle
    if (shieldImg) {
      ctx.drawImage(shieldImg, -iconSize / 2, -iconSize / 2 - 4, iconSize, iconSize);
    } else {
      ctx.beginPath();
      ctx.arc(0, -4, iconSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = unit.faction === 'blue' ? '#3366aa' : '#aa3333';
      ctx.fill();
    }

    ctx.shadowColor = 'transparent';

    // Impact flash — red outer burst + white core
    if (unit.flashTimer > 0) {
      const t = unit.flashTimer / 0.35; // 1→0 as flash fades
      // Outer red glow — expands then fades
      const outerR = iconSize / 2 + (1 - t) * 6;
      ctx.fillStyle = `rgba(255, 60, 30, ${t * 0.35})`;
      ctx.beginPath();
      ctx.arc(0, -4, outerR, 0, Math.PI * 2);
      ctx.fill();
      // Inner white core — bright then fades fast
      ctx.fillStyle = `rgba(255, 255, 240, ${Math.pow(t, 2) * 0.7})`;
      ctx.beginPath();
      ctx.arc(0, -4, iconSize / 3 * t, 0, Math.PI * 2);
      ctx.fill();
    }

    // Damage cracks — accumulate with damage
    if (gfxCracks.value) {
      const crackRatio = unit.isDying
        ? Math.min(1, unit.deathProgress / 0.33)
        : damageRatio;
      if (crackRatio > 0.05) {
        this.drawCracks(unit.crackSeed, iconSize, crackRatio);
      }
    }

    // Selection ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(0, -4, iconSize / 2 + 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Role indicator dot — only for blue (player) units
    if (unit.faction === 'blue') {
      const roleColors: Record<string, string> = {
        vanguard: '#c24a3a',
        reserve:  '#4a7cc2',
        guard:    '#d4a843',
      };
      const dotColor = roleColors[unit.role] ?? '#888888';
      const dotY = iconSize / 2 - 4; // bottom of the unit hex
      ctx.shadowColor = 'transparent';
      ctx.beginPath();
      ctx.arc(0, dotY, 4, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Seeded PRNG — deterministic float in [0,1) from integer seed. */
  private seededRandom(seed: number): number {
    const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /** Draw cracks over the unit sprite — batched into 2 strokes (outer + inner). */
  private drawCracks(seed: number, iconSize: number, intensity: number): void {
    const { ctx } = this;
    const MAX_MAIN_CRACKS = 4; // reduced from 6
    const crackCount = Math.ceil(intensity * MAX_MAIN_CRACKS);
    const radius = iconSize / 2;

    ctx.save();
    ctx.translate(0, -4);
    ctx.lineCap = 'round';

    // Batch all cracks into two paths (outer dark, inner bright) — 2 strokes total
    const outerPath = new Path2D();
    const innerPath = new Path2D();

    for (let i = 0; i < crackCount; i++) {
      const rng = (offset: number) => this.seededRandom(seed + i * 3571 + offset);
      const baseAngle = (i / MAX_MAIN_CRACKS) * Math.PI * 2;
      const angle = baseAngle + (rng(0) - 0.5) * 0.8;
      const len = radius * (0.6 + rng(1) * 0.4) * Math.min(1, intensity * 1.4);
      const segments = 3 + Math.floor(rng(2) * 2); // 3-4 segments (reduced)

      let px = 0, py = 0;
      outerPath.moveTo(0, 0);
      innerPath.moveTo(0, 0);
      for (let s = 1; s <= segments; s++) {
        const t = s / segments;
        const drift = (rng(s * 17) - 0.5) * len * 0.18;
        px = Math.cos(angle) * len * t + Math.sin(angle) * drift;
        py = Math.sin(angle) * len * t - Math.cos(angle) * drift;
        outerPath.lineTo(px, py);
        innerPath.lineTo(px, py);
      }

      // Single branch per crack
      const branchIdx = Math.floor(segments * 0.5);
      const bt = branchIdx / segments;
      const bx = Math.cos(angle) * len * bt;
      const by = Math.sin(angle) * len * bt;
      const branchAngle = angle + (rng(50) - 0.5) * 1.8;
      const branchLen = len * 0.25;
      outerPath.moveTo(bx, by);
      innerPath.moveTo(bx, by);
      outerPath.lineTo(bx + Math.cos(branchAngle) * branchLen, by + Math.sin(branchAngle) * branchLen);
      innerPath.lineTo(bx + Math.cos(branchAngle) * branchLen, by + Math.sin(branchAngle) * branchLen);
    }

    ctx.strokeStyle = 'rgba(10, 5, 2, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.stroke(outerPath);

    ctx.strokeStyle = `rgba(160, 80, 30, ${0.3 + intensity * 0.4})`;
    ctx.lineWidth = 1;
    ctx.stroke(innerPath);

    ctx.restore();
  }

  private drawFloatingTexts(): void {
    const { ctx } = this;
    const origin = this.cachedOrigin;
    const size = this.state.config.hexSize;

    for (const ft of this.state.floatingTexts) {
      const center = this.hp(ft.hex, size, origin);
      const t = 1 - ft.timer / ft.duration; // 0→1 as text ages
      const offsetY = -30 - t * 40; // float upward
      const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3; // fade out last 30%

      ctx.save();
      ctx.translate(center.x, center.y + offsetY);
      ctx.font = "bold 16px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = alpha;
      // Outline
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, 0, 0);
      // Fill
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, 0, 0);
      ctx.restore();
    }
  }

  private drawParticles(): void {
    if (!gfxParticles.value || this.state.particles.length === 0) return;
    const { hexSize } = this.state.config;
    const origin = this.cachedOrigin;
    const { ctx } = this;

    // Group particles by color to minimize style changes
    for (const p of this.state.particles) {
      const center = this.hp(p.hex, hexSize, origin);
      const x = center.x + p.offsetX;
      const y = center.y + p.offsetY;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, p.size * (0.5 + 0.5 * alpha), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawVictoryOverlay(): void {
    if (this.suppressVictoryOverlay) return;
    if (window.location.hash === '#battleV2') return;
    const isDraw = this.state.phase === 'draw';
    const isVictory = this.state.phase === 'victory' && this.state.winner;
    if (!isDraw && !isVictory) return;

    const { ctx } = this;

    // Dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, this.w, this.h);

    const label = isDraw
      ? 'Draw!'
      : this.state.winner === 'blue' ? 'Blue Faction Wins!' : 'Red Faction Wins!';
    const color = isDraw
      ? '#ccaa44'
      : this.state.winner === 'blue' ? '#5588dd' : '#dd5555';

    // Banner background
    const bannerH = 100;
    const bannerY = (this.h - bannerH) / 2;
    ctx.fillStyle = 'rgba(10, 10, 30, 0.9)';
    ctx.fillRect(0, bannerY, this.w, bannerH);

    // Top/bottom gold lines
    ctx.strokeStyle = 'rgba(220, 190, 100, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, bannerY);
    ctx.lineTo(this.w, bannerY);
    ctx.moveTo(0, bannerY + bannerH);
    ctx.lineTo(this.w, bannerY + bannerH);
    ctx.stroke();

    // Victory text
    ctx.font = "bold 36px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillText(label, this.w / 2, bannerY + bannerH / 2 - 8);
    ctx.shadowColor = 'transparent';

    // Subtitle
    ctx.font = "14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = 'rgba(200, 190, 160, 0.6)';
    ctx.fillText(`Battle concluded in ${this.state.roundCount} rounds — press ESC to return`, this.w / 2, bannerY + bannerH / 2 + 22);
  }

  private drawPauseOverlay(): void {
    if (!this.state.paused) return;
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.font = "bold 48px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('PAUSED', this.w / 2, this.h / 2);
    ctx.font = "14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = 'rgba(200, 190, 160, 0.6)';
    ctx.fillText('Press SPACE to resume', this.w / 2, this.h / 2 + 32);
  }

  private drawFps(): void {
    this.fpsFrames++;
    const now = performance.now();
    if (now - this.fpsLastTime >= 1000) {
      this.fpsDisplay = this.fpsFrames;
      this.fpsFrames = 0;
      this.fpsLastTime = now;
    }
    const { ctx } = this;
    const unitCount = this.state.units.size;
    const label = `${this.fpsDisplay} FPS | ${unitCount} units`;
    ctx.save();
    ctx.font = "bold 13px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.w - 160, this.h - 32, 152, 24);
    ctx.fillStyle = this.fpsDisplay >= 50 ? '#44ff66' : this.fpsDisplay >= 30 ? '#ffdd44' : '#ff4444';
    ctx.fillText(label, this.w - 16, this.h - 10);
    ctx.restore();
  }

  private drawOrderIndicator(): void {
    if (this.state.phase !== 'fighting') return;
    const labels: Record<LieutenantOrder, { text: string; icon: string }> = {
      auto:     { text: 'AUTO',     icon: '\u2699' },
      attack:   { text: 'ATTACK',   icon: '\u2694' },
      defend:   { text: 'DEFEND',   icon: '\uD83D\uDEE1' },
      skirmish: { text: 'SKIRMISH', icon: '\u21C4' },
      mobile:   { text: 'MOBILE',   icon: '\u27A5' },
    };
    const info = labels[this.state.lieutenantOrder];
    const { ctx } = this;
    ctx.save();
    ctx.font = "bold 14px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(200, 180, 140, 0.7)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(`${info.icon} ${info.text}`, 12, 12);
    ctx.shadowColor = 'transparent';
    ctx.font = "11px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = 'rgba(180, 170, 150, 0.4)';
    ctx.fillText('0-Auto  1-Attack  2-Defend  3-Skirmish  4-Mobile', 12, 30);
    ctx.restore();
  }

  private drawVeteranIndicator(): void {
    if (this.state.phase !== 'fighting') return;
    if (this.state.veteranBonus <= 0) return;
    const stacks = Math.round(this.state.veteranBonus / 0.05);
    const pct = Math.round(this.state.veteranBonus * 100);
    const { ctx } = this;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    // Flame icon + stack count — larger with orange glow shadow
    ctx.font = "bold 16px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = '#ff6b35';
    ctx.shadowColor = 'rgba(255, 100, 0, 0.7)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillText(`\uD83D\uDD25 ${stacks}`, 12, this.h - 58);
    ctx.shadowColor = 'transparent';
    // Bonus DMG text
    ctx.font = "bold 12px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = 'rgba(255, 160, 80, 0.75)';
    ctx.shadowColor = 'rgba(255, 100, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.fillText(`+${pct}% DMG`, 12, this.h - 40);
    ctx.shadowColor = 'transparent';
    ctx.restore();
  }

  // ── Hex drawing helpers ──

  private strokeHex(center: Point, size: number): void {
    const { ctx } = this;
    const corners = this.hc(center, size);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.stroke();
  }

  private strokeHexStyled(center: Point, size: number, style: string, lineWidth: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = style;
    ctx.lineWidth = lineWidth;
    this.strokeHex(center, size);
    ctx.restore();
  }

  private fillHex(center: Point, size: number, style: string): void {
    const { ctx } = this;
    const corners = this.hc(center, size);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.fillStyle = style;
    ctx.fill();
  }

  destroy(): void {
    this.shields.clear();
    this.bgImage = null;
    this.starImage = null;
  }
}
