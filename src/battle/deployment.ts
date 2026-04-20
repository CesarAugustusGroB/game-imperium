/**
 * Battlefield deployment plans.
 *
 * `deployArmy(state, faction, army, plan)` is the single entry point used by
 * every BattleV2 entry path to place a faction's roster onto the hex grid.
 * Swapping the `plan` changes the formation; the cohort stats / names / roles
 * are passed straight through to `state.addUnit`.
 *
 * Plans are pure data — add a new strategy by adding a case to the dispatcher
 * below. Nothing outside this module should call `state.addUnit` for the
 * initial roster.
 */

import type { BattleState } from './battle-state';
import type { BattleFaction, UnitRole } from './battle-types';
import type { ArmyData, Cohort } from '../types/index';
import type { Hex } from './hex';
import { offsetToAxial, offsetToAxialFlatTop } from './hex';

export type DeploymentStrategy = 'central' | 'flanked';

export interface DeploymentPlan {
  strategy: DeploymentStrategy;
  /** How many rows behind the zone's enemy-facing edge the front line sits. */
  frontRowOffset: number;
  /** Max columns a single row may use (center-clustered if roster exceeds). */
  maxWidth: number;
  /**
   * For `flanked` strategy: columns reserved for the flanking group on each side.
   * Ignored for other strategies.
   */
  flankCols?: { left: number[]; right: number[] };
}

/** Default deployment: tight center-clustered formation, 24 cols wide. */
export const CENTRAL_SPAWN: DeploymentPlan = {
  strategy: 'central',
  frontRowOffset: 2,
  maxWidth: 24,
};

/** Left-flank reinforcement lanes (red). Matches the Persian quick-battle flank. */
export const FLANK_LEFT: DeploymentPlan = {
  strategy: 'flanked',
  frontRowOffset: 0,
  maxWidth: 0,
  flankCols: { left: [2, 5, 8, 10], right: [] },
};

/** Right-flank reinforcement lanes (blue). Matches the Spartan quick-battle flank. */
export const FLANK_RIGHT: DeploymentPlan = {
  strategy: 'flanked',
  frontRowOffset: 0,
  maxWidth: 0,
  flankCols: { left: [], right: [44, 47] },
};

/**
 * Place `army.cohorts` onto `state`'s grid according to `plan`.
 * If the army has no cohorts, nothing is placed — the caller is responsible
 * for upstream checks (e.g. embark gate).
 */
export function deployArmy(
  state: BattleState,
  faction: BattleFaction,
  army: ArmyData | undefined,
  plan: DeploymentPlan,
): void {
  if (!army || army.cohorts.length === 0) return;

  switch (plan.strategy) {
    case 'central':
      deployCentral(state, faction, army.cohorts, plan);
      return;
    case 'flanked':
      deployFlanked(state, faction, army.cohorts, plan);
      return;
  }
}

// ── Central spawn ──────────────────────────────────────────────

/**
 * Center-clustered formation. Vanguards fill the front row(s) closest to the
 * enemy, reserves fill the middle, guards the back. Columns fill outward from
 * the grid's center so the flanks remain open for later reinforcements.
 */
function deployCentral(
  state: BattleState,
  faction: BattleFaction,
  cohorts: readonly Cohort[],
  plan: DeploymentPlan,
): void {
  const { cols, rows } = state.config;
  const zoneRows = Math.floor(rows / 3);

  // Blue's zone is the bottom third; its enemy-facing edge is the top of that third.
  // Red's zone is the top third; its enemy-facing edge is the bottom of that third.
  const enemyEdge = faction === 'blue' ? zoneRows * 2 : zoneRows - 1;
  const depthDir = faction === 'blue' ? 1 : -1;
  const frontRow = enemyEdge + plan.frontRowOffset * depthDir;

  const byRole = groupByRole(cohorts);
  const order: UnitRole[] = ['vanguard', 'reserve', 'guard'];
  const centerCol = Math.floor(cols / 2);

  let depth = 0;
  for (const role of order) {
    const list = byRole[role];
    if (list.length === 0) continue;

    let idx = 0;
    while (idx < list.length) {
      const row = frontRow + depth * depthDir;
      if (row < 0 || row >= rows) break;

      const take = Math.min(list.length - idx, plan.maxWidth);
      const colsForRow = centerClusteredCols(centerCol, take);
      for (const col of colsForRow) {
        if (idx >= list.length) break;
        if (!tryAdd(state, faction, col, row, list[idx])) continue;
        idx++;
      }
      depth++;
    }
  }
}

