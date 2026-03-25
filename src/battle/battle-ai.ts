import type { BattleState, Faction, BattleUnit } from './battle-state';

export function runAI(state: BattleState, faction: Faction): void {
  const units = state.getFactionUnits(faction);

  // Shuffle to prevent systematic bias
  shuffle(units);

  for (const unit of units) {
    // Skip if unit was destroyed this round
    if (!state.units.has(unit.id)) continue;

    // Check for adjacent enemies first — attack
    const enemies = state.getAdjacentEnemies(unit);
    if (enemies.length > 0) {
      // Attack weakest adjacent enemy
      const target = enemies.reduce((a, b) => a.strength < b.strength ? a : b);
      state.resolveCombat(unit, target);
      continue;
    }

    // No adjacent enemy — move toward nearest
    const nearest = state.findNearestEnemy(unit);
    if (!nearest) continue;

    const step = state.findStepToward(unit.hex, nearest.hex);
    if (step) {
      state.moveUnit(unit.id, step);
    }
  }
}

function shuffle(arr: BattleUnit[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
