import { signal } from '@preact/signals';
import type { Faction, ResourceType } from '../core/commander';
import { spendResource, addResource } from '../core/resources';
import { threatLevel, globalSeason, getDoomUpkeep, getDoomMilestone } from '../core/game-state';
import { getActiveEffects } from '../items/doctrine-store';
import type { DoctrineEffect } from '../items/doctrine';
import type { Posture } from '../council/advisor';
import { collectProvinceIncome, type ProvinceIncomeResult } from '../province/province-store';
import type { ArmyData } from '../../types/index';
import { computeArmySize } from '../army/cohort';
import type { Legate } from '../army/legate';
import { consumeTraversal, type TraversalAttritionLog } from '../army/supplies';
import { preparedArmy } from './strategic-store';
import type { LandmarkType, EncounterType, BattleTerrain } from './landmark-types';
import type { SpokeEffect } from './spoke-effects';
import { applySpokeEffects } from './spoke-effects';
import type { BattleTerrainModifier } from './battle-terrain-modifiers';

export type { TraversalAttritionLog } from '../army/supplies';

// ── Node types (S2-01) ──

/** The type of encounter at a spoke node. */
export type NodeType = 'battle' | 'rest' | 'event' | 'boss';

/** A resource reward granted by completing a node. */
export type NodeReward = { resource: ResourceType; amount: number }[];

/** A single node in a spoke — the player resolves these in order. */
export interface SpokeNode {
  id: string;
  type: NodeType;
  /** 0-based index within the spoke. */
  position: number;
  /** Flipped to true after the player completes this node. */
  resolved: boolean;
  /** Pre-set reward, or null when reward depends on player choice (events). */
  reward: NodeReward | null;

  // ── S27 Itinerarium metadata (all optional during migration) ──
  // Legacy spokes built by `council-store.generateSpokeFromCouncil` leave these
  // unset. New Itinerarium spokes populate them; readers must handle absence.
  // The legacy `type` field stays the canonical encounter discriminator until
  // the migration to `encounterType` lands in S27-05.

  /** Physical place this node represents (forest, hill, village, …). */
  landmarkType?: LandmarkType;
  /** Player-facing landmark name (e.g. "Blackwood Forest"). */
  name?: string;
  /** Battle-arena terrain when this node hosts a battle. */
  terrain?: BattleTerrain;
  /** Itinerarium-aware encounter discriminator. Coexists with legacy `type`. */
  encounterType?: EncounterType;

  /** Fog state. `undefined` = treat as revealed (legacy default). */
  revealed?: boolean;
  /** 0=unknown, 1=scouted, 2=full recon. See GDD §9.1. */
  scoutedLevel?: 0 | 1 | 2;

  /** Army-side consequences applied on resolution (morale/supplies/iuniores/…). */
  effects?: SpokeEffect[];
  /** Tactical modifiers passed to BattleV2 when this node hosts a battle. */
  battleModifiers?: BattleTerrainModifier[];

  /** Coarse threat tier for the unknown-state UI. Refined by scouting. */
  threatHint?: 'low' | 'medium' | 'high' | 'deadly';
  /** Optional explicit enemy strength for boss/elite tuning. */
  enemyStrength?: number;
  /** Free-form route tags for branching paths. Controlled vocabulary in S27-04. */
  routeTags?: string[];
}

// ── Spoke container (S2-02) ──

/** A linear sequence of nodes the player walks through. */
export interface Spoke {
  nodes: SpokeNode[];
  label: string;
  completed: boolean;
  /** Duration in seasons (1-4). Set at generation time. */
  duration: number;
  /** Current season (1-indexed). Advances as nodes are resolved. */
  currentSeason: number;
  /** Posture of this spoke. Affects upkeep costs. */
  posture: Posture;
  /**
   * S14-06: Army snapshotted from `preparedArmy` at embark time. Read by
   * the battle layer in `src/battle/index.ts` to populate the player
   * faction's units in pitched battles. Optional so legacy spoke
   * construction sites compile unchanged.
   */
  boundArmy?: ArmyData | null;
  /**
   * S14-06: Legate snapshotted from `preparedLegate` at embark time. Drives
   * the trait pass in `BattleState.placeStartingUnits` (see S14-05).
   */
  boundLegate?: Legate | null;
}

