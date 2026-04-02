import type { Decretum } from '../game/decretum';

// ── Red (Military) — 3 scrolls ──

export const DECRETUM_FORGE: Decretum = {
  id: 'decretum_forge',
  name: 'Decretum of the Forge',
  color: 'red',
  description: 'Harden your soldiers\' armor for the coming battle. +20% defense.',
  effect: { type: 'buff', stat: 'def', multiplier: 0.2, duration: 'battle' },
  rarity: 'common',
};

export const DECRETUM_LEGION: Decretum = {
  id: 'decretum_legion',
  name: 'Decretum of the Legion',
  color: 'red',
  description: 'Call upon reserve legionaries. Spawn 2 militia vanguards.',
  effect: { type: 'spawn', unitRole: 'vanguard', count: 2 },
  rarity: 'rare',
};

export const DECRETUM_MARS: Decretum = {
  id: 'decretum_mars',
  name: 'Decretum of Mars',
  color: 'red',
  description: 'Invoke the god of war. All units deal double damage this battle.',
  effect: { type: 'buff', stat: 'atk', multiplier: 1.0, duration: 'battle' },
  rarity: 'legendary',
};

// ── Blue (Diplomatic) — 3 scrolls ──

export const DECRETUM_TRIBUNE: Decretum = {
  id: 'decretum_tribune',
  name: 'Decretum of the Tribune',
  color: 'blue',
  description: 'The Tribune speaks — force a favorable outcome on the next event.',
  effect: { type: 'event-modifier', outcome: 'favorable' },
  rarity: 'rare',
};

export const DECRETUM_SENATE: Decretum = {
  id: 'decretum_senate',
  name: 'Decretum of the Senate',
  color: 'blue',
  description: 'A decree from the Senate floor. Gain 3 Influence immediately.',
  effect: { type: 'resource-gain', resource: 'influence', amount: 3 },
  rarity: 'common',
};

export const DECRETUM_SPY: Decretum = {
  id: 'decretum_spy',
  name: 'Decretum of the Spy',
  color: 'blue',
  description: 'Your agents reveal enemy positions and strength.',
  effect: { type: 'reveal', target: 'enemies', count: 99 },
  rarity: 'common',
};

// ── Gold (Religious) — 3 scrolls ──

export const DECRETUM_AUGUR: Decretum = {
  id: 'decretum_augur',
  name: 'Decretum of the Augur',
  color: 'gold',
  description: 'The priests read the omens — reveal the next 2 node choices.',
  effect: { type: 'reveal', target: 'choices', count: 2 },
  rarity: 'rare',
};

export const DECRETUM_HEALING: Decretum = {
  id: 'decretum_healing',
  name: 'Decretum of Healing',
  color: 'gold',
  description: 'Divine light washes over your army. Heal all units by 30%.',
  effect: { type: 'heal', amount: 0.3, target: 'all' },
  rarity: 'common',
};

export const DECRETUM_ORACLE: Decretum = {
  id: 'decretum_oracle',
  name: 'Decretum of the Oracle',
  color: 'gold',
  description: 'Fate itself intervenes — prevent the next unit death this battle.',
  effect: { type: 'prevent-death', count: 1 },
  rarity: 'legendary',
};

// ── Purple (Economic) — 3 scrolls ──

export const DECRETUM_MERCHANT: Decretum = {
  id: 'decretum_merchant',
  name: 'Decretum of the Merchant',
  color: 'purple',
  description: 'Your trade contacts double the gold from the next node.',
  effect: { type: 'resource-gain', resource: 'gold', amount: 5 },
  rarity: 'rare',
};

export const DECRETUM_TAX: Decretum = {
  id: 'decretum_tax',
  name: 'Decretum of the Tax',
  color: 'purple',
  description: 'Levy emergency taxes. Gain 3 Gold immediately.',
  effect: { type: 'resource-gain', resource: 'gold', amount: 3 },
  rarity: 'common',
};

