import type { Cohort } from '../../army/cohort';
import type { PowerStats } from './types';
import type { Legate } from '../../army/legate';
import type { FormationKey } from './types';
import { FORMATIONS, TERRAIN_CENTER } from './orders';

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

/** STOPGAP: campaign discipline is 1–5; engine wants 0–10. ×2 until Thread B migrates the scale. */
export function scaleDiscipline(campaignDiscipline: number): number {
  return Math.max(0, Math.min(10, Math.round(campaignDiscipline * 2)));
}

/** Legate trait id → the FORMATIONS trait label that unlocks a unique formation. */
const TRAIT_TO_FORMATION_TRAIT: Record<string, string> = {
  veteran: 'Roman Veteran',
  engineer: 'Engineer',
  shock: 'Shock',
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
