/**
 * combat-system — strike resolution, death handling, victory checks, and
 * capture-the-star ticks.
 */

import type { BattleWorld } from '../core/BattleWorld';
import type { Hex } from '../hex';
import { hexDistance, offsetToAxial, offsetToAxialFlatTop } from '../hex';
import type { BattleFaction, BattleUnit, Projectile } from '../battle-types';
import {
  CAPTURE_DURATION, DODGE_AGI_FACTOR, DODGE_MAX, DOUBLE_STRIKE_RATIO,
  FLASH_DURATION, LUNGE_DURATION, MORALE_BREAK_THRESHOLD,
  SCREEN_SHAKE_DURATION, SHAKE_DURATION, HIT_PARTICLE_COUNT, DEATH_PARTICLE_COUNT,
} from '../battle-config';
import { playSfx } from '../../ui/sound/sfx';
import {
  getBattleFactionStrength, getBattleFactionUnits, getUnitAt, spawnParticles,
} from './unit-system';

const FLOAT_TEXT_DURATION = 0.8;

function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

// ── Strike resolution ──

/** Resolve a combat exchange: attacker lunges, strikes (maybe double), checks death. */
export function resolveCombat(
  world: BattleWorld,
  attacker: BattleUnit,
  defender: BattleUnit,
): void {
  // Mark both units as engaged (greedy AI trigger)
  attacker.hasEngaged = true;
  defender.hasEngaged = true;

  // Pin the defender — can't move until attacker is dead
  if (defender.pinnedBy === null) {
    defender.pinnedBy = attacker.id;
  }

  // Lunge animation
  attacker.lungeTarget = { q: defender.hex.q, r: defender.hex.r };
  attacker.lungeTimer = LUNGE_DURATION;

  performStrike(world, attacker, defender);

  // Double-strike when attacker's AGI advantage is large enough
  if (attacker.stats.agi >= defender.stats.agi * DOUBLE_STRIKE_RATIO && !defender.isDying) {
    world.floatingTexts.push({
      text: 'CRIT!!', hex: { q: attacker.hex.q, r: attacker.hex.r },
      color: '#ffdd00', timer: FLOAT_TEXT_DURATION, duration: FLOAT_TEXT_DURATION,
    });
    playSfx('crit');
    performStrike(world, attacker, defender);
  }
}

export function performStrike(world: BattleWorld, attacker: BattleUnit, defender: BattleUnit): void {
  // Dodge check
  const dodgeChance = Math.min(DODGE_MAX, Math.max(0,
    (defender.stats.agi - attacker.stats.agi) * DODGE_AGI_FACTOR,
  ));
  if (Math.random() * 100 < dodgeChance) {
    defender.shakeTimer = SHAKE_DURATION * 0.3;
    world.floatingTexts.push({
      text: 'DODGE!', hex: { q: defender.hex.q, r: defender.hex.r },
      color: '#44ddff', timer: FLOAT_TEXT_DURATION, duration: FLOAT_TEXT_DURATION,
    });
    playSfx('dodge');
    return;
  }

  // Damage roll × ATK − DEF, minimum 1
  const roll = rollD6();
  let damage = Math.max(1, roll * attacker.stats.atk - defender.stats.def);
  // Boudicca veteran bonus on blue units
  if (attacker.faction === 'blue' && world.veteranBonus > 0) {
    damage = Math.floor(damage * (1 + world.veteranBonus));
  }
  defender.currentHp -= damage;

  // Hit animations
  attacker.shakeTimer = SHAKE_DURATION;
  attacker.flashTimer = FLASH_DURATION;
  defender.shakeTimer = SHAKE_DURATION;
  defender.flashTimer = FLASH_DURATION;
  playSfx('hit');
  spawnParticles(world, defender.hex, HIT_PARTICLE_COUNT, '#ffaa44', Math.PI * 2, 30, 0.5);

  applyDeathCheck(world, defender);
}

// ── Ranged combat ──

const FLIGHT_SECONDS_PER_HEX = 0.12;

/**
 * Spawn an in-flight arrow from `attacker` aimed at `defender`. Snapshots
 * attacker stats so impact still resolves if the archer dies mid-flight.
 * Triggers a brief draw-back lunge in the opposite direction (visual bow-pull).
 */
