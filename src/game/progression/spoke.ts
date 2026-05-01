import { signal } from '@preact/signals';
import type { Faction, ResourceType } from '../core/commander';
import { addResource } from '../core/resources';
import type { Posture } from '../council/advisor';
import type { ArmyData } from '../../types/index';
import { computeArmySize } from '../army/cohort';
import type { Legate } from '../army/legate';
import { consumeTraversal, type TraversalAttritionLog } from '../army/supplies';
import { preparedArmy } from './strategic-store';
import type { LandmarkType, EncounterType, BattleTerrain } from './landmark-types';
import type { SpokeEffect } from './spoke-effects';
import { applySpokeEffects } from './spoke-effects';
import type { BattleTerrainModifier, BattleContext } from './battle-terrain-modifiers';
import {
  BASE_UPKEEP,
  ATTACKING_UPKEEP_BONUS,
  THREAT_PER_SEASON,
  runSeasonTick,
  type SeasonTickResult,
} from './season-tick';

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
  /**
   * S27-08: optional bifurcations off the main chain. Each branch is a
   * 1–3 node side-route attached to a main-chain index (`attachAfter`).
   * The fork model: when the player picks a branch, `chooseBranch`
   * splices the chain into `nodes[]` AT `attachAfter`, replacing the
   * original main node there. `currentNodeIndex` then resolves the
   * inserted chain sequentially before continuing.
   */
  branches?: SpokeBranch[];
  /** S27 variety pass: drives landmark/boss/branch biasing at generation. */
  theme?: SpokeTheme;
}

/** S27 variety pass: theme buckets that bias landmark/branch/boss selection. */
export type SpokeTheme = 'woodland' | 'highlands' | 'marshland' | 'coastal' | 'mixed';

/**
 * S27-08: a side-route attached to a main-chain index. The `nodes` array is
 * 1–3 entries long; index 0 is the head (the only node the player can pick
 * to commit the branch). Tail nodes are inspectable but their action button
 * is gated until commitment splices the chain into the main path.
 */
export interface SpokeBranch {
  /** Index in `Spoke.nodes` after which this branch forks. */
  attachAfter: number;
  /** Branch chain. 1–3 entries; nodes[0] is the head (committable). */
  nodes: SpokeNode[];
}

/** The active spoke, or null when the player is at the hub. */
export const currentSpoke = signal<Spoke | null>(null);

/** Result of the last battle (S2-05). Read by PostBattleScreen to show outcome. */
export type BattleResult = 'victory' | 'defeat' | 'draw';
/** S33-11: TRANSIENT — battle-exit signal, not persisted. */
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
 * S27-10: derive the battle context from the current spoke + node. Returned
 * shape is what BattleV2's entry path stamps onto `currentBattleContext` so
 * the battle screen can render terrain/modifier UI without reading game
 * state directly. Returns null when there is no active node — quick battles
 * use that path to stay neutral.
 */
export function deriveBattleContextFromCurrentSpoke(): BattleContext | null {
  const spoke = currentSpoke.value;
  if (!spoke) return null;
  const node = spoke.nodes[currentNodeIndex.value];
  if (!node) return null;
  return {
    sourceNodeId: node.id,
    encounterType: node.encounterType ?? legacyEncounterFromNodeType(node.type),
    terrain: node.terrain ?? null,
    modifiers: node.battleModifiers ?? [],
    enemyStrength: node.enemyStrength ?? null,
    landmarkName: node.name ?? null,
  };
}

