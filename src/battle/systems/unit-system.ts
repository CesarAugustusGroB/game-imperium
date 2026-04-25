/**
 * unit-system — unit lifecycle (spawn, move, query) + player UI state.
 *
 * All functions take `BattleWorld` as first arg. Mutations stay inside the
 * world; the system has no state of its own.
 */

import type { BattleWorld, Particle } from '../core/BattleWorld';
import type { Hex } from '../hex';
import { hexDistance, hexNeighbors } from '../hex';
import type {
  BattleFaction, BattleUnit, LieutenantOrder, MovementProfileId, UnitRole,
  UnitStats,
} from '../battle-types';
import { ACTION_COOLDOWN, ACTION_JITTER, MOVE_RANGE, ROLE_STATS } from '../battle-config';
import { findPath, isValidHex } from './grid-system';

// ── Spawning ──

/** Role → default movement profile. Used when a unit is spawned without
 *  an explicit `movementProfile` (legacy reinforcement call-sites). */
function defaultProfileForRole(role: UnitRole): MovementProfileId {
  switch (role) {
    case 'vanguard': return 'vanguard-march';
    case 'reserve':  return 'reserve-intercept';
    case 'guard':    return 'guard-stand';
  }
}

/**
 * Sets the `ranged` field on a unit when its movement profile indicates ranged
 * combat. Centralises defaults so any future ranged soldier added to a cohort
 * catalog automatically picks up the correct weapon stats.
 */
function applyRangedProfile(unit: BattleUnit, profile: MovementProfileId): void {
  if (profile === 'ranged-skirmisher') {
    unit.ranged = { range: 5, cooldown: 2.0 };
  }
}

/** Add a unit to the world and return it. Auto-increments `world.nextId`. */
export function addUnit(
  world: BattleWorld,
  faction: BattleFaction,
  hex: Hex,
  name: string,
  role: UnitRole = 'vanguard',
  stats?: UnitStats,
  spriteId?: string,
  movementProfile?: MovementProfileId,
  cohortInstanceId?: string,
): BattleUnit {
  const id = world.nextId++;
  const unitStats = stats ?? ROLE_STATS[role];
  const resolvedProfile = movementProfile ?? defaultProfileForRole(role);
  const unit: BattleUnit = {
    id, cohortInstanceId, faction, role, hex, stats: unitStats, currentHp: unitStats.hp, name,
    prevHex: null, moveProgress: 1, path: [],
    shakeTimer: 0, flashTimer: 0,
    lungeTarget: null, lungeTimer: 0,
    isDying: false, deathProgress: 0,
    pinnedBy: null,
    actionCooldown: 0.1, // near-zero so all units act together from the start
    crackSeed: id * 7919,
    reviveThreshold: 0,
    hasRevived: false,
    hasEngaged: false,
    spriteId,
    movementProfile: resolvedProfile,
    // S24-02: neutral defaults. S24-03 overwrites these at deploy time with
    // the army's tier multipliers.
    moraleDamageMult: 1.0,
    moraleDefenseMult: 1.0,
  };
  applyRangedProfile(unit, resolvedProfile);
  world.units.set(unit.id, unit);
  return unit;
}

// ── Queries ──

/** First (non-dying) unit standing on `hex`, or null. */
export function getUnitAt(world: BattleWorld, hex: Hex): BattleUnit | null {
  for (const unit of world.units.values()) {
    if (unit.isDying) continue;
    if (unit.hex.q === hex.q && unit.hex.r === hex.r) return unit;
  }
  return null;
}

/** Enemies of `unit` standing on its 6 neighbors. */
export function getAdjacentEnemies(world: BattleWorld, unit: BattleUnit): BattleUnit[] {
  const enemies: BattleUnit[] = [];
  for (const nh of hexNeighbors(unit.hex)) {
    const other = getUnitAt(world, nh);
    if (other && other.faction !== unit.faction) enemies.push(other);
  }
  return enemies;
}

/** All living units of `faction`. */
export function getBattleFactionUnits(world: BattleWorld, faction: BattleFaction): BattleUnit[] {
  const result: BattleUnit[] = [];
  for (const u of world.units.values()) {
    if (u.isDying) continue;
    if (u.faction === faction) result.push(u);
  }
  return result;
}

/** Sum of living HP for `faction`. */
export function getBattleFactionStrength(world: BattleWorld, faction: BattleFaction): number {
  let total = 0;
  for (const u of world.units.values()) {
    if (u.isDying) continue;
    if (u.faction === faction) total += u.currentHp;
  }
  return total;
}

