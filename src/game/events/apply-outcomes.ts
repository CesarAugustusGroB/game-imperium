/**
 * apply-outcomes.ts — drain the campaign-event hub write-backs on return to the
 * Forum (D10 step 6). This is the ONE place the events module writes to the hub;
 * it is called from the Return-to-Hub handler, which already owns hub side effects.
 *
 * It is also the registered application site for the HubConsequence union in
 * verify-effects.ts — the switch below is what flips that union from latent to
 * applied, so a new consequence member can no longer go silently inert.
 */
import { pendingHubConsequences } from './event-store';
import { adjustProvinceUnrest } from '../province/province-store';
import { adjustAdvisorXp } from '../council/council-store';
import { refundResource, spendResource } from '../core/resources';
import type { HubConsequence } from './campaign-events-types';

function applyOne(h: HubConsequence): void {
  switch (h.type) {
    case 'province-unrest':
      adjustProvinceUnrest(h.provinceId, h.delta);
      break;
    case 'advisor-xp':
      adjustAdvisorXp(h.advisorId, h.delta);
      break;
    case 'resource':
      // Flat narrative grant/levy — applied at FACE VALUE (refundResource), never
      // income-modified (cf. D19), so the authored event balance stays exact.
      if (h.delta >= 0) refundResource(h.resource, h.delta);
      else spendResource(h.resource, -h.delta);
      break;
  }
}

/**
 * Apply every queued hub write-back to its real hub field, then clear the queue.
 * No-op on an empty queue and idempotent after draining (the cleared queue means a
 * double call does nothing).
 */
export function applyCampaignEventOutcomes(): void {
  const queue = pendingHubConsequences.value;
  if (!queue.length) return;
  for (const h of queue) applyOne(h);
  pendingHubConsequences.value = [];
}
