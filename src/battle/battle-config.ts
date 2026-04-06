import type { BattleConfig, UnitStats, UnitRole } from './battle-types';
import { HEX_SIZE } from './hex';

// ── Combat ──
/** Fraction of starting HP below which a faction's morale breaks and they lose (morale victory mode). */
export const MORALE_BREAK_THRESHOLD = 0.3;
/** Damage multiplier per Boudicca veteran stack (0.04 = +4%/stack). S9-08: reduced from 0.05, soft-capped above 12. */
export const VETERAN_BONUS_PER_STACK = 0.04;
/** Stacks at which veteran bonus hits diminishing returns (+1%/stack above this). */
export const VETERAN_SOFT_CAP_STACKS = 12;
/** Reduced bonus per stack above the soft cap. */
export const VETERAN_BONUS_ABOVE_CAP = 0.01;
/** ATK multiplier applied to all blue units when Boudicca's War Cry is active (0.25 = +25% damage). */
export const WAR_CRY_DAMAGE_BONUS = 0.25;
/** ATK multiplier applied to all blue units during an active Crusade (0.3 = +30% damage). */
export const CRUSADE_DAMAGE_BONUS = 0.3;
export const DODGE_AGI_FACTOR = 0.5;      // dodgeChance = (defAGI - atkAGI) * factor
export const DODGE_MAX = 30;              // max dodge chance %
export const DOUBLE_STRIKE_RATIO = 1.5;   // atk.agi >= def.agi * ratio → double strike

// ── Spawn HP ratios (fraction of max HP for summoned/allied units) ──
/** HP ratio for allied units (Augustus perk and doctrine ally-units). */
export const ALLY_SPAWN_HP_RATIO = 0.85;
/** HP ratio for free militia units (province Castrum / doctrine free-units). */
export const MILITIA_SPAWN_HP_RATIO = 0.7;

// ── Role Stats ──
export const ROLE_STATS: Record<UnitRole, UnitStats> = {
  vanguard: { atk: 150, def: 40, hp: 1080, agi: 40 },
  reserve:  { atk: 130, def: 50, hp: 840, agi: 70 },
  guard:    { atk: 100, def: 80, hp: 1200, agi: 30 },
};
export const ACTION_COOLDOWN = 1.4;    // base seconds between unit actions
export const ACTION_JITTER = 0.1;      // near-zero jitter so units move in sync

// ── Animation ──
export const MOVE_RANGE = 3;           // max hexes per move action
export const MOVE_ANIM_SPEED = 2.5;    // progress per second (~0.4s per hop, fast and smooth)
export const SHAKE_DURATION = 0.5;     // seconds of shake on hit
export const FLASH_DURATION = 0.35;    // seconds of impact flash
export const LUNGE_DURATION = 0.4;     // seconds for lunge forward + snap back
export const DEATH_DURATION = 2.5;     // seconds for full death animation

// ── Particles ──
export const SCREEN_SHAKE_DURATION = 0.3;
export const SCREEN_SHAKE_INTENSITY = 4;
export const DEATH_PARTICLE_COUNT = 12;
export const HIT_PARTICLE_COUNT = 5;
export const ABILITY_PARTICLE_COUNT = 8;
export const PARTICLE_GRAVITY = 80;
export const PARTICLE_BASE_SPEED = 60;

// ── Capture ──
export const CAPTURE_DURATION = 3.0;   // seconds a unit must stand on the star to capture it

// ── Grid ──
export const DEFAULT_CONFIG: BattleConfig = {
  cols: 20,
  rows: 14,
  hexSize: HEX_SIZE,
  victoryMode: 'capture',
};

// ── Unit Placement ──
export const BLUE_VANGUARD_ROWS = [1, 3, 5, 7, 9, 11];
export const BLUE_VANGUARD_COL = 6;
export const BLUE_RESERVE_ROWS = [4, 10];
export const BLUE_RESERVE_COL = 4;
export const BLUE_GUARD_ROWS = [5, 9];
export const BLUE_GUARD_COL = 1;

export const RED_VANGUARD_ROWS = [1, 3, 5, 7, 9, 11];
export const RED_VANGUARD_COL = 13;
export const RED_RESERVE_ROWS = [4, 10];
export const RED_RESERVE_COL = 15;
export const RED_GUARD_ROWS = [5, 9];
export const RED_GUARD_COL = 18;
