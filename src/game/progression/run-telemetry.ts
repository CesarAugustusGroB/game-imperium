/**
 * Campaign telemetry (plan S-J) — lightweight, local, no backend.
 *
 * Accumulates a couple of signals the post-mortem can't reconstruct after the
 * fact: how many cards the player resolved and which battle orders they leaned
 * on this campaign. Reset at campaign start (`startIterBelliCampaign`), snapshotted
 * into a CampaignLogEntry at campaign end (EndgameCard), then exported as JSON
 * from the Options panel for manual balance analysis.
 *
 * Plain module state (not signals): nothing renders these reactively; they are
 * read once, at campaign end.
 */

let cardsPlayed = 0;
const ordersUsed: Record<string, number> = {};

/** Count one resolved campaign card. */
export function tallyCardPlayed(): void {
  cardsPlayed++;
}

/** Count one battle order issued, keyed by its order id (e.g. 'siege', 'charge'). */
export function tallyOrderUsed(orderKey: string): void {
  ordersUsed[orderKey] = (ordersUsed[orderKey] ?? 0) + 1;
}

/** Clear the per-campaign tallies (call at campaign start). */
export function resetCampaignTelemetry(): void {
  cardsPlayed = 0;
  for (const k of Object.keys(ordersUsed)) delete ordersUsed[k];
}

/** Read the current tallies (call at campaign end, before reset). */
export function snapshotCampaignTelemetry(): { cardsPlayed: number; ordersUsed: Record<string, number> } {
  return { cardsPlayed, ordersUsed: { ...ordersUsed } };
}
