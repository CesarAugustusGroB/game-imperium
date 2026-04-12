import type { Cohort } from './cohort';

/**
 * Barbarian unit catalog for S15 enemy army generation.
 *
 * Stats are intentionally below player equivalents before the post-spawn
 * threat multiplier (+5%/level to HP+ATK) is applied. Players also benefit
 * from legate traits and doctrine buffs on top.
 *
 * Tiers:
 *  basic     — appear at any threat level
 *  elite     — introduced as threat rises (eliteRatio formula in generator)
 *  boss-only — reserved for boss nodes / final invasion
 */
export const ENEMY_COHORTS: readonly Cohort[] = [
  {
    id: 'barbarian-warrior',
    name: 'Barbarian Warrior',
    role: 'vanguard',
    stats: { atk: 120, def: 30, hp: 900, agi: 50 },
    aurumCost: 0,
    description: 'Ferocious tribesmen charging headlong into the front line.',
  },
  {
    id: 'barbarian-raider',
    name: 'Barbarian Raider',
    role: 'reserve',
    stats: { atk: 115, def: 35, hp: 720, agi: 85 },
    aurumCost: 0,
    description: 'Fast-moving warbands that harry the flanks and exploit gaps.',
  },
  {
    id: 'barbarian-shieldbearer',
    name: 'Barbarian Shieldbearer',
    role: 'guard',
    stats: { atk: 80, def: 72, hp: 1100, agi: 28 },
    aurumCost: 0,
    description: 'Heavy shield wall — slow but nearly immovable under assault.',
  },
  {
    id: 'barbarian-champion',
    name: 'Barbarian Champion',
    role: 'vanguard',
    stats: { atk: 165, def: 45, hp: 1200, agi: 45 },
    aurumCost: 0,
    description: 'Battle-hardened warriors who have earned glory through slaughter.',
  },
  {
    id: 'barbarian-chieftain',
    name: 'Barbarian Chieftain',
    role: 'guard',
    stats: { atk: 125, def: 90, hp: 1400, agi: 30 },
    aurumCost: 0,
    description: 'Tribal leaders whose presence steadies the warband around them.',
  },
  {
    id: 'barbarian-warlord',
    name: 'Barbarian Warlord',
    role: 'vanguard',
    stats: { atk: 200, def: 60, hp: 1600, agi: 40 },
    aurumCost: 0,
    description: 'A warlord who has united the tribes. Reserved for the fiercest confrontations.',
  },
] as const;

/** Lookup an enemy cohort definition by id, or `undefined` if not found. */
export function getEnemyCohortById(id: string): Cohort | undefined {
  return ENEMY_COHORTS.find(c => c.id === id);
}