/** The active spoke, or null when the player is at the hub. */
export const currentSpoke = signal<Spoke | null>(null);

/** Result of the last battle (S2-05). Read by PostBattleScreen to show outcome. */
export type BattleResult = 'victory' | 'defeat' | 'draw';
export const lastBattleResult = signal<BattleResult | null>(null);

/** Index of the node the player is currently at (0-based). */
export const currentNodeIndex = signal(0);

// ── Spoke gains tracking (S2-09) ──

export const ZERO_GAINS: Record<ResourceType, number> = { gold: 0, faith: 0, influence: 0, momentum: 0, iuniores: 0 };

/** Cumulative resource gains during the current spoke. Read by spoke completion summary. */
export const spokeGains = signal<Record<ResourceType, number>>({ ...ZERO_GAINS });

/**
 * Grant a resource during a spoke, tracking the gain.
 * Wraps addResource — passes through the actual amount added (after 2x multiplier).
 */
export function grantSpokeResource(type: ResourceType, amount: number, faction?: Faction): number {
  const actual = addResource(type, amount, faction);
  spokeGains.value = { ...spokeGains.value, [type]: spokeGains.value[type] + actual };
  return actual;
}

/** Get the current node, or null if no spoke is active. */
export function getCurrentNode(): SpokeNode | null {
  const spoke = currentSpoke.value;
  if (!spoke) return null;
  return spoke.nodes[currentNodeIndex.value] ?? null;
}

/**
 * Mirror the spoke's mutable army state onto the persistent Hub roster
 * (`preparedArmy`). Call after every mutation of `boundArmy.cohorts` or
 * `boundArmy.supplies` so Hub views always see live state mid-spoke and
 * any logistical gains/losses survive spoke completion or retreat.
 *
 * Persisted fields:
 *   - cohorts (HP, outOfAction, casualties)
 *   - size (recomputed)
 *   - supplies (forage / depot / hazard outcomes from S27-03 effects)
 *
 * Transient fields like `supplyMoralePenalty`, `consecutiveDeficitCount`,
 * and `campaignMoraleDelta` are NOT mirrored — they are spoke-scoped and
 * should reset on the next embark.
 */
export function syncPreparedFromBoundArmy(boundArmy: ArmyData | null | undefined): void {
  if (!boundArmy || !preparedArmy.value) return;
  preparedArmy.value = {
    ...preparedArmy.value,
    cohorts: boundArmy.cohorts,
    size: computeArmySize(boundArmy.cohorts),
    supplies: boundArmy.supplies,
  };
}

/**
 * S27-09 fix: ids of nodes whose data-driven effects have already been
 * applied (e.g. ambush damage applied pre-battle). advanceNode skips the
 * apply step when the current node is in this set so effects never
 * double-apply. Cleared on retreat / completion.
 */
const preAppliedEffectNodeIds = new Set<string>();

/** Mark a node's effects as already-applied so advanceNode skips them. */
export function markNodeEffectsApplied(nodeId: string): void {
  preAppliedEffectNodeIds.add(nodeId);
}

/** Apply a node's effects right now and mark them as applied. Used by
 *  ambush flow so the negative hit lands BEFORE the battle, not after. */
export function applyNodeEffectsNow(node: SpokeNode): void {
  if (!node.effects || node.effects.length === 0) return;
  applySpokeEffects(node.effects);
  preAppliedEffectNodeIds.add(node.id);
}

/** Clear spoke state (called on retreat or spoke completion). */
export function resetSpoke(): void {
  // Sync casualties to preparedArmy before tearing down the spoke (handles retreat).
  const finalBound = currentSpoke.value?.boundArmy ?? null;
  syncPreparedFromBoundArmy(finalBound);
  currentSpoke.value = null;
  currentNodeIndex.value = 0;
  spokeGains.value = { ...ZERO_GAINS };
  preAppliedEffectNodeIds.clear();
}

/** Mark the current node as resolved and advance to the next one.
 *  Returns { spokeComplete, seasonTicked, supplyLog } — check seasonTicked for
 *  season boundary UI; supplyLog reports supply attrition on this traversal.
 *  Safe to call multiple times — resolved nodes are skipped. */
