// S33-06: data table for Bellum encounter resolution. Each EncounterType maps
// to an ordered action list; the index matches the modal's button order.
// Having the table here instead of inline in encounter-bridge.ts lets us
// unit-test every entry independently and keeps the dispatch logic free of
// magic numbers.

import type { SpokeEffect } from '../progression/spoke-effects';
import type { EncounterType } from '../progression/landmark-types';
import type { BattleResult } from '../progression/spoke';

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
    // idx 0: Trade — gold is now a first-class effect (S35-02). Dispatch
    // still pre-flights via canAfford('gold', 10) so the "frowns at your
    // empty purse" failure copy fires before the effect list runs.
    {
      effects: [
        { type: 'gold',     delta: -10, label: 'Trader\'s price' },
        { type: 'supplies', delta:  +5, label: 'Salt pork & grain' },
      ],
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
  scout: [
    // idx 0: Send Outriders
    {
      effects: [
        { type: 'scout',  radius: 2, toLevel: 1, label: 'Outriders sketch the road' },
        { type: 'morale', delta: 1,              label: 'Eyes on the road' },
      ],
      message: 'Outriders sketch the road ahead.',
    },
  ],
  recruit: [
    // idx 0: Hire
    {
      effects: [
        { type: 'iuniores', delta: 250, label: 'Local braves' },
        { type: 'morale',   delta: 2,   label: 'Welcomed allies' },
      ],
      message: 'Local braves swear oaths and join the standards.',
    },
    // idx 1: Decline
    {
      effects: [
        { type: 'morale', delta: -2, label: 'Spurned recruits' },
      ],
      message: 'Spurned, the recruits drift back into the woods.',
    },
  ],
  hazard: [
    // idx 0: Press On
    {
      effects: [
        { type: 'morale',   delta: -5, label: 'Treacherous ground' },
        { type: 'supplies', delta: -3, label: 'Lost mules' },
      ],
      message: 'Treacherous ground takes its toll on man and mule.',
    },
  ],
  boss: [
    // idx 0: Engage — launches the Final Invasion battle
    {
      effects: [
        { type: 'morale',   delta: -30, label: 'Final Invasion' },
        { type: 'supplies', delta: -15, label: 'Final Invasion' },
      ],
      message: 'The Final Invasion crashes against the unprepared legion.',
      launchesBattle: true,
    },
  ],
  // EncounterType has more variants (siege, unknown) that the legacy event
  // mapping never produces. Empty arrays keep the lookup safe.
  siege:   [],
  unknown: [],
};

/**
 * Strategic-layer fallout applied AFTER a hex battle resolves. HP loss is
 * already projected onto preparedArmy by main.tsx's write-back; these deltas
 * are the morale/supplies fallout. Keyed on BattleResult.
 *
 * 'esc' covers the null outcome — ESC mid-battle.
 */
export const HEX_BATTLE_OUTCOME_EFFECTS: Record<BattleResult | 'esc', SpokeEffect[]> = {
  victory: [
    { type: 'morale', delta: 5, label: 'Victory in the field' },
  ],
  defeat: [
    { type: 'morale',   delta: -15, label: 'Crushing defeat' },
    { type: 'supplies', delta: -5,  label: 'Lost baggage train' },
  ],
  draw: [
    { type: 'morale', delta: -5, label: 'Indecisive engagement' },
  ],
  esc: [
    { type: 'morale', delta: -5, label: 'Withdrawal' },
  ],
};
