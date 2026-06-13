import type { LegateTrait } from './legate';

/**
 * Starter catalog of Legate traits. Each trait is pure data — the application
 * pipeline dispatches on `effect.type` without any per-trait switch cases.
 *
 * Applied by `legateSeedMods` in `iterBelli/battle/adapter.ts` (plan S-B):
 * `stat-bonus` scales the matching role's power stats (stoic scales army HP),
 * `morale-bonus` adds pre-battle morale (legacy 0–100 amount ÷10 onto the
 * 0–15 engine scale), `random-rally` boosts the strongest cohort. The
 * `lieutenant-preset` traits (aggressive/cautious) gate unique formations
 * via TRAIT_TO_FORMATION_TRAIT, not a stat bonus.
 */
export const LEGATE_TRAITS: readonly LegateTrait[] = [
  {
    id: 'veteran',
    name: 'Veteran',
    description: '+15% charge power to all vanguard units.',
    effect: { type: 'stat-bonus', target: 'vanguard', stat: 'charge', multiplier: 0.15 },
  },
  {
    id: 'disciplined',
    name: 'Disciplined',
    description: '+20% push power to all reserve units.',
    effect: { type: 'stat-bonus', target: 'reserve', stat: 'push', multiplier: 0.20 },
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Unlocks the Cuneus (Wedge) shock formation in battle (requires discipline 5).',
    effect: { type: 'lieutenant-preset', order: 'attack' },
  },
  {
    id: 'cautious',
    name: 'Cautious',
    description: 'Unlocks the Testudo defensive formation in battle (requires discipline 5).',
    effect: { type: 'lieutenant-preset', order: 'defend' },
  },
  {
    id: 'swift',
    name: 'Swift',
    description: '+20% movement to all units.',
    effect: { type: 'stat-bonus', target: 'all', stat: 'movement', multiplier: 0.20 },
  },
  {
    id: 'tactician',
    name: 'Tactician',
    description: '+20% charge power to all guard units.',
    effect: { type: 'stat-bonus', target: 'guard', stat: 'charge', multiplier: 0.20 },
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
  {
    id: 'charismatic',
    name: 'Charismatic',
    description: '+1.5 pre-battle morale. Pushes a neutral army into Resolute.',
    effect: { type: 'morale-bonus', amount: 15 },
  },
  {
    id: 'inspiring',
    name: 'Inspiring',
    description: '+2.5 pre-battle morale. The troops fight for a beloved commander.',
    effect: { type: 'morale-bonus', amount: 25 },
  },
] as const;

/** Lookup a trait definition by id, or `undefined` if not found. */
export function getLegateTraitById(id: string): LegateTrait | undefined {
  return LEGATE_TRAITS.find(t => t.id === id);
}
