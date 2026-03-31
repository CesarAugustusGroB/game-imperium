import type { Governor } from '../game/governor';

// ── One governor per faction + one white (universal) ──

export const GOVERNOR_PROCURATOR: Governor = {
  id: 'gov_procurator',
  name: 'Procurator Gaius',
  color: 'gold',
  tiers: [
    {
      description: '+10% gold income.',
      traits: [{ type: 'income-bonus', resource: 'gold', percent: 10 }],
      hireCost: { gold: 6 },
    },
    {
      description: '+18% gold income, −5 unrest.',
      traits: [
        { type: 'income-bonus', resource: 'gold', percent: 18 },
        { type: 'unrest-reduction', flat: 5 },
      ],
      hireCost: { gold: 12 },
    },
    {
      description: '+25% gold income, −10 unrest, −10% expenses.',
      traits: [
        { type: 'income-bonus', resource: 'gold', percent: 25 },
        { type: 'unrest-reduction', flat: 10 },
        { type: 'expense-reduction', percent: 10 },
      ],
      hireCost: { gold: 20 },
    },
  ],
};

export const GOVERNOR_LEGATUS: Governor = {
  id: 'gov_legatus',
  name: 'Legatus Titus',
  color: 'red',
  tiers: [
    {
      description: '+15% garrison strength.',
      traits: [{ type: 'garrison-strength', percent: 15 }],
      hireCost: { gold: 5, momentum: 2 },
    },
    {
      description: '+25% garrison strength, −5 unrest.',
      traits: [
        { type: 'garrison-strength', percent: 25 },
        { type: 'unrest-reduction', flat: 5 },
      ],
      hireCost: { gold: 10, momentum: 4 },
    },
    {
      description: '+35% garrison strength, −10 unrest, +1 population growth.',
      traits: [
        { type: 'garrison-strength', percent: 35 },
        { type: 'unrest-reduction', flat: 10 },
        { type: 'population-growth', amount: 1 },
      ],
      hireCost: { gold: 18, momentum: 6 },
    },
  ],
};

export const GOVERNOR_PONTIFEX: Governor = {
  id: 'gov_pontifex',
  name: 'Pontifex Lucius',
  color: 'blue',
  tiers: [
    {
      description: '+10% faith income.',
      traits: [{ type: 'income-bonus', resource: 'faith', percent: 10 }],
      hireCost: { gold: 4, faith: 3 },
    },
    {
      description: '+18% faith income, −8 unrest.',
      traits: [
        { type: 'income-bonus', resource: 'faith', percent: 18 },
        { type: 'unrest-reduction', flat: 8 },
      ],
      hireCost: { gold: 8, faith: 6 },
    },
    {
      description: '+25% faith income, −15 unrest, −10% investment cost.',
      traits: [
        { type: 'income-bonus', resource: 'faith', percent: 25 },
        { type: 'unrest-reduction', flat: 15 },
        { type: 'investment-discount', percent: 10 },
      ],
      hireCost: { gold: 14, faith: 10 },
    },
  ],
};

export const GOVERNOR_SENATOR: Governor = {
  id: 'gov_senator',
  name: 'Senator Corvus',
  color: 'purple',
  tiers: [
    {
      description: '+10% influence income.',
      traits: [{ type: 'income-bonus', resource: 'influence', percent: 10 }],
      hireCost: { gold: 4, influence: 3 },
    },
    {
      description: '+18% influence income, +1 population growth.',
      traits: [
        { type: 'income-bonus', resource: 'influence', percent: 18 },
        { type: 'population-growth', amount: 1 },
      ],
      hireCost: { gold: 8, influence: 6 },
    },
    {
      description: '+25% influence income, +2 population growth, −10% expenses.',
      traits: [
        { type: 'income-bonus', resource: 'influence', percent: 25 },
        { type: 'population-growth', amount: 2 },
        { type: 'expense-reduction', percent: 10 },
      ],
      hireCost: { gold: 14, influence: 10 },
    },
  ],
};

export const GOVERNOR_PREFECT: Governor = {
  id: 'gov_prefect',
  name: 'Prefect Marcellus',
  color: 'white',
  tiers: [
    {
      description: '−5% expenses, −3 unrest.',
      traits: [
        { type: 'expense-reduction', percent: 5 },
        { type: 'unrest-reduction', flat: 3 },
      ],
      hireCost: { gold: 5 },
    },
    {
      description: '−10% expenses, −6 unrest, −8% investment cost.',
      traits: [
        { type: 'expense-reduction', percent: 10 },
        { type: 'unrest-reduction', flat: 6 },
        { type: 'investment-discount', percent: 8 },
      ],
      hireCost: { gold: 10 },
    },
    {
      description: '−15% expenses, −10 unrest, −15% investment cost, +1 population growth.',
      traits: [
        { type: 'expense-reduction', percent: 15 },
        { type: 'unrest-reduction', flat: 10 },
        { type: 'investment-discount', percent: 15 },
        { type: 'population-growth', amount: 1 },
      ],
      hireCost: { gold: 18 },
    },
  ],
};

export const ALL_GOVERNORS: Governor[] = [
  GOVERNOR_PROCURATOR,
  GOVERNOR_LEGATUS,
  GOVERNOR_PONTIFEX,
  GOVERNOR_SENATOR,
  GOVERNOR_PREFECT,
];
