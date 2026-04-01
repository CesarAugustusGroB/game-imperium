import type { GameEvent } from '../game/event-types';

// Re-export types so existing imports don't break
export type { GameEvent, EventChoice, EventEffect } from '../game/event-types';

// ── Neutral events ──

export const EVENTS: GameEvent[] = [
  // ── Tier 1 — available from the start ──

  {
    id: 'wandering-merchant',
    title: 'Wandering Merchant',
    description: 'A trader crosses your path, laden with rare supplies from the eastern provinces.',
    color: 'neutral', tier: 1,
    choices: [
      { text: 'Buy supplies', effects: [{ resource: 'gold', amount: -2 }, { resource: 'faith', amount: 2 }, { resource: 'influence', amount: 2 }] },
      { text: 'Ignore', effects: [] },
    ],
  },
  {
    id: 'bandit-toll',
    title: 'Bandit Toll',
    description: 'Bandits block the road ahead, demanding payment to pass.',
    color: 'neutral', tier: 1,
    choices: [
      { text: 'Fight through', effects: [{ resource: 'momentum', amount: 3 }] },
      { text: 'Pay tribute', effects: [{ resource: 'gold', amount: -3 }] },
      { text: 'Negotiate', effects: [{ resource: 'influence', amount: -1 }, { resource: 'momentum', amount: 1 }] },
    ],
  },
  {
    id: 'ancient-shrine',
    title: 'Ancient Shrine',
    description: 'A forgotten shrine glows softly in the twilight. The old gods still linger here.',
    color: 'neutral', tier: 1,
    choices: [
      { text: 'Pray', effects: [{ resource: 'faith', amount: 2 }] },
      { text: 'Desecrate', effects: [{ resource: 'gold', amount: 3 }, { resource: 'faith', amount: -1 }] },
    ],
  },
  {
    id: 'refugee-camp',
    title: 'Refugee Camp',
    description: 'Displaced families beg for aid along the roadside. Their village was razed by raiders.',
    color: 'neutral', tier: 1,
    choices: [
      { text: 'Help them', effects: [{ resource: 'gold', amount: -2 }, { resource: 'influence', amount: 2 }], consequence: 'helped_refugees' },
      { text: 'Recruit', effects: [{ resource: 'momentum', amount: 1 }] },
      { text: 'Ignore', effects: [] },
    ],
  },
  {
    id: 'rival-scout',
    title: 'Rival Scout',
    description: 'An enemy scout is spotted nearby, unaware of your presence.',
    color: 'neutral', tier: 1,
    choices: [
      { text: 'Capture', effects: [{ resource: 'momentum', amount: 2 }, { resource: 'influence', amount: 1 }], consequence: 'captured_scout' },
      { text: 'Release', effects: [{ resource: 'faith', amount: 2 }] },
    ],
  },
  {
    id: 'road-ambush',
    title: 'Road Ambush',
    description: 'Your rearguard reports movement in the treeline. An ambush is imminent.',
    color: 'neutral', tier: 1,
    choices: [
      { text: 'Charge the ambushers', effects: [{ resource: 'momentum', amount: 3 }, { resource: 'gold', amount: -1 }] },
      { text: 'Form defensive square', effects: [{ resource: 'momentum', amount: 1 }, { resource: 'influence', amount: 1 }] },
      { text: 'Offer parley', effects: [{ resource: 'influence', amount: -2 }, { resource: 'gold', amount: 2 }, { resource: 'faith', amount: 1 }] },
    ],
  },

  // ── Tier 2 — requires threat >= 3 ──

  {
    id: 'provincial-dispute',
    title: 'Provincial Dispute',
    description: 'Two landowners demand you settle a border conflict. Both have powerful friends in the Senate.',
    color: 'neutral', tier: 2,
    requirements: { minThreat: 3 },
    choices: [
      { text: 'Rule for the veteran', effects: [{ resource: 'momentum', amount: 3 }, { resource: 'influence', amount: -2 }], consequence: 'favored_veteran' },
      { text: 'Rule for the merchant', effects: [{ resource: 'gold', amount: 4 }, { resource: 'faith', amount: -1 }], consequence: 'favored_merchant' },
      { text: 'Seize both estates', effects: [{ resource: 'gold', amount: 3 }, { resource: 'momentum', amount: 2 }, { resource: 'influence', amount: -3 }] },
    ],
  },
  {
    id: 'plague-outbreak',
    title: 'Plague Outbreak',
    description: 'A sickness spreads through your camp. The men grow fearful and morale sinks.',
    color: 'neutral', tier: 2,
    requirements: { minThreat: 3 },
    choices: [
      { text: 'Quarantine and pray', effects: [{ resource: 'faith', amount: 3 }, { resource: 'momentum', amount: -2 }] },
      { text: 'Burn the sick tents', effects: [{ resource: 'momentum', amount: 2 }, { resource: 'faith', amount: -2 }] },
      { text: 'Spend gold on physicians', effects: [{ resource: 'gold', amount: -4 }, { resource: 'influence', amount: 2 }] },
    ],
  },
  {
    id: 'senate-demand',
    title: 'Senatorial Demand',
    description: 'A courier arrives with a sealed letter: the Senate demands a tribute of gold to fund the fleet.',
    color: 'neutral', tier: 2,
    requirements: { minThreat: 3 },
    choices: [
      { text: 'Pay the tribute', effects: [{ resource: 'gold', amount: -4 }, { resource: 'influence', amount: 3 }] },
      { text: 'Refuse publicly', effects: [{ resource: 'influence', amount: -3 }, { resource: 'momentum', amount: 3 }], consequence: 'defied_senate' },
      { text: 'Delay with excuses', effects: [{ resource: 'influence', amount: -1 }] },
    ],
  },

  // ── Tier 3 — requires threat >= 6 ──

  {
    id: 'mysterious-oracle',
    title: 'The Sibyl\'s Gamble',
    description: 'A blind oracle offers a prophecy — but demands a steep offering. "Pay, and Fortune shall smile. Refuse, and she turns her back."',
    color: 'neutral', tier: 3,
    requirements: { minThreat: 6, minResource: { gold: 5 } },
    choices: [
      { text: 'Pay the offering (5 gold)', effects: [{ resource: 'gold', amount: -5 }, { resource: 'faith', amount: 6 }, { resource: 'momentum', amount: 4 }], requiresResource: { gold: 5 }, consequence: 'sibyls_blessing' },
      { text: 'Offer faith instead', effects: [{ resource: 'faith', amount: -3 }, { resource: 'influence', amount: 5 }, { resource: 'gold', amount: 3 }], requiresResource: { faith: 3 } },
      { text: 'Walk away', effects: [{ resource: 'momentum', amount: 1 }] },
    ],
  },
];
