import type { Advisor, AdvisorTrait } from '../game/council/advisor';

const ADVISOR_PORTRAIT_PATH = '/asset/councilors/';
const ADVISOR_COST_BY_TIER = {
  1: 60,
  2: 100,
  3: 150,
} as const;

function advisorMeta(
  traits: AdvisorTrait[],
  tier: Advisor['currentTier'] = 1,
  portraitFile?: string,
): Pick<Advisor, 'traits' | 'cost' | 'portrait'> {
  return {
    traits,
    cost: ADVISOR_COST_BY_TIER[tier],
    ...(portraitFile ? { portrait: `${ADVISOR_PORTRAIT_PATH}${portraitFile}` } : {}),
  };
}

// ── Red (Military) — battle-heavy, short spokes, attacking ──

export const ADVISOR_CENTURION: Advisor = {
  id: 'advisor_centurion', name: 'Centurion Varro', color: 'red', currentTier: 1, xp: 0,
  ...advisorMeta(['Strategist', 'Veteran']),
  tiers: [
    { description: '+10% loot from battles.',
      passive: { type: 'loot-bonus', percent: 10 },
      spokeTemplate: { durationRange: [1, 2], posture: 'attacking' } },
    { description: '+18% loot from battles.',
      passive: { type: 'loot-bonus', percent: 18 },
      spokeTemplate: { durationRange: [1, 2], posture: 'attacking' } },
    { description: '+25% loot from battles.',
      passive: { type: 'loot-bonus', percent: 25 },
      spokeTemplate: { durationRange: [1, 3], posture: 'attacking' } },
  ],
};

export const ADVISOR_SIEGE_MASTER: Advisor = {
  id: 'advisor_siege_master', name: 'Siege Master Titus', color: 'red', currentTier: 1, xp: 0,
  ...advisorMeta(['Strategist', 'Logistician'], 1, 'char_tiberius.png'),
  tiers: [
    { description: 'Erodes the final enemy by 7% at embark.',
      passive: { type: 'enemy-weaken', amount: 1 },
      spokeTemplate: { durationRange: [1, 3], posture: 'attacking' } },
    { description: 'Erodes the final enemy by 14% at embark.',
      passive: { type: 'enemy-weaken', amount: 2 },
      spokeTemplate: { durationRange: [2, 3], posture: 'attacking' } },
    { description: 'Erodes the final enemy by 21% at embark.',
      passive: { type: 'enemy-weaken', amount: 3 },
      spokeTemplate: { durationRange: [2, 4], posture: 'attacking' } },
  ],
};

export const ADVISOR_RAIDER: Advisor = {
  id: 'advisor_raider', name: 'Raider Brennus', color: 'red', currentTier: 1, xp: 0,
  ...advisorMeta(['Strategist', 'Schemer'], 1, 'char_boudicca.png'),
  tiers: [
    { description: '+15% loot from battles.',
      passive: { type: 'loot-bonus', percent: 15 },
      spokeTemplate: { durationRange: [1, 1], posture: 'attacking' } },
    { description: '+22% loot from battles.',
      passive: { type: 'loot-bonus', percent: 22 },
      spokeTemplate: { durationRange: [1, 1], posture: 'attacking' } },
    { description: '+30% loot from battles.',
      passive: { type: 'loot-bonus', percent: 30 },
      spokeTemplate: { durationRange: [1, 2], posture: 'attacking' } },
  ],
};

// ── Blue (Diplomatic) — event-heavy, longer spokes, defending ──

