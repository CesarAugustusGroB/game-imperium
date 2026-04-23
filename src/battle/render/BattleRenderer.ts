import type { BattleState } from '../battle-state';
import type { Layer } from './Layer';
import { Camera } from './Camera';
import { SpriteManager } from './SpriteManager';
import type { RenderContext } from './RenderContext';
import { createRenderContext, updateRenderContext } from './RenderContext';
import { spriteReloadTrigger } from '../battle-settings';

import { BackgroundLayer }    from './layers/BackgroundLayer';
import { GridLayer }          from './layers/GridLayer';
import { TargetingLayer }     from './layers/TargetingLayer';
import { ZoneLayer }          from './layers/ZoneLayer';
import { StarLayer }          from './layers/StarLayer';
import { HoverLayer }         from './layers/HoverLayer';
import { PathLayer }          from './layers/PathLayer';
import { UnitLayer }          from './layers/UnitLayer';
import { ProjectileLayer }    from './layers/ProjectileLayer';
import { FloatingTextLayer }  from './layers/FloatingTextLayer';
import { ParticleLayer }      from './layers/ParticleLayer';
import { OverlayLayer }       from './layers/OverlayLayer';
import { IndicatorsLayer }    from './layers/IndicatorsLayer';
import { FpsLayer }           from './layers/FpsLayer';

/**
 * Battle renderer orchestrator.
 *
 * Maintains the layer stack and drives the render loop.  Public API is
 * intentionally identical to the old monolithic BattleRenderer so all
 * callers (BattleMode, BattleInput, battle-signals) need zero changes.
 */
export class BattleRenderer {
  private canvas:   HTMLCanvasElement;
  private ctx:      CanvasRenderingContext2D;
  private state:    BattleState;

  /** CSS (logical) canvas dimensions — used for all drawing coordinates. */
  private w = 0;
  private h = 0;

  /** Camera pan offset — exposed as `cameraX` / `cameraY` for BattleInput. */
  readonly camera: Camera;

  private sprites:  SpriteManager;
  private layers:   Layer[];

  private hoveredHex: { q: number; r: number } | null = null;
  private lastSpriteReload = 0;

  /** EMA per-layer cost in ms (key = layer.name). Read by FpsLayer. */
  private perfStats = new Map<string, number>();
  /** EMA total frame render cost in ms. */
  private frameMsEma = 0;
  /** EMA smoothing factor — lower = smoother but laggier. */
  private static readonly PERF_EMA_ALPHA = 0.1;

  /** Reused per-frame RenderContext — mutated in place to avoid allocations. */
  private rc: RenderContext = createRenderContext();

  /** Toggle hex coordinate labels (mutated by BattleMode). */
  showCoords = false;

  /** When true the victory/draw overlay is not rendered. */
  suppressVictoryOverlay = false;

  constructor(canvas: HTMLCanvasElement, state: BattleState) {
    this.canvas = canvas;
    const ctx   = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context for battle canvas');
    this.ctx    = ctx;
    this.state  = state;

    this.camera  = new Camera();
    this.sprites = new SpriteManager();

    this.layers = [
      new BackgroundLayer(),
      new GridLayer(),
      new TargetingLayer(),
      new ZoneLayer(),
      new StarLayer(),
      new HoverLayer(),
      new PathLayer(),
      new UnitLayer(),
      new ProjectileLayer(),
      new FloatingTextLayer(),
      new ParticleLayer(),
      new OverlayLayer(),
      new IndicatorsLayer(),
      new FpsLayer(),
    ];
  }

  // ── Public API (unchanged from the old BattleRenderer) ──

  setState(state: BattleState): void {
    this.state = state;
    // New battle may have a different grid size — mark every stateful layer dirty.
    for (const layer of this.layers) {
      const l = layer as { resize?: (w: number, h: number) => void };
      if (typeof l.resize === 'function') l.resize(this.w, this.h);
    }
  }

  setHoveredHex(hex: { q: number; r: number } | null): void {
    this.hoveredHex = hex;
  }

