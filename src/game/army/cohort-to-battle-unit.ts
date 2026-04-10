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
};

function colForRole(slots: SlotTemplate, role: UnitRole): number {
  return role === 'vanguard' ? slots.vanguardCol
       : role === 'reserve'  ? slots.reserveCol
       :                       slots.guardCol;
}

function rowsForRole(slots: SlotTemplate, role: UnitRole): readonly number[] {
  return role === 'vanguard' ? slots.vanguardRows
       : role === 'reserve'  ? slots.reserveRows
       :                       slots.guardRows;
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

    const rows = rowsForRole(slots, cohort.role);
    if (slotIdx >= rows.length) continue; // overflow — drop silently

    const col = colForRole(slots, cohort.role);
    const row = rows[slotIdx];

    specs.push({
      faction,
      hex: offsetToAxial(col, row),
      name: `${slotIdx + 1}st ${cohort.name}`,
      role: cohort.role,
      stats: { ...cohort.stats }, // shallow copy — trait passes mutate freely
    });
  }

  return specs;
}
