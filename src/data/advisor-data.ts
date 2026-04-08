import type { Advisor } from '../game/council/advisor';

// ── Red (Military) — battle-heavy, short spokes, attacking ──

export const ADVISOR_CENTURION: Advisor = {
  id: 'advisor_centurion', name: 'Centurion Varro', color: 'red', currentTier: 1, xp: 0,
  tiers: [
    { description: '+10% loot from battles.',
      passive: { type: 'loot-bonus', percent: 10 },
      spokeTemplate: { nodeWeights: { battle: 5, rest: 1, event: 2, boss: 1 }, durationRange: [1, 2], posture: 'attacking' } },
    { description: '+18% loot from battles.',
      passive: { type: 'loot-bonus', percent: 18 },
      spokeTemplate: { nodeWeights: { battle: 6, rest: 1, event: 2, boss: 1 }, durationRange: [1, 2], posture: 'attacking' } },
    { description: '+25% loot from battles.',
      passive: { type: 'loot-bonus', percent: 25 },
      spokeTemplate: { nodeWeights: { battle: 7, rest: 2, event: 2, boss: 1 }, durationRange: [1, 3], posture: 'attacking' } },
  ],
};

export const ADVISOR_SIEGE_MASTER: Advisor = {
  id: 'advisor_siege_master', name: 'Siege Master Titus', color: 'red', currentTier: 1, xp: 0,
  tiers: [
    { description: '+1 Momentum per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'momentum', amount: 1 },
      spokeTemplate: { nodeWeights: { battle: 4, rest: 1, event: 1, boss: 2 }, durationRange: [1, 3], posture: 'attacking' } },
    { description: '+2 Momentum per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'momentum', amount: 2 },
      spokeTemplate: { nodeWeights: { battle: 5, rest: 1, event: 1, boss: 2 }, durationRange: [2, 3], posture: 'attacking' } },
    { description: '+3 Momentum per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'momentum', amount: 3 },
      spokeTemplate: { nodeWeights: { battle: 6, rest: 2, event: 1, boss: 2 }, durationRange: [2, 4], posture: 'attacking' } },
  ],
};

export const ADVISOR_RAIDER: Advisor = {
  id: 'advisor_raider', name: 'Raider Brennus', color: 'red', currentTier: 1, xp: 0,
  tiers: [
    { description: '+15% loot from battles.',
      passive: { type: 'loot-bonus', percent: 15 },
      spokeTemplate: { nodeWeights: { battle: 6, rest: 0, event: 1, boss: 1 }, durationRange: [1, 1], posture: 'attacking' } },
    { description: '+22% loot from battles.',
      passive: { type: 'loot-bonus', percent: 22 },
      spokeTemplate: { nodeWeights: { battle: 7, rest: 1, event: 1, boss: 1 }, durationRange: [1, 1], posture: 'attacking' } },
    { description: '+30% loot from battles.',
      passive: { type: 'loot-bonus', percent: 30 },
      spokeTemplate: { nodeWeights: { battle: 8, rest: 1, event: 1, boss: 2 }, durationRange: [1, 2], posture: 'attacking' } },
  ],
};

// ── Blue (Diplomatic) — event-heavy, longer spokes, defending ──

export const ADVISOR_DIPLOMAT: Advisor = {
  id: 'advisor_diplomat', name: 'Legate Aemilia', color: 'blue', currentTier: 1, xp: 0,
  tiers: [
    { description: '+1 extra event choice.',
      passive: { type: 'extra-event-choices', count: 1 },
      spokeTemplate: { nodeWeights: { battle: 2, rest: 2, event: 5, boss: 1 }, durationRange: [2, 4], posture: 'defending' } },
    { description: '+2 extra event choices.',
      passive: { type: 'extra-event-choices', count: 2 },
      spokeTemplate: { nodeWeights: { battle: 2, rest: 2, event: 6, boss: 1 }, durationRange: [2, 4], posture: 'defending' } },
    { description: '+3 extra event choices.',
      passive: { type: 'extra-event-choices', count: 3 },
      spokeTemplate: { nodeWeights: { battle: 2, rest: 3, event: 7, boss: 1 }, durationRange: [3, 4], posture: 'defending' } },
  ],
};

