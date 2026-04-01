import type { GameEvent } from '../game/event-types';

// ══════════════════════════════════════════════════════════════
// S7-04: Red (Military) events — Momentum trade-offs
// ══════════════════════════════════════════════════════════════

export const RED_EVENTS: GameEvent[] = [
  {
    id: 'red-deserters',
    title: 'Deserters at the Gate',
    description: 'A band of deserters from a rival legion seeks refuge in your camp. Your centurion awaits orders.',
    color: 'red', tier: 1,
    choices: [
      { text: 'Press them into service', effects: [{ resource: 'momentum', amount: 3 }], consequence: 'recruited_deserters' },
      { text: 'Execute them as example', effects: [{ resource: 'momentum', amount: 1 }, { resource: 'influence', amount: 1 }] },
      { text: 'Turn them away', effects: [] },
    ],
  },
  {
    id: 'red-arms-dealer',
    title: 'The Arms Dealer',
    description: 'A Gallic smith offers fine weapons at a steep price. Your legionaries eye them hungrily.',
    color: 'red', tier: 1,
    choices: [
      { text: 'Buy weapons', effects: [{ resource: 'gold', amount: -3 }, { resource: 'momentum', amount: 4 }] },
      { text: 'Confiscate his stock', effects: [{ resource: 'momentum', amount: 2 }, { resource: 'influence', amount: -2 }] },
      { text: 'Decline', effects: [] },
    ],
  },
  {
    id: 'red-veterans-return',
    title: 'Veterans Return',
    description: 'Grizzled veterans from a distant campaign arrive, seeking a commander worth following.',
    color: 'red', tier: 1,
    choices: [
      { text: 'Welcome them', effects: [{ resource: 'momentum', amount: 3 }, { resource: 'gold', amount: -2 }] },
      { text: 'Test them in the arena', effects: [{ resource: 'momentum', amount: 2 }] },
    ],
  },
  {
    id: 'red-siege-opportunity',
    title: 'Siege Opportunity',
    description: 'Scouts report a lightly defended outpost. Its supplies would fuel your campaign for weeks.',
    color: 'red', tier: 2,
    requirements: { minThreat: 3 },
    choices: [
      { text: 'Storm the walls', effects: [{ resource: 'momentum', amount: 4 }, { resource: 'gold', amount: 3 }, { resource: 'faith', amount: -2 }] },
      { text: 'Lay siege patiently', effects: [{ resource: 'momentum', amount: 2 }, { resource: 'influence', amount: 2 }] },
      { text: 'Bypass — not worth the risk', effects: [{ resource: 'momentum', amount: 1 }] },
    ],
  },
  {
    id: 'red-legion-mutiny',
    title: 'Whispers of Mutiny',
    description: 'Your spymaster reports discontent in the ranks. The men want blood, not marching.',
    color: 'red', tier: 3,
    requirements: { minThreat: 6, hasInvestment: 'castrum' },
    choices: [
      { text: 'Address the legion', effects: [{ resource: 'momentum', amount: 5 }, { resource: 'influence', amount: -3 }], consequence: 'quelled_mutiny' },
      { text: 'Decimation — punish the tenth', effects: [{ resource: 'momentum', amount: 3 }, { resource: 'faith', amount: -3 }] },
      { text: 'Promise plunder', effects: [{ resource: 'gold', amount: -4 }, { resource: 'momentum', amount: 6 }] },
    ],
  },
];

// ══════════════════════════════════════════════════════════════
// S7-05: Blue (Diplomatic) events — Influence trade-offs
// ══════════════════════════════════════════════════════════════