export function legacyEncounterFromNodeType(t: NodeType): EncounterType {
  if (t === 'boss') return 'boss';
  if (t === 'rest') return 'rest';
  if (t === 'event') return 'event';
  return 'battle';
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

/**
 * Pure helper used by `chooseBranch` and Golden Opportunity rest insertion.
 * Splices `inserted` into `nodes` at `insertAt`, **replacing** the slot at
 * that index when `replaceAt` is true (branch commitment) or **inserting
 * before** when false (Golden Opportunity adds without removing).
 *
 * Reindexes every node's `position` to its new array index and shifts every
 * remaining branch's `attachAfter` so it still points at the right landmark
 * after the splice. Branches whose attach index falls inside the inserted
 * range (replaceAt=true case where the original main node carried a branch)
 * would be orphaned — but the call sites already drop the committed branch
 * before invoking this helper, so that case never reaches here.
 *
 * Returns a fresh `{ nodes, branches }` pair; the inputs are not mutated.
 */
export function reindexSpokeNodesAndBranches(
  nodes: readonly SpokeNode[],
  branches: readonly SpokeBranch[] | undefined,
  insertAt: number,
  inserted: readonly SpokeNode[],
  replaceAt: boolean,
): { nodes: SpokeNode[]; branches: SpokeBranch[] | undefined } {
  // Splice
  const before = nodes.slice(0, insertAt);
  const after = nodes.slice(insertAt + (replaceAt ? 1 : 0));
  const merged = [...before, ...inserted, ...after];

  // Reindex positions
  const reindexed = merged.map((n, i) => (n.position === i ? n : { ...n, position: i }));

  // Shift remaining branches
  const sizeDelta = inserted.length - (replaceAt ? 1 : 0);
  const shifted = branches?.map(b => {
    if (b.attachAfter <= insertAt) return b;
    return { ...b, attachAfter: b.attachAfter + sizeDelta };
  });

  return { nodes: reindexed, branches: shifted };
}

/**
 * S27-08 closure: commit a bifurcation. Splices the branch's full chain
 * (1–3 nodes) into `spoke.nodes` at `attachAfter`, replacing the original
 * main node at that index, reindexes node positions, and shifts later
 * branches' `attachAfter` to absorb the chain's length delta. Removes the
 * committed branch from `spoke.branches`.
 *
 * No-op when the branch isn't found, the player isn't standing at the fork
 * point, the main node has already been resolved, or the chain is empty.
 * Returns true when the commit happened so the UI can fire activation.
 */
export function chooseBranch(branchHeadId: string): boolean {
  const spoke = currentSpoke.value;
  if (!spoke || !spoke.branches || spoke.branches.length === 0) return false;
  const branch = spoke.branches.find(b => b.nodes[0]?.id === branchHeadId);
  if (!branch || branch.nodes.length === 0) return false;
  if (branch.attachAfter !== currentNodeIndex.value) return false;
  const mainNode = spoke.nodes[branch.attachAfter];
  if (!mainNode || mainNode.resolved) return false;

  // Drop the committed branch BEFORE the splice so the helper doesn't see it.
  const remainingBranches = spoke.branches.filter(b => b !== branch);
  const inserted = branch.nodes.map(n => ({ ...n }));
  const { nodes, branches } = reindexSpokeNodesAndBranches(
    spoke.nodes,
    remainingBranches,
    branch.attachAfter,
    inserted,
    true,
  );
  currentSpoke.value = { ...spoke, nodes, branches };
  return true;
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

export { BASE_UPKEEP, ATTACKING_UPKEEP_BONUS, THREAT_PER_SEASON, type SeasonTickResult };

/**
 * Advance to the next season within the current spoke.
 * Drains upkeep resources (reduced by doctrine upkeep-reduction) and increments threat.
 */
export function tickSeason(): SeasonTickResult | null {
  const spoke = currentSpoke.value;
  if (!spoke || spoke.currentSeason >= spoke.duration) return null;

  const newSeason = spoke.currentSeason + 1;

  const result = runSeasonTick(spoke.posture, newSeason);

  // Advance season
  currentSpoke.value = { ...spoke, currentSeason: newSeason };

  return result;
}

/** Return type for advanceNode. */
export interface AdvanceNodeResult {
  spokeComplete: boolean;
  seasonTicked: SeasonTickResult | null;
  /** FT-SUP: supply attrition applied to the bound army on this traversal,
   *  or null when there's no army (or no-op). UI can surface kills/damage. */
  supplyLog: TraversalAttritionLog | null;
}

