// S31-05a: dispatch table for campaign-hex encounter resolution.
// Routes the modal's chosen action through encounter-type handlers that apply
// their effects (morale/supplies/gold deltas) and consume the hex's event.
//
// S31-05b: battle / elite / ambush now route through `launchHexBattle`,
// which synthesizes a 1-node Spoke and navigates to BattleScreenV2. If
// preparedArmy is null (no commander selected), we fall back to the
// original placeholder casualty deltas so the player isn't stranded.

import type { HexTile } from './campaign-types';
import { eventTypeToEncounterType } from './event-encounter-mapping';
import type { EncounterType } from '../progression/landmark-types';
import { addMorale, addSupplies, campaignState, consumeEvent, refreshMovementPoints } from './campaign-state';
import { launchHexBattle } from './hex-battle';
import { spendResource } from '../core/resources';
import { evaluateBellumDefeat, type BellumDefeatEvaluation } from './campaign-defeat';

export type EncounterOutcome = {
  /** True when the hex's event was cleared (re-entry won't re-fire). */
  consumed: boolean;
  /** Optional player-facing summary line for a notification. */
  message?: string;
  /** Bellum defeat status after resolving this encounter. */
  defeat?: BellumDefeatEvaluation;
};

const NOOP: EncounterOutcome = { consumed: true };

/**
 * Resolve the player's chosen action on the active hex encounter.
 * Always consumes the event afterwards — except when the encounter type is
 * unknown (legacy 'none' / unmapped variants) in which case we leave state
 * alone and bail.
 */
export function resolveEncounter(tile: HexTile, actionIndex: number): EncounterOutcome {
  const encounter = eventTypeToEncounterType(tile.event);
  if (encounter === null) return { consumed: false };

  const outcome = dispatch(tile, encounter, actionIndex);
  consumeEvent(tile.id);
  const defeat = evaluateBellumDefeat(campaignState.value);
  return { ...outcome, defeat };
}

function dispatch(
  tile: HexTile,
  encounter: EncounterType,
  actionIndex: number,
): EncounterOutcome {
  switch (encounter) {
    case 'rest':
      addMorale(20);
      refreshMovementPoints();
      return { consumed: true, message: 'The legion makes camp. Morale and march points recover.' };

    case 'forage':
      addSupplies(10);
      addMorale(1);
      return { consumed: true, message: 'Foragers return with grain and salt pork.' };

    case 'merchant':
      // idx 0 = Trade, idx 1 = Ignore.
      if (actionIndex === 0) {
        if (spendResource('gold', 10)) {
          addSupplies(5);
          return { consumed: true, message: 'Traded 10 gold for 5 supplies.' };
        }
        return { consumed: true, message: 'The merchant frowns at your empty purse.' };
      }
      return NOOP;

    case 'event':
      // Story / inspect — flavor only, no mechanics in S31-05a.
      return NOOP;

    case 'battle':
      // S31-05b: idx 0 = Fight → launchHexBattle; idx 1 = Retreat → small morale knock.
      // launchHexBattle returns false when preparedArmy is null (campaign tab
      // entered without a commander) — fall back to placeholder deltas so the
      // player isn't blocked.
      if (actionIndex === 0) {
        if (launchHexBattle(tile, 'battle')) return { consumed: true };
        addMorale(-10);
        addSupplies(-3);
        return { consumed: true, message: 'The skirmish ends bloody but the road is clear.' };
      }
      addMorale(-5);
      return { consumed: true, message: 'The legion withdraws to safer ground.' };

    case 'elite_battle':
      if (actionIndex === 0) {
        if (launchHexBattle(tile, 'elite_battle')) return { consumed: true };
        addMorale(-12);
        addSupplies(-4);
        return { consumed: true, message: 'A hard-won fight. Veterans paid the price.' };
      }
      addMorale(-2);
      return { consumed: true, message: 'The legion gives the elite force a wide berth.' };

    case 'ambush':
      // No retreat option for ambush — surprised legions fight.
      if (launchHexBattle(tile, 'ambush')) return { consumed: true };
      addMorale(-8);
      addSupplies(-2);
      return { consumed: true, message: 'The ambush bloodies the column before it scatters.' };

    default:
      // EncounterType has variants (boss, scout, recruit, siege, hazard,
      // unknown) that eventTypeToEncounterType never produces today. Kept as
      // a no-op fallback so a future EventType→EncounterType mapping change
      // can't crash the bridge silently.
      return NOOP;
  }
}