export const BLUE_EVENTS: GameEvent[] = [
  {
    id: 'blue-embassy',
    title: 'Embassy from Gaul',
    description: 'A Gallic chieftain sends envoys offering alliance against a common threat.',
    color: 'blue', tier: 1,
    choices: [
      { text: 'Accept the alliance', effects: [{ resource: 'influence', amount: 3 }], consequence: 'gallic_alliance' },
      { text: 'Demand tribute first', effects: [{ resource: 'gold', amount: 3 }, { resource: 'influence', amount: -1 }] },
      { text: 'Reject — Rome needs no barbarians', effects: [{ resource: 'momentum', amount: 2 }] },
    ],
  },
  {
    id: 'blue-betrayal-plot',
    title: 'Betrayal Unmasked',
    description: 'Your agents intercept letters proving a trusted ally plots against you.',
    color: 'blue', tier: 1,
    choices: [
      { text: 'Confront publicly', effects: [{ resource: 'influence', amount: 3 }, { resource: 'momentum', amount: -1 }], consequence: 'exposed_traitor' },
      { text: 'Use the knowledge quietly', effects: [{ resource: 'influence', amount: 2 }, { resource: 'gold', amount: 2 }] },
      { text: 'Burn the letters', effects: [{ resource: 'faith', amount: 2 }] },
    ],
  },
  {
    id: 'blue-political-marriage',
    title: 'Political Marriage',
    description: 'A powerful senator offers his daughter in marriage to cement a political alliance.',
    color: 'blue', tier: 1,
    choices: [
      { text: 'Accept the match', effects: [{ resource: 'influence', amount: 4 }, { resource: 'gold', amount: -2 }] },
      { text: 'Decline gracefully', effects: [{ resource: 'faith', amount: 1 }, { resource: 'influence', amount: -1 }] },
    ],
  },
  {
    id: 'blue-senate-session',
    title: 'Emergency Senate Session',
    description: 'The Senate convenes to debate your campaign. Your supporters urge you to send a representative.',
    color: 'blue', tier: 2,
    requirements: { minThreat: 3 },
    choices: [
      { text: 'Send your best orator', effects: [{ resource: 'influence', amount: 4 }, { resource: 'gold', amount: -2 }] },
      { text: 'Attend personally', effects: [{ resource: 'influence', amount: 5 }, { resource: 'momentum', amount: -3 }] },
      { text: 'Ignore the summons', effects: [{ resource: 'influence', amount: -3 }, { resource: 'momentum', amount: 2 }], consequence: 'ignored_senate' },
    ],
  },
  {
    id: 'blue-foreign-prince',
    title: 'The Foreign Prince',
    description: 'A prince from a distant land arrives with gifts and a proposition: mutual defense against the barbarian tide.',
    color: 'blue', tier: 3,
    requirements: { minThreat: 6, minProvinces: 3 },
    choices: [
      { text: 'Grand alliance', effects: [{ resource: 'influence', amount: 6 }, { resource: 'gold', amount: -3 }, { resource: 'faith', amount: 2 }], consequence: 'foreign_alliance' },
      { text: 'Trade pact only', effects: [{ resource: 'gold', amount: 4 }, { resource: 'influence', amount: 2 }] },
      { text: 'Refuse — Rome stands alone', effects: [{ resource: 'momentum', amount: 3 }, { resource: 'influence', amount: -2 }] },
    ],
  },
];

// ══════════════════════════════════════════════════════════════
// S7-06: Gold (Religious) events — Faith trade-offs
// ══════════════════════════════════════════════════════════════

export const GOLD_EVENTS: GameEvent[] = [
  {
    id: 'gold-temple-dedication',
    title: 'Temple Dedication',
    description: 'The local priesthood requests funds to dedicate a temple to Jupiter Optimus Maximus.',
    color: 'gold', tier: 1,
    choices: [
      { text: 'Fund the temple', effects: [{ resource: 'gold', amount: -2 }, { resource: 'faith', amount: 3 }], consequence: 'blessed_temple' },
      { text: 'Attend the ceremony', effects: [{ resource: 'faith', amount: 2 }] },
      { text: 'Divert funds to the army', effects: [{ resource: 'momentum', amount: 2 }, { resource: 'faith', amount: -1 }] },
    ],
  },
  {
    id: 'gold-heretic-trial',
    title: 'Heretic on Trial',
    description: 'A man accused of blasphemy against the state gods is brought before you in chains.',
    color: 'gold', tier: 1,
    choices: [
      { text: 'Condemn him', effects: [{ resource: 'faith', amount: 3 }, { resource: 'influence', amount: -1 }] },
      { text: 'Show mercy', effects: [{ resource: 'influence', amount: 2 }, { resource: 'faith', amount: -1 }] },
      { text: 'Let the priests decide', effects: [{ resource: 'faith', amount: 1 }] },
    ],
  },
  {
    id: 'gold-divine-omen',
    title: 'Divine Omen',
    description: 'An eagle lands on your standard at dawn. The augurs declare it a sign from Mars himself.',
    color: 'gold', tier: 1,
    choices: [
      { text: 'Proclaim divine favor', effects: [{ resource: 'faith', amount: 3 }, { resource: 'momentum', amount: 1 }] },
      { text: 'Sacrifice in gratitude', effects: [{ resource: 'gold', amount: -1 }, { resource: 'faith', amount: 4 }] },
    ],
  },
  {
    id: 'gold-relic-discovery',
    title: 'Relic of the Republic',
    description: 'Diggers unearth a sacred relic from the founding era. Both priests and senators claim it.',
    color: 'gold', tier: 2,
    requirements: { minThreat: 3 },
    choices: [
      { text: 'Give to the priests', effects: [{ resource: 'faith', amount: 5 }, { resource: 'influence', amount: -2 }] },
      { text: 'Display in the forum', effects: [{ resource: 'influence', amount: 3 }, { resource: 'faith', amount: 2 }] },
      { text: 'Keep it for yourself', effects: [{ resource: 'gold', amount: 4 }, { resource: 'faith', amount: -2 }], consequence: 'kept_relic' },
    ],
  },
  {
    id: 'gold-divine-intervention',
    title: 'Divine Intervention',
    description: 'A blinding light strikes the Pantheon altar. The high priestess speaks in tongues, prophesying victory — but only through sacrifice.',
    color: 'gold', tier: 3,
    requirements: { minThreat: 6, hasInvestment: 'pantheon', requiresFlag: 'blessed_temple' },
    choices: [
      { text: 'The Great Sacrifice', effects: [{ resource: 'gold', amount: -4 }, { resource: 'faith', amount: 8 }, { resource: 'momentum', amount: 3 }], consequence: 'divine_favor' },
      { text: 'Modest offering', effects: [{ resource: 'gold', amount: -2 }, { resource: 'faith', amount: 4 }] },
      { text: 'This is madness', effects: [{ resource: 'momentum', amount: 2 }, { resource: 'faith', amount: -3 }] },
    ],
  },
];