/** Closest enemy of `unit` by hex distance, or null. */
export function findNearestEnemy(world: BattleWorld, unit: BattleUnit): BattleUnit | null {
  let nearest: BattleUnit | null = null;
  let bestDist = Infinity;
  for (const other of world.units.values()) {
    if (other.isDying) continue;
    if (other.faction === unit.faction) continue;
    const d = hexDistance(unit.hex, other.hex);
    if (d < bestDist) { bestDist = d; nearest = other; }
  }
  return nearest;
}

// ── Movement ──

/** Direct single-hex move (used internally to advance one hop). */
export function moveUnit(world: BattleWorld, unitId: number, target: Hex): boolean {
  const unit = world.units.get(unitId);
  if (!unit) return false;
  if (!isValidHex(world, target)) return false;
  if (getUnitAt(world, target)) return false;
  unit.prevHex = { q: unit.hex.q, r: unit.hex.r };
  unit.hex = { q: target.q, r: target.r };
  unit.moveProgress = 0;
  return true;
}

/** Queue a multi-hex move toward target along the shortest path, clamped to MOVE_RANGE. */
export function moveUnitAlongPath(world: BattleWorld, unitId: number, target: Hex): boolean {
  const unit = world.units.get(unitId);
  if (!unit) return false;
  if (unit.moveProgress < 1) return false; // still animating
  if (getUnitAt(world, target)) return false;

  const fullPath = findPath(world, unit.hex, target);
  if (!fullPath || fullPath.length < 2) return false;

  const clamped = fullPath.slice(0, MOVE_RANGE + 1);

  const firstTarget = clamped[1];
  unit.prevHex = { q: unit.hex.q, r: unit.hex.r };
  unit.hex = { q: firstTarget.q, r: firstTarget.r };
  unit.moveProgress = 0;
  unit.path = clamped.slice(2);
  return true;
}

/** True if the unit is currently walking a path. */
export function isUnitMoving(unit: BattleUnit): boolean {
  return unit.moveProgress < 1 || unit.path.length > 0;
}

// ── Action gating ──

/** True if the unit can act (cooldown expired, not moving/dying/lunging/shaking). */
export function canAct(unit: BattleUnit): boolean {
  return unit.actionCooldown <= 0
    && !unit.isDying
    && !isUnitMoving(unit)
    && unit.lungeTimer <= 0
    && unit.shakeTimer <= 0;
}

/** Reset a unit's action cooldown with random jitter. */
export function resetCooldown(unit: BattleUnit): void {
  unit.actionCooldown = ACTION_COOLDOWN + (Math.random() - 0.5) * ACTION_JITTER * 2;
}

// ── Selection / UI state ──

export function selectUnit(world: BattleWorld, unitId: number | null): void {
  world.selectedUnitId = unitId;
}

export function getSelectedUnit(world: BattleWorld): BattleUnit | null {
  if (world.selectedUnitId === null) return null;
  return world.units.get(world.selectedUnitId) ?? null;
}

export function setLieutenantOrder(world: BattleWorld, order: LieutenantOrder): void {
  world.lieutenantOrder = order;
}

/**
 * Enter or exit ability targeting mode. Pass an ability id to highlight the
 * cursor for targeting, or `null` to cancel.
 */
export function setTargeting(world: BattleWorld, abilityId: string | null): void {
  world.targetingAbility = abilityId;
}

/** Mark an ability as used for this battle (once-per-battle tracking). */
export function markAbilityUsed(world: BattleWorld, abilityId: string): void {
  world.abilityCooldowns.add(abilityId);
}

export function isAbilityOnCooldown(world: BattleWorld, abilityId: string): boolean {
  return world.abilityCooldowns.has(abilityId);
}

export function togglePause(world: BattleWorld): void {
  world.paused = !world.paused;
}

// ── Particles ──

/** Spawn `count` particles at `hex` with a random spread. */
export function spawnParticles(
  world: BattleWorld,
  hex: { q: number; r: number },
  count: number,
  color: string,
  spread: number,
  speed: number,
  lifetime: number,
): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.random() - 0.5) * spread;
    const s = speed * (0.5 + Math.random() * 1.0);
    const p: Particle = {
      hex: { q: hex.q, r: hex.r },
      offsetX: 0, offsetY: 0,
      vx: Math.cos(angle) * s,
      vy: Math.sin(angle) * s - speed * 0.3,
      life: lifetime * (0.6 + Math.random() * 0.4),
      maxLife: lifetime,
      color,
      size: 2 + Math.random() * 3,
    };
    world.particles.push(p);
  }
}
