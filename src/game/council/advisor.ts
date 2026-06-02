import type { ResourceType } from '../core/commander';
import type { GameEntity, FactionAffiliated, TierLevel, TierTuple } from '../../types/index';

// ── Posture ──

/** Spoke posture: attacking = conquest/sieges, defending = holding/rebellions. */
export type Posture = 'attacking' | 'defending';

// ── Spoke template ──

/**
 * What an advisor contributes to campaign planning (duration + posture).
 */
export interface SpokeTemplate {
  /** Min and max spoke duration in seasons (1-4). */
  durationRange: [min: number, max: number];
  posture: Posture;
}

// ── Advisor passive ──

/** Passive bonus while the advisor is seated on the Council. */
export type AdvisorPassive =
  | { type: 'resource-per-spoke'; resource: ResourceType; amount: number }
  | { type: 'upkeep-reduction'; percent: number }
  | { type: 'shop-discount'; percent: number }
  | { type: 'extra-event-choices'; count: number }
  | { type: 'heal-between-nodes'; amount: number }
  | { type: 'threat-reduction'; amount: number }
  | { type: 'loot-bonus'; percent: number }
  | { type: 'enemy-weaken'; amount: number }
  | { type: 'campaign-time'; days: number }
  | { type: 'morale-bonus'; amount: number }
  | { type: 'soldiers-bonus'; amount: number };

// ── Advisor tier ──

export interface AdvisorTier {
  description: string;
  passive: AdvisorPassive;
  spokeTemplate: SpokeTemplate;
}

export type AdvisorTrait =
  | 'Diplomat'
  | 'Negotiator'
  | 'Strategist'
  | 'Veteran'
  | 'Logistician'
  | 'Schemer'
  | 'Mastermind'
  | 'Coin-Keeper'
  | 'Administrator'
  | 'Financier'
  | 'Healer'
  | 'Zealot'
  | 'Pontifex'
  | 'Tribune';

// ── Advisor ──

/**
 * An advisor that sits on the Council (3 slots).
 * Color is UNRESTRICTED — any commander can hire any color advisor.
 * This is a deliberate design break from Doctrines/Decretum.
 */
export interface Advisor extends GameEntity, FactionAffiliated {
  /** Current tier: 1, 2, or 3. Levels up with use. */
  currentTier: TierLevel;
  /** XP accumulated toward next tier. */
  xp: number;
  /** Optional portrait asset path for Consilium presentation. */
  portrait?: string;
  /** Trait chips for advisor market / hero UI. */
  traits: AdvisorTrait[];
  /** Gold price when this advisor appears as a market offer. */
  cost: number;
  /** Fixed 3-tier structure: [Tier I, Tier II, Tier III]. */
  tiers: TierTuple<AdvisorTier>;
}

// ── XP thresholds ──

/** XP needed to reach Tier 2 (cumulative). S9-08: raised from 3. */
export const XP_TIER_2 = 5;
/** XP needed to reach Tier 3 (cumulative). S9-08: raised from 6. */
export const XP_TIER_3 = 12;

// ── Pure helpers ──

/** Get the current tier data for an advisor. */
export function getCurrentTier(advisor: Advisor): AdvisorTier {
  return advisor.tiers[advisor.currentTier - 1];
}

/** Get the current passive bonus. */
export function getCurrentPassive(advisor: Advisor): AdvisorPassive {
  return getCurrentTier(advisor).passive;
}

/** Get the current spoke template. */
export function getCurrentSpokeTemplate(advisor: Advisor): SpokeTemplate {
  return getCurrentTier(advisor).spokeTemplate;
}

/** Get remaining XP to next tier, or null if already max (Tier 3). */
export function getXpToNextTier(advisor: Advisor): number | null {
  if (advisor.currentTier >= 3) return null;
  const threshold = advisor.currentTier === 1 ? XP_TIER_2 : XP_TIER_3;
  return Math.max(0, threshold - advisor.xp);
}

/** Determine the tier for a given XP value. */
export function getTierForXp(xp: number): 1 | 2 | 3 {
  if (xp >= XP_TIER_3) return 3;
  if (xp >= XP_TIER_2) return 2;
  return 1;
}