export function fireProjectile(
  world: BattleWorld,
  attacker: BattleUnit,
  defender: BattleUnit,
): void {
  const dist = hexDistance(attacker.hex, defender.hex);
  const duration = dist * FLIGHT_SECONDS_PER_HEX;

  const projectile: Projectile = {
    id: world.nextProjectileId++,
    ownerId: attacker.id,
    targetId: defender.id,
    fromHex: { q: attacker.hex.q, r: attacker.hex.r },
    toHex: { q: defender.hex.q, r: defender.hex.r },
    elapsed: 0,
    duration,
    kind: 'arrow',
    atkSnapshot: attacker.stats.atk,
    agiSnapshot: attacker.stats.agi,
  };
  world.projectiles.push(projectile);

  // Backward lunge — pulls toward the hex opposite the target (visual bow-draw).
  const dq = attacker.hex.q - defender.hex.q;
  const dr = attacker.hex.r - defender.hex.r;
  const mag = Math.max(1, Math.abs(dq) + Math.abs(dr));
  attacker.lungeTarget = {
    q: attacker.hex.q + Math.round(dq / mag),
    r: attacker.hex.r + Math.round(dr / mag),
  };
  attacker.lungeTimer = 0.15;

  if (attacker.ranged) {
    attacker.actionCooldown = attacker.ranged.cooldown;
  }
  attacker.hasEngaged = true;
}

/**
 * Resolve the impact of a projectile on its target. Reuses `performStrike` so
 * hit flash, dodge, damage, and death all come for free.
 */
export function resolveProjectileImpact(world: BattleWorld, projectile: Projectile): void {
  const target = world.units.get(projectile.targetId);
  if (!target || target.isDying) return;

  // Build a minimal stat proxy for the (possibly dead) attacker.
  const fakeAttacker: BattleUnit = {
    ...(world.units.get(projectile.ownerId) ?? {
      id: projectile.ownerId,
      faction: target.faction === 'blue' ? 'red' : 'blue',
      role: 'vanguard' as const,
      hex: projectile.fromHex,
      stats: { atk: projectile.atkSnapshot, def: 0, hp: 1, agi: projectile.agiSnapshot },
      currentHp: 1,
      name: '',
      prevHex: null, moveProgress: 1, path: [],
      shakeTimer: 0, flashTimer: 0,
      lungeTarget: null, lungeTimer: 0,
      isDying: false, deathProgress: 0,
      pinnedBy: null, actionCooldown: 0,
      crackSeed: 0, reviveThreshold: 0,
      hasRevived: false, hasEngaged: false,
      movementProfile: 'vanguard-march' as const,
    }),
    // Always use snapshot stats so an archer death doesn't void shots in flight.
    stats: { atk: projectile.atkSnapshot, def: 0, hp: 1, agi: projectile.agiSnapshot },
  } as BattleUnit;

  performStrike(world, fakeAttacker, target);
}

/** Process a unit's death with priority: prevent-death → revive → actual death. */
export function applyDeathCheck(world: BattleWorld, unit: BattleUnit): void {
  if (unit.currentHp > 0) return;

  // Priority 1: prevent-death (Decretum Oracle) — blue units survive at 1 HP
  if (world.preventDeathCount > 0 && unit.faction === 'blue') {
    world.preventDeathCount--;
    unit.currentHp = 1;
    unit.flashTimer = FLASH_DURATION;
    world.floatingTexts.push({
      text: 'SAVED!', hex: { q: unit.hex.q, r: unit.hex.r },
      color: '#ffd700', timer: FLOAT_TEXT_DURATION, duration: FLOAT_TEXT_DURATION,
    });
    return;
  }
  // Priority 2: revive (Doctrine Pantheon)
  if (!unit.hasRevived && unit.reviveThreshold > 0) {
    unit.currentHp = Math.max(1, Math.floor(unit.stats.hp * unit.reviveThreshold / 100));
    unit.hasRevived = true;
    unit.flashTimer = FLASH_DURATION;
    world.floatingTexts.push({
      text: 'REVIVED!', hex: { q: unit.hex.q, r: unit.hex.r },
      color: '#44ff88', timer: FLOAT_TEXT_DURATION, duration: FLOAT_TEXT_DURATION,
    });
    return;
  }
  // Priority 3: actual death
  unit.currentHp = 0;
  unit.isDying = true;
  unit.deathProgress = 0;
  if (world.selectedUnitId === unit.id) world.selectedUnitId = null;
  spawnParticles(world, unit.hex, DEATH_PARTICLE_COUNT,
    unit.faction === 'blue' ? '#5588dd' : '#dd5555', Math.PI * 2, 60, 1.2);
  world.screenShake = SCREEN_SHAKE_DURATION;
  playSfx('death');
}

