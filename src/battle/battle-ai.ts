/**
 * Battle AI dispatcher.
 *
 * Thin layer that groups units by role (or by lieutenant order for the player
 * faction) and runs each group through its matching `MovementFn` profile.
 * All actual movement decisions live in `./movements/profiles.ts`.
 *
 * Adding a new role behavior or lieutenant order = add one entry to the
 * profile tables; no edits here.
 */

import type { BattleEngine } from './core/BattleEngine';
import type { BattleFaction, BattleUnit, UnitRole } from './battle-types';
import {
  resolveMovement, ROLE_PROFILES, LIEUTENANT_PROFILES,
  type MoveContext, type MovementFn,
} from './movements';

export function tickAI(engine: BattleEngine, faction: BattleFaction): void {
  const units = engine.getBattleFactionUnits(faction);
  if (units.length === 0) return;

  const vertical = !!engine.config.vertical;
  const dir = vertical
    ? (faction === 'blue' ? -1 : 1)
    : (faction === 'blue' ? 1 : -1);

  const ctx: MoveContext = {
    dir,
    vertical,
    cols: engine.config.cols,
    rows: engine.config.rows,
  };

  // Player with a non-auto lieutenant order → every unit follows the order
  if (faction === 'blue' && engine.lieutenantOrder !== 'auto') {
    const profile = LIEUTENANT_PROFILES[engine.lieutenantOrder];
    resolveMovement(engine, units, profile, ctx);
    return;
  }

  // Otherwise group by role and dispatch through ROLE_PROFILES
  const buckets: Record<UnitRole, BattleUnit[]> = { vanguard: [], reserve: [], guard: [] };
  for (const u of units) buckets[u.role].push(u);

  for (const role of Object.keys(buckets) as UnitRole[]) {
    const group = buckets[role];
    if (group.length === 0) continue;
    const profile: MovementFn = ROLE_PROFILES[role];
    resolveMovement(engine, group, profile, ctx);
  }
}
