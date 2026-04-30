// S31-09: per-tile particle + halo effects for danger / important hexes.
// Pure helpers — given a Pixi container + ticker, register effects and return
// a cleanup function. Callers (HexTileView) call cleanup before re-drawing
// and on destroy so ticker callbacks don't leak.

import { Container, Graphics, Ticker } from 'pixi.js';

// Module-level cap shared across all emitters. AC: "cap total emitters at
// 20 active particles; degrade to halo-only above that." Counter increments
// when a particle is spawned, decrements when it dies.
const MAX_ACTIVE_PARTICLES = 20;
let activeParticleCount = 0;

const EMIT_INTERVAL_MS = 500; // ~2 particles/sec
const PARTICLE_LIFETIME_MS = 1500;
const PARTICLE_RISE_PX = 32;

type Particle = {
  graphic: Graphics;
  born: number;
};

/**
 * Slow ember emitter — meant for battle / ambush / elite hexes. Particles
 * drift upward and fade. Stops emitting silently when the global particle
 * count is at cap; existing particles continue to age and die.
 */
export function createDangerEmitter(
  parent: Container,
  color: number,
  ticker: Ticker,
): () => void {
  const particles: Particle[] = [];
  let lastEmitMs = 0;
  let elapsedMs = 0;

  const callback = (): void => {
    elapsedMs += ticker.deltaMS;

    if (elapsedMs - lastEmitMs >= EMIT_INTERVAL_MS && activeParticleCount < MAX_ACTIVE_PARTICLES) {
      lastEmitMs = elapsedMs;
      const graphic = new Graphics();
      graphic.circle(0, 0, 2);
      graphic.fill({ color });
      // Spread emitter origin slightly so embers don't all stack on one column.
      graphic.x = (Math.random() - 0.5) * 12;
      graphic.y = 0;
      parent.addChild(graphic);
      particles.push({ graphic, born: elapsedMs });
      activeParticleCount += 1;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const age = elapsedMs - p.born;
      if (age >= PARTICLE_LIFETIME_MS) {
        parent.removeChild(p.graphic);
        p.graphic.destroy();
        particles.splice(i, 1);
        activeParticleCount = Math.max(0, activeParticleCount - 1);
        continue;
      }
      const t = age / PARTICLE_LIFETIME_MS;
      p.graphic.y = -t * PARTICLE_RISE_PX;
      p.graphic.alpha = 1 - t;
    }
  };

  ticker.add(callback);

  return () => {
    ticker.remove(callback);
    for (const p of particles) {
      parent.removeChild(p.graphic);
      p.graphic.destroy();
      activeParticleCount = Math.max(0, activeParticleCount - 1);
    }
    particles.length = 0;
  };
}

/**
 * Soft pulsing halo — meant for merchant / supply / rest hexes. Single
 * circle Graphics with alpha riding a sin wave (0.2 → 0.5).
 */
export function createGlowHalo(
  parent: Container,
  color: number,
  ticker: Ticker,
  radius: number = 28,
): () => void {
  const halo = new Graphics();
  halo.circle(0, 0, radius);
  halo.fill({ color, alpha: 0.35 });
  parent.addChild(halo);

  let phase = 0;
  const callback = (): void => {
    phase += ticker.deltaMS / 1000; // seconds
    halo.alpha = 0.35 + Math.sin(phase * 2) * 0.15;
  };
  ticker.add(callback);

  return () => {
    ticker.remove(callback);
    parent.removeChild(halo);
    halo.destroy();
  };
}

/** Test-only — exported for verify scripts to inspect cap behavior. */
export function __getActiveParticleCount(): number {
  return activeParticleCount;
}
