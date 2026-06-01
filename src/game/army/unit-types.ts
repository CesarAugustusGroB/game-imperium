/**
 * Core cohort/unit type vocabulary.
 *
 * These were originally defined in the (now-deleted) battle engine
 * (`src/battle/battle-types.ts`). They survive here because cohorts and
 * legates still describe their role, stats, movement profile, and lieutenant
 * orders independent of any battle simulator.
 */

/** Tactical role a cohort plays in a formation. */
export type UnitRole = 'vanguard' | 'reserve' | 'guard';

/** Lieutenant standing order for a cohort. */
export type LieutenantOrder = 'auto' | 'attack' | 'defend' | 'skirmish' | 'mobile';

/** Movement AI profile key for a cohort. */
export type MovementProfileId =
  | 'vanguard-march'
  | 'reserve-intercept'
  | 'guard-stand'
  | 'berserker'
  | 'skirmisher'
  | 'ranged-skirmisher'
  | 'flanker'
  | 'lieutenant:attack'
  | 'lieutenant:defend'
  | 'lieutenant:skirmish'
  | 'lieutenant:mobile';

/** Base combat stat block for a unit/cohort. */
export interface UnitStats {
  atk: number;
  def: number;
  hp: number;
  agi: number;
}
