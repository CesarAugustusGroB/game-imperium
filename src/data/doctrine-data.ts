import type { Doctrine } from '../game/items/doctrine';

// ── Red (Military) — 3 Doctrines ──

export const DOCTRINE_SWORD: Doctrine = {
  id: 'doctrine_sword', name: 'Doctrine of the Sword', color: 'red', currentLevel: 1, starter: true,
  levels: [
    { description: '+200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 200 }], upgradeCost: { iuniores: 300 } },
    { description: '+400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { iuniores: 600 } },
    { description: '+800 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { iuniores: 1200 } },
  ],
};

export const DOCTRINE_IRON: Doctrine = {
  id: 'doctrine_iron', name: 'Doctrine of Iron', color: 'red', currentLevel: 1, starter: true,
  levels: [
    { description: '+400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { iuniores: 400 } },
    { description: '+800 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { iuniores: 800 } },
    { description: '+1600 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1600 }], upgradeCost: { iuniores: 1200 } },
  ],
};

export const DOCTRINE_BLOOD: Doctrine = {
  id: 'doctrine_blood', name: 'Doctrine of Blood', color: 'red', currentLevel: 1,
  levels: [
    { description: '+1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { iuniores: 200, gold: 6 } },
    { description: '+2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { iuniores: 500, gold: 9 } },
    { description: '+3 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: { iuniores: 1000, gold: 36 } },
  ],
};

// ── Blue (Diplomatic) — 3 Doctrines ──

export const DOCTRINE_DIPLOMACY: Doctrine = {
  id: 'doctrine_diplomacy', name: 'Doctrine of Diplomacy', color: 'blue', currentLevel: 1, starter: true,
  levels: [
    { description: '+5 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 5 }], upgradeCost: { gold: 9 } },
    { description: '+10 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 10 }], upgradeCost: { gold: 18 } },
    { description: '+15 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 15 }], upgradeCost: { gold: 72 } },
  ],
};

export const DOCTRINE_COURT: Doctrine = {
  id: 'doctrine_court', name: 'Doctrine of the Court', color: 'blue', currentLevel: 1, starter: true,
  levels: [
    { description: '+5 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 5 }], upgradeCost: { gold: 12 } },
    { description: '+10 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 10 }], upgradeCost: { gold: 24 } },
    { description: '+15 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 15 }], upgradeCost: { gold: 96 } },
  ],
};

export const DOCTRINE_ALLIANCES: Doctrine = {
  id: 'doctrine_alliances', name: 'Doctrine of Alliances', color: 'blue', currentLevel: 1,
  levels: [
    { description: '+400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { gold: 15 } },
    { description: '+800 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { gold: 30 } },
    { description: '+1200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }], upgradeCost: { gold: 96 } },
  ],
};

// ── Gold (Religious) — 3 Doctrines ──

export const DOCTRINE_FAITH: Doctrine = {
  id: 'doctrine_faith', name: 'Doctrine of Faith', color: 'gold', currentLevel: 1, starter: true,
  levels: [
    { description: '+5 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 5 }], upgradeCost: { gold: 9 } },
    { description: '+10 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 10 }], upgradeCost: { gold: 18 } },
    { description: '+15 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 15 }], upgradeCost: { gold: 72 } },
  ],
};

export const DOCTRINE_MIRACLES: Doctrine = {
  id: 'doctrine_miracles', name: 'Doctrine of Miracles', color: 'gold', currentLevel: 1, starter: true,
  levels: [
    { description: '+1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { gold: 12 } },
    { description: '+2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { gold: 24 } },
    { description: '+3 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: { gold: 96 } },
  ],
};

export const DOCTRINE_PANTHEON: Doctrine = {
  id: 'doctrine_pantheon', name: 'Doctrine of the Pantheon', color: 'gold', currentLevel: 1,
  levels: [
    { description: '+1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { gold: 18 } },
    { description: '+2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { gold: 36 } },
    { description: '+3 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: { gold: 96 } },
  ],
};

// ── Purple (Economic) — 3 Doctrines ──

export const DOCTRINE_TRADE: Doctrine = {
  id: 'doctrine_trade', name: 'Doctrine of Trade', color: 'purple', currentLevel: 1, starter: true,
  levels: [
    { description: '+15% gold income from all sources.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.15 }], upgradeCost: { gold: 12 } },
    { description: '+30% gold income from all sources.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.30 }], upgradeCost: { gold: 24 } },
    { description: '+50% gold income from all sources.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.50 }], upgradeCost: { gold: 96 } },
  ],
};

export const DOCTRINE_INFRASTRUCTURE: Doctrine = {
  id: 'doctrine_infrastructure', name: 'Doctrine of Infrastructure', color: 'purple', currentLevel: 1,
  levels: [
    { description: 'Province upkeep reduced by 10%.', effects: [{ type: 'upkeep-reduction', percent: 10 }], upgradeCost: { gold: 9 } },
    { description: 'Province upkeep reduced by 20%.', effects: [{ type: 'upkeep-reduction', percent: 20 }], upgradeCost: { gold: 21 } },
    { description: 'Province upkeep reduced by 30%.', effects: [{ type: 'upkeep-reduction', percent: 30 }], upgradeCost: { gold: 84 } },
  ],
};

export const DOCTRINE_MARKET: Doctrine = {
  id: 'doctrine_market', name: 'Doctrine of the Market', color: 'purple', currentLevel: 1, starter: true,
  levels: [
    { description: 'Shop prices reduced by 10%.',    effects: [{ type: 'shop-discount', percent: 10 }], upgradeCost: { gold: 9 } },
    { description: 'Shop prices reduced by 20%.',    effects: [{ type: 'shop-discount', percent: 20 }], upgradeCost: { gold: 18 } },
    { description: 'Shop prices reduced by 30%.',    effects: [{ type: 'shop-discount', percent: 30 }], upgradeCost: { gold: 72 } },
  ],
};

// ── White (Populist) — 3 Doctrines ──

export const DOCTRINE_PEOPLE: Doctrine = {
  id: 'doctrine_people', name: 'Doctrine of the People', color: 'white', currentLevel: 1, starter: true,
  levels: [
    { description: '+400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { gold: 9 } },
    { description: '+800 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { gold: 18 } },
    { description: '+1200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }], upgradeCost: { gold: 72 } },
  ],
};

export const DOCTRINE_MILITIA: Doctrine = {
  id: 'doctrine_militia', name: 'Doctrine of the Militia', color: 'white', currentLevel: 1, starter: true,
  levels: [
    { description: '+400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { gold: 12 } },
    { description: '+800 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { gold: 24 } },
    { description: '+1200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }], upgradeCost: { gold: 96 } },
  ],
};

export const DOCTRINE_RESILIENCE: Doctrine = {
  id: 'doctrine_resilience', name: 'Doctrine of Resilience', color: 'white', currentLevel: 1,
  levels: [
    { description: '+200 soldiers + 1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 200 }, { type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { gold: 9, iuniores: 200 } },
    { description: '+400 soldiers + 2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }, { type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { gold: 18, iuniores: 400 } },
    { description: '+600 soldiers + 3 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 600 }, { type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: { gold: 72, iuniores: 800 } },
  ],
};

// ── Red (Military) — additional doctrines ──

export const DOCTRINE_LEX_MILITARIS: Doctrine = {
  id: 'doctrine_lex_militaris', name: 'Lex Militaris', color: 'red', currentLevel: 1,
  levels: [
    { description: '+400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { iuniores: 300 } },
    { description: '+800 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { iuniores: 600 } },
    { description: '+1200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }], upgradeCost: { iuniores: 1200 } },
  ],
};

export const DOCTRINE_VIS_BELLICA: Doctrine = {
  id: 'doctrine_vis_bellica', name: 'Vis Bellica', color: 'red', currentLevel: 1,
  levels: [
    { description: '+200 soldiers + 1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 200 }, { type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { iuniores: 400, gold: 6 } },
    { description: '+400 soldiers + 1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }, { type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { iuniores: 700, gold: 12 } },
    { description: '+600 soldiers + 2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 600 }, { type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { iuniores: 1200, gold: 48 } },
  ],
};

// ── Blue (Diplomatic) — additional doctrines ──

export const DOCTRINE_PAX_ROMANA: Doctrine = {
  id: 'doctrine_pax_romana', name: 'Pax Romana', color: 'blue', currentLevel: 1,
  levels: [
    { description: '+5 gold at campaign start + shop prices reduced by 5%.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 5 }, { type: 'shop-discount', percent: 5 }], upgradeCost: { gold: 12 } },
    { description: '+10 gold at campaign start + shop prices reduced by 10%.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 10 }, { type: 'shop-discount', percent: 10 }], upgradeCost: { gold: 24 } },
    { description: '+15 gold at campaign start + shop prices reduced by 15%.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 15 }, { type: 'shop-discount', percent: 15 }], upgradeCost: { gold: 96 } },
  ],
};

export const DOCTRINE_FOEDUS_AETERNUM: Doctrine = {
  id: 'doctrine_foedus_aeternum', name: 'Foedus Aeternum', color: 'blue', currentLevel: 1,
  levels: [
    { description: '+400 soldiers on campaign start + 15% gold income.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }, { type: 'income-modifier', resource: 'gold', multiplier: 0.15 }], upgradeCost: { gold: 24 } },
    { description: '+800 soldiers on campaign start + 25% gold income.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }, { type: 'income-modifier', resource: 'gold', multiplier: 0.25 }], upgradeCost: { gold: 42 } },
    { description: '+1200 soldiers on campaign start + 40% gold income.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }, { type: 'income-modifier', resource: 'gold', multiplier: 0.40 }], upgradeCost: { gold: 96 } },
  ],
};

// ── Gold (Religious) — additional doctrines ──

export const DOCTRINE_DIVINA_PROVIDENTIA: Doctrine = {
  id: 'doctrine_divina_providentia', name: 'Divina Providentia', color: 'gold', currentLevel: 1,
  levels: [
    { description: '+5 gold at campaign start + 1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 5 }, { type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { gold: 15 } },
    { description: '+10 gold at campaign start + 2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 10 }, { type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { gold: 27 } },
    { description: '+15 gold at campaign start + 3 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'gold', amount: 15 }, { type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: { gold: 96 } },
  ],
};

// ── Purple (Economic) — additional doctrines ──

export const DOCTRINE_ANNONA: Doctrine = {
  id: 'doctrine_annona', name: 'Annona', color: 'purple', currentLevel: 1,
  levels: [
    { description: '+15% gold income + upkeep reduced by 10%.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.15 }, { type: 'upkeep-reduction', percent: 10 }], upgradeCost: { gold: 15 } },
    { description: '+30% gold income + upkeep reduced by 20%.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.30 }, { type: 'upkeep-reduction', percent: 20 }], upgradeCost: { gold: 27 } },
    { description: '+50% gold income + upkeep reduced by 30%.', effects: [{ type: 'income-modifier', resource: 'gold', multiplier: 0.50 }, { type: 'upkeep-reduction', percent: 30 }], upgradeCost: { gold: 96 } },
  ],
};

// ── White (Populist) — additional doctrines ──

export const DOCTRINE_VIRTUS_POPULI: Doctrine = {
  id: 'doctrine_virtus_populi', name: 'Virtus Populi', color: 'white', currentLevel: 1,
  levels: [
    { description: '+800 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { gold: 12 } },
    { description: '+1600 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1600 }], upgradeCost: { gold: 24 } },
    { description: '+2400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 2400 }], upgradeCost: { gold: 96 } },
  ],
};

export const DOCTRINE_CONCORDIA: Doctrine = {
  id: 'doctrine_concordia', name: 'Concordia', color: 'white', currentLevel: 1,
  levels: [
    { description: '+1 morale on campaign start + 5 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 1 }, { type: 'embark-bonus', stat: 'gold', amount: 5 }], upgradeCost: { gold: 12, iuniores: 200 } },
    { description: '+2 morale on campaign start + 10 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 2 }, { type: 'embark-bonus', stat: 'gold', amount: 10 }], upgradeCost: { gold: 21, iuniores: 400 } },
    { description: '+3 morale on campaign start + 15 gold at campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 3 }, { type: 'embark-bonus', stat: 'gold', amount: 15 }], upgradeCost: { gold: 84, iuniores: 800 } },
  ],
};

// ── New doctrines: supplies & discipline embark bonuses ──

export const DOCTRINE_HORREA_PUBLICA: Doctrine = {
  id: 'doctrine_horrea_publica', name: 'Horrea Publica', color: 'purple', currentLevel: 1,
  levels: [
    { description: '+4 supplies on campaign start.', effects: [{ type: 'embark-bonus', stat: 'supplies', amount: 4 }], upgradeCost: { gold: 9 } },
    { description: '+8 supplies on campaign start.', effects: [{ type: 'embark-bonus', stat: 'supplies', amount: 8 }], upgradeCost: { gold: 18 } },
    { description: '+12 supplies on campaign start.', effects: [{ type: 'embark-bonus', stat: 'supplies', amount: 12 }], upgradeCost: { gold: 72 } },
  ],
};

export const DOCTRINE_DISCIPLINA_FERREA: Doctrine = {
  id: 'doctrine_disciplina_ferrea', name: 'Disciplina Ferrea', color: 'red', currentLevel: 1,
  levels: [
    { description: '+1 discipline on campaign start.', effects: [{ type: 'embark-bonus', stat: 'discipline', amount: 1 }], upgradeCost: { iuniores: 300 } },
    { description: '+2 discipline on campaign start.', effects: [{ type: 'embark-bonus', stat: 'discipline', amount: 2 }], upgradeCost: { iuniores: 600 } },
    { description: '+3 discipline on campaign start.', effects: [{ type: 'embark-bonus', stat: 'discipline', amount: 3 }], upgradeCost: { iuniores: 1200 } },
  ],
};

export const DOCTRINE_HEARTH: Doctrine = {
  id: 'doctrine_hearth', name: 'Doctrine of the Hearth', color: 'white', currentLevel: 1,
  levels: [
    { description: '+4 supplies + 1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'supplies', amount: 4 }, { type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { gold: 9, iuniores: 200 } },
    { description: '+8 supplies + 2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'supplies', amount: 8 }, { type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { gold: 18, iuniores: 400 } },
    { description: '+12 supplies + 3 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'supplies', amount: 12 }, { type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: { gold: 72, iuniores: 800 } },
  ],
};

// ── Full doctrine catalog (starter core + draft-acquirable) ──

export const DOCTRINE_CATALOG: Doctrine[] = [
  // Red
  DOCTRINE_SWORD, DOCTRINE_IRON, DOCTRINE_BLOOD,
  DOCTRINE_LEX_MILITARIS, DOCTRINE_VIS_BELLICA, DOCTRINE_DISCIPLINA_FERREA,
  // Blue
  DOCTRINE_DIPLOMACY, DOCTRINE_COURT, DOCTRINE_ALLIANCES,
  DOCTRINE_PAX_ROMANA, DOCTRINE_FOEDUS_AETERNUM,
  // Gold
  DOCTRINE_FAITH, DOCTRINE_MIRACLES, DOCTRINE_PANTHEON,
  DOCTRINE_DIVINA_PROVIDENTIA,
  // Purple
  DOCTRINE_TRADE, DOCTRINE_INFRASTRUCTURE, DOCTRINE_MARKET,
  DOCTRINE_ANNONA, DOCTRINE_HORREA_PUBLICA,
  // White
  DOCTRINE_PEOPLE, DOCTRINE_MILITIA, DOCTRINE_RESILIENCE,
  DOCTRINE_VIRTUS_POPULI, DOCTRINE_CONCORDIA, DOCTRINE_HEARTH,
];
