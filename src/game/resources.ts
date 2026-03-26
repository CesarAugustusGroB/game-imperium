import { signal } from '@preact/signals';
import type { Faction, ResourceType } from './commander';
import { FACTION_PRIMARY_RESOURCE } from './commander';

export interface Resources {
  gold: number;
  faith: number;
  influence: number;
  momentum: number;
}

/** Reactive resource signals. */
export const gold = signal(0);
export const faith = signal(0);
export const influence = signal(0);
export const momentum = signal(0);

const resourceSignals: Record<ResourceType, typeof gold> = {
  gold, faith, influence, momentum,
};

/** Initialize resources from starting values. */
export function initResources(starting: Resources): void {
  gold.value = starting.gold;
  faith.value = starting.faith;
  influence.value = starting.influence;
  momentum.value = starting.momentum;
}

/** Get current value of a resource. */
export function getResource(type: ResourceType): number {
  return resourceSignals[type].value;
}

/**
 * Add a resource. Applies 2x multiplier if it matches the faction's primary.
 * Returns the actual amount added.
 */
export function addResource(type: ResourceType, amount: number, faction?: Faction): number {
  const multiplier = faction && FACTION_PRIMARY_RESOURCE[faction] === type ? 2 : 1;
  const actual = Math.floor(amount * multiplier);
  resourceSignals[type].value += actual;
  return actual;
}

/**
 * Spend a resource. Returns false if insufficient (no deduction).
 */
export function spendResource(type: ResourceType, amount: number): boolean {
  if (resourceSignals[type].value < amount) return false;
  resourceSignals[type].value -= amount;
  return true;
}

/** Check if the player can afford a cost without spending. */
export function canAfford(type: ResourceType, amount: number): boolean {
  return resourceSignals[type].value >= amount;
}

/**
 * Exchange resources. Primary resource converts at 2:2, others at 3:2.
 * Returns the amount gained, or 0 if insufficient.
 */
export function exchangeResources(
  from: ResourceType, to: ResourceType, amount: number, faction: Faction,
): number {
  const isPrimary = FACTION_PRIMARY_RESOURCE[faction] === from;
  const rate = isPrimary ? 1 : 2 / 3; // 2:2 for primary, 3:2 for others
  const cost = isPrimary ? amount : Math.ceil(amount / rate);

  if (!spendResource(from, cost)) return 0;
  const gained = isPrimary ? amount : Math.floor(cost * rate);
  resourceSignals[to].value += gained;
  return gained;
}

/**
 * Get exchange rate info for display.
 * Returns { spend, gain } for converting `amount` of `from` to `to`.
 */
export function getExchangePreview(
  from: ResourceType, amount: number, faction: Faction,
): { spend: number; gain: number } {
  const isPrimary = FACTION_PRIMARY_RESOURCE[faction] === from;
  if (isPrimary) return { spend: amount, gain: amount }; // 2:2
  // 3:2 ratio
  const gain = Math.floor(amount * 2 / 3);
  return { spend: amount, gain };
}