export function advanceNode(): AdvanceNodeResult {
  const spoke = currentSpoke.value;
  if (!spoke) return { spokeComplete: false, seasonTicked: null, supplyLog: null };
  const idx = currentNodeIndex.value;
  const node = spoke.nodes[idx];
  if (!node) return { spokeComplete: true, seasonTicked: null, supplyLog: null };

  // Guard: already resolved — don't double-advance. Tied to this guard,
  // applySpokeEffects() below runs exactly once per node — re-clicks and
  // rerenders cannot double-apply (S27-09 AC7).
  if (node.resolved) return { spokeComplete: idx + 1 >= spoke.nodes.length, seasonTicked: null, supplyLog: null };

  // S27-09: apply this node's data-driven effects (morale/supplies/iuniores/
  // reveal/scout/battle-modifier/threat) at the resolved transition. Centered
  // on currentNodeIndex which still points at this node. applySpokeEffects
  // mutates `currentSpoke.value`, so we re-read after.
  // The pre-applied set is consulted so flows like ambush (which apply
  // effects BEFORE the battle to bias it) don't double-apply on return.
  if (node.effects && node.effects.length > 0 && !preAppliedEffectNodeIds.has(node.id)) {
    applySpokeEffects(node.effects);
  }
  preAppliedEffectNodeIds.delete(node.id);
  const spokeAfterEffects = currentSpoke.value ?? spoke;

  // FT-SUP: consume supplies for this traversal BEFORE advancing. Attrition
  // (HP damage + morale penalty) is applied when supplies run short. Cohorts
  // reduced to 0 HP are removed from the roster here so the next battle
  // spawns the shrunken army.
  let supplyLog: TraversalAttritionLog | null = null;
  let nextBoundArmy = spokeAfterEffects.boundArmy ?? null;
  if (nextBoundArmy && nextBoundArmy.cohorts.length > 0) {
    const result = consumeTraversal(nextBoundArmy);
    nextBoundArmy = result.army;
    supplyLog = result.log;
  }

  // Create new node object to avoid in-place mutation
  const updatedNodes = spokeAfterEffects.nodes.map((n, i) =>
    i === idx ? { ...n, resolved: true } : n,
  );
  currentSpoke.value = {
    ...spokeAfterEffects,
    nodes: updatedNodes,
    boundArmy: nextBoundArmy,
  };
  syncPreparedFromBoundArmy(nextBoundArmy);
  const next = idx + 1;
  currentNodeIndex.value = next;

  const spokeComplete = next >= spokeAfterEffects.nodes.length;

  // Check season boundary
  let seasonTicked: SeasonTickResult | null = null;
  const currentSp = currentSpoke.value;
  if (currentSp && currentSp.currentSeason < currentSp.duration) {
    const nodesPerSeason = Math.ceil(currentSp.nodes.length / currentSp.duration);
    const resolvedCount = currentSp.nodes.filter(n => n.resolved).length;
    const expectedSeason = Math.min(
      Math.floor(resolvedCount / nodesPerSeason) + 1,
      currentSp.duration,
    );
    if (expectedSeason > currentSp.currentSeason) {
      seasonTicked = tickSeason();
    }
  }

  return { spokeComplete, seasonTicked, supplyLog };
}

/** Mark the spoke as completed and reset.
 *
 *  S26-05 / FT-HEAL FR-3: project the wounded `boundArmy.cohorts` (with their
 *  `currentHp` + `outOfAction` flags from S26-03's battle write-back) onto the
 *  Hub roster `preparedArmy` so wounds carry across spokes and surface in the
 *  Hub heal panel (S26-07). Cohorts removed by FT-SUP supply attrition during
 *  the spoke also disappear from preparedArmy because the boundArmy roster
 *  *replaces* the prepared roster wholesale — no merge.
 */
export function completeSpoke(): void {
  const spoke = currentSpoke.value;
  if (spoke) {
    // S26-05: write back the post-spoke army state before tearing the spoke
    // down. Delegate to the shared helper (idempotent with resetSpoke's sync).
    syncPreparedFromBoundArmy(spoke.boundArmy);

    // Trigger reactivity with a new object instead of in-place mutation
    currentSpoke.value = { ...spoke, completed: true };
  }
  resetSpoke();
}