export const DECRETUM_SUPPLY: Decretum = {
  id: 'decretum_supply',
  name: 'Decretum of Supply',
  color: 'purple',
  description: 'Efficient logistics reduce your campaign upkeep for 1 season.',
  effect: { type: 'upkeep-reduction', seasons: 1 },
  rarity: 'common',
};

// ── White (Populist) — 3 scrolls ──

export const DECRETUM_BREAD: Decretum = {
  id: 'decretum_bread',
  name: 'Decretum of Bread & Circuses',
  color: 'white',
  description: 'Feed the troops and lift their spirits. Heal all units by 20%.',
  effect: { type: 'heal', amount: 0.2, target: 'all' },
  rarity: 'rare',
};

export const DECRETUM_MOB: Decretum = {
  id: 'decretum_mob',
  name: 'Decretum of the Mob',
  color: 'white',
  description: 'Rally the common folk to fight. Spawn 3 weak militia guards.',
  effect: { type: 'spawn', unitRole: 'guard', count: 3 },
  rarity: 'common',
};

export const DECRETUM_RIOT: Decretum = {
  id: 'decretum_riot',
  name: 'Decretum of the Riot',
  color: 'white',
  description: 'Unleash chaos on the battlefield. Deal 1500 area damage — beware friendly fire.',
  effect: { type: 'damage', amount: 1500, target: 'area' },
  rarity: 'legendary',
};

// ── Red (Military) — 3 additional scrolls ──

export const DECRETUM_GLADIUS: Decretum = {
  id: 'decretum_gladius',
  name: 'Lex Gladii',
  color: 'red',
  description: 'The law of the sword prevails. All units gain +15% attack this battle.',
  effect: { type: 'buff', stat: 'atk', multiplier: 0.15, duration: 'battle' },
  rarity: 'common',
};

export const DECRETUM_VANGUARD: Decretum = {
  id: 'decretum_vanguard',
  name: 'Edictum Principis',
  color: 'red',
  description: 'By imperial decree, the vanguard charges. Spawn 1 elite vanguard.',
  effect: { type: 'spawn', unitRole: 'vanguard', count: 1 },
  rarity: 'common',
};

export const DECRETUM_TESTUDO: Decretum = {
  id: 'decretum_testudo',
  name: 'Senatus Consultum de Testudine',
  color: 'red',
  description: 'Form the tortoise. All units gain +40% defense this battle.',
  effect: { type: 'buff', stat: 'def', multiplier: 0.4, duration: 'battle' },
  rarity: 'rare',
};

// ── Blue (Diplomatic) — 3 additional scrolls ──

export const DECRETUM_FOEDUS: Decretum = {
  id: 'decretum_foedus',
  name: 'Foedus Amicitiae',
  color: 'blue',
  description: 'A treaty of friendship earns goodwill. Gain 2 Influence immediately.',
  effect: { type: 'resource-gain', resource: 'influence', amount: 2 },
  rarity: 'common',
};

export const DECRETUM_LEGATUS: Decretum = {
  id: 'decretum_legatus',
  name: 'Mandatum Legati',
  color: 'blue',
  description: 'Your legate secures favorable terms — force the next event to resolve well.',
  effect: { type: 'event-modifier', outcome: 'favorable' },
  rarity: 'rare',
};

export const DECRETUM_EXPLORATOR: Decretum = {
  id: 'decretum_explorator',
  name: 'Vox Exploratoris',
  color: 'blue',
  description: 'Scouts return with vital intelligence. Reveal all enemy units.',
  effect: { type: 'reveal', target: 'enemies', count: 99 },
  rarity: 'common',
};

// ── Gold (Religious) — 3 additional scrolls ──

export const DECRETUM_PONTIFEX: Decretum = {
  id: 'decretum_pontifex',
  name: 'Decretum Pontificis',
  color: 'gold',
  description: 'The high priest blesses the wounded. Heal a single unit fully.',
  effect: { type: 'heal', amount: 1.0, target: 'single' },
  rarity: 'common',
};

