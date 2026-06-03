import type { Faction, ResourceType } from '../core/commander';
import { isColorMatch } from '../core/commander';
import type { Collectible, TierLevel, TierTuple, ResourceCost } from '../../types/index';

// ── Effect types (discriminated union on `type`) ──

export type DoctrineEffect =
  | { type: 'stat-modifier'; stat: 'damage' | 'armor' | 'maxHp'; multiplier: number }
  | { type: 'heal-on-kill'; amount: number }
  | { type: 'revive'; hpPercent: number }
  | { type: 'heal-battle-start'; amount: number | 'full' | { percent: number } }
  | { type: 'free-units'; unitRole: 'vanguard' | 'reserve' | 'guard'; count: number }
  | { type: 'extra-event-choices'; count: number }
  | { type: 'shop-discount'; percent: number }
  | { type: 'income-modifier'; resource: ResourceType; multiplier: number }
  | { type: 'ally-units'; count: number }
  | { type: 'upkeep-reduction'; percent: number }
  | { type: 'embark-bonus'; stat: 'soldiers' | 'morale' | 'supplies' | 'discipline' | 'gold'; amount: number };

// ── Doctrine level ──

export interface DoctrineLevel {
  description: string;
  effects: DoctrineEffect[];
  upgradeCost: ResourceCost;
}

// ── Doctrine definition ──

export interface Doctrine extends Collectible {
  /** Fixed 3-level structure: [Level I, Level II, Level III]. */
  levels: TierTuple<DoctrineLevel>;
  /** 1-indexed current level (displays as I/II/III). */
  currentLevel: TierLevel;
}

// ── Color-lock rule ──

/**
 * Check if a Doctrine can be equipped by a commander of the given faction.
 * Rule: Commander can equip doctrines of their own color OR white (universal).
 * White commanders can equip ANY color.
 */
export function isDoctrineEquippable(doctrine: Doctrine, commanderColor: Faction): boolean {
  return isColorMatch(doctrine.color, commanderColor);
}

// ── Helpers ──

/** Get the active effects for a doctrine at its current level. */
export function getCurrentEffects(doctrine: Doctrine): DoctrineEffect[] {
  return doctrine.levels[doctrine.currentLevel - 1].effects;
}

/** Get the cost to upgrade to the next level, or null if already max. */
export function getUpgradeCost(doctrine: Doctrine): ResourceCost | null {
  if (doctrine.currentLevel >= 3) return null;
  // currentLevel is 1 or 2 here, so index 1 or 2 is the NEXT level's cost
  const nextLevel = doctrine.levels[doctrine.currentLevel as 1 | 2];
  return nextLevel.upgradeCost;
}

/** Sell price in gold: base 8g + 4g per level above 1. */
export function getDoctrineSellPrice(doctrine: Doctrine): number {
  return 8 + (doctrine.currentLevel - 1) * 4;
}