export const ADVISOR_SCHOLAR: Advisor = {
  id: 'advisor_scholar', name: 'Scholar Ptolemy', color: 'blue', currentTier: 1, xp: 0,
  tiers: [
    { description: '+1 Influence per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'influence', amount: 1 },
      spokeTemplate: { nodeWeights: { battle: 2, rest: 3, event: 4, boss: 1 }, durationRange: [2, 3], posture: 'defending' } },
    { description: '+2 Influence per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'influence', amount: 2 },
      spokeTemplate: { nodeWeights: { battle: 2, rest: 3, event: 5, boss: 1 }, durationRange: [2, 3], posture: 'defending' } },
    { description: '+3 Influence per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'influence', amount: 3 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 3, event: 5, boss: 1 }, durationRange: [2, 4], posture: 'defending' } },
  ],
};

export const ADVISOR_SPYMASTER: Advisor = {
  id: 'advisor_spymaster', name: 'Spymaster Cassia', color: 'blue', currentTier: 1, xp: 0,
  tiers: [
    { description: 'Threat reduced by 1 per spoke.',
      passive: { type: 'threat-reduction', amount: 1 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 2, event: 3, boss: 1 }, durationRange: [1, 3], posture: 'defending' } },
    { description: 'Threat reduced by 2 per spoke.',
      passive: { type: 'threat-reduction', amount: 2 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 2, event: 4, boss: 1 }, durationRange: [1, 3], posture: 'defending' } },
    { description: 'Threat reduced by 3 per spoke.',
      passive: { type: 'threat-reduction', amount: 3 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 3, event: 4, boss: 1 }, durationRange: [2, 3], posture: 'defending' } },
  ],
};

// ── Gold (Religious) — faith, healing, holy events ──

export const ADVISOR_PONTIFEX: Advisor = {
  id: 'advisor_pontifex', name: 'Pontifex Lucius', color: 'gold', currentTier: 1, xp: 0,
  tiers: [
    { description: '+1 Faith per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'faith', amount: 1 },
      spokeTemplate: { nodeWeights: { battle: 2, rest: 2, event: 4, boss: 1 }, durationRange: [2, 4], posture: 'defending' } },
    { description: '+2 Faith per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'faith', amount: 2 },
      spokeTemplate: { nodeWeights: { battle: 2, rest: 3, event: 5, boss: 1 }, durationRange: [2, 4], posture: 'defending' } },
    { description: '+3 Faith per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'faith', amount: 3 },
      spokeTemplate: { nodeWeights: { battle: 2, rest: 3, event: 6, boss: 1 }, durationRange: [3, 4], posture: 'defending' } },
  ],
};

export const ADVISOR_HEALER: Advisor = {
  id: 'advisor_healer', name: 'Healer Cornelia', color: 'gold', currentTier: 1, xp: 0,
  tiers: [
    { description: 'Heal 100 HP between nodes.',
      passive: { type: 'heal-between-nodes', amount: 100 },
      spokeTemplate: { nodeWeights: { battle: 2, rest: 4, event: 3, boss: 1 }, durationRange: [2, 3], posture: 'defending' } },
    { description: 'Heal 200 HP between nodes.',
      passive: { type: 'heal-between-nodes', amount: 200 },
      spokeTemplate: { nodeWeights: { battle: 2, rest: 5, event: 3, boss: 1 }, durationRange: [2, 3], posture: 'defending' } },
    { description: 'Heal 300 HP between nodes.',
      passive: { type: 'heal-between-nodes', amount: 300 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 5, event: 3, boss: 1 }, durationRange: [2, 4], posture: 'defending' } },
  ],
};

export const ADVISOR_ZEALOT: Advisor = {
  id: 'advisor_zealot', name: 'Zealot Marcus', color: 'gold', currentTier: 1, xp: 0,
  tiers: [
    { description: '+2 Faith per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'faith', amount: 2 },
      spokeTemplate: { nodeWeights: { battle: 4, rest: 1, event: 3, boss: 1 }, durationRange: [1, 2], posture: 'attacking' } },
    { description: '+3 Faith per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'faith', amount: 3 },
      spokeTemplate: { nodeWeights: { battle: 5, rest: 1, event: 3, boss: 1 }, durationRange: [1, 2], posture: 'attacking' } },
    { description: '+4 Faith per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'faith', amount: 4 },
      spokeTemplate: { nodeWeights: { battle: 5, rest: 2, event: 3, boss: 2 }, durationRange: [1, 3], posture: 'attacking' } },
  ],
};

// ── Purple (Economic) — trade, gold, shop discounts ──