export const DECRETUM_HARUSPEX: Decretum = {
  id: 'decretum_haruspex',
  name: 'Responsum Haruspicis',
  color: 'gold',
  description: 'The entrails speak of fortune ahead. Reveal the next 3 node choices.',
  effect: { type: 'reveal', target: 'choices', count: 3 },
  rarity: 'rare',
};

export const DECRETUM_PIETAS: Decretum = {
  id: 'decretum_pietas',
  name: 'Vow of Pietas',
  color: 'gold',
  description: 'Sacred devotion channels divine momentum. Gain 3 Momentum immediately.',
  effect: { type: 'resource-gain', resource: 'momentum', amount: 3 },
  rarity: 'common',
};

// ── Purple (Economic) — 3 additional scrolls ──

export const DECRETUM_AERARIUM: Decretum = {
  id: 'decretum_aerarium',
  name: 'Edictum Aerarii',
  color: 'purple',
  description: 'Unlock the treasury reserves. Gain 4 Gold immediately.',
  effect: { type: 'resource-gain', resource: 'gold', amount: 4 },
  rarity: 'common',
};

export const DECRETUM_ANNONA: Decretum = {
  id: 'decretum_annona',
  name: 'Lex Annonae',
  color: 'purple',
  description: 'Streamline grain supply chains — reduce upkeep costs for 2 seasons.',
  effect: { type: 'upkeep-reduction', seasons: 2 },
  rarity: 'rare',
};

export const DECRETUM_CURSUS: Decretum = {
  id: 'decretum_cursus',
  name: 'Cursus Honorum Aureus',
  color: 'purple',
  description: 'Offices and coin flow freely — gain 8 Gold and the loyalty of the equites.',
  effect: { type: 'resource-gain', resource: 'gold', amount: 8 },
  rarity: 'legendary',
};

// ── White (Populist) — 3 additional scrolls ──

export const DECRETUM_PLEBS: Decretum = {
  id: 'decretum_plebs',
  name: 'Vox Plebis',
  color: 'white',
  description: 'The voice of the people rallies reserves. Spawn 2 militia guards.',
  effect: { type: 'spawn', unitRole: 'guard', count: 2 },
  rarity: 'common',
};

export const DECRETUM_FRUMENTUM: Decretum = {
  id: 'decretum_frumentum',
  name: 'Lex Frumentaria',
  color: 'white',
  description: 'Distribute the grain dole — heal all units by 25%.',
  effect: { type: 'heal', amount: 0.25, target: 'all' },
  rarity: 'rare',
};

export const DECRETUM_TRIUMPHUS: Decretum = {
  id: 'decretum_triumphus',
  name: 'Decretum Triumphi',
  color: 'white',
  description: 'The triumph is declared — the crowd\'s frenzy grants all units +50% agility and prevents the next death.',
  effect: { type: 'prevent-death', count: 2 },
  rarity: 'legendary',
};

// ── All starter Decretum ──

export const STARTER_DECRETUM: Decretum[] = [
  // Red
  DECRETUM_FORGE, DECRETUM_LEGION, DECRETUM_MARS,
  DECRETUM_GLADIUS, DECRETUM_VANGUARD, DECRETUM_TESTUDO,
  // Blue
  DECRETUM_TRIBUNE, DECRETUM_SENATE, DECRETUM_SPY,
  DECRETUM_FOEDUS, DECRETUM_LEGATUS, DECRETUM_EXPLORATOR,
  // Gold
  DECRETUM_AUGUR, DECRETUM_HEALING, DECRETUM_ORACLE,
  DECRETUM_PONTIFEX, DECRETUM_HARUSPEX, DECRETUM_PIETAS,
  // Purple
  DECRETUM_MERCHANT, DECRETUM_TAX, DECRETUM_SUPPLY,
  DECRETUM_AERARIUM, DECRETUM_ANNONA, DECRETUM_CURSUS,
  // White
  DECRETUM_BREAD, DECRETUM_MOB, DECRETUM_RIOT,
  DECRETUM_PLEBS, DECRETUM_FRUMENTUM, DECRETUM_TRIUMPHUS,
];
