/**
 * Tactical battle modifiers applied to BattleV2 when the spoke node carries a
 * specific terrain. The campaign layer (Itinerarium) attaches these to nodes;
 * BattleV2 reads them on entry via `BattleContext` to bias movement, ranged
 * accuracy, charge effectiveness, etc.
 *
 * S27-10: this module gained two runtime exports:
 *   - `BattleContext` — the data BattleV2 receives from the campaign layer.
 *   - `BATTLE_MODIFIER_LABELS` — fantasy-forward label/description table
 *     shared between LandmarkDetailsPanel and BattleContextBanner.
 *
 * GDD reference: Itinerarium §7.3 + §10.1.
 */

import type { BattleTerrain, EncounterType } from './landmark-types';

export type BattleTerrainModifier =
  | 'forest_cover'
  | 'dense_trees'
  | 'high_ground'
  | 'open_field'
  | 'river_crossing'
  | 'urban_fighting'
  | 'mud'
  | 'narrow_pass'
  | 'sacred_ground'
  | 'fortified_position';

/**
 * Snapshot the battle layer uses to surface campaign context. Built once on
 * entry from the active spoke node and stashed on `currentBattleContext`.
 * Quick battles set this to `null` so the banner stays hidden.
 */
export interface BattleContext {
  sourceNodeId: string;
  encounterType: EncounterType;
  terrain: BattleTerrain | null;
  modifiers: readonly BattleTerrainModifier[];
  enemyStrength: number | null;
  landmarkName: string | null;
}

/**
 * Player-facing label + flavour description per modifier. Numbers stay out
 * of the chip face by design (S27-07 AC5) — the description is the
 * "advanced" tooltip and is the only place mechanical implications live
 * until the battle layer wires real gameplay effects.
 */
export const BATTLE_MODIFIER_LABELS: Record<BattleTerrainModifier, { icon: string; label: string; description: string }> = {
  forest_cover:       { icon: '🌲', label: 'Forest Cover',       description: 'Ranged attacks lose accuracy; ambushes favor the defender.' },
  dense_trees:        { icon: '🌳', label: 'Dense Trees',        description: 'Movement slowed; cavalry charges blunted.' },
  high_ground:        { icon: '⛰',  label: 'High Ground',        description: 'Defenders gain a positional advantage on attack rolls.' },
  open_field:         { icon: '🌾', label: 'Open Field',         description: 'Cavalry charges devastate; no cover for skirmishers.' },
  river_crossing:     { icon: '🌊', label: 'River Crossing',     description: 'Crossing units fight at a severe disadvantage.' },
  urban_fighting:     { icon: '🏛',  label: 'Urban Fighting',     description: 'Cohesion breaks; infantry fights in fragments.' },
  mud:                { icon: '🌧',  label: 'Mud',                description: 'All movement slowed; heavy units suffer most.' },
  narrow_pass:        { icon: '🏔',  label: 'Narrow Pass',        description: 'Frontage limited; numbers count for less.' },
  sacred_ground:      { icon: '✨', label: 'Sacred Ground',      description: 'Morale steady; the gods watch this field.' },
  fortified_position: { icon: '🛡',  label: 'Fortified Position', description: 'Defenders entrenched behind walls and ditches.' },
};
