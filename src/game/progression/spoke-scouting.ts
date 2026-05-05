/**
 * Itinerarium fog-of-war + scouting (S27-06).
 *
 * Two responsibilities:
 *   1. **Projection** — `getNodeIntel(node)` returns a level-shaped view of
 *      what the player is allowed to see for a given `SpokeNode`. The UI reads
 *      this instead of the raw node so it can never accidentally leak full
 *      info on an unscouted node.
 *   2. **Resolution** — `applyScoutReveal(spoke, centerIdx, radius, toLevel)`
 *      is the pure function that watchtower/scout encounters call to bump
 *      intel on nearby nodes. Resolved nodes are skipped, the function never
 *      lowers an existing intel level, and the input spoke is returned by
 *      reference when no node would change.
 *
 * GDD reference: Itinerarium §9.1 (Unknown / Scouted / Full Recon).
 */

import type { Spoke, SpokeNode, NodeReward } from './spoke';
import type { LandmarkType, EncounterType, BattleTerrain } from './landmark-types';
import type { SpokeEffect } from './spoke-effects';
import type { BattleTerrainModifier } from './battle-terrain-modifiers';

export type IntelLevel = 0 | 1 | 2;

export type ThreatHint = NonNullable<SpokeNode['threatHint']>;

/**
 * Subset of `SpokeNode` exposed at intel level 0. The player sees the place
 * (so they can plan a route) but the encounter is hidden behind a placeholder.
 * Fields stay optional because legacy spokes do not carry landmark metadata.
 */
export interface UnknownNodeIntel {
  level: 0;
  landmarkType?: LandmarkType;
  name?: string;
  terrain?: BattleTerrain;
  threatHint?: ThreatHint;
  /** Constant marker the UI can render in place of `encounterType`. */
  encounterPlaceholder: 'unknown';
}

/**
 * Intel level 1. The encounter and one risk line are revealed. Reward is
 * coarse: amounts rounded to the nearest 5 so the player gets the magnitude
 * without spoilers. `mainRisk` collapses the strongest negative effect (or the
 * threat hint, if there are no effects) into a single line.
 */
export interface ScoutedNodeIntel {
  level: 1;
  landmarkType?: LandmarkType;
  name?: string;
  terrain?: BattleTerrain;
  threatHint?: ThreatHint;
  encounterType?: EncounterType;
  /** Rewards with amounts rounded to the nearest 5. Null when the node has none. */
  approximateReward: NodeReward | null;
  /** One-line summary of the largest hazard, or null when nothing of note. */
  mainRisk: string | null;
}

/**
 * Intel level 2. Everything the engine knows about the node is exposed. This
 * is the data the player needs to decide whether to push or detour.
 */
export interface FullReconNodeIntel {
  level: 2;
  landmarkType?: LandmarkType;
  name?: string;
  terrain?: BattleTerrain;
  threatHint?: ThreatHint;
  encounterType?: EncounterType;
  reward: NodeReward | null;
  effects: readonly SpokeEffect[];
  battleModifiers: readonly BattleTerrainModifier[];
  enemyStrength?: number;
}

export type NodeIntel = UnknownNodeIntel | ScoutedNodeIntel | FullReconNodeIntel;

/**
 * Project a node into the view its current `scoutedLevel` allows. Resolved
 * nodes are always shown at full recon — once you've fought the battle, there
 * is nothing left to hide. Legacy nodes (no `scoutedLevel` set) also default
 * to full recon so existing spokes keep working unchanged.
 */
export function getNodeIntel(node: SpokeNode): NodeIntel {
  const level = effectiveIntelLevel(node);

  if (level === 0) {
    return {
      level: 0,
      landmarkType: node.landmarkType,
      name: node.name,
      terrain: node.terrain,
      threatHint: node.threatHint,
      encounterPlaceholder: 'unknown',
    };
  }

  if (level === 1) {
    return {
      level: 1,
      landmarkType: node.landmarkType,
      name: node.name,
      terrain: node.terrain,
      threatHint: node.threatHint,
      encounterType: node.encounterType,
      approximateReward: approximateReward(node.reward),
      mainRisk: summarizeMainRisk(node),
    };
  }

  return {
    level: 2,
    landmarkType: node.landmarkType,
    name: node.name,
    terrain: node.terrain,
    threatHint: node.threatHint,
    encounterType: node.encounterType,
    reward: node.reward,
    effects: node.effects ?? [],
    battleModifiers: node.battleModifiers ?? [],
    enemyStrength: node.enemyStrength,
  };
}

/**
 * Apply a radius scout centered on `centerIdx`. Bumps intel to `toLevel` on
 * every unresolved node within `[centerIdx - radius, centerIdx + radius]`,
 * clamped to the spoke's bounds.
 *
 * Invariants:
 *   - **Resolved nodes are never mutated** (AC6). Once you've resolved a node
 *     its intel is whatever the resolution wrote; scouting can't rewrite it.
 *   - **Intel never decreases**: the new level is `max(prev, toLevel)`.
 *   - **`revealed` and `scoutedLevel` stay in lockstep** — any node whose
 *     level reaches ≥1 is also marked `revealed: true`.
 *   - **No-op short-circuit**: if no node would change, the same `Spoke`
 *     reference is returned so callers can `if (next === spoke) return`.
 *
 * The center node itself is included in the radius (use `radius: 0` to scout
 * only the center). Negative radii are clamped to 0.
 */
