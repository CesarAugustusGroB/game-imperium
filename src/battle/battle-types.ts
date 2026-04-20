import type { Hex } from './hex';

export type BattleFaction = 'blue' | 'red';
export type BattlePhase = 'fighting' | 'victory' | 'draw';
export type UnitRole = 'vanguard' | 'reserve' | 'guard';
export type LieutenantOrder = 'auto' | 'attack' | 'defend' | 'skirmish' | 'mobile';
export type VictoryMode = 'morale' | 'annihilation' | 'capture';

/**
 * Movement AI profile key — picks a `MovementFn` from `MOVEMENT_PROFILES`
 * in `src/battle/movements/profiles.ts`.
 *
 * Cohorts typically declare one of the non-`lieutenant:*` keys. The
 * `lieutenant:*` entries are produced by `tickAI` when the player has a
 * non-`auto` lieutenant order active — they override the cohort default
 * for the duration of that order.
 */
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

export interface UnitStats {
  atk: number;
  def: number;
  hp: number;
  agi: number;
}

export interface BattleUnit {
  id: number;
  faction: BattleFaction;
  role: UnitRole;
  hex: Hex;
  stats: UnitStats;
  currentHp: number;
  name: string;
  // Movement state (mirrors strategic ArmyData.path pattern)
  prevHex: Hex | null;
  moveProgress: number; // 0 = at prevHex, 1 = at hex
  path: Hex[];          // queued hexes to walk through
  // Combat animation state
  shakeTimer: number;   // seconds remaining of shake effect
  flashTimer: number;   // seconds remaining of impact flash
  lungeTarget: Hex | null; // hex to lunge toward
  lungeTimer: number;   // seconds remaining (forward then snap back)
  isDying: boolean;
  deathProgress: number; // 0→1 (0-0.33 = cracks spread, 0.33-1.0 = fade out)
  crackSeed: number;     // deterministic seed for crack generation
  // Pin state: when hit, unit is pinned and must fight the attacker
  pinnedBy: number | null; // ID of the enemy that pinned this unit (null = free)
  // Semi-real-time action cooldown
  actionCooldown: number; // seconds until this unit can act again
  // Doctrine: revive (unit revives once at threshold % HP)
  reviveThreshold: number; // 0 = no revive, >0 = revive at this % of maxHp
  hasRevived: boolean;
  // Greedy AI: flipped on first combat (attack given or received)
  hasEngaged: boolean;
  // Optional per-unit sprite override. Keys a sprite registered on SpriteManager
  // under its soldier id (e.g. "spartan", "samurai"). When unset, the renderer
  // falls back to the `${faction}:${role}` sprite key.
  spriteId?: string;
  // Movement AI profile key — resolved against `MOVEMENT_PROFILES` each tick.
  // Decoupled from `role` so two cohorts sharing a role (e.g. both vanguard)
  // can still play differently (e.g. 'vanguard-march' vs 'skirmisher').
  movementProfile: MovementProfileId;
  // Ranged weapon definition. Presence of this field marks the unit as ranged.
  ranged?: { range: number; cooldown: number };
}

export interface Projectile {
  id: number;
  ownerId: number;
  targetId: number;
  fromHex: Hex;
  toHex: Hex;
  elapsed: number;
  duration: number;
  kind: 'arrow';
  /** Snapshot of attacker stats at fire time — resolves even if archer dies in flight. */
  atkSnapshot: number;
  agiSnapshot: number;
}

export interface FloatingText {
  text: string;
  hex: Hex;
  color: string;
  timer: number;    // seconds remaining (counts down from duration)
  duration: number;  // total seconds
}

export interface BattleConfig {
  cols: number;
  rows: number;
  hexSize: number;
  victoryMode: VictoryMode;
  /** When true, blue spawns at bottom (high r) and red at top (low r). Default: horizontal (left/right). */
  vertical?: boolean;
}
