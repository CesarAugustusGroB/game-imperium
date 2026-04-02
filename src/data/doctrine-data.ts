import type { Doctrine } from '../game/doctrine';

// ── Red (Military) — 3 Doctrines ──

export const DOCTRINE_SWORD: Doctrine = {
  id: 'doctrine_sword', name: 'Doctrine of the Sword', color: 'red', currentLevel: 1,
  levels: [
    { description: '+5% damage for all units.',     effects: [{ type: 'stat-modifier', stat: 'damage', multiplier: 0.05 }], upgradeCost: { momentum: 3 } },
    { description: '+10% damage for all units.',    effects: [{ type: 'stat-modifier', stat: 'damage', multiplier: 0.10 }], upgradeCost: { momentum: 6 } },
    { description: '+15% damage for all units.',    effects: [{ type: 'stat-modifier', stat: 'damage', multiplier: 0.15 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_IRON: Doctrine = {
  id: 'doctrine_iron', name: 'Doctrine of Iron', color: 'red', currentLevel: 1,
  levels: [
    { description: '+10% armor for all units.',     effects: [{ type: 'stat-modifier', stat: 'armor', multiplier: 0.10 }], upgradeCost: { momentum: 4 } },
    { description: '+20% armor for all units.',     effects: [{ type: 'stat-modifier', stat: 'armor', multiplier: 0.20 }], upgradeCost: { momentum: 8 } },
    { description: '+30% armor for all units.',     effects: [{ type: 'stat-modifier', stat: 'armor', multiplier: 0.30 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_BLOOD: Doctrine = {
  id: 'doctrine_blood', name: 'Doctrine of Blood', color: 'red', currentLevel: 1,
  levels: [
    { description: 'Heal 50 HP per kill.',          effects: [{ type: 'heal-on-kill', amount: 50 }], upgradeCost: { momentum: 2, gold: 2 } },
    { description: 'Heal 100 HP per kill.',         effects: [{ type: 'heal-on-kill', amount: 100 }], upgradeCost: { momentum: 5, gold: 3 } },
    { description: 'Heal 200 HP per kill + 5% damage.', effects: [{ type: 'heal-on-kill', amount: 200 }, { type: 'stat-modifier', stat: 'damage', multiplier: 0.05 }], upgradeCost: {} },
  ],
};

// ── Blue (Diplomatic) — 3 Doctrines ──

export const DOCTRINE_DIPLOMACY: Doctrine = {
  id: 'doctrine_diplomacy', name: 'Doctrine of Diplomacy', color: 'blue', currentLevel: 1,
  levels: [
    { description: '+1 Influence per spoke.',       effects: [{ type: 'resource-per-spoke', resource: 'influence', amount: 1 }], upgradeCost: { influence: 3 } },
    { description: '+2 Influence per spoke.',       effects: [{ type: 'resource-per-spoke', resource: 'influence', amount: 2 }], upgradeCost: { influence: 6 } },
    { description: '+3 Influence per spoke.',       effects: [{ type: 'resource-per-spoke', resource: 'influence', amount: 3 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_COURT: Doctrine = {
  id: 'doctrine_court', name: 'Doctrine of the Court', color: 'blue', currentLevel: 1,
  levels: [
    { description: 'Events offer 1 extra choice.',  effects: [{ type: 'extra-event-choices', count: 1 }], upgradeCost: { influence: 4 } },
    { description: 'Events offer 2 extra choices.', effects: [{ type: 'extra-event-choices', count: 2 }], upgradeCost: { influence: 8 } },
    { description: 'Events offer 3 extra choices.', effects: [{ type: 'extra-event-choices', count: 3 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_ALLIANCES: Doctrine = {
  id: 'doctrine_alliances', name: 'Doctrine of Alliances', color: 'blue', currentLevel: 1,
  levels: [
    { description: '+1 allied unit in battle.',      effects: [{ type: 'ally-units', count: 1 }], upgradeCost: { influence: 3, gold: 2 } },
    { description: '+2 allied units in battle.',     effects: [{ type: 'ally-units', count: 2 }], upgradeCost: { influence: 6, gold: 4 } },
    { description: '+3 allied units in battle.',     effects: [{ type: 'ally-units', count: 3 }], upgradeCost: {} },
  ],
};

// ── Gold (Religious) — 3 Doctrines ──

export const DOCTRINE_FAITH: Doctrine = {
  id: 'doctrine_faith', name: 'Doctrine of Faith', color: 'gold', currentLevel: 1,
  levels: [
    { description: '+1 Faith per spoke.',            effects: [{ type: 'resource-per-spoke', resource: 'faith', amount: 1 }], upgradeCost: { faith: 3 } },
    { description: '+2 Faith per spoke.',            effects: [{ type: 'resource-per-spoke', resource: 'faith', amount: 2 }], upgradeCost: { faith: 6 } },
    { description: '+3 Faith per spoke.',            effects: [{ type: 'resource-per-spoke', resource: 'faith', amount: 3 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_MIRACLES: Doctrine = {
  id: 'doctrine_miracles', name: 'Doctrine of Miracles', color: 'gold', currentLevel: 1,
  levels: [
    { description: 'Heal all units 200 HP at battle start.', effects: [{ type: 'heal-battle-start', amount: 200 }], upgradeCost: { faith: 4 } },
    { description: 'Heal all units 400 HP at battle start.', effects: [{ type: 'heal-battle-start', amount: 400 }], upgradeCost: { faith: 8 } },
    { description: 'Heal all units to full at battle start.', effects: [{ type: 'heal-battle-start', amount: 'full' }], upgradeCost: {} },
  ],
};

export const DOCTRINE_PANTHEON: Doctrine = {
  id: 'doctrine_pantheon', name: 'Doctrine of the Pantheon', color: 'gold', currentLevel: 1,
  levels: [
    { description: 'Units revive once at 10% HP.',  effects: [{ type: 'revive', hpPercent: 10 }], upgradeCost: { faith: 3, gold: 3 } },
    { description: 'Units revive once at 20% HP.',  effects: [{ type: 'revive', hpPercent: 20 }], upgradeCost: { faith: 7, gold: 5 } },
    { description: 'Units revive once at 30% HP.',  effects: [{ type: 'revive', hpPercent: 30 }], upgradeCost: {} },
  ],
};

// ── Purple (Economic) — 3 Doctrines ──

export const DOCTRINE_TRADE: Doctrine = {
  id: 'doctrine_trade', name: 'Doctrine of Trade', color: 'purple', currentLevel: 1,
  levels: [
    { description: '+15% gold income from all sources.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.15 }], upgradeCost: { gold: 5 } },
    { description: '+30% gold income from all sources.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.30 }], upgradeCost: { gold: 10 } },
    { description: '+50% gold income from all sources.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.50 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_INFRASTRUCTURE: Doctrine = {
  id: 'doctrine_infrastructure', name: 'Doctrine of Infrastructure', color: 'purple', currentLevel: 1,
  levels: [
    { description: 'Province upkeep reduced by 10%.', effects: [{ type: 'upkeep-reduction', percent: 10 }], upgradeCost: { gold: 4 } },
    { description: 'Province upkeep reduced by 20%.', effects: [{ type: 'upkeep-reduction', percent: 20 }], upgradeCost: { gold: 8 } },
    { description: 'Province upkeep reduced by 30%.', effects: [{ type: 'upkeep-reduction', percent: 30 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_MARKET: Doctrine = {
  id: 'doctrine_market', name: 'Doctrine of the Market', color: 'purple', currentLevel: 1,
  levels: [
    { description: 'Shop prices reduced by 10%.',    effects: [{ type: 'shop-discount', percent: 10 }], upgradeCost: { gold: 3 } },
    { description: 'Shop prices reduced by 20%.',    effects: [{ type: 'shop-discount', percent: 20 }], upgradeCost: { gold: 7 } },
    { description: 'Shop prices reduced by 30%.',    effects: [{ type: 'shop-discount', percent: 30 }], upgradeCost: {} },
  ],
};

// ── White (Populist) — 3 Doctrines ──

export const DOCTRINE_PEOPLE: Doctrine = {
  id: 'doctrine_people', name: 'Doctrine of the People', color: 'white', currentLevel: 1,
  levels: [
    { description: '+10% max HP for all units.',     effects: [{ type: 'stat-modifier', stat: 'maxHp', multiplier: 0.10 }], upgradeCost: { gold: 3 } },
    { description: '+20% max HP for all units.',     effects: [{ type: 'stat-modifier', stat: 'maxHp', multiplier: 0.20 }], upgradeCost: { gold: 6 } },
    { description: '+30% max HP for all units.',     effects: [{ type: 'stat-modifier', stat: 'maxHp', multiplier: 0.30 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_MILITIA: Doctrine = {
  id: 'doctrine_militia', name: 'Doctrine of the Militia', color: 'white', currentLevel: 1,
  levels: [
    { description: '1 free militia guard per battle.', effects: [{ type: 'free-units', unitRole: 'guard', count: 1 }], upgradeCost: { gold: 4 } },
    { description: '2 free militia guards per battle.', effects: [{ type: 'free-units', unitRole: 'guard', count: 2 }], upgradeCost: { gold: 8 } },
    { description: '3 free militia guards per battle.', effects: [{ type: 'free-units', unitRole: 'guard', count: 3 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_RESILIENCE: Doctrine = {
  id: 'doctrine_resilience', name: 'Doctrine of Resilience', color: 'white', currentLevel: 1,
  levels: [
    { description: '+5% max HP + heal 100 HP at battle start.',  effects: [{ type: 'stat-modifier', stat: 'maxHp', multiplier: 0.05 }, { type: 'heal-battle-start', amount: 100 }], upgradeCost: { gold: 3, momentum: 2 } },
    { description: '+10% max HP + heal 200 HP at battle start.', effects: [{ type: 'stat-modifier', stat: 'maxHp', multiplier: 0.10 }, { type: 'heal-battle-start', amount: 200 }], upgradeCost: { gold: 6, momentum: 4 } },
    { description: '+15% max HP + heal 400 HP at battle start.', effects: [{ type: 'stat-modifier', stat: 'maxHp', multiplier: 0.15 }, { type: 'heal-battle-start', amount: 400 }], upgradeCost: {} },
  ],
};

// ── Red (Military) — additional doctrines ──

export const DOCTRINE_LEX_MILITARIS: Doctrine = {
  id: 'doctrine_lex_militaris', name: 'Lex Militaris', color: 'red', currentLevel: 1,
  levels: [
    { description: '1 free vanguard unit per battle.',  effects: [{ type: 'free-units', unitRole: 'vanguard', count: 1 }], upgradeCost: { momentum: 3 } },
    { description: '2 free vanguard units per battle.', effects: [{ type: 'free-units', unitRole: 'vanguard', count: 2 }], upgradeCost: { momentum: 6 } },
    { description: '3 free vanguard units per battle.', effects: [{ type: 'free-units', unitRole: 'vanguard', count: 3 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_VIS_BELLICA: Doctrine = {
  id: 'doctrine_vis_bellica', name: 'Vis Bellica', color: 'red', currentLevel: 1,
  levels: [
    { description: '+5% armor + heal 50 HP per kill.',         effects: [{ type: 'stat-modifier', stat: 'armor', multiplier: 0.05 }, { type: 'heal-on-kill', amount: 50 }], upgradeCost: { momentum: 4, gold: 2 } },
    { description: '+10% armor + heal 100 HP per kill.',       effects: [{ type: 'stat-modifier', stat: 'armor', multiplier: 0.10 }, { type: 'heal-on-kill', amount: 100 }], upgradeCost: { momentum: 7, gold: 4 } },
    { description: '+15% armor + heal 150 HP per kill + 5% damage.', effects: [{ type: 'stat-modifier', stat: 'armor', multiplier: 0.15 }, { type: 'heal-on-kill', amount: 150 }, { type: 'stat-modifier', stat: 'damage', multiplier: 0.05 }], upgradeCost: {} },
  ],
};

// ── Blue (Diplomatic) — additional doctrines ──

export const DOCTRINE_PAX_ROMANA: Doctrine = {
  id: 'doctrine_pax_romana', name: 'Pax Romana', color: 'blue', currentLevel: 1,
  levels: [
    { description: '+1 Influence per spoke + shop prices reduced by 5%.', effects: [{ type: 'resource-per-spoke', resource: 'influence', amount: 1 }, { type: 'shop-discount', percent: 5 }], upgradeCost: { influence: 4 } },
    { description: '+2 Influence per spoke + shop prices reduced by 10%.', effects: [{ type: 'resource-per-spoke', resource: 'influence', amount: 2 }, { type: 'shop-discount', percent: 10 }], upgradeCost: { influence: 8 } },
    { description: '+3 Influence per spoke + shop prices reduced by 15%.', effects: [{ type: 'resource-per-spoke', resource: 'influence', amount: 3 }, { type: 'shop-discount', percent: 15 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_FOEDUS_AETERNUM: Doctrine = {
  id: 'doctrine_foedus_aeternum', name: 'Foedus Aeternum', color: 'blue', currentLevel: 1,
  levels: [
    { description: '+1 allied unit + +15% gold income.',  effects: [{ type: 'ally-units', count: 1 }, { type: 'income-modifier', resource: 'gold', multiplier: 0.15 }], upgradeCost: { influence: 5, gold: 3 } },
    { description: '+2 allied units + +25% gold income.', effects: [{ type: 'ally-units', count: 2 }, { type: 'income-modifier', resource: 'gold', multiplier: 0.25 }], upgradeCost: { influence: 9, gold: 5 } },
    { description: '+3 allied units + +40% gold income.', effects: [{ type: 'ally-units', count: 3 }, { type: 'income-modifier', resource: 'gold', multiplier: 0.40 }], upgradeCost: {} },
  ],
};

// ── Gold (Religious) — additional doctrines ──

export const DOCTRINE_DIVINA_PROVIDENTIA: Doctrine = {
  id: 'doctrine_divina_providentia', name: 'Divina Providentia', color: 'gold', currentLevel: 1,
  levels: [
    { description: '+1 Faith per spoke + units revive once at 10% HP.',  effects: [{ type: 'resource-per-spoke', resource: 'faith', amount: 1 }, { type: 'revive', hpPercent: 10 }], upgradeCost: { faith: 5 } },
    { description: '+2 Faith per spoke + units revive once at 20% HP.',  effects: [{ type: 'resource-per-spoke', resource: 'faith', amount: 2 }, { type: 'revive', hpPercent: 20 }], upgradeCost: { faith: 9 } },
    { description: '+3 Faith per spoke + units revive once at 30% HP.',  effects: [{ type: 'resource-per-spoke', resource: 'faith', amount: 3 }, { type: 'revive', hpPercent: 30 }], upgradeCost: {} },
  ],
};

// ── Purple (Economic) — additional doctrines ──

export const DOCTRINE_ANNONA: Doctrine = {
  id: 'doctrine_annona', name: 'Annona', color: 'purple', currentLevel: 1,
  levels: [
    { description: '+15% gold income + upkeep reduced by 10%.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.15 }, { type: 'upkeep-reduction', percent: 10 }], upgradeCost: { gold: 6 } },
    { description: '+30% gold income + upkeep reduced by 20%.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.30 }, { type: 'upkeep-reduction', percent: 20 }], upgradeCost: { gold: 11 } },
    { description: '+50% gold income + upkeep reduced by 30%.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.50 }, { type: 'upkeep-reduction', percent: 30 }], upgradeCost: {} },
  ],
};

// ── White (Populist) — additional doctrines ──

export const DOCTRINE_VIRTUS_POPULI: Doctrine = {
  id: 'doctrine_virtus_populi', name: 'Virtus Populi', color: 'white', currentLevel: 1,
  levels: [
    { description: '+10% max HP + 1 free reserve per battle.',  effects: [{ type: 'stat-modifier', stat: 'maxHp', multiplier: 0.10 }, { type: 'free-units', unitRole: 'reserve', count: 1 }], upgradeCost: { gold: 4 } },
    { description: '+20% max HP + 2 free reserves per battle.', effects: [{ type: 'stat-modifier', stat: 'maxHp', multiplier: 0.20 }, { type: 'free-units', unitRole: 'reserve', count: 2 }], upgradeCost: { gold: 8 } },
    { description: '+30% max HP + 3 free reserves per battle.', effects: [{ type: 'stat-modifier', stat: 'maxHp', multiplier: 0.30 }, { type: 'free-units', unitRole: 'reserve', count: 3 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_CONCORDIA: Doctrine = {
  id: 'doctrine_concordia', name: 'Concordia', color: 'white', currentLevel: 1,
  levels: [
    { description: 'Heal 300 HP at battle start + 1 event choice.',   effects: [{ type: 'heal-battle-start', amount: 300 }, { type: 'extra-event-choices', count: 1 }], upgradeCost: { gold: 4, momentum: 2 } },
    { description: 'Heal 500 HP at battle start + 2 event choices.',  effects: [{ type: 'heal-battle-start', amount: 500 }, { type: 'extra-event-choices', count: 2 }], upgradeCost: { gold: 7, momentum: 4 } },
    { description: 'Full heal at battle start + 3 event choices.',    effects: [{ type: 'heal-battle-start', amount: 'full' }, { type: 'extra-event-choices', count: 3 }], upgradeCost: {} },
  ],
};

// ── All starter Doctrines ──

export const STARTER_DOCTRINES: Doctrine[] = [
  // Red
  DOCTRINE_SWORD, DOCTRINE_IRON, DOCTRINE_BLOOD,
  DOCTRINE_LEX_MILITARIS, DOCTRINE_VIS_BELLICA,
  // Blue
  DOCTRINE_DIPLOMACY, DOCTRINE_COURT, DOCTRINE_ALLIANCES,
  DOCTRINE_PAX_ROMANA, DOCTRINE_FOEDUS_AETERNUM,
  // Gold
  DOCTRINE_FAITH, DOCTRINE_MIRACLES, DOCTRINE_PANTHEON,
  DOCTRINE_DIVINA_PROVIDENTIA,
  // Purple
  DOCTRINE_TRADE, DOCTRINE_INFRASTRUCTURE, DOCTRINE_MARKET,
  DOCTRINE_ANNONA,
  // White
  DOCTRINE_PEOPLE, DOCTRINE_MILITIA, DOCTRINE_RESILIENCE,
  DOCTRINE_VIRTUS_POPULI, DOCTRINE_CONCORDIA,
];
