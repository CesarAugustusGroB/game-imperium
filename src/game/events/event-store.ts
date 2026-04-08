import { signal } from '@preact/signals';

// ── Consequence tracking ──

/**
 * Flags set by event choices. Persist for the entire run.
 * Events can require or be blocked by these flags, enabling event chains.
 * Examples: 'betrayed_merchant', 'allied_with_gauls', 'captured_scout'
 */
export const consequenceFlags = signal<Set<string>>(new Set());

/** Events seen during the current spoke (for deduplication). */
export const seenEventsThisSpoke = signal<Set<string>>(new Set());

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
}
