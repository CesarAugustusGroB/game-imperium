/**
 * Iter Belli — Doctrinae Fase 1: per-color campaign-modifier factories + bridge.
 * Pure data + functions. Maps each equipped Hub doctrine to a DoctrineCampaignModifier
 * by color, scaled by the doctrine's level. The campaign engine consults the
 * modifiers' hooks; it never imports this module's run-domain dependency.
 */
import type {
  CardCost, CardEffects, DoctrineCampaignModifier,
} from '../game/iterBelli/iter-belli-types';
import type { Doctrine } from '../game/items/doctrine';

export type DoctrineColor = 'red' | 'blue' | 'gold' | 'purple' | 'white';

// Shared no-op sentinels returned by hooks for cards they do not affect.
// MUST stay immutable — the engine only reads hook return values, never mutates them.
const NONE: CardEffects = {};
const NO_COST: CardCost = {};

/**
 * One signature campaign behavior per doctrine color. `level` (1/2/3) scales the
 * effect. Hooks return empty objects for cards/categories they do not affect.
 */
export const DOCTRINE_MODIFIERS: Record<DoctrineColor, (level: number) => DoctrineCampaignModifier> = {
  red: (level) => ({
    id: 'doctrine_red',
    label: 'Doctrina Marcial',
    onPlay: (card) => (card.category === 'Coerción' ? { enemyWeaken: level } : NONE),
  }),
  blue: (level) => ({
    id: 'doctrine_blue',
    label: 'Doctrina Diplomática',
    costDelta: (card) => (card.category === 'Diplomacia' ? { gold: -5 * level } : NO_COST),
    onPlay: (card) => (card.category === 'Diplomacia' ? { threat: -level } : NONE),
  }),
  purple: (level) => ({
    id: 'doctrine_purple',
    label: 'Doctrina Económica',
    onPlay: (card) => (card.category === 'Logística' ? { supplies: 2 * level } : NONE),
  }),
  gold: (level) => ({
    id: 'doctrine_gold',
    label: 'Doctrina Religiosa',
    onTurn: () => ({ morale: 0.3 * level }),
  }),
  white: (level) => ({
    id: 'doctrine_white',
    label: 'Doctrina Populista',
    onTurn: () => ({ supplies: level }),
  }),
};

/**
 * Resolve equipped doctrines into campaign modifiers: one per occupied slot,
 * themed by color and scaled by level. Same-color doctrines stack.
 */
export function computeDoctrineModifiers(equipped: (Doctrine | null)[]): DoctrineCampaignModifier[] {
  const mods: DoctrineCampaignModifier[] = [];
  equipped.forEach((doctrine, slot) => {
    if (!doctrine) return;
    const factory = DOCTRINE_MODIFIERS[doctrine.color as DoctrineColor];
    // Unique id per slot so stacked same-color doctrines don't collide.
    if (factory) mods.push({ ...factory(doctrine.currentLevel), id: `doctrine_${doctrine.color}_${slot}` });
  });
  return mods;
}
