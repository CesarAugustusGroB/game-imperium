import type { BattleState, Faction, BattleUnit } from './battle-state';
import type { Hex } from './hex';

/**
 * Semi-real-time AI: called every frame. Each unit acts independently
 * when its cooldown expires — no synchronized turns.
 */
export function tickAI(state: BattleState, faction: Faction): void {
  const dir = faction === 'blue' ? 1 : -1;
  const units = state.getFactionUnits(faction);
  if (units.length === 0) return;

  // Find the front line for formation reference
  const frontQ = units.reduce((best, u) =>
    dir > 0 ? Math.max(best, u.hex.q) : Math.min(best, u.hex.q),
    dir > 0 ? -Infinity : Infinity,
  );

  for (const unit of units) {
    if (!state.canAct(unit)) continue;

    // Priority 1: attack adjacent enemy
    const enemies = state.getAdjacentEnemies(unit);
    if (enemies.length > 0) {
      const target = enemies.reduce((a, b) => a.strength < b.strength ? a : b);
      state.resolveCombat(unit, target);
      state.resetCooldown(unit);
      continue;
    }

    // Priority 2: advance in formation toward enemy
    const nearest = state.findNearestEnemy(unit);
    if (!nearest) continue;

    const distBehindFront = Math.abs(unit.hex.q - frontQ);
    const steps = distBehindFront > 1 ? 2 : 1;
    const target = findAdvanceTarget(state, unit, dir, steps);
    if (target) {
      state.moveUnitAlongPath(unit.id, target);
      state.resetCooldown(unit);
    }
  }
}

/** Find the best hex to advance toward while maintaining formation. */
function findAdvanceTarget(
  state: BattleState, unit: BattleUnit, dir: number, maxSteps: number,
): Hex | null {
  let target: Hex = { q: unit.hex.q, r: unit.hex.r };

  for (let s = 0; s < maxSteps; s++) {
    const next: Hex = { q: target.q + dir, r: target.r };
    if (!state.isValidHex(next)) break;
    if (state.getUnitAt(next)) break;
    target = next;
  }

  // Diagonal fallback if straight is blocked
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
