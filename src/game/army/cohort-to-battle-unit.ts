import type { ArmyData } from '../../types/index';
import type { BattleFaction, UnitRole, UnitStats } from '../../battle/battle-types';
import type { Hex } from '../../battle/hex';
import { offsetToAxial } from '../../battle/hex';
import {
  BLUE_VANGUARD_COL, BLUE_VANGUARD_ROWS,
  BLUE_RESERVE_COL,  BLUE_RESERVE_ROWS,
  BLUE_GUARD_COL,    BLUE_GUARD_ROWS,
  RED_VANGUARD_COL,  RED_VANGUARD_ROWS,
  RED_RESERVE_COL,   RED_RESERVE_ROWS,
  RED_GUARD_COL,     RED_GUARD_ROWS,
  RED_VANGUARD_COL_2, RED_VANGUARD_ROWS_2,
  RED_RESERVE_COL_2,  RED_RESERVE_ROWS_2,
} from '../../battle/battle-config';

/**
 * A planned spawn — what to addUnit on the hex grid for one cohort.
 *
 * The mapper produces these; `placeStartingUnits` consumes them by passing
 * each spec into `BattleState.addUnit`. Keeping the spec as plain data
 * (rather than calling addUnit directly inside the mapper) keeps the
 * mapper testable and free of BattleState coupling.
 */
export interface CohortSpawnSpec {
  faction: BattleFaction;
  hex: Hex;
  name: string;
  role: UnitRole;
  /** Shallow-copied from the cohort catalog so trait passes can mutate freely. */
  stats: UnitStats;
}

/** Per-faction column + row template, mirrors `battle-config.ts`. */
interface SlotTemplate {
  vanguardCol: number;
  vanguardRows: readonly number[];
  reserveCol: number;
  reserveRows: readonly number[];
  guardCol: number;
  guardRows: readonly number[];
  // S15-04: Overflow — filled after primary rows exhausted
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
  // S15-04: overflow slots for armies larger than 10
  vanguardCol2: RED_VANGUARD_COL_2, vanguardRows2: RED_VANGUARD_ROWS_2,
  reserveCol2:  RED_RESERVE_COL_2,  reserveRows2:  RED_RESERVE_ROWS_2,
};

/** Resolve column + row for a given role and slot index, falling through to overflow when primary is full. */
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

  // Overflow
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

  return null; // no slot available — drop silently
}

/**
 * Map an army's cohort roster to spawn specs on the hex grid.
 *
 * Cohorts are placed by role into their faction's column slot pattern from
 * `battle-config.ts` (vanguard col, reserve col, guard col). Cohorts of the
 * same role consume slots in declaration order.
 *
 * If a role has more cohorts than its column has rows, the overflow is
 * silently dropped here — surfacing recruitment caps is the Recruitment
 * Screen's job (see S14-07).
 *
 * Stats are shallow-copied so the trait pipeline (S14-05) can mutate them
 * freely without aliasing the static cohort catalog.
 */
export function mapArmyToBattleUnits(
  army: ArmyData,
  faction: BattleFaction,
): CohortSpawnSpec[] {
  const slots = faction === 'blue' ? BLUE_SLOTS : RED_SLOTS;
  const specs: CohortSpawnSpec[] = [];

  // Per-role placement counters — vanguard cohorts fill vanguard rows in
  // order, reserve cohorts fill reserve rows in order, etc.
  const counters: Record<UnitRole, number> = { vanguard: 0, reserve: 0, guard: 0 };

  for (const cohort of army.cohorts) {
    const slotIdx = counters[cohort.role];
    counters[cohort.role]++;

    const slot = resolveSlot(slots, cohort.role, slotIdx);
    if (!slot) continue; // no slot available — drop silently

    specs.push({
      faction,
      hex: offsetToAxial(slot.col, slot.row),
      name: `${slotIdx + 1}st ${cohort.name}`,
      role: cohort.role,
      stats: { ...cohort.stats }, // shallow copy — trait passes mutate freely
    });
  }

  return specs;
}
