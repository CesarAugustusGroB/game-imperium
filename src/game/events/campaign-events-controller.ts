/**
 * campaign-events-controller.ts — select, fire, and resolve campaign events (D10 step 4).
 *
 * The single per-campaign event surfaces at the mid-march window, probabilistically,
 * only when a sealed hub conflict has an eligible catalog event. The pure pieces
 * (selectCampaignEvent / resolveConsequences) are decoupled from the RNG and the
 * live signals so they test headlessly; maybeFireCampaignEvent is the thin wrapper
 * the campaign screen (step 5) calls after each turn.
 */
import { signal } from '@preact/signals';
import { iterBelliState, applyCampaignEventEffects } from '../iterBelli/iter-belli-state';
import { getActiveScenario } from '../iterBelli/iter-belli-scenario';
import {
  campaignConflicts, consequenceFlags, seenEventsThisSpoke, campaignEventFiredThisSpoke,
  markEventSeen, setCampaignEventFired, enqueueHubConsequences, setConsequenceFlag,
} from './event-store';
import { CAMPAIGN_EVENTS } from '../../data/campaign-events';
import { SOURCE_REF } from './campaign-events-types';
import type { CampaignConflict, CampaignEvent, EventChoice, HubConsequence } from './campaign-events-types';

export interface FiredCampaignEvent {
  event: CampaignEvent;
  conflict: CampaignConflict;
}

/** The event awaiting the player's choice, or null. The modal (step 5) renders it. */
export const pendingCampaignEvent = signal<FiredCampaignEvent | null>(null);

/** Mid-march firing window (fraction of the itinerary) and per-turn odds inside it. */
export const EVENT_FIRE_WINDOW = { min: 0.35, max: 0.8 } as const;
export const EVENT_FIRE_CHANCE = 0.5;

function isEligible(e: CampaignEvent, flags: ReadonlySet<string>, seen: ReadonlySet<string>): boolean {
  if (seen.has(e.id)) return false;
  if (e.requiresFlag && !flags.has(e.requiresFlag)) return false;
  if (e.blockedByFlag && flags.has(e.blockedByFlag)) return false;
  return true;
}

/**
 * Pick the {event, conflict} to fire, or null. Walks conflicts in severity order
 * (they arrive pre-sorted) and returns the first that has an eligible event of its
 * source type. `pick` chooses among the eligible events (default: the first).
 */
export function selectCampaignEvent(
  conflicts: readonly CampaignConflict[],
  flags: ReadonlySet<string>,
  seen: ReadonlySet<string>,
  catalog: readonly CampaignEvent[] = CAMPAIGN_EVENTS,
  pick: (n: number) => number = () => 0,
): FiredCampaignEvent | null {
  for (const conflict of conflicts) {
    const eligible = catalog.filter((e) => e.sourceType === conflict.source && isEligible(e, flags, seen));
    if (eligible.length) return { event: eligible[pick(eligible.length) % eligible.length], conflict };
  }
  return null;
}

/** Rewrite SOURCE_REF ids to the firing conflict's sourceId. */
export function resolveConsequences(
  consequence: readonly HubConsequence[],
  conflict: CampaignConflict,
): HubConsequence[] {
  return consequence.map((h) => {
    if (h.type === 'province-unrest' && h.provinceId === SOURCE_REF) return { ...h, provinceId: conflict.sourceId };
    if (h.type === 'advisor-xp' && h.advisorId === SOURCE_REF) return { ...h, advisorId: conflict.sourceId };
    return h;
  });
}

/** Campaign progress 0..1 along the itinerary (locationIdx / last index). */
function marchProgress(): number {
  const locs = getActiveScenario().locations.length;
  return locs <= 1 ? 0 : iterBelliState.value.locationIdx / (locs - 1);
}

/**
 * Try to surface the per-campaign event. At most once per campaign (the fired
 * guard), only inside the mid-march window, and only on a successful probability
 * roll with a sealed conflict that has an eligible event. On success sets
 * pendingCampaignEvent and returns it; otherwise returns null.
 *
 * Test seams: inject `rng`, the eligible-event `pick`, and `progress`.
 */
export function maybeFireCampaignEvent(opts: {
  rng?: () => number;
  pick?: (n: number) => number;
  progress?: number;
} = {}): FiredCampaignEvent | null {
  const rng = opts.rng ?? Math.random;
  if (campaignEventFiredThisSpoke.value || pendingCampaignEvent.value) return null;
  if (iterBelliState.value.phase !== 'campaign') return null; // never mid-battle/endgame
  const p = opts.progress ?? marchProgress();
  if (p < EVENT_FIRE_WINDOW.min || p > EVENT_FIRE_WINDOW.max) return null;
  if (rng() >= EVENT_FIRE_CHANCE) return null;
  const fired = selectCampaignEvent(
    campaignConflicts.value, consequenceFlags.value, seenEventsThisSpoke.value,
    CAMPAIGN_EVENTS, opts.pick ?? ((n) => Math.floor(rng() * n)),
  );
  if (!fired) return null;
  pendingCampaignEvent.value = fired;
  return fired;
}

/**
 * Resolve the player's chosen option: apply immediate campaign effects, enqueue
 * the resolved hub write-back, set any chain flag, mark the event seen + fired,
 * and clear the pending event.
 */
export function resolveCampaignEventChoice(fired: FiredCampaignEvent, choice: EventChoice): void {
  if (choice.immediate) applyCampaignEventEffects(choice.immediate);
  if (choice.consequence?.length) enqueueHubConsequences(resolveConsequences(choice.consequence, fired.conflict));
  if (choice.setsFlag) setConsequenceFlag(choice.setsFlag);
  markEventSeen(fired.event.id);
  setCampaignEventFired();
  pendingCampaignEvent.value = null;
}