// ── Victory ──

/** Dispatch to the appropriate victory check based on config.victoryMode. */
export function checkVictory(world: BattleWorld): void {
  switch (world.config.victoryMode) {
    case 'capture':      checkCapture(world); break;
    case 'annihilation': checkAnnihilation(world); break;
    case 'morale':       checkMorale(world); break;
  }
}

function checkAnnihilation(world: BattleWorld): void {
  for (const faction of ['blue', 'red'] as BattleFaction[]) {
    const alive = getBattleFactionUnits(world, faction);
    if (alive.length === 0) {
      world.phase = 'victory';
      world.winner = faction === 'blue' ? 'red' : 'blue';
      return;
    }
  }
}

function checkCapture(world: BattleWorld): void {
  // Annihilation also ends capture mode
  for (const faction of ['blue', 'red'] as BattleFaction[]) {
    if (getBattleFactionUnits(world, faction).length === 0) {
      world.phase = 'victory';
      world.winner = faction === 'blue' ? 'red' : 'blue';
      return;
    }
  }
  // Star fully captured?
  for (const faction of ['blue', 'red'] as BattleFaction[]) {
    if ((world.captureProgress.get(faction) ?? 0) >= CAPTURE_DURATION) {
      world.phase = 'victory';
      world.winner = faction === 'blue' ? 'red' : 'blue';
      return;
    }
  }
  // Round timeout
  if (world.roundCount > 200) {
    world.phase = 'draw';
    world.winner = null;
    return;
  }
  // Draw: both sides only have Guards left
  const blueUnits = getBattleFactionUnits(world, 'blue');
  const redUnits = getBattleFactionUnits(world, 'red');
  const blueOnlyGuards = blueUnits.length > 0 && blueUnits.every(u => u.role === 'guard');
  const redOnlyGuards = redUnits.length > 0 && redUnits.every(u => u.role === 'guard');
  if (blueOnlyGuards && redOnlyGuards) {
    world.phase = 'draw';
  }
}

function checkMorale(world: BattleWorld): void {
  for (const faction of ['blue', 'red'] as BattleFaction[]) {
    const current = getBattleFactionStrength(world, faction);
    const starting = world.startingStrength.get(faction) ?? 1;
    if (current <= 0 || current / starting < MORALE_BREAK_THRESHOLD) {
      world.phase = 'victory';
      world.winner = faction === 'blue' ? 'red' : 'blue';
      return;
    }
  }
}

/** Tick capture progress — called each frame from animation-system. */
export function updateCapture(world: BattleWorld, dt: number): void {
  if (world.config.victoryMode !== 'capture') return;
  for (const faction of ['blue', 'red'] as BattleFaction[]) {
    const star = world.stars.get(faction);
    if (!star) continue;
    const occupant = getUnitAt(world, star);
    if (occupant && occupant.faction !== faction) {
      world.captureProgress.set(faction, (world.captureProgress.get(faction) ?? 0) + dt);
    } else {
      world.captureProgress.set(faction, 0);
    }
  }
}

// ── Stars + starting strength ──

/** The enemy faction's star (the one this faction wants to capture). */
export function getEnemyStar(world: BattleWorld, faction: BattleFaction): Hex | null {
  const enemy: BattleFaction = faction === 'blue' ? 'red' : 'blue';
  return world.stars.get(enemy) ?? null;
}

/** Record starting strengths and place capture stars at each faction's back. */
export function placeStarsAndStrength(world: BattleWorld): void {
  world.startingStrength.set('blue', getBattleFactionStrength(world, 'blue'));
  world.startingStrength.set('red', getBattleFactionStrength(world, 'red'));

  if (world.config.vertical) {
    const midCol = Math.floor(world.config.cols / 2);
    world.stars.set('blue', offsetToAxialFlatTop(midCol, world.config.rows - 1));
    world.stars.set('red', offsetToAxialFlatTop(midCol, 0));
  } else {
    const midRow = Math.floor(world.config.rows / 2);
    world.stars.set('blue', offsetToAxial(0, midRow));
    world.stars.set('red', offsetToAxial(world.config.cols - 1, midRow));
  }
  world.captureProgress.set('blue', 0);
  world.captureProgress.set('red', 0);
}
