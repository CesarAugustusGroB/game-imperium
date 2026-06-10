import { signal } from '@preact/signals';
import type { ResourceType } from './commander';

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

export interface Resources {
  gold: number;
  iuniores: number;
}

/** Reactive resource signals. */
export const gold = signal(0);
export const iuniores = signal(0);

const resourceSignals: Record<ResourceType, typeof gold> = {
  gold, iuniores,
};

/** Initialize resources from starting values. */
export function initResources(starting: Resources): void {
  gold.value = starting.gold;
  iuniores.value = starting.iuniores;
}

/** Get current value of a resource. */
export function getResource(type: ResourceType): number {
  return resourceSignals[type].value;
}

/**
 * Add a resource, applying War Profiteer / doctrine income modifiers (capped at
 * +75%). Returns the actual amount added. Negative amounts are ignored and
 * return 0.
 */
export function addResource(type: ResourceType, amount: number): number {
  if (amount < 0) return 0;
  // S3-11 + S4-11: Additive bonus pool — War Profiteer and doctrine income-modifier stack additively
  let bonusMultiplier = 0;
  if (type === 'gold' && warProfilerActive) bonusMultiplier += 0.5;
  if (incomeModifierFn) bonusMultiplier += incomeModifierFn(type);
  bonusMultiplier = Math.min(bonusMultiplier, 0.75); // S9-07: cap income modifiers at +75%
  const actual = Math.floor(amount * (1 + bonusMultiplier));
  resourceSignals[type].value += actual;
  return actual;
}

/**
 * Refund a resource at face value — NO income modifiers applied (unlike
 * addResource). Use for returning what a player previously paid, so refunds
 * can't be inflated by War Profiteer / doctrine income bonuses.
 */
export function refundResource(type: ResourceType, amount: number): void {
  if (amount <= 0) return;
  resourceSignals[type].value += amount;
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

