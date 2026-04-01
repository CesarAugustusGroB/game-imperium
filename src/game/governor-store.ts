import { signal } from '@preact/signals';
import type { Governor, GovernorTrait } from './governor';
import { getHireCost } from './governor';
import type { ResourceType } from './commander';
import { ALL_GOVERNORS } from '../data/governor-data';
import { canAffordCost } from './province-store';
import { spendResource } from './resources';

// ── Types ──

export interface GovernorAssignment {
  governorId: string;
  tier: 1 | 2 | 3;
}

// ── Signals ──

/** Governors available for hire (not yet assigned to any province). */
export const governorPool = signal<Governor[]>([]);

/** Map of provinceId → assignment (governorId + tier). */
export const governorAssignments = signal<Record<string, GovernorAssignment>>({});

// ── Queries ──

/** Get the assignment for a province, if any. */
export function getAssignment(provinceId: string): GovernorAssignment | undefined {
  return governorAssignments.value[provinceId];
}

/** Get the Governor data + tier for a province, if assigned. */
export function getAssignedGovernor(provinceId: string): { governor: Governor; tier: 1 | 2 | 3 } | null {
  const assignment = governorAssignments.value[provinceId];
  if (!assignment) return null;
  const governor = ALL_GOVERNORS.find(g => g.id === assignment.governorId);
  if (!governor) return null;
  return { governor, tier: assignment.tier };
}

/** Get the active traits for a province's governor. */
export function getGovernorTraits(provinceId: string): GovernorTrait[] {
  const assigned = getAssignedGovernor(provinceId);
  if (!assigned) return [];
  return assigned.governor.tiers[assigned.tier - 1].traits;
}

/** Check if a specific governor is already assigned somewhere. */
export function isGovernorAssigned(governorId: string): boolean {
  return Object.values(governorAssignments.value).some(a => a.governorId === governorId);
}

// ── Actions ──

/**
 * Hire a governor and assign to a province.
 * Pays the hire cost for the chosen tier. Returns true on success.
 */
export function hireGovernor(
  governorId: string,
  provinceId: string,
  tier: 1 | 2 | 3,
): boolean {
  // Validate governor exists and is in pool
  const poolIdx = governorPool.value.findIndex(g => g.id === governorId);
  if (poolIdx === -1) return false;

  // Province must not already have a governor
  if (governorAssignments.value[provinceId]) return false;

  const governor = governorPool.value[poolIdx];
  const cost = getHireCost(governor, tier);

  if (!canAffordCost(cost)) return false;

  // Pay cost
  for (const [res, amt] of Object.entries(cost) as [ResourceType, number][]) {
    spendResource(res, amt);
  }

  // Remove from pool
  const newPool = [...governorPool.value];
  newPool.splice(poolIdx, 1);
  governorPool.value = newPool;

  // Assign
  governorAssignments.value = {
    ...governorAssignments.value,
    [provinceId]: { governorId, tier },
  };

  return true;
}

/**
 * Dismiss a governor from a province. Returns them to the pool.
 */
export function dismissGovernor(provinceId: string): boolean {
  const assignment = governorAssignments.value[provinceId];
  if (!assignment) return false;

  const governor = ALL_GOVERNORS.find(g => g.id === assignment.governorId);
  if (!governor) return false;

  // Return to pool
  governorPool.value = [...governorPool.value, governor];

  // Remove assignment
  const newAssignments = { ...governorAssignments.value };
  delete newAssignments[provinceId];
  governorAssignments.value = newAssignments;

  return true;
}

// ── Lifecycle ──

/** Initialize governor pool with all governors. */
export function initGovernorStore(): void {
  governorPool.value = [...ALL_GOVERNORS];
  governorAssignments.value = {};
}

/** Reset governor state (called on run end / new run). */
export function resetGovernorStore(): void {
  governorPool.value = [];
  governorAssignments.value = {};
}