export const ADVISOR_MERCHANT: Advisor = {
  id: 'advisor_merchant', name: 'Merchant Decimus', color: 'purple', currentTier: 1, xp: 0,
  tiers: [
    { description: '+2 Gold per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'gold', amount: 2 },
      spokeTemplate: { nodeWeights: { battle: 2, rest: 2, event: 4, boss: 1 }, durationRange: [2, 3], posture: 'defending' } },
    { description: '+3 Gold per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'gold', amount: 3 },
      spokeTemplate: { nodeWeights: { battle: 2, rest: 2, event: 5, boss: 1 }, durationRange: [2, 3], posture: 'defending' } },
    { description: '+5 Gold per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'gold', amount: 5 },
      spokeTemplate: { nodeWeights: { battle: 2, rest: 3, event: 5, boss: 1 }, durationRange: [2, 4], posture: 'defending' } },
  ],
};

export const ADVISOR_QUARTERMASTER: Advisor = {
  id: 'advisor_quartermaster', name: 'Quartermaster Livia', color: 'purple', currentTier: 1, xp: 0,
  tiers: [
    { description: 'Upkeep reduced by 10%.',
      passive: { type: 'upkeep-reduction', percent: 10 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 3, event: 3, boss: 1 }, durationRange: [2, 4], posture: 'defending' } },
    { description: 'Upkeep reduced by 20%.',
      passive: { type: 'upkeep-reduction', percent: 20 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 3, event: 4, boss: 1 }, durationRange: [2, 4], posture: 'defending' } },
    { description: 'Upkeep reduced by 30%.',
      passive: { type: 'upkeep-reduction', percent: 30 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 4, event: 4, boss: 1 }, durationRange: [3, 4], posture: 'defending' } },
  ],
};

export const ADVISOR_SMUGGLER: Advisor = {
  id: 'advisor_smuggler', name: 'Smuggler Gaius', color: 'purple', currentTier: 1, xp: 0,
  tiers: [
    { description: '10% shop discount.',
      passive: { type: 'shop-discount', percent: 10 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 1, event: 4, boss: 1 }, durationRange: [1, 2], posture: 'attacking' } },
    { description: '18% shop discount.',
      passive: { type: 'shop-discount', percent: 18 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 2, event: 4, boss: 1 }, durationRange: [1, 2], posture: 'attacking' } },
    { description: '25% shop discount.',
      passive: { type: 'shop-discount', percent: 25 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 2, event: 5, boss: 1 }, durationRange: [1, 3], posture: 'attacking' } },
  ],
};

// ── White (Populist) — balanced, rest-heavy, population bonuses ──

export const ADVISOR_TRIBUNE: Advisor = {
  id: 'advisor_tribune', name: 'Tribune Publius', color: 'white', currentTier: 1, xp: 0,
  tiers: [
    { description: '+10% loot from all sources.',
      passive: { type: 'loot-bonus', percent: 10 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 3, event: 3, boss: 1 }, durationRange: [2, 3], posture: 'defending' } },
    { description: '+18% loot from all sources.',
      passive: { type: 'loot-bonus', percent: 18 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 3, event: 4, boss: 1 }, durationRange: [2, 3], posture: 'defending' } },
    { description: '+25% loot from all sources.',
      passive: { type: 'loot-bonus', percent: 25 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 4, event: 4, boss: 1 }, durationRange: [2, 4], posture: 'defending' } },
  ],
};

export const ADVISOR_VETERAN: Advisor = {
  id: 'advisor_veteran', name: 'Veteran Flavia', color: 'white', currentTier: 1, xp: 0,
  tiers: [
    { description: 'Heal 50 HP between nodes.',
      passive: { type: 'heal-between-nodes', amount: 50 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 4, event: 2, boss: 1 }, durationRange: [1, 3], posture: 'defending' } },
    { description: 'Heal 100 HP between nodes.',
      passive: { type: 'heal-between-nodes', amount: 100 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 4, event: 3, boss: 1 }, durationRange: [1, 3], posture: 'defending' } },
    { description: 'Heal 150 HP between nodes.',
      passive: { type: 'heal-between-nodes', amount: 150 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 5, event: 3, boss: 1 }, durationRange: [2, 3], posture: 'defending' } },
  ],
};

export const ADVISOR_CONSUL: Advisor = {
  id: 'advisor_consul', name: 'Consul Servius', color: 'white', currentTier: 1, xp: 0,
  tiers: [
    { description: '+1 Influence per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'influence', amount: 1 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 3, event: 3, boss: 1 }, durationRange: [2, 4], posture: 'defending' } },
    { description: '+2 Influence per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'influence', amount: 2 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 3, event: 4, boss: 1 }, durationRange: [2, 4], posture: 'defending' } },
    { description: '+3 Influence per spoke.',
      passive: { type: 'resource-per-spoke', resource: 'influence', amount: 3 },
      spokeTemplate: { nodeWeights: { battle: 3, rest: 4, event: 4, boss: 1 }, durationRange: [3, 4], posture: 'defending' } },
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
