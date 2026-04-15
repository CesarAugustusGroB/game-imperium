import type { GameEvent } from '../game/events/event-types';
import { RED_EVENTS, BLUE_EVENTS, GOLD_EVENTS, PURPLE_EVENTS, WHITE_EVENTS } from './faction-events';

// Re-export types so existing imports don't break
export type { GameEvent, EventChoice, EventEffect } from '../game/events/event-types';

// ── Fallback event ──

/**
 * Shown when no other event qualifies (all events filtered out).
 * Exported separately — NOT included in the EVENTS array to avoid
 * it appearing in normal event selection.
 */
export const FALLBACK_EVENT: GameEvent = {
  id: '__fallback_uneventful',
  title: 'Uneventful March',
  description: 'The road ahead is quiet. Your legions march undisturbed.',
  color: 'neutral',
  tier: 1,
  choices: [
    { text: 'Press onward', effects: [{ resource: 'momentum', amount: 1 }] },
  ],
};

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

  // ── Consequence-chain events ──

  {
    id: 'refugees-gratitude',
    title: 'Refugees Give Thanks',
    description: 'The families you sheltered have rebuilt their lives. Their young men now seek to repay the debt — with service.',
    color: 'neutral', tier: 1,
    requirements: { requiresFlag: 'helped_refugees', blockedByFlag: 'refugees_repaid' },
    choices: [
      { text: 'Accept their service', effects: [{ resource: 'momentum', amount: 2 }, { resource: 'influence', amount: 1 }], consequence: 'refugees_repaid' },
      { text: 'Accept a donation instead', effects: [{ resource: 'gold', amount: 2 }, { resource: 'faith', amount: 1 }], consequence: 'refugees_repaid' },
      { text: 'Wish them well and move on', effects: [{ resource: 'faith', amount: 2 }], consequence: 'refugees_repaid' },
    ],
  },
  {
    id: 'senate-retaliation',
    title: 'The Senate Strikes Back',
    description: 'Your defiance has not gone forgotten. Senators hostile to your cause have frozen your supply contracts and dispatched an inspector.',
    color: 'neutral', tier: 2,
    requirements: { minThreat: 3, requiresFlag: 'defied_senate', blockedByFlag: 'senate_placated' },
    choices: [
      { text: 'Pay reparations', effects: [{ resource: 'gold', amount: -4 }, { resource: 'influence', amount: 3 }], consequence: 'senate_placated' },
      { text: 'Bribe the inspector', effects: [{ resource: 'gold', amount: -3 }, { resource: 'momentum', amount: 2 }], consequence: 'senate_placated' },
      { text: 'Defy again — openly', effects: [{ resource: 'momentum', amount: 4 }, { resource: 'influence', amount: -4 }] },
    ],
  },
  {
    id: 'stargazer-omen',
    title: 'The Stargazer\'s Warning',
    description: 'A wandering astronomer reads the night sky and warns of a convergence that has preceded every great empire\'s fall.',
    color: 'neutral', tier: 2,
    requirements: { minThreat: 3 },
    choices: [
      { text: 'Heed the warning — rest the legions', effects: [{ resource: 'faith', amount: 3 }, { resource: 'momentum', amount: -2 }] },
      { text: 'Use it to inspire fear', effects: [{ resource: 'momentum', amount: 3 }, { resource: 'influence', amount: 1 }] },
      { text: 'Imprison the alarmist', effects: [{ resource: 'gold', amount: 2 }, { resource: 'faith', amount: -2 }] },
    ],
  },
  {
    id: 'lost-legion-standards',
    title: 'Lost Legion Standards',
    description: 'A local shepherd claims to have found the golden standards of a legion lost two decades ago. Returning them to Rome would be a monumental act of prestige.',
    color: 'neutral', tier: 3,
    requirements: { minThreat: 6, minProvinces: 2 },
    choices: [
      { text: 'Return them to the Senate', effects: [{ resource: 'influence', amount: 6 }, { resource: 'faith', amount: 3 }], consequence: 'standards_returned' },
      { text: 'Keep them as a trophy', effects: [{ resource: 'momentum', amount: 5 }, { resource: 'influence', amount: -2 }], consequence: 'kept_standards' },
      { text: 'Melt them for gold', effects: [{ resource: 'gold', amount: 6 }, { resource: 'faith', amount: -4 }, { resource: 'influence', amount: -2 }] },
    ],
  },
  {
    id: 'night-of-assassins',
    title: 'Night of Assassins',
    description: 'Your guards intercept three armed men in your tent. One dies with a patrician ring on his finger. Someone in Rome wants you dead.',
    color: 'neutral', tier: 3,
    requirements: { minThreat: 6 },
    choices: [
      { text: 'Announce the attempt publicly', effects: [{ resource: 'influence', amount: 5 }, { resource: 'momentum', amount: 2 }], consequence: 'assassination_exposed' },
      { text: 'Investigate quietly', effects: [{ resource: 'gold', amount: -2 }, { resource: 'influence', amount: 3 }] },
      { text: 'Send the ring back — a warning', effects: [{ resource: 'momentum', amount: 3 }, { resource: 'faith', amount: -2 }] },
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

  // ── Food & famine events (S20) ──

  {
    id: 'granary-rats',
    title: 'Rats in the Granary',
    description: 'Vermin have infested a province\'s grain stores. The people cry out for action — but fumigating is costly, and burning the infected stocks risks hunger.',
    color: 'neutral', tier: 1,
    choices: [
      { text: 'Fumigate the stores (3g)', effects: [{ resource: 'gold', amount: -3 }, { resource: 'influence', amount: 2 }], requiresResource: { gold: 3 }, consequence: 'granary_saved' },
      { text: 'Burn infected stocks', effects: [{ resource: 'momentum', amount: 2 }] },
      { text: 'Ignore the problem', effects: [{ resource: 'gold', amount: 1 }] },
    ],
  },
  {
    id: 'drought-prayer',
    title: 'Drought Season',
    description: 'The rains have not come. Fields wither and wells run dry. The priests urge a grand sacrifice to appease the gods, while the merchants suggest buying grain from abroad.',
    color: 'neutral', tier: 2,
    requirements: { minProvinces: 2 },
    choices: [
      { text: 'Grand sacrifice (3 faith)', effects: [{ resource: 'faith', amount: -3 }, { resource: 'influence', amount: 3 }, { resource: 'momentum', amount: 2 }], requiresResource: { faith: 3 }, consequence: 'gods_appeased' },
      { text: 'Buy foreign grain (5g)', effects: [{ resource: 'gold', amount: -5 }, { resource: 'influence', amount: 2 }], requiresResource: { gold: 5 } },
      { text: 'Ration what remains', effects: [{ resource: 'momentum', amount: -1 }] },
    ],
  },
  {
    id: 'bumper-harvest',
    title: 'Bumper Harvest',
    description: 'An exceptional growing season has blessed your provinces. The granaries overflow with grain, and the people celebrate with feasts.',
    color: 'neutral', tier: 1,
    choices: [
      { text: 'Feast and celebrate', effects: [{ resource: 'influence', amount: 3 }, { resource: 'momentum', amount: 2 }] },
      { text: 'Sell the surplus', effects: [{ resource: 'gold', amount: 5 }] },
      { text: 'Store for winter', effects: [{ resource: 'faith', amount: 2 }, { resource: 'momentum', amount: 1 }] },
    ],
  },
  {
    id: 'wandering-farmers',
    title: 'Displaced Farmers',
    description: 'A column of farmers displaced by war in a neighbouring region seeks refuge in your lands. They bring skills and willing hands — but also hungry mouths.',
    color: 'neutral', tier: 2,
    requirements: { minProvinces: 2 },
    choices: [
      { text: 'Welcome them (3g)', effects: [{ resource: 'gold', amount: -3 }, { resource: 'influence', amount: 4 }, { resource: 'faith', amount: 1 }], requiresResource: { gold: 3 }, consequence: 'refugee_farmers' },
      { text: 'Recruit able-bodied', effects: [{ resource: 'momentum', amount: 3 }] },
      { text: 'Turn them away', effects: [{ resource: 'gold', amount: 1 }] },
    ],
  },

  // ── Faction-colored events (S7-04 through S7-08) ──
  ...RED_EVENTS,
  ...BLUE_EVENTS,
  ...GOLD_EVENTS,
  ...PURPLE_EVENTS,
  ...WHITE_EVENTS,
];
