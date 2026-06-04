/**
 * Iter Belli — Consilium → campaign bridge (Phase 1: mission + modifiers).
 * Pure data + helpers. The first-seated advisor's color picks a mission; the
 * other seated advisors' passives sum into starting-stat modifiers. Consumed by
 * the embark/endgame UI bridge — the Iter Belli logic module never imports this.
 */
import type { Advisor, AdvisorPassive } from '../game/council/advisor';
import { getCurrentPassive } from '../game/council/advisor';
import type { Faction, ResourceType } from '../game/core/commander';
import type { IterBelliState, SecondaryQuest } from '../game/iterBelli/iter-belli-types';
import { SUPPLY_UPKEEP_PER_TURN, START, QUEST_WINDOW_BASE } from '../game/iterBelli/iter-belli-balance';
import { SECONDARY_QUESTS } from './iter-belli-quests';
import type { QuestColor } from './iter-belli-quests';

export interface MissionDef {
  id: string;
  title: string;
  /** Short human-readable success condition, shown in the UI. */
  conditionDesc: string;
  /** Optional structured resource condition for icon-rich UI surfaces. */
  conditionResource?: {
    lead: string;
    type: Extract<ResourceType, 'gold' | 'iuniores'>;
    amount: number;
    tail: string;
  };
  /** Checked against the final campaign state; bonus granted on victory when true. */
  condition: (s: IterBelliState) => boolean;
  bonusGold: number;
}

/** Main mission by the first-seated advisor's color. Tunable. */
export const MISSIONS: Record<Faction, MissionDef> = {
  red: { id: 'asalto', title: 'Asalto', conditionDesc: 'Vence en ocho días o menos',
    condition: (s) => s.turnNum <= 8, bonusGold: 50 },
  blue: { id: 'pax', title: 'Pax Romana', conditionDesc: 'Termina con cuatro puntos de amenaza o menos',
    condition: (s) => s.threat <= 4, bonusGold: 50 },
  gold: { id: 'cruzada', title: 'Cruzada', conditionDesc: 'Termina con seis puntos de moral o más',
    condition: (s) => s.morale >= 6, bonusGold: 50 },
  purple: {
    id: 'botin',
    title: 'Botín',
    conditionDesc: 'Termina con 120 de oro o más',
    conditionResource: { lead: 'Termina con', type: 'gold', amount: 120, tail: 'o más' },
    condition: (s) => s.gold >= 120, bonusGold: 80 },
  white: { id: 'legion', title: 'Legión Intacta', conditionDesc: 'Conserva al menos el 60% de tus soldados',
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
  /** Erosion of the final enemy army (each point ≈ −7% effectives). */
  enemyWeaken: number;
  /** Extra campaign days added to the starting clock. */
  extraDays: number;
  /** Bonus to starting soldiers. */
  soldiers: number;
}

type SeedDeltas = Pick<ConsiliumSetup, 'supplies' | 'gold' | 'threat' | 'morale' | 'enemyWeaken' | 'extraDays' | 'soldiers'>;

/** Total supply-upkeep budget of a campaign — the basis for upkeep-reduction bonuses. */
const UPKEEP_BUDGET = SUPPLY_UPKEEP_PER_TURN * START.timeRemaining;

/** Gold granted per extra-event-choice (advisor passive has no event system to widen). */
const EVENT_CHOICE_GOLD = 5;

/** Map one advisor passive to its starting-stat deltas (all zero if unmapped). */
export function passiveModifier(passive: AdvisorPassive): SeedDeltas {
  const z: SeedDeltas = { supplies: 0, gold: 0, threat: 0, morale: 0, enemyWeaken: 0, extraDays: 0, soldiers: 0 };
  switch (passive.type) {
    case 'upkeep-reduction':
      return { ...z, supplies: Math.round((passive.percent / 100) * UPKEEP_BUDGET) };
    case 'threat-reduction':
      return { ...z, threat: passive.amount };
    case 'loot-bonus':
      return { ...z, gold: Math.round(passive.percent / 5) };
    case 'heal-between-nodes':
      return { ...z, morale: Math.round(passive.amount / 100) };
    case 'resource-per-spoke':
      // Deprecated resources (faith/influence/momentum) fold into gold.
      return { ...z, gold: passive.amount };
    case 'extra-event-choices':
      return { ...z, gold: passive.count * EVENT_CHOICE_GOLD };
    case 'enemy-weaken':
      return { ...z, enemyWeaken: passive.amount };
    case 'campaign-time':
      return { ...z, extraDays: passive.days };
    case 'morale-bonus':
      return { ...z, morale: passive.amount };
    case 'soldiers-bonus':
      return { ...z, soldiers: passive.amount };
    default:
      // shop-discount no longer seeds gold — it now applies as a real Hub discount.
      return z;
  }
}

/**
 * Resolve the seated council into a campaign setup: the first occupied slot
 * sets the mission (by color); EVERY occupied slot — including the first — sums
 * its passive modifier. (The first advisor's passive used to be silently
 * dropped, so seating your best advisor in slot 0 quietly cost you its embark
 * bonus while the hero card still advertised it.)
 */
export function computeConsiliumSetup(slots: (Advisor | null)[]): ConsiliumSetup {
  const setup: ConsiliumSetup = { missionId: null, supplies: 0, gold: 0, threat: 0, morale: 0, enemyWeaken: 0, extraDays: 0, soldiers: 0 };
  let firstSeen = false;
  for (const advisor of slots) {
    if (!advisor) continue;
    if (!firstSeen) {
      firstSeen = true;
      setup.missionId = MISSIONS[advisor.color].id; // first seat also picks the mission
    }
    const mod = passiveModifier(getCurrentPassive(advisor));
    setup.supplies += mod.supplies;
    setup.gold += mod.gold;
    setup.threat += mod.threat;
    setup.morale += mod.morale;
    setup.enemyWeaken += mod.enemyWeaken;
    setup.extraDays += mod.extraDays;
    setup.soldiers += mod.soldiers;
  }
  return setup;
}

/** Mid-campaign locations a secondary quest can bind to (no start/final stop). */
const QUEST_LOCATIONS = ['tarraco', 'llanura', 'bosques'] as const;

/**
 * Resolve the seated council into secondary quests: the first occupied slot is
 * the mission seat (no quest); every other occupied slot seeds one quest, themed
 * by color, windowed by advisor tier, bound to a random distinct mid-location.
 */
export function computeSecondaryQuests(slots: (Advisor | null)[]): SecondaryQuest[] {
  const quests: SecondaryQuest[] = [];
  const available: string[] = [...QUEST_LOCATIONS];
  let firstSeen = false;
  let seatIdx = -1;
  for (const advisor of slots) {
    seatIdx++;
    if (!advisor) continue;
    if (!firstSeen) { firstSeen = true; continue; } // first occupied seat = mission
    if (available.length === 0) break;
    const color = advisor.color as QuestColor;
    const window = QUEST_WINDOW_BASE + (advisor.currentTier - 1);
    const pick = Math.floor(Math.random() * available.length);
    const locationId = available.splice(pick, 1)[0];
    quests.push({
      id: `quest_${color}_${seatIdx}`,
      color,
      title: SECONDARY_QUESTS[color].title,
      locationId,
      window,
      status: 'pending',
    });
  }
  return quests;
}
