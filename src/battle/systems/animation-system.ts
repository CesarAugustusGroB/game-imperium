/**
 * animation-system — per-frame tick of every animation timer and particle.
 *
 * Called once per update from `BattleEngine.updateAnimations(dt)`. Drives:
 *  - Unit movement interpolation + path advancement
 *  - Combat effect timers (lunge, shake, flash)
 *  - Action cooldowns
 *  - Death progress (and removal on completion, with pin unwinding)
 *  - Floating text lifetime
 *  - Particles (position, velocity, gravity, lifetime)
 *  - Screen shake decay
 *  - Capture progress (delegates to combat-system)
 */

import type { BattleWorld } from '../core/BattleWorld';
import {
  DEATH_DURATION, MOVE_ANIM_SPEED, PARTICLE_GRAVITY,
} from '../battle-config';
import { getUnitAt } from './unit-system';
import { resolveProjectileImpact, updateCapture } from './combat-system';

export function updateAnimations(world: BattleWorld, dt: number): void {
  const toRemove: number[] = [];

  for (const unit of world.units.values()) {
    // Movement animation
    if (unit.moveProgress < 1) {
      unit.moveProgress = Math.min(1, unit.moveProgress + MOVE_ANIM_SPEED * dt);
      if (unit.moveProgress >= 1) {
        unit.prevHex = null;
        if (unit.path.length > 0) {
          const next = unit.path.shift()!;
          if (!getUnitAt(world, next)) {
            unit.prevHex = { q: unit.hex.q, r: unit.hex.r };
            unit.hex = { q: next.q, r: next.r };
            unit.moveProgress = 0;
          } else {
            unit.path = [];
          }
        }
      }
    }

    // Combat effect timers
    if (unit.lungeTimer > 0) {
      unit.lungeTimer = Math.max(0, unit.lungeTimer - dt);
      if (unit.lungeTimer <= 0) unit.lungeTarget = null;
    }
    if (unit.shakeTimer > 0) unit.shakeTimer = Math.max(0, unit.shakeTimer - dt);
    if (unit.flashTimer > 0) unit.flashTimer = Math.max(0, unit.flashTimer - dt);

    // Action cooldown
    if (unit.actionCooldown > 0) unit.actionCooldown = Math.max(0, unit.actionCooldown - dt);

    // Death animation
    if (unit.isDying) {
      unit.deathProgress = Math.min(1, unit.deathProgress + dt / DEATH_DURATION);
      if (unit.deathProgress >= 1) toRemove.push(unit.id);
    }
  }

  // Remove finished-dying units and unpin anyone they were pinning
  for (const id of toRemove) {
    world.units.delete(id);
    for (const unit of world.units.values()) {
      if (unit.pinnedBy === id) unit.pinnedBy = null;
    }
  }

  // Floating text countdown
  for (let i = world.floatingTexts.length - 1; i >= 0; i--) {
    world.floatingTexts[i].timer -= dt;
    if (world.floatingTexts[i].timer <= 0) world.floatingTexts.splice(i, 1);
  }

  // Particles
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i];
    p.offsetX += p.vx * dt;
    p.offsetY += p.vy * dt;
    p.vy += PARTICLE_GRAVITY * dt;
    p.life -= dt;
    if (p.life <= 0) world.particles.splice(i, 1);
  }

  // Projectiles — advance elapsed and resolve on landing.
  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const p = world.projectiles[i];
    p.elapsed += dt;
    if (p.elapsed >= p.duration) {
      resolveProjectileImpact(world, p);
      world.projectiles.splice(i, 1);
    }
  }

  // Screen shake
  if (world.screenShake > 0) world.screenShake = Math.max(0, world.screenShake - dt);

  updateCapture(world, dt);
}
