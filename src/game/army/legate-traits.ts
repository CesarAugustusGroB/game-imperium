import type { LegateTrait } from './legate';

/**
 * Starter catalog of 8 Legate traits. Each trait is pure data — the
 * application pipeline in S14-05 dispatches on `effect.type` without any
 * per-trait switch cases (S14 NFR-2).
 *
 * Multipliers are tuned against the canonical ROLE_STATS scale in
 * battle-config.ts (vanguard atk 150, guard hp 1200, etc.), not flat
 * integers — a flat +1 atk would be imperceptible at this scale.
 */
export const LEGATE_TRAITS: readonly LegateTrait[] = [
  {
    id: 'veteran',
    name: 'Veteran',
    description: '+15% attack to all vanguard units.',
    effect: { type: 'stat-bonus', target: 'vanguard', stat: 'atk', multiplier: 0.15 },
  },
  {
    id: 'disciplined',
    name: 'Disciplined',
    description: '+20% defense to all reserve units.',
    effect: { type: 'stat-bonus', target: 'reserve', stat: 'def', multiplier: 0.20 },
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    description: "Battle begins with lieutenant order set to 'Attack'.",
    effect: { type: 'lieutenant-preset', order: 'attack' },
  },
  {
    id: 'cautious',
    name: 'Cautious',
    description: "Battle begins with lieutenant order set to 'Defend'.",
    effect: { type: 'lieutenant-preset', order: 'defend' },
  },
  {
    id: 'swift',
    name: 'Swift',
    description: '+20% agility to all units.',
    effect: { type: 'stat-bonus', target: 'all', stat: 'agi', multiplier: 0.20 },
  },
  {
    id: 'tactician',
    name: 'Tactician',
    description: '+20% attack to all guard units.',
    effect: { type: 'stat-bonus', target: 'guard', stat: 'atk', multiplier: 0.20 },
  },
  {
    id: 'stoic',
    name: 'Stoic',
    description: '+15% maximum health to all units.',
    effect: { type: 'stat-bonus', target: 'all', stat: 'hp', multiplier: 0.15 },
  },
  {
    id: 'rallying',
    name: 'Rallying',
    description: '+25% to all stats of one random friendly unit at battle start.',
    effect: { type: 'random-rally', multiplier: 0.25 },
  },
] as const;

/** Lookup a trait definition by id, or `undefined` if not found. */
export function getLegateTraitById(id: string): LegateTrait | undefined {
  return LEGATE_TRAITS.find(t => t.id === id);
}
