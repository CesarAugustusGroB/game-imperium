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

// ── All starter Decretum ──

export const STARTER_DECRETUM: Decretum[] = [
  // Red
  DECRETUM_FORGE, DECRETUM_LEGION, DECRETUM_MARS,
  // Blue
  DECRETUM_TRIBUNE, DECRETUM_SENATE, DECRETUM_SPY,
  // Gold
  DECRETUM_AUGUR, DECRETUM_HEALING, DECRETUM_ORACLE,
  // Purple
  DECRETUM_MERCHANT, DECRETUM_TAX, DECRETUM_SUPPLY,
  // White
  DECRETUM_BREAD, DECRETUM_MOB, DECRETUM_RIOT,
];