// ── Season system (S5-03) ──

/** Base upkeep cost per season tick. */
export const BASE_UPKEEP: Partial<Record<ResourceType, number>> = { gold: 2, faith: 1 };

/** Additional upkeep for 'attacking' posture. */
export const ATTACKING_UPKEEP_BONUS: Partial<Record<ResourceType, number>> = { gold: 1, momentum: 1 };

/** Threat increase per season tick. */
export const THREAT_PER_SEASON = 1;

/** Result of a season tick, for the UI to display. */
export interface SeasonTickResult {
  season: number;
  globalSeason: number;
  doomUpkeep: number;
  doomMilestone: string | null;
  upkeepPaid: { resource: ResourceType; amount: number }[];
  upkeepShortfall: { resource: ResourceType; deficit: number }[];
  threatIncrease: number;
  provinceIncome: ProvinceIncomeResult | null;
}

/**
 * Advance to the next season within the current spoke.
 * Drains upkeep resources (reduced by doctrine upkeep-reduction) and increments threat.
 */
export function tickSeason(): SeasonTickResult | null {
  const spoke = currentSpoke.value;
  if (!spoke || spoke.currentSeason >= spoke.duration) return null;

  const newSeason = spoke.currentSeason + 1;

  // Compute upkeep reduction from doctrines
  const reductionPercent = getActiveEffects()
    .filter((e): e is Extract<DoctrineEffect, { type: 'upkeep-reduction'; percent: number }> => e.type === 'upkeep-reduction' && 'percent' in e)
    .reduce((sum, e) => sum + e.percent, 0);
  const reductionMultiplier = Math.max(0, 1 - reductionPercent / 100);

  // Compute raw upkeep
  const rawUpkeep: Partial<Record<ResourceType, number>> = { ...BASE_UPKEEP };
  if (spoke.posture === 'attacking') {
    for (const [res, amt] of Object.entries(ATTACKING_UPKEEP_BONUS) as [ResourceType, number][]) {
      rawUpkeep[res] = (rawUpkeep[res] ?? 0) + amt;
    }
  }

  // Apply upkeep
  const upkeepPaid: SeasonTickResult['upkeepPaid'] = [];
  const upkeepShortfall: SeasonTickResult['upkeepShortfall'] = [];

  for (const [res, rawAmt] of Object.entries(rawUpkeep) as [ResourceType, number][]) {
    const amount = Math.floor(rawAmt * reductionMultiplier);
    if (amount <= 0) continue;
    if (spendResource(res, amount)) {
      upkeepPaid.push({ resource: res, amount });
    } else {
      upkeepShortfall.push({ resource: res, deficit: amount });
    }
  }

  // Doom escalation upkeep (extra gold drain)
  const doomUpkeep = getDoomUpkeep();
  if (doomUpkeep > 0) {
    if (spendResource('gold', doomUpkeep)) {
      upkeepPaid.push({ resource: 'gold', amount: doomUpkeep });
    } else {
      upkeepShortfall.push({ resource: 'gold', deficit: doomUpkeep });
    }
  }

  // Increment threat
  threatLevel.value += THREAT_PER_SEASON;

  // Advance global season clock
  globalSeason.value += 1;
  const doomMilestone = getDoomMilestone();

  // Collect province income
  const provinceIncome = collectProvinceIncome();

  // Advance season
  currentSpoke.value = { ...spoke, currentSeason: newSeason };

  return {
    season: newSeason,
    globalSeason: globalSeason.value,
    doomUpkeep,
    doomMilestone,
    upkeepPaid,
    upkeepShortfall,
    threatIncrease: THREAT_PER_SEASON,
    provinceIncome,
  };
}

/** Return type for advanceNode. */
export interface AdvanceNodeResult {
  spokeComplete: boolean;
  seasonTicked: SeasonTickResult | null;
  /** FT-SUP: supply attrition applied to the bound army on this traversal,
   *  or null when there's no army (or no-op). UI can surface kills/damage. */
  supplyLog: TraversalAttritionLog | null;
}

