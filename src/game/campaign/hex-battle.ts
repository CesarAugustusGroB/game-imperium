// S31-05b: bridge between the campaign hex map and the existing
// SpokeNode → BattleScreenV2 pipeline.
//
// Hex battles synthesize a 1-node Spoke labeled `__hex_encounter__` so
// `main.tsx` can detect them on battle exit and route back to the Bellum
// tab instead of the standard post-battle screen. The synthesized spoke's
// `boundArmy` is `preparedArmy.value`, which means main.tsx's existing
// HP/cohort write-back path already projects battle losses forward — no
// extra plumbing needed.

import type { HexTile, TerrainType } from './campaign-types';
import type { BattleTerrain, EncounterType } from '../progression/landmark-types';
import { currentSpoke, type BattleResult, type Spoke, type SpokeNode } from '../progression/spoke';
import { preparedArmy, preparedLegate } from '../progression/strategic-store';
import { addMorale, addSupplies } from './campaign-state';

// Navigation hook — registered by main.tsx at app boot. Kept as an injection
// point (not a direct `navigateTo` import) so this module stays free of the
// browser-coupled `screens.ts` graph; verify scripts can run it in node.
let navigateFn: ((screen: string) => void) | null = null;
export function setHexBattleNavigation(fn: (screen: string) => void): void {
  navigateFn = fn;
}

export const HEX_ENCOUNTER_LABEL = '__hex_encounter__';

/**
 * Map campaign-map terrain to the BattleTerrain vocabulary used by BattleV2.
 * `camp` has no battle equivalent (it's open ground); fall back to plains.
 */
export function terrainToBattleTerrain(t: TerrainType): BattleTerrain {
  switch (t) {
    case 'plains':
      return 'plains';
    case 'forest':
      return 'forest';
    case 'hills':
      return 'hills';
    case 'mountains':
      return 'mountains';
    case 'river':
      return 'river';
    case 'road':
      return 'road';
    case 'ruins':
      return 'ruins';
    case 'camp':
      return 'plains';
  }
}

export function isHexEncounterSpoke(spoke: Spoke | null): boolean {
  return spoke?.label === HEX_ENCOUNTER_LABEL;
}

/**
 * Build a 1-node Spoke for a hex battle, or null if there's no army to send.
 * Caller is responsible for installing the spoke in `currentSpoke.value` and
 * navigating to battleV2.
 */
export function synthesizeHexBattleSpoke(
  tile: HexTile,
  encounterType: EncounterType,
): Spoke | null {
  const army = preparedArmy.value;
  if (!army) return null;

  const node: SpokeNode = {
    id: '__hex_encounter_node__',
    type: encounterType === 'elite_battle' ? 'boss' : 'battle',
    position: 0,
    resolved: false,
    reward: null,
    encounterType,
    terrain: terrainToBattleTerrain(tile.terrain),
    name: 'Hex Encounter',
  };

  return {
    nodes: [node],
    label: HEX_ENCOUNTER_LABEL,
    completed: false,
    duration: 1,
    currentSeason: 1,
    posture: encounterType === 'ambush' ? 'defending' : 'attacking',
    boundArmy: army,
    boundLegate: preparedLegate.value,
  };
}

/**
 * Try to launch a hex battle by synthesizing a spoke and asking the
 * runtime-registered navigation hook to switch screens. Returns false if no
 * preparedArmy exists OR the navigation hook hasn't been registered yet —
 * caller falls back to placeholder casualty deltas.
 */
export function launchHexBattle(tile: HexTile, encounterType: EncounterType): boolean {
  if (!navigateFn) return false;
  const spoke = synthesizeHexBattleSpoke(tile, encounterType);
  if (!spoke) return false;
  currentSpoke.value = spoke;
  navigateFn('battleV2');
  return true;
}

/**
 * Apply post-battle morale/supplies deltas to campaignState. Called from
 * main.tsx's battle-exit callback after the HP write-back has projected
 * cohort losses onto preparedArmy. HP loss is paid for "for free" by that
 * write-back; the deltas here represent strategic-layer fallout (morale +
 * supplies). Numbers are placeholder-tuned per the wider S31 balance pass.
 */
export function applyHexBattleOutcome(outcome: BattleResult | null): void {
  if (outcome === 'victory') {
    addMorale(5);
  } else if (outcome === 'defeat') {
    addMorale(-15);
    addSupplies(-5);
  } else {
    // 'draw' or null (esc-exit) — modest morale knock either way.
    addMorale(-5);
  }
}

