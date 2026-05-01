// S31-05b: bridge between the campaign hex map and the existing
// SpokeNode → BattleScreenV2 pipeline.
//
// Hex battles synthesize a 1-node Spoke labeled `__hex_encounter__` so
// `main.tsx` can detect Bellum-origin battles on exit. Normal hex battles
// route back to the Bellum tab; Final Invasion battles must route through
// EndScreen per docs/bellum-run-contract.md. The synthesized spoke's
// `boundArmy` is `preparedArmy.value`, which means main.tsx's existing
// HP/cohort write-back path already projects battle losses forward.

import type { HexTile, TerrainType } from './campaign-types';
import type { BattleTerrain, EncounterType } from '../progression/landmark-types';
import type { BattleTerrainModifier } from '../progression/battle-terrain-modifiers';
import { currentSpoke, type BattleResult, type Spoke, type SpokeNode } from '../progression/spoke';
import { preparedArmy, preparedLegate } from '../progression/strategic-store';
import { campaignState } from './campaign-state';
import { evaluateBellumDefeat, type BellumDefeatEvaluation } from './campaign-defeat';
import { applyBellumEffects } from './bellum-encounter-effects';
import { HEX_BATTLE_OUTCOME_EFFECTS } from './encounter-effects-data';
import { getEventContent } from './events';
import { computeEnemyStrengthRating } from '../army/enemy-army-generator';
import { threatLevel, globalSeason, completedSpokes } from '../core/game-state';

// Navigation hook — registered by main.tsx at app boot. Kept as an injection
// point (not a direct `navigateTo` import) so this module stays free of the
// browser-coupled `screens.ts` graph; verify scripts can run it in node.
let navigateFn: ((screen: string) => void) | null = null;
export function setHexBattleNavigation(fn: (screen: string) => void): void {
  navigateFn = fn;
}

export const HEX_ENCOUNTER_LABEL = '__hex_encounter__';

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/**
 * Derive terrain-based battle modifiers from terrain type and encounter type.
 * Pure function — no signal reads.
 */
export function terrainToAutoModifiers(
  terrain: TerrainType,
  encounterType: EncounterType,
): BattleTerrainModifier[] {
  const out: BattleTerrainModifier[] = [];
  switch (terrain) {
    case 'forest':
      out.push('forest_cover');
      if (encounterType === 'ambush') out.push('dense_trees');
      break;
    case 'hills':
      out.push('high_ground');
      break;
    case 'plains':
    case 'road':
      // Open ground only matters when both sides can maneuver. Skip for
      // ambush — the open-field call would conflict with the ambush feel.
      if (encounterType !== 'ambush') out.push('open_field');
      break;
    case 'river':
      out.push('river_crossing');
      break;
    case 'ruins':
      out.push('urban_fighting');
      break;
    // 'camp' / 'mountains' → no auto modifier
  }
  return out;
}

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

  // Final Invasion always reads "Final Invasion" regardless of tile.event.
  // For all other encounters, derive from event content with a terrain fallback.
  const landmarkName = encounterType === 'boss'
    ? 'Final Invasion'
    : (getEventContent(tile)?.title ?? `${capitalize(tile.terrain)} Skirmish`);

  // Merge terrain-derived auto-modifiers with any tile-stashed battle modifiers.
  const autoMods = terrainToAutoModifiers(tile.terrain, encounterType);
  const tileMods = tile.battleModifiers ?? [];
  const seen = new Set<BattleTerrainModifier>();
  const mergedModifiers: BattleTerrainModifier[] = [];
  for (const m of [...autoMods, ...tileMods]) {
    if (!seen.has(m)) { seen.add(m); mergedModifiers.push(m); }
  }

  // Compute enemy strength rating matching the army builders' formulas.
  const enemyStrength = computeEnemyStrengthRating(
    encounterType,
    globalSeason.value,
    threatLevel.value,
    completedSpokes.value,
  );

  const node: SpokeNode = {
    id: '__hex_encounter_node__',
    type: encounterType === 'elite_battle' || encounterType === 'boss' ? 'boss' : 'battle',
    position: 0,
    resolved: false,
    reward: null,
    encounterType,
    terrain: terrainToBattleTerrain(tile.terrain),
    name: landmarkName,
    battleModifiers: mergedModifiers.length > 0 ? mergedModifiers : undefined,
    enemyStrength,
  };

  return {
    nodes: [node],
    label: HEX_ENCOUNTER_LABEL,
    completed: false,
    duration: 1,
    currentSeason: 1,
    // posture biases red deployment offset; see deployArmy in src/battle/deployment.ts
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
 * supplies). Data-driven via HEX_BATTLE_OUTCOME_EFFECTS.
 *
 * tile=null — no tile-targeting effects in this set; applyBellumEffects skips
 * reveal/scout/battle-modifier effects when tile is null (correct behavior).
 */
export function applyHexBattleOutcome(outcome: BattleResult | null): BellumDefeatEvaluation {
  const key = outcome ?? 'esc';
  const effects = HEX_BATTLE_OUTCOME_EFFECTS[key];
  applyBellumEffects(effects, null);
  return evaluateBellumDefeat(campaignState.value, { checkArmy: true });
}

/**
 * S33-09: testable hex-battle exit helper. Applies the strategic-layer
 * outcome (morale/supplies) and evaluates the defeat condition. Returns
 * both the defeat evaluation and the screen to navigate to next.
 *
 * Defeat path: `defeat.defeated === true` — `navigateToDefeat` was already
 * called internally by `evaluateBellumDefeat`; nextScreen is null so the
 * caller doesn't double-navigate.
 *
 * Victory/draw path: routes to 'post-battle' for the reward picker.
 */
export function handleHexBattleExit(
  result: BattleResult | null,
): { defeat: BellumDefeatEvaluation; nextScreen: 'post-battle' | null } {
  const defeat = applyHexBattleOutcome(result);
  if (defeat.defeated) return { defeat, nextScreen: null }; // defeat nav fired internally
  return { defeat, nextScreen: 'post-battle' };
}