  /** Camera X offset (read by BattleInput for WASD pan). */
  get cameraX(): number { return this.camera.x; }
  set cameraX(v: number) { this.camera.x = v; }

  /** Camera Y offset (read by BattleInput for WASD pan). */
  get cameraY(): number { return this.camera.y; }
  set cameraY(v: number) { this.camera.y = v; }

  resize(width: number, height: number): void {
    const dpr      = window.devicePixelRatio || 1;
    this.w         = width;
    this.h         = height;
    this.canvas.width  = Math.round(width  * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width  = width  + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // imageSmoothing is part of the persistent drawing state — setting it
    // once after setTransform is enough; no layer toggles it without a save/
    // restore pair, so it stays in effect until the next resize.
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // Notify layers that support resize (e.g. GridLayer marks cache dirty)
    for (const layer of this.layers) {
      if ('resize' in layer && typeof (layer as { resize?: unknown }).resize === 'function') {
        (layer as { resize: (w: number, h: number) => void }).resize(width, height);
      }
    }
  }

  /** Force all sprite caches to be cleared and reloaded. */
  reloadSprites(): void {
    this.sprites.reloadSprites();
  }

  render(): void {
    // Auto-reload sprites when gfxHighRes is toggled (the settings UI bumps
    // `spriteReloadTrigger`, which we poll here).
    if (spriteReloadTrigger.value !== this.lastSpriteReload) {
      this.lastSpriteReload = spriteReloadTrigger.value;
      this.sprites.reloadSprites();
    }

    const { ctx } = this;
    ctx.clearRect(0, 0, this.w, this.h);

    const frameStart = performance.now();
    updateRenderContext(
      this.rc,
      ctx,
      this.state,
      this.w,
      this.h,
      this.sprites,
      this.hoveredHex,
      this.showCoords,
      this.suppressVictoryOverlay,
      frameStart,
    );
    const rc = this.rc;
    rc.perfStats = this.perfStats;
    rc.frameMs   = this.frameMsEma;

    const alpha = BattleRenderer.PERF_EMA_ALPHA;

    // ── World-space layers (translated by camera, optional screen shake) ──
    const restoreCamera = this.camera.begin(ctx, this.state.screenShake);
    for (const layer of this.layers) {
      if (layer.fixed) continue;
      if (layer.enabled && layer.enabled(rc) === false) {
        // Layer was skipped this frame — decay its recorded cost toward zero
        // so the HUD doesn't show stale ms for disabled layers.
        const prev = this.perfStats.get(layer.name) ?? 0;
        if (prev > 0.001) this.perfStats.set(layer.name, prev * (1 - alpha));
        continue;
      }
      const t0 = performance.now();
      layer.render(rc);
      const dt = performance.now() - t0;
      const prev = this.perfStats.get(layer.name) ?? dt;
      this.perfStats.set(layer.name, prev + (dt - prev) * alpha);
    }
    restoreCamera();

    // ── Screen-space / HUD layers (drawn outside camera transform) ──
    for (const layer of this.layers) {
      if (!layer.fixed) continue;
      if (layer.enabled && layer.enabled(rc) === false) {
        const prev = this.perfStats.get(layer.name) ?? 0;
        if (prev > 0.001) this.perfStats.set(layer.name, prev * (1 - alpha));
        continue;
      }
      // Skip self-timing the FPS/HUD layer: its cost would be measuring itself.
      if (layer.name === 'fps') {
        layer.render(rc);
        continue;
      }
      const t0 = performance.now();
      layer.render(rc);
      const dt = performance.now() - t0;
      const prev = this.perfStats.get(layer.name) ?? dt;
      this.perfStats.set(layer.name, prev + (dt - prev) * alpha);
    }

    const frameMs = performance.now() - frameStart;
    this.frameMsEma = this.frameMsEma === 0
      ? frameMs
      : this.frameMsEma + (frameMs - this.frameMsEma) * alpha;
  }

  destroy(): void {
    this.sprites.shields.clear();
  }
}