export const ADVISOR_DIPLOMAT: Advisor = {
  id: 'advisor_diplomat', name: 'Legate Aemilia', color: 'blue', currentTier: 1, xp: 0,
  ...advisorMeta(['Diplomat', 'Negotiator']),
  tiers: [
    { description: '+5 gold at embark.',
      passive: { type: 'extra-event-choices', count: 1 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
    { description: '+10 gold at embark.',
      passive: { type: 'extra-event-choices', count: 2 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
    { description: '+15 gold at embark.',
      passive: { type: 'extra-event-choices', count: 3 },
      spokeTemplate: { durationRange: [3, 4], posture: 'defending' } },
  ],
};

export const ADVISOR_SCHOLAR: Advisor = {
  id: 'advisor_scholar', name: 'Scholar Ptolemy', color: 'blue', currentTier: 1, xp: 0,
  ...advisorMeta(['Diplomat', 'Administrator']),
  tiers: [
    { description: '+1 campaign day at embark.',
      passive: { type: 'campaign-time', days: 1 },
      spokeTemplate: { durationRange: [2, 3], posture: 'defending' } },
    { description: '+2 campaign days at embark.',
      passive: { type: 'campaign-time', days: 2 },
      spokeTemplate: { durationRange: [2, 3], posture: 'defending' } },
    { description: '+3 campaign days at embark.',
      passive: { type: 'campaign-time', days: 3 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
  ],
};

export const ADVISOR_SPYMASTER: Advisor = {
  id: 'advisor_spymaster', name: 'Spymaster Cassia', color: 'blue', currentTier: 1, xp: 0,
  ...advisorMeta(['Schemer', 'Mastermind']),
  tiers: [
    { description: '−1 starting threat at embark.',
      passive: { type: 'threat-reduction', amount: 1 },
      spokeTemplate: { durationRange: [1, 3], posture: 'defending' } },
    { description: '−2 starting threat at embark.',
      passive: { type: 'threat-reduction', amount: 2 },
      spokeTemplate: { durationRange: [1, 3], posture: 'defending' } },
    { description: '−3 starting threat at embark.',
      passive: { type: 'threat-reduction', amount: 3 },
      spokeTemplate: { durationRange: [2, 3], posture: 'defending' } },
  ],
};

// ── Gold (Religious) — faith, healing, holy events ──

export const ADVISOR_PONTIFEX: Advisor = {
  id: 'advisor_pontifex', name: 'Pontifex Lucius', color: 'gold', currentTier: 1, xp: 0,
  ...advisorMeta(['Pontifex', 'Diplomat'], 1, 'char_pope_innocent.png'),
  tiers: [
    { description: '+1 morale at embark.',
      passive: { type: 'morale-bonus', amount: 1 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
    { description: '+2 morale at embark.',
      passive: { type: 'morale-bonus', amount: 2 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
    { description: '+3 morale at embark.',
      passive: { type: 'morale-bonus', amount: 3 },
      spokeTemplate: { durationRange: [3, 4], posture: 'defending' } },
  ],
};

export const ADVISOR_HEALER: Advisor = {
  id: 'advisor_healer', name: 'Healer Cornelia', color: 'gold', currentTier: 1, xp: 0,
  ...advisorMeta(['Healer', 'Logistician']),
  tiers: [
    { description: '+1 morale at embark.',
      passive: { type: 'heal-between-nodes', amount: 100 },
      spokeTemplate: { durationRange: [2, 3], posture: 'defending' } },
    { description: '+2 morale at embark.',
      passive: { type: 'heal-between-nodes', amount: 200 },
      spokeTemplate: { durationRange: [2, 3], posture: 'defending' } },
    { description: '+3 morale at embark.',
      passive: { type: 'heal-between-nodes', amount: 300 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
  ],
};

export const ADVISOR_ZEALOT: Advisor = {
  id: 'advisor_zealot', name: 'Zealot Marcus', color: 'gold', currentTier: 1, xp: 0,
  ...advisorMeta(['Zealot', 'Strategist']),
  tiers: [
    { description: '+250 soldiers at embark.',
      passive: { type: 'soldiers-bonus', amount: 250 },
      spokeTemplate: { durationRange: [1, 2], posture: 'attacking' } },
    { description: '+450 soldiers at embark.',
      passive: { type: 'soldiers-bonus', amount: 450 },
      spokeTemplate: { durationRange: [1, 2], posture: 'attacking' } },
    { description: '+700 soldiers at embark.',
      passive: { type: 'soldiers-bonus', amount: 700 },
      spokeTemplate: { durationRange: [1, 3], posture: 'attacking' } },
  ],
};

// ── Purple (Economic) — trade, gold, shop discounts ──

export const ADVISOR_MERCHANT: Advisor = {
  id: 'advisor_merchant', name: 'Merchant Decimus', color: 'purple', currentTier: 1, xp: 0,
  ...advisorMeta(['Coin-Keeper', 'Financier'], 1, 'char_marcus_crassus.png'),
  tiers: [
    { description: '+2 gold at embark.',
      passive: { type: 'resource-per-spoke', resource: 'gold', amount: 2 },
      spokeTemplate: { durationRange: [2, 3], posture: 'defending' } },
    { description: '+3 gold at embark.',
      passive: { type: 'resource-per-spoke', resource: 'gold', amount: 3 },
      spokeTemplate: { durationRange: [2, 3], posture: 'defending' } },
    { description: '+5 gold at embark.',
      passive: { type: 'resource-per-spoke', resource: 'gold', amount: 5 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
  ],
};

export const ADVISOR_QUARTERMASTER: Advisor = {
  id: 'advisor_quartermaster', name: 'Quartermaster Livia', color: 'purple', currentTier: 1, xp: 0,
  ...advisorMeta(['Logistician', 'Administrator']),
  tiers: [
    { description: '+supplies at embark (10% of campaign upkeep).',
      passive: { type: 'upkeep-reduction', percent: 10 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
    { description: '+supplies at embark (20% of campaign upkeep).',
      passive: { type: 'upkeep-reduction', percent: 20 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
    { description: '+supplies at embark (30% of campaign upkeep).',
      passive: { type: 'upkeep-reduction', percent: 30 },
      spokeTemplate: { durationRange: [3, 4], posture: 'defending' } },
  ],
};

export const ADVISOR_SMUGGLER: Advisor = {
  id: 'advisor_smuggler', name: 'Smuggler Gaius', color: 'purple', currentTier: 1, xp: 0,
  ...advisorMeta(['Schemer', 'Coin-Keeper']),
  tiers: [
    { description: '10% shop discount.',
      passive: { type: 'shop-discount', percent: 10 },
      spokeTemplate: { durationRange: [1, 2], posture: 'attacking' } },
    { description: '18% shop discount.',
      passive: { type: 'shop-discount', percent: 18 },
      spokeTemplate: { durationRange: [1, 2], posture: 'attacking' } },
    { description: '25% shop discount.',
      passive: { type: 'shop-discount', percent: 25 },
      spokeTemplate: { durationRange: [1, 3], posture: 'attacking' } },
  ],
};

// ── White (Populist) — balanced, rest-heavy, population bonuses ──

export const ADVISOR_TRIBUNE: Advisor = {
  id: 'advisor_tribune', name: 'Tribune Publius', color: 'white', currentTier: 1, xp: 0,
  ...advisorMeta(['Tribune', 'Negotiator']),
  tiers: [
    { description: '+10% loot from all sources.',
      passive: { type: 'loot-bonus', percent: 10 },
      spokeTemplate: { durationRange: [2, 3], posture: 'defending' } },
    { description: '+18% loot from all sources.',
      passive: { type: 'loot-bonus', percent: 18 },
      spokeTemplate: { durationRange: [2, 3], posture: 'defending' } },
    { description: '+25% loot from all sources.',
      passive: { type: 'loot-bonus', percent: 25 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
  ],
};

export const ADVISOR_VETERAN: Advisor = {
  id: 'advisor_veteran', name: 'Veteran Flavia', color: 'white', currentTier: 1, xp: 0,
  ...advisorMeta(['Veteran', 'Healer']),
  tiers: [
    { description: '+1 morale at embark.',
      passive: { type: 'heal-between-nodes', amount: 50 },
      spokeTemplate: { durationRange: [1, 3], posture: 'defending' } },
    { description: '+1 morale at embark.',
      passive: { type: 'heal-between-nodes', amount: 100 },
      spokeTemplate: { durationRange: [1, 3], posture: 'defending' } },
    { description: '+2 morale at embark.',
      passive: { type: 'heal-between-nodes', amount: 150 },
      spokeTemplate: { durationRange: [2, 3], posture: 'defending' } },
  ],
};

export const ADVISOR_CONSUL: Advisor = {
  id: 'advisor_consul', name: 'Consul Servius', color: 'white', currentTier: 1, xp: 0,
  ...advisorMeta(['Administrator', 'Diplomat'], 1, 'char_caesar_augustus.png'),
  tiers: [
    { description: '−1 starting threat at embark.',
      passive: { type: 'threat-reduction', amount: 1 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
    { description: '−2 starting threat at embark.',
      passive: { type: 'threat-reduction', amount: 2 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
    { description: '−3 starting threat at embark.',
      passive: { type: 'threat-reduction', amount: 3 },
      spokeTemplate: { durationRange: [3, 4], posture: 'defending' } },
  ],
};

// ── All starter advisors ──

export const STARTER_ADVISORS: Advisor[] = [
  // Red
  ADVISOR_CENTURION, ADVISOR_SIEGE_MASTER, ADVISOR_RAIDER,
  // Blue
  ADVISOR_DIPLOMAT, ADVISOR_SCHOLAR, ADVISOR_SPYMASTER,
  // Gold
  ADVISOR_PONTIFEX, ADVISOR_HEALER, ADVISOR_ZEALOT,
  // Purple
  ADVISOR_MERCHANT, ADVISOR_QUARTERMASTER, ADVISOR_SMUGGLER,
  // White
  ADVISOR_TRIBUNE, ADVISOR_VETERAN, ADVISOR_CONSUL,
];