// ── Flanked spawn ──────────────────────────────────────────────

/**
 * Split formation: roster is partitioned by role, then cohorts are placed
 * column-first along the configured flank columns. Used by the Spartan/Persian
 * quick battle to recreate its hand-crafted flank waves data-driven.
 */
function deployFlanked(
  state: BattleState,
  faction: BattleFaction,
  cohorts: readonly Cohort[],
  plan: DeploymentPlan,
): void {
  if (!plan.flankCols) return;
  const { rows } = state.config;
  const zoneRows = Math.floor(rows / 3);

  const enemyEdge = faction === 'blue' ? zoneRows * 2 : zoneRows - 1;
  const depthDir = faction === 'blue' ? 1 : -1;

  // Flank cohorts fill their columns starting from the faction's own back edge,
  // working toward the enemy. Alternates left/right columns to keep the two
  // wings balanced.
  const sideCols = faction === 'blue' ? plan.flankCols.right : plan.flankCols.left;
  let idx = 0;
  for (const col of sideCols) {
    for (let d = 0; d < zoneRows && idx < cohorts.length; d++) {
      const row = enemyEdge + d * depthDir + plan.frontRowOffset * depthDir;
      if (row < 0 || row >= rows) break;
      if (!tryAdd(state, faction, col, row, cohorts[idx])) continue;
      idx++;
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────

function groupByRole(cohorts: readonly Cohort[]): Record<UnitRole, Cohort[]> {
  const out: Record<UnitRole, Cohort[]> = { vanguard: [], reserve: [], guard: [] };
  for (const c of cohorts) out[c.role].push(c);
  return out;
}

/** Column sequence radiating out from `center`: [c, c+1, c-1, c+2, c-2, ...]. */
function centerClusteredCols(center: number, count: number): number[] {
  const out: number[] = [];
  if (count <= 0) return out;
  out.push(center);
  for (let d = 1; out.length < count; d++) {
    out.push(center + d);
    if (out.length < count) out.push(center - d);
  }
  return out;
}

function tryAdd(
  state: BattleState, faction: BattleFaction,
  col: number, row: number, cohort: Cohort,
): boolean {
  const hex = offsetToAxialFlatTop(col, row);
  if (!state.isValidHex(hex)) return false;
  if (state.getUnitAt(hex)) return false;
  state.addUnit(
    faction, hex, cohort.name, cohort.role,
    { ...cohort.stats }, cohort.spriteId, cohort.movementProfile,
  );
  return true;
}

/**
 * Find an empty hex for a reinforcement unit arriving behind the main army
 * (Augustus allies, doctrine free-units, doctrine ally-units, etc.).
 *
 * Walks a grid-appropriate back-area candidate list in a deterministic order
 * and returns the first empty hex. Returns `null` if none remain. Intended to
 * be called once per unit — each placement shrinks the available set.
 */
export function findReinforcementHex(
  state: BattleState,
  faction: BattleFaction,
): Hex | null {
  const candidates = reinforcementCandidates(state, faction);
  for (const hex of candidates) {
    if (!state.isValidHex(hex)) continue;
    if (state.getUnitAt(hex)) continue;
    return hex;
  }
  return null;
}

/** Generate an ordered list of candidate back-area hexes for reinforcements. */
function reinforcementCandidates(state: BattleState, faction: BattleFaction): Hex[] {
  const { cols, rows, vertical } = state.config;

  if (vertical) {
    // V2: walk the 3 rows closest to the faction's back edge, columns center-out.
    const backEdge = faction === 'blue' ? rows - 1 : 0;
    const depthDir = faction === 'blue' ? -1 : 1;
    const centerCol = Math.floor(cols / 2);
    const out: Hex[] = [];
    for (let depth = 1; depth <= 3; depth++) {
      const row = backEdge + depth * depthDir;
      if (row < 0 || row >= rows) continue;
      for (const col of centerClusteredCols(centerCol, Math.min(cols, 16))) {
        out.push(offsetToAxialFlatTop(col, row));
      }
    }
    return out;
  }

  // V1 horizontal fallback: legacy blue back columns (col 3 / 4) at a mix of rows.
  const backCols = faction === 'blue' ? [3, 4] : [cols - 4, cols - 5];
  const backRows = [2, 4, 6, 8, 10, 12, 3, 7, 11];
  const out: Hex[] = [];
  for (const col of backCols) {
    for (const row of backRows) {
      out.push(offsetToAxial(col, row));
    }
  }
  return out;
}
