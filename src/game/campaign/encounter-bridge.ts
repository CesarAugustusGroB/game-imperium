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
import type { ResourceType } from '../core/commander';
import type { ResourceCost } from '../../types/index';
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

  let appliedLines: AppliedLine[] = [];
  let message = action.message;
  let replenishment: ReplenishmentPreview | null | undefined;

  // S35-05: generic affordability gate. When the action declares
  // `requiresResource`, every entry must be affordable before any effect
  // runs (prevents the gold-clamp giving free supplies, mirrors what the
  // merchant special-case did under S35-02). Failure surfaces the action's
  // own `unaffordableMessage` or a generic fallback.
  if (action.requiresResource && !canAffordCost(action.requiresResource)) {
    const defeat = evaluateBellumDefeat(campaignState.value);
    return {
      consumed: true,
      message: action.unaffordableMessage ?? 'Cannot afford that course.',
      defeat,
      appliedLines: [],
    };
  }

  if (action.launchesBattle) {
    // S35-05: when the action declares both `launchesBattle` AND
    // `requiresResource`, its effects represent pre-paid setup — e.g.
    // press-the-advantage spends momentum and grants a battle-modifier
    // BEFORE the battle mounts. Apply them, then launch.
    //
    // Without `requiresResource`, the effects are no-army fallbacks
    // (battle / elite / ambush / boss casualty deltas) — original
    // S31-05b semantics — applied only when the battle fails to launch.
    if (action.requiresResource) {
      appliedLines = applyBellumEffects(action.effects, tile);
      if (launchHexBattle(tile, encounter)) {
        return { consumed: true, appliedLines };
      }
      // No army — effects already applied; fall through to defeat eval.
    } else {
      if (launchHexBattle(tile, encounter)) {
        return { consumed: true };
      }
      appliedLines = applyBellumEffects(action.effects, tile);
    }
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

/** S35-05: every entry in the cost map must be affordable. */
function canAffordCost(cost: ResourceCost): boolean {
  for (const [resource, amount] of Object.entries(cost) as [ResourceType, number][]) {
    if (amount > 0 && !canAfford(resource, amount)) return false;
  }
  return true;
}
