/**
 * battle-state — deprecated alias for backward compatibility.
 *
 * The real class lives in `core/BattleEngine.ts`. This file only re-exports
 * it under the old `BattleState` name so existing `import { BattleState } from './battle-state'`
 * call sites keep working.
 *
 * Prefer `import { BattleEngine } from './core/BattleEngine'` in new code.
 */

export { BattleEngine as BattleState } from './core/BattleEngine';
export type { Particle } from './core/BattleWorld';

// Re-export types that used to live here
export type {
  BattleFaction, BattlePhase, UnitRole, UnitStats, VictoryMode,
  BattleUnit, BattleConfig, FloatingText, LieutenantOrder,
} from './battle-types';