// ══════════════════════════════════════════════════════════════
// S7-07: Purple (Economic) events — Gold trade-offs
// ══════════════════════════════════════════════════════════════

export const PURPLE_EVENTS: GameEvent[] = [
  {
    id: 'purple-trade-caravan',
    title: 'The Silk Road Caravan',
    description: 'A wealthy merchant caravan passes through your province, offering exotic goods and investment opportunities.',
    color: 'purple', tier: 1,
    choices: [
      { text: 'Tax the caravan', effects: [{ resource: 'gold', amount: 4 }, { resource: 'influence', amount: -1 }] },
      { text: 'Invest in the route', effects: [{ resource: 'gold', amount: -3 }, { resource: 'influence', amount: 2 }], consequence: 'trade_route_invested' },
      { text: 'Raid the caravan', effects: [{ resource: 'gold', amount: 5 }, { resource: 'momentum', amount: 2 }, { resource: 'influence', amount: -3 }], consequence: 'caravan_raider' },
    ],
  },
  {
    id: 'purple-tax-collector',
    title: 'The Tax Collector',
    description: 'Your provincial tax collector reports widespread evasion. He requests harsher measures.',
    color: 'purple', tier: 1,
    choices: [
      { text: 'Enforce strictly', effects: [{ resource: 'gold', amount: 4 }, { resource: 'faith', amount: -1 }] },
      { text: 'Offer amnesty', effects: [{ resource: 'gold', amount: 1 }, { resource: 'influence', amount: 2 }] },
      { text: 'Replace the collector', effects: [{ resource: 'gold', amount: 2 }] },
    ],
  },
  {
    id: 'purple-bribery',
    title: 'A Generous Offer',
    description: 'A wealthy patrician offers a substantial bribe for preferential treatment in upcoming contracts.',
    color: 'purple', tier: 1,
    choices: [
      { text: 'Accept discreetly', effects: [{ resource: 'gold', amount: 5 }, { resource: 'faith', amount: -2 }], consequence: 'accepted_bribe' },
      { text: 'Refuse publicly', effects: [{ resource: 'influence', amount: 3 }, { resource: 'faith', amount: 1 }] },
      { text: 'Double the price', effects: [{ resource: 'gold', amount: 3 }, { resource: 'influence', amount: -1 }] },
    ],
  },
  {
    id: 'purple-market-speculation',
    title: 'Market Speculation',
    description: 'Grain prices are plummeting. Your advisors see opportunity — buy low now, sell high when winter comes.',
    color: 'purple', tier: 2,
    requirements: { minThreat: 3 },
    choices: [
      { text: 'Invest heavily', effects: [{ resource: 'gold', amount: -4 }, { resource: 'influence', amount: 3 }], consequence: 'grain_speculator', requiresResource: { gold: 4 } },
      { text: 'Modest investment', effects: [{ resource: 'gold', amount: -2 }, { resource: 'influence', amount: 1 }] },
      { text: 'Too risky', effects: [] },
    ],
  },
  {
    id: 'purple-golden-fleet',
    title: 'The Golden Fleet',
    description: 'A fleet of merchant galleys offers exclusive access to eastern luxury goods. The profits could be immense — but so is the cost.',
    color: 'purple', tier: 3,
    requirements: { minThreat: 6, hasInvestment: 'market', minResource: { gold: 8 } },
    choices: [
      { text: 'Full investment', effects: [{ resource: 'gold', amount: -8 }, { resource: 'influence', amount: 6 }, { resource: 'faith', amount: 3 }], requiresResource: { gold: 8 }, consequence: 'golden_fleet' },
      { text: 'Partial stake', effects: [{ resource: 'gold', amount: -4 }, { resource: 'influence', amount: 3 }], requiresResource: { gold: 4 } },
      { text: 'Pass — too much risk', effects: [{ resource: 'momentum', amount: 1 }] },
    ],
  },
];

