/**
 * Itinerarium spoke effects — the army-side consequences a landmark applies
 * when the player resolves it. A discriminated union so S27-03's apply step
 * can switch on `type` exhaustively without runtime guards beyond TypeScript.
 *
 * Sources of truth (do not duplicate):
 *   - Morale  → `computeArmyMorale(spoke)` in `army/morale.ts`
 *   - Supplies → `ArmyData.supplies` mutated via `army/supplies.ts`
 *   - Iuniores → global `ResourceType = 'iuniores'` (resources.ts)
 *
 * Each variant carries a player-facing `label` so the UI can show "+8 Morale —
 * Rest at Camp" without translating the effect kind every time it renders.
 *
 * Pure type module — no runtime.
 *
 * GDD reference: Itinerarium §7.2.
 */

import type { BattleTerrainModifier } from './battle-terrain-modifiers';

export type SpokeEffect =
  | { type: 'morale';           delta: number; label: string }
  | { type: 'supplies';         delta: number; label: string }
  | { type: 'iuniores';         delta: number; label: string }
  | { type: 'reveal';           radius: number; label: string }
  | { type: 'battle-modifier';  modifierId: BattleTerrainModifier; label: string }
  | { type: 'threat';           delta: number; label: string };
