/**
 * @deprecated V1 cohort-to-BattleUnit mapper. Uses fixed spawn slots from
 * `legacy-spawn-config.ts` to place cohorts on the 20×14 horizontal grid.
 *
 * BattleV2 uses `src/battle/deployment.ts` (central-spawn formation).
 * This mapper is only reached from the legacy `enter()` path via
 * `BattleState.placeFactionUnits`, which itself is only called by
 * `enterLegacyBattle()`.
 */

import type { ArmyData } from '../../types/index';
import type { BattleFaction, UnitRole, UnitStats } from '../battle-types';
import type { Hex } from '../hex';
import { offsetToAxial } from '../hex';
import {
  BLUE_VANGUARD_COL, BLUE_VANGUARD_ROWS,
  BLUE_RESERVE_COL,  BLUE_RESERVE_ROWS,
  BLUE_GUARD_COL,    BLUE_GUARD_ROWS,
  RED_VANGUARD_COL,  RED_VANGUARD_ROWS,
  RED_RESERVE_COL,   RED_RESERVE_ROWS,
  RED_GUARD_COL,     RED_GUARD_ROWS,
  RED_VANGUARD_COL_2, RED_VANGUARD_ROWS_2,
  RED_RESERVE_COL_2,  RED_RESERVE_ROWS_2,
} from './legacy-spawn-config';

/** A planned spawn — what to addUnit on the hex grid for one cohort. */
export interface CohortSpawnSpec {
  faction: BattleFaction;
  hex: Hex;
  name: string;
  role: UnitRole;
  /** Shallow-copied from the cohort catalog so trait passes can mutate freely. */
  stats: UnitStats;
}

interface SlotTemplate {
  vanguardCol: number;
  vanguardRows: readonly number[];
  reserveCol: number;
  reserveRows: readonly number[];
  guardCol: number;
  guardRows: readonly number[];
  vanguardCol2?: number;
  vanguardRows2?: readonly number[];
  reserveCol2?: number;
  reserveRows2?: readonly number[];
}

const BLUE_SLOTS: SlotTemplate = {
  vanguardCol: BLUE_VANGUARD_COL, vanguardRows: BLUE_VANGUARD_ROWS,
  reserveCol:  BLUE_RESERVE_COL,  reserveRows:  BLUE_RESERVE_ROWS,
  guardCol:    BLUE_GUARD_COL,    guardRows:    BLUE_GUARD_ROWS,
};

const RED_SLOTS: SlotTemplate = {
  vanguardCol: RED_VANGUARD_COL, vanguardRows: RED_VANGUARD_ROWS,
  reserveCol:  RED_RESERVE_COL,  reserveRows:  RED_RESERVE_ROWS,
  guardCol:    RED_GUARD_COL,    guardRows:    RED_GUARD_ROWS,
  vanguardCol2: RED_VANGUARD_COL_2, vanguardRows2: RED_VANGUARD_ROWS_2,
  reserveCol2:  RED_RESERVE_COL_2,  reserveRows2:  RED_RESERVE_ROWS_2,
};

function resolveSlot(
  slots: SlotTemplate,
  role: UnitRole,
  slotIdx: number,
): { col: number; row: number } | null {
  const primaryRows = role === 'vanguard' ? slots.vanguardRows
                    : role === 'reserve'  ? slots.reserveRows
                    :                       slots.guardRows;
  const primaryCol  = role === 'vanguard' ? slots.vanguardCol
                    : role === 'reserve'  ? slots.reserveCol
                    :                       slots.guardCol;

  if (slotIdx < primaryRows.length) {
    return { col: primaryCol, row: primaryRows[slotIdx] };
  }

  const overflowIdx = slotIdx - primaryRows.length;
  const overflowRows = role === 'vanguard' ? slots.vanguardRows2
                     : role === 'reserve'  ? slots.reserveRows2
                     :                       undefined;
  const overflowCol  = role === 'vanguard' ? slots.vanguardCol2
                     : role === 'reserve'  ? slots.reserveCol2
                     :                       undefined;

  if (overflowRows && overflowCol != null && overflowIdx < overflowRows.length) {
    return { col: overflowCol, row: overflowRows[overflowIdx] };
  }

  return null;
}

/** @deprecated — use `deployArmy(state, faction, army, plan)` from `src/battle/deployment.ts`. */
export function mapArmyToBattleUnits(
  army: ArmyData,
  faction: BattleFaction,
): CohortSpawnSpec[] {
  const slots = faction === 'blue' ? BLUE_SLOTS : RED_SLOTS;
  const specs: CohortSpawnSpec[] = [];
  const counters: Record<UnitRole, number> = { vanguard: 0, reserve: 0, guard: 0 };

  for (const cohort of army.cohorts) {
    const slotIdx = counters[cohort.role];
    counters[cohort.role]++;

    const slot = resolveSlot(slots, cohort.role, slotIdx);
    if (!slot) continue;

    specs.push({
      faction,
      hex: offsetToAxial(slot.col, slot.row),
      name: `${slotIdx + 1}st ${cohort.name}`,
      role: cohort.role,
      stats: { ...cohort.stats },
    });
  }

  return specs;
}
