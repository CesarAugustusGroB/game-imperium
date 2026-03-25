import type { BattleState, Faction, BattleUnit } from './battle-state';

export function runAI(state: BattleState, faction: Faction): void {
  const units = state.getFactionUnits(faction);

  // Shuffle to prevent systematic bias
  shuffle(units);

  for (const unit of units) {
    // Skip if unit was destroyed or is dying
    if (!state.units.has(unit.id)) continue;
    if (unit.isDying) continue;

    // Check for adjacent enemies first — attack
    const enemies = state.getAdjacentEnemies(unit);
    if (enemies.length > 0) {
      // Attack weakest adjacent enemy
      const target = enemies.reduce((a, b) => a.strength < b.strength ? a : b);
      state.resolveCombat(unit, target);
      continue;
    }

    // No adjacent enemy — pathfind toward nearest (multi-hex, like strategic map)
    if (state.isUnitMoving(unit)) continue;
    const nearest = state.findNearestEnemy(unit);
    if (!nearest) continue;

    // Get full path to enemy, then pick the last unoccupied hex within range
    const fullPath = state.findPath(unit.hex, nearest.hex);
    if (!fullPath || fullPath.length < 2) continue;

    // Walk as far as possible: exclude the enemy's hex (occupied), clamp to range
    const walkable = fullPath.slice(1, -1); // remove start and enemy hex
    if (walkable.length === 0) continue;
    const target = walkable[Math.min(walkable.length - 1, 2)]; // up to MOVE_RANGE (3) - 1
    state.moveUnitAlongPath(unit.id, target);
  }
}

function shuffle(arr: BattleUnit[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
