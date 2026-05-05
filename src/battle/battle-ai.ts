/**
 * Battle AI dispatcher.
 *
 * Thin layer that groups units by their `movementProfile` id and runs each
 * bucket through the matching `MovementFn` from `MOVEMENT_PROFILES`. When the
 * player has a non-`auto` lieutenant order active, every blue unit's bucket
 * is overridden to the corresponding `lieutenant:*` profile for that tick —
 * the order wins over the cohort default, then falls back to it when the
 * player returns to `auto`.
 *
 * Adding a new movement profile = one entry in `MOVEMENT_PROFILES` + one entry
 * on the `MovementProfileId` union; no edits here.
 */

import type { BattleEngine } from './core/BattleEngine';
import type { BattleFaction, BattleUnit, MovementProfileId } from './battle-types';
import { forceBerserkerMovement } from './battle-settings';
import {
  resolveMovement, MOVEMENT_PROFILES,
  type MoveContext,
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

  // Blue-only: a non-'auto' lieutenant order maps to a 'lieutenant:*' profile
  // id that overrides the unit's cohort default for this tick.
  const orderOverride: MovementProfileId | null =
    faction === 'blue' && engine.lieutenantOrder !== 'auto'
      ? (`lieutenant:${engine.lieutenantOrder}` as MovementProfileId)
      : null;
  const forcedProfile: MovementProfileId | null = forceBerserkerMovement.value
    ? 'berserker'
    : null;

  // Bucket by effective profile id so stateful profiles (e.g. RESERVE_AI's
  // pruneBusy pass) see their whole group once per tick.
  const buckets = new Map<MovementProfileId, BattleUnit[]>();
  for (const u of units) {
    const id = forcedProfile ?? orderOverride ?? u.movementProfile;
    const bucket = buckets.get(id);
    if (bucket) bucket.push(u);
    else buckets.set(id, [u]);
  }

  for (const [id, group] of buckets) {
    resolveMovement(engine, group, MOVEMENT_PROFILES[id], ctx);
  }
}