// ══════════════════════════════════════════════════════════════
// S7-08: White (Populist) events — Multi-resource, unrest tie-ins
// ══════════════════════════════════════════════════════════════

export const WHITE_EVENTS: GameEvent[] = [
  {
    id: 'white-bread-riots',
    title: 'Bread Riots in the Forum',
    description: 'The plebs demand cheaper grain. Your granaries run low and the mob grows restless.',
    color: 'white', tier: 1,
    choices: [
      { text: 'Open the reserves', effects: [{ resource: 'gold', amount: -3 }, { resource: 'influence', amount: 2 }], consequence: 'fed_the_mob' },
      { text: 'Deploy the garrison', effects: [{ resource: 'momentum', amount: 2 }, { resource: 'faith', amount: -1 }] },
      { text: 'Promise reforms', effects: [{ resource: 'influence', amount: -2 }, { resource: 'faith', amount: 1 }], consequence: 'reform_promised' },
    ],
  },
  {
    id: 'white-gladiators',
    title: 'Gladiatorial Games',
    description: 'The people crave spectacle. Hosting games would boost morale but drain your treasury.',
    color: 'white', tier: 1,
    choices: [
      { text: 'Grand spectacle', effects: [{ resource: 'gold', amount: -3 }, { resource: 'momentum', amount: 2 }, { resource: 'influence', amount: 2 }] },
      { text: 'Modest games', effects: [{ resource: 'gold', amount: -1 }, { resource: 'momentum', amount: 1 }] },
      { text: 'Cancel — waste of coin', effects: [{ resource: 'influence', amount: -1 }] },
    ],
  },
  {
    id: 'white-popular-tribune',
    title: 'The People\'s Tribune',
    description: 'A charismatic tribune rallies the common folk, demanding land redistribution. His followers grow by the day.',
    color: 'white', tier: 1,
    choices: [
      { text: 'Support his reforms', effects: [{ resource: 'influence', amount: 3 }, { resource: 'gold', amount: -2 }], consequence: 'supported_tribune' },
      { text: 'Co-opt his movement', effects: [{ resource: 'influence', amount: 1 }, { resource: 'momentum', amount: 2 }] },
      { text: 'Silence him', effects: [{ resource: 'momentum', amount: 1 }, { resource: 'influence', amount: -2 }, { resource: 'faith', amount: -1 }] },
    ],
  },
  {
    id: 'white-grain-shortage',
    title: 'Grain Ships Delayed',
    description: 'The grain fleet from Egypt is three weeks late. Panic spreads through the markets as bread prices soar.',
    color: 'white', tier: 2,
    requirements: { minProvinces: 2 },
    choices: [
      { text: 'Ration strictly', effects: [{ resource: 'gold', amount: 2 }, { resource: 'influence', amount: -2 }] },
      { text: 'Buy from local farms', effects: [{ resource: 'gold', amount: -4 }, { resource: 'faith', amount: 2 }] },
      { text: 'Blame the merchants', effects: [{ resource: 'influence', amount: 2 }, { resource: 'momentum', amount: 1 }, { resource: 'faith', amount: -2 }] },
    ],
  },
  {
    id: 'white-urban-miracle',
    title: 'Miracle at the Coliseum',
    description: 'During the games, a wounded gladiator rises impossibly. The crowd roars — they see divine will. The priests call it a sign. The cynics call it theater.',
    color: 'white', tier: 3,
    requirements: { hasInvestment: 'insula' },
    choices: [
      { text: 'Declare it a miracle', effects: [{ resource: 'faith', amount: 5 }, { resource: 'influence', amount: 3 }, { resource: 'momentum', amount: 2 }], consequence: 'coliseum_miracle' },
      { text: 'Investigate quietly', effects: [{ resource: 'influence', amount: 2 }, { resource: 'gold', amount: 2 }] },
      { text: 'Exploit for recruitment', effects: [{ resource: 'momentum', amount: 5 }, { resource: 'faith', amount: -2 }] },
    ],
  },
];
