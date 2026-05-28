/**
 * Iter Belli — Consilium → campaign bridge (Phase 1: mission + modifiers).
 * Pure data + helpers. The first-seated advisor's color picks a mission; the
 * other seated advisors' passives sum into starting-stat modifiers. Consumed by
 * the embark/endgame UI bridge — the Iter Belli logic module never imports this.
 */
import type { Advisor, AdvisorPassive } from '../game/council/advisor';
import { getCurrentPassive } from '../game/council/advisor';
import type { Faction } from '../game/core/commander';
import type { IterBelliState } from '../game/iterBelli/iter-belli-types';
import { SUPPLY_UPKEEP_PER_TURN, START } from '../game/iterBelli/iter-belli-balance';

export interface MissionDef {
  id: string;
  title: string;
  /** Short human-readable success condition, shown in the UI. */
  conditionDesc: string;
  /** Checked against the final campaign state; bonus granted on victory when true. */
  condition: (s: IterBelliState) => boolean;
  bonusGold: number;
}

/** Main mission by the first-seated advisor's color. Tunable. */
export const MISSIONS: Record<Faction, MissionDef> = {
  red: { id: 'asalto', title: 'Asalto', conditionDesc: 'Vence en ≤ 8 días',
    condition: (s) => s.turnNum <= 8, bonusGold: 50 },
  blue: { id: 'pax', title: 'Pax Romana', conditionDesc: 'Amenaza final ≤ 4',
    condition: (s) => s.threat <= 4, bonusGold: 50 },
  gold: { id: 'cruzada', title: 'Cruzada', conditionDesc: 'Moral final ≥ 6',
    condition: (s) => s.morale >= 6, bonusGold: 50 },
  purple: { id: 'botin', title: 'Botín', conditionDesc: 'Oro final ≥ 120',
    condition: (s) => s.gold >= 120, bonusGold: 80 },
  white: { id: 'legion', title: 'Legión Intacta', conditionDesc: 'Conserva ≥ 60% de soldados',
    condition: (s) => s.initialSoldiers > 0 && s.soldiers >= 0.6 * s.initialSoldiers, bonusGold: 50 },
};

const MISSION_BY_ID: Record<string, MissionDef> =
  Object.fromEntries(Object.values(MISSIONS).map((m) => [m.id, m]));

/** Look up a mission by id; null for null/unknown. */
export function getMissionById(id: string | null): MissionDef | null {
  return id == null ? null : (MISSION_BY_ID[id] ?? null);
}

export interface ConsiliumSetup {
  missionId: string | null;
  /** Bonus to starting supplies. */
  supplies: number;
  /** Bonus to starting gold. */
  gold: number;
  /** Amount to REDUCE starting threat by. */
  threat: number;
  /** Bonus to starting morale. */
  morale: number;
}

type SeedDeltas = Pick<ConsiliumSetup, 'supplies' | 'gold' | 'threat' | 'morale'>;

/** Total supply-upkeep budget of a campaign — the basis for upkeep-reduction bonuses. */
const UPKEEP_BUDGET = SUPPLY_UPKEEP_PER_TURN * START.timeRemaining;

/** Map one advisor passive to its starting-stat deltas (all zero if unmapped). */
export function passiveModifier(passive: AdvisorPassive): SeedDeltas {
  const z: SeedDeltas = { supplies: 0, gold: 0, threat: 0, morale: 0 };
  switch (passive.type) {
    case 'upkeep-reduction':
      return { ...z, supplies: Math.round((passive.percent / 100) * UPKEEP_BUDGET) };
    case 'threat-reduction':
      return { ...z, threat: passive.amount };
    case 'loot-bonus':
    case 'shop-discount':
      return { ...z, gold: Math.round(passive.percent / 5) };
    case 'heal-between-nodes':
      return { ...z, morale: Math.round(passive.amount / 100) };
    case 'resource-per-spoke':
      return passive.resource === 'gold' ? { ...z, gold: passive.amount } : z;
    default:
      return z; // extra-event-choices and anything else: no campaign effect
  }
}

/**
 * Resolve the seated council into a campaign setup: the first occupied slot
 * sets the mission (by color, no modifier); every other occupied slot sums its
 * passive modifier.
 */
export function computeConsiliumSetup(slots: (Advisor | null)[]): ConsiliumSetup {
  const setup: ConsiliumSetup = { missionId: null, supplies: 0, gold: 0, threat: 0, morale: 0 };
  let firstSeen = false;
  for (const advisor of slots) {
    if (!advisor) continue;
    if (!firstSeen) {
      firstSeen = true;
      setup.missionId = MISSIONS[advisor.color].id;
      continue; // first seat sets the mission only
    }
    const mod = passiveModifier(getCurrentPassive(advisor));
    setup.supplies += mod.supplies;
    setup.gold += mod.gold;
    setup.threat += mod.threat;
    setup.morale += mod.morale;
  }
  return setup;
}
