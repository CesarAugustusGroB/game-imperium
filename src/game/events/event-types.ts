import type { Faction, ResourceType } from '../core/commander';
import type { InvestmentType } from '../province/province';

// ── Event effect ──

export interface EventEffect {
  resource: ResourceType;
  amount: number; // positive = gain, negative = cost
}

// ── Event requirements ──

/** Conditions that must be met for an event to appear. */
export interface EventRequirement {
  /** Minimum threat level. */
  minThreat?: number;
  /** Minimum number of conquered provinces. */
  minProvinces?: number;
  /** Minimum resource values (all must be met). */
  minResource?: Partial<Record<ResourceType, number>>;
  /** Any province must have this investment built. */
  hasInvestment?: InvestmentType;
  /** Only available for this commander faction. */
  factionOnly?: Faction;
  /** A consequence flag that must have been set in a prior event. */
  requiresFlag?: string;
  /** A consequence flag that must NOT be set (blocks event). */
  blockedByFlag?: string;
}

// ── Event choice ──

export interface EventChoice {
  text: string;
  effects: EventEffect[];
  /** Optional consequence flag set when this choice is picked. */
  consequence?: string;
  /** Explicit resource floor — choice is unselectable if not met. */
  requiresResource?: Partial<Record<ResourceType, number>>;
}

// ── Event ──

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  /** Faction color affinity. 'neutral' = any faction. */
  color: Faction | 'neutral';
  /** Complexity/rarity tier. Higher tiers need higher threat to appear. */
  tier: 1 | 2 | 3;
  /** Conditions to be eligible for the event pool. */
  requirements?: EventRequirement;
  choices: EventChoice[];
}
