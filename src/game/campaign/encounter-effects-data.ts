// S33-06: data table for Bellum encounter resolution. Each EncounterType maps
// to an ordered action list; the index matches the modal's button order.
// Having the table here instead of inline in encounter-bridge.ts lets us
// unit-test every entry independently and keeps the dispatch logic free of
// magic numbers.

import type { SpokeEffect } from '../progression/spoke-effects';
import type { EncounterType } from '../progression/landmark-types';
import type { BattleResult } from '../progression/spoke';
import type { ResourceCost } from '../../types/index';

export type BellumEncounterAction = {
  effects: SpokeEffect[];
  message: string;
  /** When true, dispatch should call launchHexBattle BEFORE applying these
   *  effects. Effects then become the no-army fallback. */
  launchesBattle?: boolean;
  /** When true, this action also calls refreshMovementPoints (rest only). */
  refreshesMovement?: boolean;
  /** S35-04: when true, dispatch calls `replenishHubRoster()` to spend
   *  iuniores from the global pool and heal damaged cohorts on
   *  preparedArmy. The cost is dynamic (scales with missing HP) and
   *  metered by the helper, so the action's `effects` list should NOT
   *  carry an `iuniores: -N` line — that would double-deduct. */
  replenishCohorts?: boolean;
  /** S35-05: hard affordability gate. Dispatch checks every resource via
   *  `canAfford` BEFORE running effects, launching a battle, or replenishing.
   *  When the player can't pay, the action becomes a no-op and surfaces the
   *  fallback `unaffordableMessage`. The actual deduction still flows through
   *  the effect list (e.g. a `gold: -30` effect) — this field only gates. */
  requiresResource?: ResourceCost;
  /** Optional flavor copy for the unaffordable case (S35-05). Falls back to
   *  a generic "cannot afford" message when omitted. */
  unaffordableMessage?: string;
};

export const BELLUM_ENCOUNTER_TABLE: Record<EncounterType, BellumEncounterAction[]> = {
  rest: [
    {
      effects: [{ type: 'morale', delta: 20, label: 'Rest at camp' }],
      message: 'The legion makes camp. Morale and march points recover.',
      refreshesMovement: true,
    },
    // S35-04: spend iuniores to heal damaged cohorts. Cost is computed by
    // replenishHubRoster (cheapest-cohort-first; full pool drain on partial
    // heal). Morale +3 reflects the boost of seeing the wounded return to
    // the line — it's the only static effect; the iuniores spend is dynamic.
    {
      effects: [{ type: 'morale', delta: 3, label: 'The wounded return to the line' }],
      message: 'Iuniores tend the wounded. Cohorts return to fighting weight.',
      replenishCohorts: true,
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
    // idx 0: Trade — gold deduction is a first-class effect (S35-02).
    // S35-05: the imperative canAfford pre-flight in encounter-bridge is now
    // a generic `requiresResource` gate driven by this field. Same behavior,
    // shared mechanism with the new combat-bribe and press-the-advantage
    // actions below.
    {
      effects: [
        { type: 'gold',     delta: -10, label: 'Trader\'s price' },
        { type: 'supplies', delta:  +5, label: 'Salt pork & grain' },
      ],
      message: 'Traded 10 gold for 5 supplies.',
      requiresResource: { gold: 10 },
      unaffordableMessage: 'The merchant frowns at your empty purse.',
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
    // S35-05 idx 2: Bribe Scouts — gold buys a road around the patrol. The
    // men resent the silver (-2 morale) but the column saves time and blood.
    {
      effects: [
        { type: 'gold',   delta: -30, label: 'Silver to silent tongues' },
        { type: 'morale', delta: -2,  label: 'The men resent the bribe' },
      ],
      message: 'Coin changes hands. The patrol drifts back into the trees.',
      requiresResource: { gold: 30 },
      unaffordableMessage: 'Not enough silver to tempt the scouts.',
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
    // S35-05 idx 2: Press the Advantage — burn 1 momentum to seize the high
    // ground before the engagement, granting a battle modifier on entry.
    // Still launches the battle — this is a setup action, not an evade.
    {
      effects: [
        { type: 'momentum',         delta: -1,            label: 'Press the advantage' },
        { type: 'battle-modifier',  modifierId: 'high_ground', label: 'High ground seized' },
      ],
      message: 'The legion seizes the ridge before the eagles meet.',
      launchesBattle: true,
      requiresResource: { momentum: 1 },
      unaffordableMessage: 'No momentum to press the advantage — meet them on equal ground.',
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
