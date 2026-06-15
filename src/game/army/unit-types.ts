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

/**
 * Base stat block for a unit/cohort: a flat hit-point pool plus five tactical
 * "power" stats on a small 0–3 scale (0 = not this unit's role, 1 = low,
 * 2 = moderate, 3 = strong). The combat engine does not read the powers yet —
 * they are unit identity/ficha for now; only `hp` feeds the soldiers pool.
 */
export interface UnitStats {
  /** Hit points. Flat 1000 for every unit — the army-size / replenishment basis. */
  hp: number;
  /** Carga — shock / charge power (cavalry). */
  charge: number;
  /** Acoso — harassment / skirmish power (sling). */
  harass: number;
  /** Empuje — push / line-hold power (Roman shield). */
  push: number;
  /** Asedio — siege power (crossbow). */
  siege: number;
  /** Movimiento — battlefield movement power (feet). */
  movement: number;
}

/** Keys of the five tactical power stats (everything on UnitStats except `hp`). */
export type PowerStat = keyof Omit<UnitStats, 'hp'>;

/**
 * Display metadata (key + label) for the five power stats. The icons are the
 * real medallion art, rendered by keying on `key`: GameIcon `stat-*`
 * (ArmyStatus, OrderBar) and `STAT_ICON_SRC` (ExercitusTab StatGrid). The old
 * emoji `glyph` placeholders were removed once those icons were wired in.
 */
export const POWER_STATS: readonly { key: PowerStat; label: string }[] = [
  { key: 'charge',   label: 'Carga' },
  { key: 'harass',   label: 'Acoso' },
  { key: 'push',     label: 'Empuje' },
  { key: 'siege',    label: 'Asedio' },
  { key: 'movement', label: 'Movimiento' },
];

/** Flat HP every unit has under the power-stat model. */
export const UNIT_HP = 1000;
