/**
 * campaign-conflicts.ts — detect, at embark, which HUB tensions are eligible to
 * surface as a campaign event (D10 step 2).
 *
 * Pure and read-only: it takes a snapshot of the hub (owned provinces + seated
 * advisors) and returns the CampaignConflict candidates, highest severity first.
 * The events module never writes to the hub — only applyCampaignEventOutcomes
 * (step 6) does, on return to the Forum. Deterministic (no RNG) so the controller
 * picks from a stable, ranked list.
 */
import type { Province } from '../province/province';
import type { Advisor } from '../council/advisor';
import type { CampaignConflict } from './campaign-events-types';

/** A province at or above this unrest (0–100) is restless enough to spawn a conflict. */
export const PROVINCE_UNREST_THRESHOLD = 40;

/**
 * Detect eligible conflicts from a hub snapshot.
 *
 * - Province: any owned province with unrest ≥ PROVINCE_UNREST_THRESHOLD; the
 *   unrest value is the severity.
 * - Advisor: a divided council — seated advisors spanning ≥2 distinct colors —
 *   fronted by its highest-tier member (the ambitious rival).
 */
export function detectCampaignConflicts(
  provinces: readonly Province[],
  seatedAdvisors: readonly Advisor[],
): CampaignConflict[] {
  const conflicts: CampaignConflict[] = [];

  for (const p of provinces) {
    if (p.unrest >= PROVINCE_UNREST_THRESHOLD) {
      conflicts.push({
        id: `province:${p.id}`,
        source: 'province',
        sourceId: p.id,
        sourceName: p.name,
        severity: Math.round(p.unrest),
      });
    }
  }

  if (new Set(seatedAdvisors.map((a) => a.color)).size >= 2) {
    // Front the rivalry with the highest-tier seated advisor (tie → first seated).
    const rival = seatedAdvisors.reduce(
      (best, a) => (a.currentTier > best.currentTier ? a : best),
      seatedAdvisors[0],
    );
    conflicts.push({
      id: `advisor:${rival.id}`,
      source: 'advisor',
      sourceId: rival.id,
      sourceName: rival.name,
      severity: 40 + rival.currentTier * 15,
    });
  }

  // Highest severity first — the controller surfaces the sharpest tension.
  return conflicts.sort((a, b) => b.severity - a.severity);
}
