import type { Cohort } from '../../army/cohort';
import type { PowerStats, EnemyArchetype, FormationDef } from './types';
import type { Legate } from '../../army/legate';
import type { FormationKey } from './types';
import { FORMATIONS, TERRAIN_CENTER, ENEMY_ARCHETYPES } from './orders';
import { ARMORS } from './balance';

export function sumRosterStats(cohorts: readonly Cohort[]): PowerStats {
  const t: PowerStats = { charge: 0, harass: 0, push: 0, siege: 0, movement: 0 };
  for (const c of cohorts) {
    t.charge += c.stats.charge; t.harass += c.stats.harass; t.push += c.stats.push;
    t.siege += c.stats.siege; t.movement += c.stats.movement;
  }
  return t;
}

export function strengthFrac(soldiers: number, initialSoldiers: number): number {
  if (initialSoldiers <= 0) return 0;
  return Math.max(0, Math.min(1, soldiers / initialSoldiers));
}

/** Campaign discipline is now native 0–10 (Thread B); just clamp into the engine range. */
export function clampEngineDiscipline(campaignDiscipline: number): number {
  return Math.max(0, Math.min(10, Math.round(campaignDiscipline)));
}

/**
 * Legate trait id → the FORMATIONS trait label that unlocks a unique formation.
 * Real trait ids from `src/game/army/legate-traits.ts`. Disciplined commanders unlock
 * the manipular Triplex; defensive/enduring ones the Testudo; aggressive/mobile ones the
 * Cuneus. The morale traits (rallying/charismatic/inspiring) gate no formation.
 */
const TRAIT_TO_FORMATION_TRAIT: Record<string, string> = {
  veteran: 'Roman Veteran',
  disciplined: 'Roman Veteran',
  tactician: 'Roman Veteran',
  cautious: 'Engineer',
  stoic: 'Engineer',
  aggressive: 'Shock',
  swift: 'Shock',
};

export function legateFormationKeys(legate: Legate | null): FormationKey[] {
  const unlockedTraits = new Set(
    (legate?.traitIds ?? []).map((id) => TRAIT_TO_FORMATION_TRAIT[id]).filter(Boolean) as string[],
  );
  return (Object.keys(FORMATIONS) as FormationKey[]).filter((k) => {
    const f = FORMATIONS[k];
    return f.kind === 'common' || (f.trait != null && unlockedTraits.has(f.trait));
  });
}

export function terrainToCenterKey(terrain: string): string {
  return TERRAIN_CENTER[terrain] ?? 'plain';
}

/** Formations the player can field now: from the legate AND within engine discipline. */
export function availableFormations(legate: Legate | null, engineDiscipline: number): FormationKey[] {
  return legateFormationKeys(legate).filter((k) => engineDiscipline >= FORMATIONS[k].disc);
}

/** Minimal shape this adapter reads from the campaign — keeps it decoupled from the full state type. */
export interface CampaignSnapshot { soldiers: number; initialSoldiers: number; morale: number; discipline: number; }

export interface PlayerSeed {
  hp: number; morale: number; discipline: number;
  stats: PowerStats; armorPct: number; armorName: string; ammo: number;
  formation: FormationDef;
}

const ENEMY_WEAKEN_PER_POINT = 0.07; // mirrors iter-belli-balance

export function buildPlayerSeed(
  snap: CampaignSnapshot, roster: readonly Cohort[], legate: Legate | null,
  formation: FormationDef = FORMATIONS.battleLine,
  armor: { material: keyof typeof ARMORS } | null = null,
  ammunition = 32,
): PlayerSeed {
  void legate; // formation chosen separately; legate gates that choice upstream
  const frac = strengthFrac(snap.soldiers, snap.initialSoldiers);
  const raw = sumRosterStats(roster);
  const material = armor?.material ?? 'iron';
  return {
    hp: Math.max(1, Math.round(snap.soldiers)),
    morale: snap.morale,
    discipline: clampEngineDiscipline(snap.discipline),
    stats: {
      charge: Math.round(raw.charge * frac),
      harass: Math.round(raw.harass * frac),
      push: Math.round(raw.push * frac),
      siege: Math.round(raw.siege * frac),
      movement: raw.movement, // maneuver not scaled by attrition
    },
    armorPct: ARMORS[material],
    armorName: material.charAt(0).toUpperCase() + material.slice(1),
    ammo: ammunition,
    formation,
  };
}

export function buildEnemyArchetype(key: string, enemyWeaken: number, soldiers: number): EnemyArchetype {
  const base = ENEMY_ARCHETYPES[key] ?? ENEMY_ARCHETYPES.carthage;
  const frac = Math.max(0.2, 1 - enemyWeaken * ENEMY_WEAKEN_PER_POINT);
  return {
    ...base,
    hp: Math.max(1, Math.round(soldiers)),
    stats: {
      charge: Math.round(base.stats.charge * frac),
      harass: Math.round(base.stats.harass * frac),
      push: Math.round(base.stats.push * frac),
      siege: Math.round(base.stats.siege * frac),
      movement: base.stats.movement,
    },
  };
}
