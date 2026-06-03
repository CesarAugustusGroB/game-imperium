import type { Doctrine } from '../game/items/doctrine';

// ── Red (Military) — 3 Doctrines ──

export const DOCTRINE_SWORD: Doctrine = {
  id: 'doctrine_sword', name: 'Doctrine of the Sword', color: 'red', currentLevel: 1,
  levels: [
    { description: '+200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 200 }], upgradeCost: { iuniores: 3 } },
    { description: '+400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { iuniores: 6 } },
    { description: '+600 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 600 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_IRON: Doctrine = {
  id: 'doctrine_iron', name: 'Doctrine of Iron', color: 'red', currentLevel: 1,
  levels: [
    { description: '+400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { iuniores: 4 } },
    { description: '+800 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { iuniores: 8 } },
    { description: '+1200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_BLOOD: Doctrine = {
  id: 'doctrine_blood', name: 'Doctrine of Blood', color: 'red', currentLevel: 1,
  levels: [
    { description: '+1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { iuniores: 2, gold: 2 } },
    { description: '+2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { iuniores: 5, gold: 3 } },
    { description: '+3 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: {} },
  ],
};

// ── Blue (Diplomatic) — 3 Doctrines ──

export const DOCTRINE_DIPLOMACY: Doctrine = {
  id: 'doctrine_diplomacy', name: 'Doctrine of Diplomacy', color: 'blue', currentLevel: 1,
  levels: [
    { description: '+5 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 5 }], upgradeCost: { gold: 3 } },
    { description: '+10 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 10 }], upgradeCost: { gold: 6 } },
    { description: '+15 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 15 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_COURT: Doctrine = {
  id: 'doctrine_court', name: 'Doctrine of the Court', color: 'blue', currentLevel: 1,
  levels: [
    { description: '+5 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 5 }], upgradeCost: { gold: 4 } },
    { description: '+10 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 10 }], upgradeCost: { gold: 8 } },
    { description: '+15 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 15 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_ALLIANCES: Doctrine = {
  id: 'doctrine_alliances', name: 'Doctrine of Alliances', color: 'blue', currentLevel: 1,
  levels: [
    { description: '+400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { gold: 5 } },
    { description: '+800 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { gold: 10 } },
    { description: '+1200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }], upgradeCost: {} },
  ],
};

// ── Gold (Religious) — 3 Doctrines ──

export const DOCTRINE_FAITH: Doctrine = {
  id: 'doctrine_faith', name: 'Doctrine of Faith', color: 'gold', currentLevel: 1,
  levels: [
    { description: '+5 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 5 }], upgradeCost: { gold: 3 } },
    { description: '+10 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 10 }], upgradeCost: { gold: 6 } },
    { description: '+15 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 15 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_MIRACLES: Doctrine = {
  id: 'doctrine_miracles', name: 'Doctrine of Miracles', color: 'gold', currentLevel: 1,
  levels: [
    { description: '+1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { gold: 4 } },
    { description: '+2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { gold: 8 } },
    { description: '+3 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_PANTHEON: Doctrine = {
  id: 'doctrine_pantheon', name: 'Doctrine of the Pantheon', color: 'gold', currentLevel: 1,
  levels: [
    { description: '+1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { gold: 6 } },
    { description: '+2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { gold: 12 } },
    { description: '+3 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: {} },
  ],
};

// ── Purple (Economic) — 3 Doctrines ──

export const DOCTRINE_TRADE: Doctrine = {
  id: 'doctrine_trade', name: 'Doctrine of Trade', color: 'purple', currentLevel: 1,
  levels: [
    { description: '+15% gold income from all sources.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.15 }], upgradeCost: { gold: 4 } },
    { description: '+30% gold income from all sources.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.30 }], upgradeCost: { gold: 8 } },
    { description: '+50% gold income from all sources.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.50 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_INFRASTRUCTURE: Doctrine = {
  id: 'doctrine_infrastructure', name: 'Doctrine of Infrastructure', color: 'purple', currentLevel: 1,
  levels: [
    { description: 'Province upkeep reduced by 10%.', effects: [{ type: 'upkeep-reduction', percent: 10 }], upgradeCost: { gold: 3 } },
    { description: 'Province upkeep reduced by 20%.', effects: [{ type: 'upkeep-reduction', percent: 20 }], upgradeCost: { gold: 7 } },
    { description: 'Province upkeep reduced by 30%.', effects: [{ type: 'upkeep-reduction', percent: 30 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_MARKET: Doctrine = {
  id: 'doctrine_market', name: 'Doctrine of the Market', color: 'purple', currentLevel: 1,
  levels: [
    { description: 'Shop prices reduced by 10%.',    effects: [{ type: 'shop-discount', percent: 10 }], upgradeCost: { gold: 3 } },
    { description: 'Shop prices reduced by 20%.',    effects: [{ type: 'shop-discount', percent: 20 }], upgradeCost: { gold: 6 } },
    { description: 'Shop prices reduced by 30%.',    effects: [{ type: 'shop-discount', percent: 30 }], upgradeCost: {} },
  ],
};

// ── White (Populist) — 3 Doctrines ──

export const DOCTRINE_PEOPLE: Doctrine = {
  id: 'doctrine_people', name: 'Doctrine of the People', color: 'white', currentLevel: 1,
  levels: [
    { description: '+400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { gold: 3 } },
    { description: '+800 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { gold: 6 } },
    { description: '+1200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_MILITIA: Doctrine = {
  id: 'doctrine_militia', name: 'Doctrine of the Militia', color: 'white', currentLevel: 1,
  levels: [
    { description: '+400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { gold: 4 } },
    { description: '+800 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { gold: 8 } },
    { description: '+1200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_RESILIENCE: Doctrine = {
  id: 'doctrine_resilience', name: 'Doctrine of Resilience', color: 'white', currentLevel: 1,
  levels: [
    { description: '+200 soldiers + 1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 200 }, { type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { gold: 3, iuniores: 2 } },
    { description: '+400 soldiers + 2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }, { type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { gold: 6, iuniores: 4 } },
    { description: '+600 soldiers + 3 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 600 }, { type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: {} },
  ],
};

// ── Red (Military) — additional doctrines ──

export const DOCTRINE_LEX_MILITARIS: Doctrine = {
  id: 'doctrine_lex_militaris', name: 'Lex Militaris', color: 'red', currentLevel: 1,
  levels: [
    { description: '+400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { iuniores: 3 } },
    { description: '+800 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { iuniores: 6 } },
    { description: '+1200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_VIS_BELLICA: Doctrine = {
  id: 'doctrine_vis_bellica', name: 'Vis Bellica', color: 'red', currentLevel: 1,
  levels: [
    { description: '+200 soldiers + 1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 200 }, { type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { iuniores: 4, gold: 2 } },
    { description: '+400 soldiers + 1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }, { type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { iuniores: 7, gold: 4 } },
    { description: '+600 soldiers + 2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 600 }, { type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: {} },
  ],
};

// ── Blue (Diplomatic) — additional doctrines ──

export const DOCTRINE_PAX_ROMANA: Doctrine = {
  id: 'doctrine_pax_romana', name: 'Pax Romana', color: 'blue', currentLevel: 1,
  levels: [
    { description: '+5 gold at campaign start + shop prices reduced by 5%.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 5 }, { type: 'shop-discount', percent: 5 }], upgradeCost: { gold: 4 } },
    { description: '+10 gold at campaign start + shop prices reduced by 10%.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 10 }, { type: 'shop-discount', percent: 10 }], upgradeCost: { gold: 8 } },
    { description: '+15 gold at campaign start + shop prices reduced by 15%.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 15 }, { type: 'shop-discount', percent: 15 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_FOEDUS_AETERNUM: Doctrine = {
  id: 'doctrine_foedus_aeternum', name: 'Foedus Aeternum', color: 'blue', currentLevel: 1,
  levels: [
    { description: '+400 soldiers on campaign start + 15% gold income.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }, { type: 'income-modifier', resource: 'gold', multiplier: 0.15 }], upgradeCost: { gold: 8 } },
    { description: '+800 soldiers on campaign start + 25% gold income.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }, { type: 'income-modifier', resource: 'gold', multiplier: 0.25 }], upgradeCost: { gold: 14 } },
    { description: '+1200 soldiers on campaign start + 40% gold income.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }, { type: 'income-modifier', resource: 'gold', multiplier: 0.40 }], upgradeCost: {} },
  ],
};

// ── Gold (Religious) — additional doctrines ──

export const DOCTRINE_DIVINA_PROVIDENTIA: Doctrine = {
  id: 'doctrine_divina_providentia', name: 'Divina Providentia', color: 'gold', currentLevel: 1,
  levels: [
    { description: '+5 gold at campaign start + 1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 5 }, { type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { gold: 5 } },
    { description: '+10 gold at campaign start + 2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 10 }, { type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { gold: 9 } },
    { description: '+15 gold at campaign start + 3 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 15 }, { type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: {} },
  ],
};

// ── Purple (Economic) — additional doctrines ──

export const DOCTRINE_ANNONA: Doctrine = {
  id: 'doctrine_annona', name: 'Annona', color: 'purple', currentLevel: 1,
  levels: [
    { description: '+15% gold income + upkeep reduced by 10%.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.15 }, { type: 'upkeep-reduction', percent: 10 }], upgradeCost: { gold: 5 } },
    { description: '+30% gold income + upkeep reduced by 20%.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.30 }, { type: 'upkeep-reduction', percent: 20 }], upgradeCost: { gold: 9 } },
    { description: '+50% gold income + upkeep reduced by 30%.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.50 }, { type: 'upkeep-reduction', percent: 30 }], upgradeCost: {} },
  ],
};

// ── White (Populist) — additional doctrines ──

export const DOCTRINE_VIRTUS_POPULI: Doctrine = {
  id: 'doctrine_virtus_populi', name: 'Virtus Populi', color: 'white', currentLevel: 1,
  levels: [
    { description: '+800 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { gold: 4 } },
    { description: '+1600 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1600 }], upgradeCost: { gold: 8 } },
    { description: '+2400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 2400 }], upgradeCost: {} },
  ],
};

export const DOCTRINE_CONCORDIA: Doctrine = {
  id: 'doctrine_concordia', name: 'Concordia', color: 'white', currentLevel: 1,
  levels: [
    { description: '+1 morale on campaign start + 5 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 1 }, { type: 'embark-bonus', stat: 'gold', amount: 5 }], upgradeCost: { gold: 4, iuniores: 2 } },
    { description: '+2 morale on campaign start + 10 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 2 }, { type: 'embark-bonus', stat: 'gold', amount: 10 }], upgradeCost: { gold: 7, iuniores: 4 } },
    { description: '+3 morale on campaign start + 15 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 3 }, { type: 'embark-bonus', stat: 'gold', amount: 15 }], upgradeCost: {} },
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
