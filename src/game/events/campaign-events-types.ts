/**
 * campaign-events-types.ts — shapes for the campaign-event system (D10).
 *
 * Events are narrative interludes (NOT cards, NOT the card engine) that surface
 * a HUB conflict — a Consilium advisor or a province — during an Iter Belli
 * march, at most once per campaign. The player's choice applies immediate
 * campaign effects and ENQUEUES a deferred hub write-back, applied on return to
 * the Forum. See docs/superpowers/specs/2026-06-14-campaign-events-design.md.
 *
 * This module is leaf-level on purpose: it imports only the CardEffects type and
 * NOTHING from the hub stores, keeping the data→effect flow one-directional and
 * free of the province↔council import cycle (cf. D12).
 */
import type { CardEffects } from '../iterBelli/iter-belli-types';

// ── Hub write-back vocabulary (the 9th effect-bearing union; plan D10) ──

/**
 * A deferred mutation applied to the HUB when a campaign ends, as the
 * consequence of an event choice. Kept small and HONEST: every member maps to a
 * real hub field (`province.unrest`, hub gold/iuniores, `advisor.xp`) so
 * verify-effects can guarantee a live application site — no "promises / inert".
 *
 * SCALE: `resource` iuniores deltas follow the campaign balance rule — denominated
 * in hundreds, capped at low thousands. (Soldiers are a CAMPAIGN concern carried
 * by `CardEffects.soldiers`, never a hub consequence.)
 */
export type HubConsequence =
  | { type: 'province-unrest'; provinceId: string; delta: number }
  | { type: 'advisor-xp'; advisorId: string; delta: number }
  | { type: 'resource'; resource: 'gold' | 'iuniores'; delta: number };

/**
 * Sentinel id used by a catalog consequence to mean "the province/advisor that
 * triggered this event". The controller (D10 step 4) rewrites it to the firing
 * conflict's `sourceId` before enqueueing. Catalog events are generic, so they
 * cannot name a concrete province/advisor id at authoring time.
 */
export const SOURCE_REF = '@source';

// ── Conflict snapshot (sealed at embark, read-only thereafter) ──

export type ConflictSource = 'province' | 'advisor';

/** A hub tension detected at embark and eligible to surface as an event. */
export interface CampaignConflict {
  /** Stable id, e.g. `province:hispania` or `advisor:cato`. */
  id: string;
  source: ConflictSource;
  /** The province id or advisor id this conflict is about. */
  sourceId: string;
  /** Display name of the source, for narrative binding in the modal. */
  sourceName: string;
  /** 0–100 rough severity (province unrest, or an advisor-standing proxy). */
  severity: number;
}

// ── Event catalog shape ──

export interface EventChoice {
  /** Button label shown to the player. */
  label: string;
  /** Immediate effects on the CURRENT campaign (reuses the card vocabulary). */
  immediate?: CardEffects;
  /** Deferred write-back applied to the hub on return to the Forum. */
  consequence?: HubConsequence[];
  /** Consequence flag this choice sets, to chain later events this run. */
  setsFlag?: string;
  /** Only offered when the run holds the `extra-event-choice` province feature. */
  premium?: boolean;
}

export interface CampaignEvent {
  id: string;
  /** Which kind of hub conflict this event dramatizes. */
  sourceType: ConflictSource;
  title: string;
  body: string;
  /** 2–3 base choices, plus an optional `premium` one. */
  choices: EventChoice[];
  /** Run flag required for this event to be eligible. */
  requiresFlag?: string;
  /** Run flag that blocks this event from firing. */
  blockedByFlag?: string;
}
