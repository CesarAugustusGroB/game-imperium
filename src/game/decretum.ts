import type { Faction } from './commander';
import type { ResourceType } from './commander';

// ── Rarity ──

export type DecretumRarity = 'common' | 'rare' | 'legendary';

// ── Effect types (discriminated union on `type`) ──

export type DecretumEffect =
  | { type: 'heal'; amount: number; target: 'all' | 'single' }
  | { type: 'damage'; amount: number; target: 'single' | 'area' }
  | { type: 'buff'; stat: 'atk' | 'def' | 'hp' | 'agi'; multiplier: number; duration: 'battle' }
  | { type: 'debuff'; stat: 'atk' | 'def' | 'hp' | 'agi'; multiplier: number; duration: 'battle' }
  | { type: 'resource-gain'; resource: ResourceType; amount: number }
  | { type: 'spawn'; unitRole: 'vanguard' | 'reserve' | 'guard'; count: number }
  | { type: 'reveal'; target: 'choices' | 'enemies'; count: number }
  | { type: 'prevent-death'; count: number }
  | { type: 'event-modifier'; outcome: 'favorable' }
  | { type: 'upkeep-reduction'; seasons: number };

// ── Targeting mode (derived from effect for UI) ──

export type DecretumTargeting = 'none' | 'single-unit' | 'single-hex' | 'immediate';

/** Determine what targeting mode the ability UI should use for a given effect. */
export function getDecretumTargeting(effect: DecretumEffect): DecretumTargeting {
  switch (effect.type) {
    case 'heal':
      return effect.target === 'single' ? 'single-unit' : 'immediate';
    case 'damage':
      return effect.target === 'single' ? 'single-unit' : 'immediate';
    case 'spawn':
      return 'single-hex';
    case 'buff':
    case 'debuff':
    case 'resource-gain':
    case 'reveal':
    case 'prevent-death':
    case 'event-modifier':
    case 'upkeep-reduction':
      return 'immediate';
  }
}

// ── Decretum definition ──

export interface Decretum {
  id: string;
  name: string;
  color: Faction;
  description: string;
  effect: DecretumEffect;
  rarity: DecretumRarity;
}

// ── Color-lock rule ──

/**
 * Check if a Decretum can be cast by a commander of the given faction.
 * Rule: Commander can cast scrolls of their own color OR white (universal).
 * White commanders can cast ANY color.
 */
export function isDecretumCastable(decretum: Decretum, commanderColor: Faction): boolean {
  if (commanderColor === 'white') return true;
  return decretum.color === commanderColor || decretum.color === 'white';
}

/** Sell price in gold based on rarity. */
export const DECRETUM_SELL_PRICE: Record<DecretumRarity, number> = {
  common: 2,
  rare: 5,
  legendary: 10,
};
