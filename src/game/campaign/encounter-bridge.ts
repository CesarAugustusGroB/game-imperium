// S31-05a: dispatch table for campaign-hex encounter resolution.
// Routes the modal's chosen action through encounter-type handlers that apply
// their effects (morale/supplies/gold deltas) and consume the hex's event.
//
// Battle / elite / ambush get placeholder casualty deltas — the full
// BattleScreenV2 launch (synthesized SpokeNode + post-battle return path) is
// deferred to S31-05b, which is a Notion-tracked follow-up.

import type { HexTile } from './campaign-types';
import { eventTypeToEncounterType } from './event-encounter-mapping';
import type { EncounterType } from '../progression/landmark-types';
import { addMorale, addSupplies, consumeEvent } from './campaign-state';
import { spendResource } from '../core/resources';

export type EncounterOutcome = {
  /** True when the hex's event was cleared (re-entry won't re-fire). */
  consumed: boolean;
  /** Optional player-facing summary line for a notification. */
  message?: string;
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

  const outcome = dispatch(encounter, actionIndex);
  consumeEvent(tile.id);
  return outcome;
}

function dispatch(encounter: EncounterType, actionIndex: number): EncounterOutcome {
  switch (encounter) {
    case 'rest':
      addMorale(20);
      return { consumed: true, message: 'The legion makes camp. Morale recovers.' };

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
      // S31-05b will replace this with a synthesized SpokeNode + battleV2 launch.
      // idx 0 = Fight, idx 1 = Retreat.
      if (actionIndex === 0) {
        addMorale(-10);
        addSupplies(-3);
        return { consumed: true, message: 'The skirmish ends bloody but the road is clear.' };
      }
      addMorale(-5);
      return { consumed: true, message: 'The legion withdraws to safer ground.' };

    case 'elite_battle':
      if (actionIndex === 0) {
        addMorale(-12);
        addSupplies(-4);
        return { consumed: true, message: 'A hard-won fight. Veterans paid the price.' };
      }
      addMorale(-2);
      return { consumed: true, message: 'The legion gives the elite force a wide berth.' };

    case 'ambush':
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

