import type { BattleState, Faction, BattleUnit } from './battle-state';
import type { Hex } from './hex';

export function runAI(state: BattleState, faction: Faction): void {
  const units = state.getFactionUnits(faction);
  if (units.length === 0) return;

  // Determine advance direction: blue goes right (+q), red goes left (-q)
  const dir = faction === 'blue' ? 1 : -1;

  // Phase 1: units adjacent to enemies — attack
  const fighters: BattleUnit[] = [];
  const marchers: BattleUnit[] = [];

  for (const unit of units) {
    if (!state.units.has(unit.id)) continue;
    if (unit.isDying) continue;
    if (state.isUnitMoving(unit)) continue;

    const enemies = state.getAdjacentEnemies(unit);
    if (enemies.length > 0) {
      fighters.push(unit);
    } else {
      marchers.push(unit);
    }
  }

  // Fighters attack weakest adjacent enemy
  for (const unit of fighters) {
    if (!state.units.has(unit.id)) continue;
    const enemies = state.getAdjacentEnemies(unit);
    if (enemies.length === 0) continue;
    const target = enemies.reduce((a, b) => a.strength < b.strength ? a : b);
    state.resolveCombat(unit, target);
  }

  // Phase 2: marchers advance in formation — find the frontmost unit,
  // then all units advance 1 step toward the enemy side, keeping rows
  if (marchers.length === 0) return;

  // Find the front line q-coordinate (most advanced toward enemy)
  const frontQ = marchers.reduce((best, u) =>
    dir > 0 ? Math.max(best, u.hex.q) : Math.min(best, u.hex.q),
    dir > 0 ? -Infinity : Infinity,
  );

  // Sort marchers: rear units move first so they don't block front units
  marchers.sort((a, b) => dir > 0 ? (a.hex.q - b.hex.q) : (b.hex.q - a.hex.q));

  // Check if any enemy is nearby — if so, front units can advance faster
  const hasNearEnemy = marchers.some(u => {
    const nearest = state.findNearestEnemy(u);
    return nearest !== null;
  });

  if (!hasNearEnemy) return;

  // Each unit advances 1 hex forward (same row, +/- q direction)
  // Units that are behind the front line advance to catch up
  for (const unit of marchers) {
    if (state.isUnitMoving(unit)) continue;

    const distBehindFront = Math.abs(unit.hex.q - frontQ);

    // Advance step: move toward enemy side
    // Units behind the front get up to 2 steps to catch up
    const steps = distBehindFront > 1 ? 2 : 1;
    const target = findAdvanceTarget(state, unit, dir, steps);
    if (target) {
      state.moveUnitAlongPath(unit.id, target);
    }
  }
}

/** Find the best hex to advance toward while maintaining formation. */
function findAdvanceTarget(
  state: BattleState, unit: BattleUnit, dir: number, maxSteps: number,
): Hex | null {
  // Try to advance straight forward (same row)
  let target: Hex = { q: unit.hex.q, r: unit.hex.r };

  for (let s = 0; s < maxSteps; s++) {
    const next: Hex = { q: target.q + dir, r: target.r };
    if (!state.isValidHex(next)) break;
    if (state.getUnitAt(next)) break;
    target = next;
  }

  // If we couldn't advance straight, try diagonal (shift row by ±1)
  if (target.q === unit.hex.q && target.r === unit.hex.r) {
    for (const rOffset of [-1, 1]) {
      const diag: Hex = { q: unit.hex.q + dir, r: unit.hex.r + rOffset };
      if (state.isValidHex(diag) && !state.getUnitAt(diag)) {
        return diag;
      }
    }
    return null;
  }

  if (target.q === unit.hex.q && target.r === unit.hex.r) return null;
  return target;
}
