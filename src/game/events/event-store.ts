import { signal } from '@preact/signals';
import type { CampaignConflict, HubConsequence } from './campaign-events-types';

// ── Consequence tracking ──

/**
 * Flags set by event choices. Persist for the entire run.
 * Events can require or be blocked by these flags, enabling event chains.
 * Examples: 'betrayed_merchant', 'allied_with_gauls', 'captured_scout'
 */
export const consequenceFlags = signal<Set<string>>(new Set());

/** Events seen during the current spoke (for deduplication). */
export const seenEventsThisSpoke = signal<Set<string>>(new Set());

/**
 * Hub conflicts sealed at embark (provinces + seated advisors), eligible to
 * surface as ONE campaign event this spoke. Read-only until the next embark
 * reseals it. Not yet persisted in meta-save — wired when the controller (D10
 * step 4) starts consuming it.
 */
export const campaignConflicts = signal<CampaignConflict[]>([]);

/** True once the single per-campaign event has fired (the ≤1/campaign cap). */
export const campaignEventFiredThisSpoke = signal<boolean>(false);

/**
 * Hub write-backs queued by event choices this campaign, applied on return to
 * the Forum by applyCampaignEventOutcomes (D10 step 6). Source ids are already
 * resolved (no SOURCE_REF) by the time they land here.
 */
export const pendingHubConsequences = signal<HubConsequence[]>([]);

// ── Actions ──

/** Set a consequence flag (idempotent). */
export function setConsequenceFlag(flag: string): void {
  if (consequenceFlags.value.has(flag)) return;
  consequenceFlags.value = new Set(consequenceFlags.value).add(flag);
}

/** Check if a consequence flag is set. */
export function hasConsequenceFlag(flag: string): boolean {
  return consequenceFlags.value.has(flag);
}

/**
 * Seal the embark-time conflict snapshot AND reset per-campaign event state — this
 * is the start-of-campaign hook, called once from EmbarkCard. Clears the seen set,
 * the fired guard, and any (stale, abandoned-run) pending write-backs.
 */
export function sealCampaignConflicts(conflicts: CampaignConflict[]): void {
  campaignConflicts.value = conflicts.slice();
  seenEventsThisSpoke.value = new Set();
  campaignEventFiredThisSpoke.value = false;
  pendingHubConsequences.value = [];
}

/** Mark the single per-campaign event as having fired (enforces the ≤1 cap). */
export function setCampaignEventFired(): void {
  campaignEventFiredThisSpoke.value = true;
}

/** Queue resolved hub write-backs for application on return to the Forum. */
export function enqueueHubConsequences(consequences: HubConsequence[]): void {
  if (consequences.length) pendingHubConsequences.value = [...pendingHubConsequences.value, ...consequences];
}

/** Mark an event as seen this spoke. */
export function markEventSeen(eventId: string): void {
  seenEventsThisSpoke.value = new Set(seenEventsThisSpoke.value).add(eventId);
}

/** Check if an event was already seen this spoke. */
export function wasEventSeen(eventId: string): boolean {
  return seenEventsThisSpoke.value.has(eventId);
}

// ── Lifecycle ──

/** Reset seen events (called when a new spoke starts). */
export function resetSpokeEvents(): void {
  seenEventsThisSpoke.value = new Set();
}

/** Reset all event state (called on run end / new run). */
export function resetEventStore(): void {
  consequenceFlags.value = new Set();
  seenEventsThisSpoke.value = new Set();
  campaignConflicts.value = [];
  campaignEventFiredThisSpoke.value = false;
  pendingHubConsequences.value = [];
}
