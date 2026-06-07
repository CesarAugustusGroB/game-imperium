import type { Cohort } from '../../army/cohort';
import type { PowerStats } from './types';

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
