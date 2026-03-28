import type { ResourceType } from '../game/commander';

export interface EventEffect {
  resource: ResourceType;
  amount: number; // positive = gain (addResource), negative = cost (spendResource)
}

export interface EventChoice {
  text: string;
  effects: EventEffect[];
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
}

export const EVENTS: GameEvent[] = [
  {
    id: 'wandering-merchant',
    title: 'Wandering Merchant',
    description: 'A trader crosses your path, laden with rare supplies.',
    choices: [
      { text: 'Buy supplies', effects: [{ resource: 'gold', amount: -2 }, { resource: 'faith', amount: 2 }, { resource: 'influence', amount: 2 }] },
      { text: 'Ignore', effects: [] },
    ],
  },
  {
    id: 'bandit-toll',
    title: 'Bandit Toll',
    description: 'Bandits block the road ahead, demanding payment.',
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
    choices: [
      { text: 'Pray', effects: [{ resource: 'faith', amount: 2 }] },
      { text: 'Desecrate', effects: [{ resource: 'gold', amount: 3 }, { resource: 'faith', amount: -1 }] },
    ],
  },
  {
    id: 'refugee-camp',
    title: 'Refugee Camp',
    description: 'Displaced families beg for aid along the roadside.',
    choices: [
      { text: 'Help them', effects: [{ resource: 'gold', amount: -2 }, { resource: 'influence', amount: 2 }] },
      { text: 'Recruit', effects: [{ resource: 'momentum', amount: 1 }] },
      { text: 'Ignore', effects: [] },
    ],
  },
  {
    id: 'rival-scout',
    title: 'Rival Scout',
    description: 'An enemy scout is spotted nearby, unaware of your presence.',
    choices: [
      { text: 'Capture', effects: [{ resource: 'momentum', amount: 2 }, { resource: 'influence', amount: 1 }] },
      { text: 'Release', effects: [{ resource: 'faith', amount: 2 }] },
    ],
  },
];
