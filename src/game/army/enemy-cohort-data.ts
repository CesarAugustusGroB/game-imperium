import type { Cohort } from './cohort';

/**
 * Enemy unit catalog — rebuilt from `public/asset/soldiers/soldiers.json`.
 *
 * `soldiers.json` is the source of truth for every sprite that exists on
 * disk; each entry here references one of those sprite ids so the battle
 * renderer can draw the matching artwork.
 *
 * Reserved "gold-coin" sprites that must NOT appear in the regular enemy
 * roster (used only when explicitly requested):
 *   - `spartan_royal_super_rare`
 *   - `companion_super_rare`
 *
 * The ids (`barbarian-warrior` / `barbarian-raider` / …) are kept so the
 * role-based generator in `enemy-army-generator.ts` continues to work; the
 * display names and sprites are now drawn from the cultural catalog.
 *
 * Stats are tuned to stay below player equivalents before the post-spawn
 * threat multiplier in `applyThreatScaling()` is applied.
 */
export const ENEMY_COHORTS: readonly Cohort[] = [
  {
    id: 'barbarian-warrior',
    name: 'Gallic Warband',
    role: 'vanguard',
    stats: { atk: 125, def: 25, hp: 850, agi: 55 },
    aurumCost: 0,
    rarity: 'common',
    spriteId: 'gallic_common',
    description: 'Woad-painted Celtic shock infantry charging headlong at the line.',
    movementProfile: 'vanguard-march',
  },
  {
    id: 'barbarian-raider',
    name: 'Persian Immortal',
    role: 'reserve',
    stats: { atk: 115, def: 40, hp: 820, agi: 70 },
    aurumCost: 0,
    rarity: 'uncommon',
    spriteId: 'persian_immortal_uncommon',
    description: 'Anūšiya reserve — scale-mail archer-spearmen that intercept breaches in the enemy line.',
    movementProfile: 'ranged-skirmisher',
  },
  {
    id: 'barbarian-shieldbearer',
    name: 'Punic Citizen-Soldier',
    role: 'guard',
    stats: { atk: 95, def: 75, hp: 1150, agi: 30 },
    aurumCost: 0,
    rarity: 'common',
    spriteId: 'punic_common',
    description: 'Carthaginian linothorax spearmen — slow but nearly immovable behind the Tanit shield.',
    movementProfile: 'vanguard-march',
  },
  {
    id: 'barbarian-champion',
    name: 'Norse Raider',
    role: 'vanguard',
    stats: { atk: 175, def: 30, hp: 1100, agi: 65 },
    aurumCost: 0,
    rarity: 'common',
    spriteId: 'viking_common',
    description: 'Dane-axe shock berserkers — no formation, no restraint. They chase the nearest enemy without deviation.',
    movementProfile: 'berserker',
  },
  {
    id: 'barbarian-chieftain',
    name: 'Spartan Hoplite',
    role: 'guard',
    stats: { atk: 145, def: 85, hp: 1400, agi: 40 },
    aurumCost: 0,
    rarity: 'rare',
    spriteId: 'spartan_rare',
    description: 'Bronze-cuirass phalanx that anchors the enemy line — the lambda shield will not break first.',
    movementProfile: 'vanguard-march',
  },
  {
    id: 'barbarian-warlord',
    name: 'Athenian Elite Hoplite',
    role: 'vanguard',
    stats: { atk: 195, def: 70, hp: 1550, agi: 55 },
    aurumCost: 0,
    rarity: 'super-rare',
    spriteId: 'athen_hoplite_elite_super_rare',
    description: 'Gilded-cuirass elite with Athena\'s owl on the aspis — reserved for the fiercest confrontations.',
    movementProfile: 'vanguard-march',
  },
  {
    id: 'makedon-hetairoi',
    name: 'Makedon Hetairoi',
    role: 'vanguard',
    stats: { atk: 185, def: 60, hp: 1500, agi: 85 },
    aurumCost: 0,
    rarity: 'secret-rare',
    spriteId: 'makedon_hetairoi_secret_rare',
    description: 'Alexander\'s royal Companion Cavalry. Heavy xyston-armed horse that crashes through lines.',
    movementProfile: 'flanker',
  },

  // ── Gallic Confederation (campaign-roll entries) ──────────────────────
  // Stats mirror GALLIC_COHORT_POOL but shaved ~10% to stay under player
  // equivalents before applyThreatScaling().
  {
    id: 'gallic-clansmen',
    name: 'Gallic Clansmen',
    role: 'vanguard',
    stats: { atk: 95, def: 25, hp: 780, agi: 45 },
    aurumCost: 0,
    rarity: 'common',
    spriteId: 'gallic_clansmen_common',
    description: 'Teuta levy — smallholders answering the war-horn under the Taranis thunder-wheel.',
    movementProfile: 'vanguard-march',
  },
  {
    id: 'gallic-neitos',
    name: 'Gallic Neitos',
    role: 'reserve',
    stats: { atk: 115, def: 20, hp: 660, agi: 95 },
    aurumCost: 0,
    rarity: 'uncommon',
    spriteId: 'gallic_neitos_uncommon',
    description: 'Javelineer war-champions under Lugh\'s sunburst — open with a sheaf of gaesum, then kite.',
    movementProfile: 'ranged-skirmisher',
  },
  {
    id: 'gallic-gaesatae',
    name: 'Gaesatae',
    role: 'vanguard',
    stats: { atk: 180, def: 20, hp: 900, agi: 70 },
    aurumCost: 0,
    rarity: 'rare',
    spriteId: 'gallic_gaesatae_rare',
    description: 'Naked Telamon-line berserkers. Lime-washed, torc-clad, the Cernunnos war-band.',
    movementProfile: 'berserker',
  },
  {
    id: 'gallic-noble-horse',
    name: 'Gallic Noble Horse',
    role: 'guard',
    stats: { atk: 150, def: 55, hp: 900, agi: 85 },
    aurumCost: 0,
    rarity: 'rare',
    spriteId: 'gallic_noble_horse_rare',
    description: 'Marcacoi — mounted aristocracy with Cernunnos stag-horns and Epona on the pelta.',
    movementProfile: 'flanker',
  },
  {
    id: 'gallic-vergobret',
    name: 'Vergobret',
    role: 'guard',
    stats: { atk: 145, def: 75, hp: 1200, agi: 50 },
    aurumCost: 0,
    rarity: 'super-rare',
    spriteId: 'gallic_vergobret_super_rare',
    description: 'The elected war-king of the Aedui — a hero-charge last line, gold-torc at the throat.',
    movementProfile: 'reserve-intercept',
  },
] as const;

/** Lookup an enemy cohort definition by id, or `undefined` if not found. */
export function getEnemyCohortById(id: string): Cohort | undefined {
  return ENEMY_COHORTS.find(c => c.id === id);
}
