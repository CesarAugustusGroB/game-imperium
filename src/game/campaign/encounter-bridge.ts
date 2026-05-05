// S31-05a: dispatch table for campaign-hex encounter resolution.
// Routes the modal's chosen action through encounter-type handlers that apply
// their effects (morale/supplies/gold deltas) and consume the hex's event.
//
// S31-05b: battle / elite / ambush now route through `launchHexBattle`,
// which synthesizes a 1-node Spoke and navigates to BattleScreenV2. If
// preparedArmy is null (no commander selected), we fall back to the
// original placeholder casualty deltas so the player isn't stranded.
//
// S33-05: morale/supply mutations now flow through `addCampaignMorale` /
// `addArmySupplies` from `bellum-army-view.ts` instead of the old
// `campaignState`-scoped helpers.
//
// S33-06: encounter effects are now data-driven via BELLUM_ENCOUNTER_TABLE
// and applied through applyBellumEffects. consumeEvent is called BEFORE
// dispatch to guard against fast double-click re-fires.

import type { HexTile } from './campaign-types';
import { eventTypeToEncounterType } from './event-encounter-mapping';
import { campaignState, consumeEvent, refreshMovementPoints } from './campaign-state';
import { launchHexBattle } from './hex-battle';
import { canAfford } from '../core/resources';
import { evaluateBellumDefeat, type BellumDefeatEvaluation } from './campaign-defeat';
import { applyBellumEffects, type AppliedLine } from './bellum-encounter-effects';
import { BELLUM_ENCOUNTER_TABLE } from './encounter-effects-data';
import { replenishHubRoster, type ReplenishmentPreview } from '../army/army-replenishment';

export type EncounterOutcome = {
  /** True when the hex's event was cleared (re-entry won't re-fire). */
  consumed: boolean;
  /** Optional player-facing summary line for a notification. */
  message?: string;
  /** Bellum defeat status after resolving this encounter. */
  defeat?: BellumDefeatEvaluation;
  /** One line per effect that mutated state. */
  appliedLines?: AppliedLine[];
  /** S35-04: cohort-replenishment summary when a `replenishCohorts` action
   *  fires. Null when the action didn't run a heal pass (no army, nothing
   *  damaged) — the caller can fall back to the static message in that case. */
  replenishment?: ReplenishmentPreview | null;
};

/**
 * Resolve the player's chosen action on the active hex encounter.
 * Consumes the event FIRST — a fast double-click cannot re-fire the dispatch.
 * Returns consumed:false only when the encounter type is unknown (unmapped
 * variants) so the caller can leave state alone.
 */
export function resolveEncounter(tile: HexTile, actionIndex: number): EncounterOutcome {
  const encounter = eventTypeToEncounterType(tile.event);
  if (encounter === null) return { consumed: false };

  // Consume FIRST so a fast double-click can't re-fire the dispatch.
  consumeEvent(tile.id);

  const actions = BELLUM_ENCOUNTER_TABLE[encounter];
  const action = actions[actionIndex];
  if (!action) {
    // Out-of-range action index — treat as no-op.
    const defeat = evaluateBellumDefeat(campaignState.value);
    return { consumed: true, defeat };
  }

  // Special-case merchant trade gate (gold spend before applying effects).
  let appliedLines: AppliedLine[] = [];
  let message = action.message;
  let replenishment: ReplenishmentPreview | null | undefined;

  if (encounter === 'merchant' && actionIndex === 0) {
    // S35-02: gold spend is now a first-class effect in action.effects.
    // canAfford() gates the trade so the failure copy still fires before
    // any effect runs (don't want a clamped half-spend giving free supplies).
    if (!canAfford('gold', 10)) {
      message = 'The merchant frowns at your empty purse.';
    } else {
      appliedLines = applyBellumEffects(action.effects, tile);
    }
  } else if (action.launchesBattle && launchHexBattle(tile, encounter)) {
    // Battle launched — defer effects to post-battle (handled in
    // applyHexBattleOutcome). No-op here, no message yet.
    return { consumed: true };
  } else {
    appliedLines = applyBellumEffects(action.effects, tile);
  }

  // S35-04: replenish-cohorts pass. Runs AFTER the static effects so the
  // morale +3 from "Tend the Wounded" is visible alongside the heal summary.
  // replenishHubRoster returns null when there's no preparedArmy or empty
  // roster; returns a preview with iunioresSpent === 0 when nothing needed
  // healing (or pool was empty). Both no-op cases are surfaced via the
  // returned `replenishment` field so the modal/notification can branch.
  if (action.replenishCohorts) {
    replenishment = replenishHubRoster();
    if (replenishment === null || replenishment.iunioresSpent === 0) {
      message = 'No cohorts need tending — the legion is at fighting weight.';
    } else if (replenishment.partialHeal) {
      message = `Iuniores stretched thin — ${replenishment.iunioresSpent} spent, ${replenishment.hpRestored} HP restored.`;
    } else {
      message = `${replenishment.iunioresSpent} iuniores spent — wounded restored to fighting weight.`;
    }
  }

  if (action.refreshesMovement) refreshMovementPoints();

  const defeat = evaluateBellumDefeat(campaignState.value);
  return { consumed: true, message, defeat, appliedLines, replenishment };
}
