import type { GameEvent } from '../game/event-types';

// Re-export types so existing imports don't break
export type { GameEvent, EventChoice, EventEffect } from '../game/event-types';

// ── Neutral events (Tier 1) ──

export const EVENTS: GameEvent[] = [
  {
    id: 'wandering-merchant',
    title: 'Wandering Merchant',
    description: 'A trader crosses your path, laden with rare supplies.',
    color: 'neutral', tier: 1,
    choices: [
      { text: 'Buy supplies', effects: [{ resource: 'gold', amount: -2 }, { resource: 'faith', amount: 2 }, { resource: 'influence', amount: 2 }] },
      { text: 'Ignore', effects: [] },
    ],
  },
  {
    id: 'bandit-toll',
    title: 'Bandit Toll',
    description: 'Bandits block the road ahead, demanding payment.',
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
    description: 'A forgotten shrine glows softly in the twilight.',
    color: 'neutral', tier: 1,
    choices: [
      { text: 'Pray', effects: [{ resource: 'faith', amount: 2 }] },
      { text: 'Desecrate', effects: [{ resource: 'gold', amount: 3 }, { resource: 'faith', amount: -1 }] },
    ],
  },
  {
    id: 'refugee-camp',
    title: 'Refugee Camp',
    description: 'Displaced families beg for aid along the roadside.',
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
];
