import { signal } from '@preact/signals';
import type { Faction, ResourceType } from './commander';
import { FACTION_PRIMARY_RESOURCE } from './commander';

// S3-11: War Profiteer flag — kept as module-level state (NOT imported from game-state.ts)
// to avoid a circular dependency: game-state.ts imports resources.ts; if resources.ts
// imported game-state.ts the chain would be circular. Instead, game-state.ts pushes
// the flag in via setWarProfiler() during startNewRun / resetRun.
let warProfilerActive = false;

export function setWarProfiler(active: boolean): void {
  warProfilerActive = active;
}

// S4-11: Doctrine income-modifier — same pattern as warProfiler to avoid circular deps.
// Caller pushes a getter that returns the additive multiplier for a resource type.
let incomeModifierFn: ((type: ResourceType) => number) | null = null;

export function setIncomeModifierFn(fn: ((type: ResourceType) => number) | null): void {
  incomeModifierFn = fn;
}

// S6-10: Market T3 exchange rate bonus — caller pushes a getter.
let exchangeBonusFn: (() => number) | null = null;

export function setExchangeBonusFn(fn: (() => number) | null): void {
  exchangeBonusFn = fn;
}

export interface Resources {
  gold: number;
  faith: number;
  influence: number;
  momentum: number;
  iuniores: number;
}

/** Reactive resource signals. */
export const gold = signal(0);
export const faith = signal(0);
export const influence = signal(0);
export const momentum = signal(0);
export const iuniores = signal(0);

const resourceSignals: Record<ResourceType, typeof gold> = {
  gold, faith, influence, momentum, iuniores,
};

/** Initialize resources from starting values. */
export function initResources(starting: Resources): void {
  gold.value = starting.gold;
  faith.value = starting.faith;
  influence.value = starting.influence;
  momentum.value = starting.momentum;
  iuniores.value = starting.iuniores;
}

/** Get current value of a resource. */
export function getResource(type: ResourceType): number {
  return resourceSignals[type].value;
}

/**
 * Add a resource. Applies 2x multiplier if it matches the faction's primary.
 * Returns the actual amount added. Negative amounts are ignored and return 0.
 */
export function addResource(type: ResourceType, amount: number, faction?: Faction): number {
  if (amount < 0) return 0;
  const factionMultiplier = faction && FACTION_PRIMARY_RESOURCE[faction] === type ? 2 : 1;
  // S3-11 + S4-11: Additive bonus pool — War Profiteer and doctrine income-modifier stack additively
  let bonusMultiplier = 0;
  if (type === 'gold' && warProfilerActive) bonusMultiplier += 0.5;
  if (incomeModifierFn) bonusMultiplier += incomeModifierFn(type);
  bonusMultiplier = Math.min(bonusMultiplier, 0.75); // S9-07: cap income modifiers at +75%
  const actual = Math.floor(amount * factionMultiplier * (1 + bonusMultiplier));
  resourceSignals[type].value += actual;
  return actual;
}

/**
 * Spend a resource. Returns false if insufficient or negative (no deduction).
 */
export function spendResource(type: ResourceType, amount: number): boolean {
  if (amount < 0) return false;
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
 * @param amount - The amount to spend from the source resource.
 */
export function exchangeResources(
  from: ResourceType, to: ResourceType, amount: number, faction: Faction,
): number {
  if (amount <= 0) return 0;
  const isPrimary = FACTION_PRIMARY_RESOURCE[faction] === from;
  const bonus = exchangeBonusFn ? exchangeBonusFn() : 0;
  const gained = (isPrimary ? amount : Math.floor(amount * 2 / 3)) + bonus;
  if (!spendResource(from, amount)) return 0;
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
  const bonus = exchangeBonusFn ? exchangeBonusFn() : 0;
  if (isPrimary) return { spend: amount, gain: amount + bonus };
  const gain = Math.floor(amount * 2 / 3) + bonus;
  return { spend: amount, gain };
}
