import { signal } from '@preact/signals';
import type { Faction, ResourceType } from '../core/commander';
import { spendResource, addResource } from '../core/resources';
import { threatLevel, globalSeason, getDoomUpkeep, getDoomMilestone } from '../core/game-state';
import { getActiveEffects } from '../items/doctrine-store';
import type { DoctrineEffect } from '../items/doctrine';
import type { Posture } from '../council/advisor';
import { collectProvinceIncome, type ProvinceIncomeResult } from '../province/province-store';

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
}

/** The active spoke, or null when the player is at the hub. */
export const currentSpoke = signal<Spoke | null>(null);

/** Result of the last battle (S2-05). Read by PostBattleScreen to show outcome. */
export type BattleResult = 'victory' | 'defeat' | 'draw';
export const lastBattleResult = signal<BattleResult | null>(null);

/** Index of the node the player is currently at (0-based). */
export const currentNodeIndex = signal(0);

// ── Spoke gains tracking (S2-09) ──

export const ZERO_GAINS: Record<ResourceType, number> = { gold: 0, faith: 0, influence: 0, momentum: 0 };

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

/** Clear spoke state (called on retreat or spoke completion). */
export function resetSpoke(): void {
  currentSpoke.value = null;
  currentNodeIndex.value = 0;
  spokeGains.value = { ...ZERO_GAINS };
}

/** Mark the current node as resolved and advance to the next one.
 *  Returns { spokeComplete, seasonTicked } — check seasonTicked for season boundary UI.
 *  Safe to call multiple times — resolved nodes are skipped. */
export function advanceNode(): AdvanceNodeResult {
  const spoke = currentSpoke.value;
  if (!spoke) return { spokeComplete: false, seasonTicked: null };
  const idx = currentNodeIndex.value;
  const node = spoke.nodes[idx];
  if (!node) return { spokeComplete: true, seasonTicked: null };

  // Guard: already resolved — don't double-advance
  if (node.resolved) return { spokeComplete: idx + 1 >= spoke.nodes.length, seasonTicked: null };

  // Create new node object to avoid in-place mutation
  const updatedNodes = spoke.nodes.map((n, i) =>
    i === idx ? { ...n, resolved: true } : n,
  );
  currentSpoke.value = { ...spoke, nodes: updatedNodes };
  const next = idx + 1;
  currentNodeIndex.value = next;

  const spokeComplete = next >= spoke.nodes.length;

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

  return { spokeComplete, seasonTicked };
}

/** Mark the spoke as completed and reset. */
export function completeSpoke(): void {
  const spoke = currentSpoke.value;
  if (spoke) {
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
}

