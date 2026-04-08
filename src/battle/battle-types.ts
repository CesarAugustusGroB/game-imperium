import type { Hex } from './hex';

export type BattleFaction = 'blue' | 'red';
export type BattlePhase = 'fighting' | 'victory' | 'draw';
export type UnitRole = 'vanguard' | 'reserve' | 'guard';
export type LieutenantOrder = 'auto' | 'attack' | 'defend' | 'skirmish' | 'mobile';
export type VictoryMode = 'morale' | 'annihilation' | 'capture';

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
}
