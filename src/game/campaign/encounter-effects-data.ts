// S33-06: data table for Bellum encounter resolution. Each EncounterType maps
// to an ordered action list; the index matches the modal's button order.
// Having the table here instead of inline in encounter-bridge.ts lets us
// unit-test every entry independently and keeps the dispatch logic free of
// magic numbers.

import type { SpokeEffect } from '../progression/spoke-effects';
import type { EncounterType } from '../progression/landmark-types';

export type BellumEncounterAction = {
  effects: SpokeEffect[];
  message: string;
  /** When true, dispatch should call launchHexBattle BEFORE applying these
   *  effects. Effects then become the no-army fallback. */
  launchesBattle?: boolean;
  /** When true, this action also calls refreshMovementPoints (rest only). */
  refreshesMovement?: boolean;
};

export const BELLUM_ENCOUNTER_TABLE: Record<EncounterType, BellumEncounterAction[]> = {
  rest: [
    {
      effects: [{ type: 'morale', delta: 20, label: 'Rest at camp' }],
      message: 'The legion makes camp. Morale and march points recover.',
      refreshesMovement: true,
    },
  ],
  forage: [
    {
      effects: [
        { type: 'supplies', delta: 10, label: 'Foragers return' },
        { type: 'morale',   delta: 1,  label: 'Foragers return' },
      ],
      message: 'Foragers return with grain and salt pork.',
    },
  ],
  merchant: [
    // idx 0: Trade — handled imperatively in dispatch (gold spend gates the
    // supply gain). The table entry exists for the data shape but its
    // effects are applied conditionally; see encounter-bridge.ts.
    {
      effects: [{ type: 'supplies', delta: 5, label: 'Merchant trade' }],
      message: 'Traded 10 gold for 5 supplies.',
    },
    // idx 1: Ignore — no-op
    { effects: [], message: '' },
  ],
  event: [
    { effects: [], message: '' }, // story/inspect — flavor only
  ],
  battle: [
    // idx 0: Fight — launches battle; effects = no-army fallback
    {
      effects: [
        { type: 'morale',   delta: -10, label: 'Skirmish casualties' },
        { type: 'supplies', delta: -3,  label: 'Skirmish casualties' },
      ],
      message: 'The skirmish ends bloody but the road is clear.',
      launchesBattle: true,
    },
    // idx 1: Retreat
    {
      effects: [{ type: 'morale', delta: -5, label: 'Withdrawal' }],
      message: 'The legion withdraws to safer ground.',
    },
  ],
  elite_battle: [
    {
      effects: [
        { type: 'morale',   delta: -12, label: 'Hard-fought victory' },
        { type: 'supplies', delta: -4,  label: 'Hard-fought victory' },
      ],
      message: 'A hard-won fight. Veterans paid the price.',
      launchesBattle: true,
    },
    {
      effects: [{ type: 'morale', delta: -2, label: 'Avoidance march' }],
      message: 'The legion gives the elite force a wide berth.',
    },
  ],
  ambush: [
    {
      effects: [
        { type: 'morale',   delta: -8, label: 'Ambush bloodletting' },
        { type: 'supplies', delta: -2, label: 'Ambush bloodletting' },
      ],
      message: 'The ambush bloodies the column before it scatters.',
      launchesBattle: true,
    },
  ],
  // EncounterType has more variants (boss, scout, recruit, siege, hazard,
  // unknown) that the legacy event mapping never produces. Empty arrays
  // keep the lookup safe.
  boss:    [],
  scout:   [],
  recruit: [],
  siege:   [],
  hazard:  [],
  unknown: [],
};
