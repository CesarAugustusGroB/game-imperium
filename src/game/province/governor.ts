import type { Faction, ResourceType } from '../core/commander';
import type { ResourceCost } from '../items/doctrine';

// ── Governor traits (discriminated union on `type`) ──

export type GovernorTrait =
  | { type: 'income-bonus'; resource: ResourceType; percent: number }
  | { type: 'expense-reduction'; percent: number }
  | { type: 'unrest-reduction'; flat: number }
  | { type: 'population-growth'; amount: number }
  | { type: 'investment-discount'; percent: number }
  | { type: 'garrison-strength'; percent: number };

// ── Governor tier ──

export interface GovernorTier {
  description: string;
  traits: GovernorTrait[];
  hireCost: ResourceCost;
}

// ── Governor ──

export interface Governor {
  id: string;
  name: string;
  color: Faction;
  tiers: [GovernorTier, GovernorTier, GovernorTier];
}

// ── Helpers ──

export function getHireCost(governor: Governor, tier: 1 | 2 | 3): ResourceCost {
  return governor.tiers[tier - 1].hireCost;
}
