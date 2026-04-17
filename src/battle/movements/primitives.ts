/**
 * Movement primitives — atomic building blocks.
 *
 * Each primitive is a pure function `MovementFn`. They answer
 * "where should this unit go?" without attacking or resetting cooldowns —
 * the `resolveMovement` loop handles those.
 *
 * Adding a new primitive is one exported function; compose it into profiles
 * via the combinators in `./combinators`.
 */

import { MOVE_RANGE } from '../battle-config';
import { offsetToAxialFlatTop } from '../hex';
import type { MovementFn } from './resolver';
import {
  findAdvanceTarget, findInterceptHex, findRetreatHex,
  validateForward,
} from './helpers';

// ── Straight forward ──

/** March straight forward up to 3 steps. */
export const forward: MovementFn = (engine, unit, ctx) => {
  const target = findAdvanceTarget(engine, unit, ctx.dir, 3, ctx.vertical);
  if (!target) return null;
  return validateForward(unit, target, ctx.dir, ctx.vertical);
};

/** Charge — march forward at MOVE_RANGE (6) steps. Pairs well with impact
 *  bonuses on contact. Still forward-only. */
export const charge: MovementFn = (engine, unit, ctx) => {
  const target = findAdvanceTarget(engine, unit, ctx.dir, MOVE_RANGE, ctx.vertical);
  if (!target) return null;
  return validateForward(unit, target, ctx.dir, ctx.vertical);
};

// ── Chase / intercept ──

/** Chase the nearest enemy — no direction restriction. */
export const greedy: MovementFn = (engine, unit) => {
  const nearest = engine.findNearestEnemy(unit);
  if (!nearest) return null;
  return findInterceptHex(engine, unit, nearest);
};

/** Intercept a specific target — used by reserves after they've locked onto
 *  an enemy via busy-targets bookkeeping. Placeholder: behaves as greedy. */
export const intercept: MovementFn = greedy;

// ── Retreat ──

/** Retreat one step backward. */
export const retreat: MovementFn = (engine, unit, ctx) => {
  return findRetreatHex(engine, unit, ctx.dir, ctx.vertical);
};

// ── Static ──

/** Stay in place — lets the attack loop handle adjacent enemies. */
export const hold: MovementFn = () => null;

/** Alias for hold — used by guards who attack adjacent enemies only. */
export const standGround: MovementFn = hold;

// ── Skirmish (hit-and-run) ──

/** Skirmish: retreat one step after striking, otherwise approach the nearest
 *  enemy. Opts into post-attack movement via `postAttackMove = true` so the
 *  resolver calls it after combat — every other primitive stays put. */
const skirmishFn: MovementFn = (engine, unit, ctx) => {
  if (ctx.justAttacked) {
    return findRetreatHex(engine, unit, ctx.dir, ctx.vertical);
  }
  const nearest = engine.findNearestEnemy(unit);
  if (!nearest) return null;
  return findInterceptHex(engine, unit, nearest);
};
skirmishFn.postAttackMove = true;
export const skirmish = skirmishFn;

// ── Flank ──

/**
 * Flank: approach the nearest enemy via an off-center column to hit their
 * side instead of their front. On the V2 grid this means biasing the column
 * toward the flanks (left cols < 12, right cols ≥ 38).
 */
export const flank: MovementFn = (engine, unit, ctx) => {
  const nearest = engine.findNearestEnemy(unit);
  if (!nearest) return null;

  if (!ctx.vertical) {
    // Fallback to greedy for horizontal grids — flanks aren't well-defined there.
    return findInterceptHex(engine, unit, nearest);
  }

  // Pick the closer flank relative to the unit's current column
  const { cols } = ctx;
  const unitCol = unit.hex.q;
  const preferLeft = unitCol < cols / 2;
  const flankCol = preferLeft ? 5 : cols - 6;

  // Unit's offset row, nudge one step toward the enemy (forward)
  const unitRow = unit.hex.r + Math.floor(unit.hex.q / 2);
  const targetRow = unitRow + ctx.dir;
  const flankHex = offsetToAxialFlatTop(flankCol, targetRow);

  // Aim for the hex that's closest-to-flank AND adjacent to the nearest enemy
  if (engine.isValidHex(flankHex) && !engine.getUnitAt(flankHex)) {
    return flankHex;
  }
  // Fallback: intercept the enemy directly
  return findInterceptHex(engine, unit, nearest);
};

// ── Path to star (capture mode) ──

/** Pathfind toward the enemy's capture star — used by vanguards once they've
 *  broken into the enemy zone. Returns null when the star hex is occupied or
 *  no path exists, so `fallback(pathToStar, forward)` can recover. */
export const pathToStar: MovementFn = (engine, unit) => {
  const star = engine.getEnemyStar(unit.faction);
  if (!star) return null;
  // If someone's standing on the star, moveUnitAlongPath would silently fail.
  if (engine.getUnitAt(star)) return null;
  return star;
};
