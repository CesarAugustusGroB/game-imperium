// S33-09: per-Bellum-run resource gains tracker. Mirrors spokeGains in shape
// but persists across hex battles within a run (resets only on resetCampaign).
// Surfaces to post-run scoring/meta-save so a Bellum victory can show what
// was earned across the whole campaign.
//
// FUTURE (advisor XP): when the advisor-XP system lands, the per-battle
// hook would attach here so a Bellum victory grants advisor progress just
// like a spoke battle. No-op until that system exists.

import { signal } from '@preact/signals';
import type { Faction, ResourceType } from '../core/commander';
import { addResource } from '../core/resources';

const ZERO_GAINS: Record<ResourceType, number> = {
  gold: 0,
  faith: 0,
  influence: 0,
  momentum: 0,
  iuniores: 0,
};

/** Cumulative resource gains during the current Bellum run. */
export const bellumGains = signal<Record<ResourceType, number>>({ ...ZERO_GAINS });

/** Replace bellumGains wholesale (used by save restore). */
export function setBellumGains(gains: Record<ResourceType, number>): void {
  bellumGains.value = { ...ZERO_GAINS, ...gains };
}

/** Zero the tracker. Called by resetCampaign. */
export function resetBellumGains(): void {
  bellumGains.value = { ...ZERO_GAINS };
}

/**
 * Grant a resource during a Bellum hex battle reward, tracking the gain.
 * Wraps addResource — passes through the actual amount added (after
 * faction-multiplier logic in addResource).
 */
export function grantBellumResource(type: ResourceType, amount: number, faction?: Faction): number {
  const actual = addResource(type, amount, faction);
  bellumGains.value = { ...bellumGains.value, [type]: bellumGains.value[type] + actual };
  return actual;
}