export function applyScoutReveal(
  spoke: Spoke,
  centerIdx: number,
  radius: number,
  toLevel: 1 | 2,
): Spoke {
  if (spoke.nodes.length === 0) return spoke;
  const r = Math.max(0, radius);
  const lo = Math.max(0, centerIdx - r);
  const hi = Math.min(spoke.nodes.length - 1, centerIdx + r);
  if (lo > hi) return spoke;

  let touched = false;
  const nodes = spoke.nodes.map((n, i) => {
    if (i < lo || i > hi) return n;
    if (n.resolved) return n;
    const prevLevel = (n.scoutedLevel ?? 0) as IntelLevel;
    const nextLevel = (Math.max(prevLevel, toLevel) as IntelLevel);
    if (n.revealed === true && prevLevel === nextLevel) return n;
    touched = true;
    return { ...n, revealed: true, scoutedLevel: nextLevel };
  });

  if (!touched) return spoke;
  return { ...spoke, nodes };
}

/**
 * One-line summary of the most pressing hazard at a node. Used by the
 * scouted-level intel projection so the player gets a "main risk" line
 * without seeing the full effect breakdown.
 *
 * Priority:
 *   1. Encounter-driven risks (`ambush`, `hazard`, `siege`, elite/boss tier)
 *   2. Largest negative effect by absolute delta (`supplies`, `morale`,
 *      `iuniores`, `threat`).
 *   3. Coarse `threatHint` fallback for battle-flavored nodes.
 */
export function summarizeMainRisk(node: SpokeNode): string | null {
  const enc = node.encounterType;
  if (enc === 'ambush') return 'Ambush risk — enemy may strike unprepared';
  if (enc === 'hazard') return 'Terrain hazard — supply or morale loss likely';
  if (enc === 'siege') return 'Siege engagement — heavy casualties expected';
  if (enc === 'elite_battle') return 'Elite enemy force — above-strength engagement';
  if (enc === 'boss') return 'Boss encounter — campaign-defining battle';

  const worst = worstNegativeEffect(node.effects);
  if (worst) return formatEffectRisk(worst);

  if (enc === 'battle' && node.threatHint) {
    return `${capitalize(node.threatHint)} threat battle`;
  }
  return null;
}

// ── Internal helpers ──

function effectiveIntelLevel(node: SpokeNode): IntelLevel {
  // Resolved nodes always show full info — nothing left to hide.
  if (node.resolved) return 2;
  // Legacy nodes (S2-era) default to full recon so existing spokes keep
  // working. Itinerarium spokes set scoutedLevel explicitly at generation.
  if (node.scoutedLevel === undefined) return 2;
  return node.scoutedLevel;
}

function approximateReward(reward: NodeReward | null): NodeReward | null {
  if (!reward || reward.length === 0) return null;
  return reward.map((r) => ({
    resource: r.resource,
    amount: roundToNearest(r.amount, 5),
  }));
}

function roundToNearest(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

function worstNegativeEffect(effects: readonly SpokeEffect[] | undefined): SpokeEffect | null {
  if (!effects || effects.length === 0) return null;
  let worst: SpokeEffect | null = null;
  let worstMagnitude = 0;
  for (const e of effects) {
    const delta = effectNegativeDelta(e);
    if (delta === null) continue;
    const magnitude = Math.abs(delta);
    if (magnitude > worstMagnitude) {
      worst = e;
      worstMagnitude = magnitude;
    }
  }
  return worst;
}

function effectNegativeDelta(e: SpokeEffect): number | null {
  switch (e.type) {
    case 'morale':
    case 'supplies':
    case 'iuniores':
    case 'gold':
    case 'momentum':
      return e.delta < 0 ? e.delta : null;
    case 'threat':
      // Threat increases are bad for the player.
      return e.delta > 0 ? e.delta : null;
    case 'reveal':
    case 'scout':
    case 'battle-modifier':
      return null;
  }
}

function formatEffectRisk(e: SpokeEffect): string {
  switch (e.type) {
    case 'morale':    return `Morale loss (${e.delta})`;
    case 'supplies':  return `Supply loss (${e.delta})`;
    case 'iuniores':  return `Iuniores drain (${e.delta})`;
    case 'gold':      return `Gold cost (${e.delta})`;
    case 'momentum':  return `Momentum cost (${e.delta})`;
    case 'threat':    return `Threat rises (+${e.delta})`;
    // Non-negative variants never reach this path; satisfy exhaustiveness.
    case 'reveal':
    case 'scout':
    case 'battle-modifier':
      return e.label;
  }
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
