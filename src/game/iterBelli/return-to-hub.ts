/**
 * return-to-hub.ts — settle a finished Iter Belli campaign back into the run (D32).
 *
 * Extracted from EndgameCard's UI handler so the critical campaign→hub path is
 * unit-testable in isolation. This module owns the GAME side effects only:
 *  • campaign gold (+ mission bonus) and iuniores flow back to run resources,
 *  • the season clock advances and provinces/allies accrue per-season income,
 *  • telemetry is logged,
 *  • on victory: completedSpokes/battlesWon bump, a province is conquered, a
 *    doctrine draft rolls, and the next scenario unlocks,
 *  • surviving soldiers scale each cohort's HP; leftover supplies carry back,
 *  • seated advisors earn XP, and the queued campaign-event write-backs (D10) drain,
 *  • the campaign engine resets.
 *
 * Navigation (navigateTo) and the unlock NOTIFICATION stay in the UI: the function
 * returns the unlocked scenario id so the caller can announce it — keeping this
 * module free of any UI-layer import.
 */
import { iterBelliState, resetIterBelli } from './iter-belli-state';
import { getActiveScenario, unlockNextScenario } from './iter-belli-scenario';
import { SUPPLY_MAX_CARRY } from '../../config/game-config';
import { gold, iuniores } from '../core/resources';
import { completedSpokes, battlesWon, globalSeason, MAX_SEASONS, selectedCommander } from '../core/game-state';
import { recordCampaignLog } from '../core/meta-save';
import { snapshotCampaignTelemetry } from '../progression/run-telemetry';
import { preparedArmy } from '../progression/strategic-store';
import { collectAllyIncome } from '../progression/ally-store';
import { computeArmySize } from '../army/cohort';
import { conquerProvince, provinces, collectProvinceIncome } from '../province/province-store';
import { councilSlots, grantAdvisorXp } from '../council/council-store';
import { applyCampaignEventOutcomes } from '../events/apply-outcomes';
import { pickConquestName, PROVINCE_REWARD } from '../../data/iter-belli-conquest';
import { getMissionById } from '../../data/iter-belli-consilium';
import { rollDoctrineDraft } from '../items/doctrine-store';
import type { TerrainType } from '../../data/terrain-data';
import type { ResourceType } from '../core/commander';

export interface ReturnResult {
  /** No active outcome → nothing settled (already returned). The caller bails. */
  alreadyReturned: boolean;
  victory: boolean;
  /** Scenario unlocked by this victory — the UI announces it. null when none. */
  unlockedScenarioId: string | null;
}

/**
 * Settle the finished campaign back into the run. NOT idempotent: it overwrites
 * hub resources from the campaign snapshot, advances the season, collects income
 * and conquers a province, and ends by resetting the engine (nulling the outcome).
 * A null outcome only ever means "already returned" — so re-entry is a safe no-op.
 */
export function returnFromCampaign(): ReturnResult {
  const s = iterBelliState.value;
  const outcome = s.outcome;
  if (!outcome) return { alreadyReturned: true, victory: false, unlockedScenarioId: null };

  // Consilium mission: on victory, a met condition grants a gold bonus.
  const mission = getMissionById(s.missionId);
  const missionAccomplished = !!(outcome.victory && mission && mission.condition(s));
  gold.value = s.gold + (mission && missionAccomplished ? mission.bonusGold : 0);
  iuniores.value = s.iuniores;

  // Season clock advances regardless of outcome — campaign time elapsed.
  globalSeason.value = Math.min(MAX_SEASONS, globalSeason.value + s.spokeDuration);
  // Provinces accrue income/ticks for each season spent on campaign.
  for (let i = 0; i < s.spokeDuration; i++) collectProvinceIncome();
  // Forged allies pledge their season tribute (tribes → iuniores, kingdoms → gold).
  for (let i = 0; i < s.spokeDuration; i++) collectAllyIncome();

  // Telemetry (plan S-J): log this campaign's outcome + tallies for balance analysis.
  const cmd = selectedCommander.value;
  if (cmd) {
    const tel = snapshotCampaignTelemetry();
    recordCampaignLog({
      date: new Date().toISOString(),
      commanderId: cmd.id,
      commanderName: cmd.name,
      scenarioId: getActiveScenario().id,
      outcome: outcome.victory ? 'victory' : 'defeat',
      cause: outcome.text,
      seasonsAtEnd: globalSeason.value,
      daysUsed: outcome.turnNum,
      finalGold: gold.value,
      finalIuniores: iuniores.value,
      survivors: outcome.soldiers,
      cardsPlayed: tel.cardsPlayed,
      ordersUsed: tel.ordersUsed,
    });
  }

  let unlockedScenarioId: string | null = null;
  if (outcome.victory) {
    completedSpokes.value++;
    battlesWon.value++;             // the decisive battle was won

    // Conquer a province: terrain from the spoke theme, random unused name, fixed income.
    const taken = new Set(provinces.value.map((p) => p.name));
    const name = pickConquestName(taken, getActiveScenario().conquestNames);
    conquerProvince(name, PROVINCE_REWARD as Record<ResourceType, number>, 1, {
      terrain: s.spokeTerrain as TerrainType,
    });

    // The Senate rewards the triumph: a doctrine draft awaits at the Forum.
    rollDoctrineDraft();

    // Winning a campaign unlocks the next one in the progression.
    unlockedScenarioId = unlockNextScenario(getActiveScenario().id);
  }

  const army = preparedArmy.value;
  if (army) {
    // Surviving soldiers scale each cohort's HP (dead cohorts drop out).
    // When initialSoldiers is 0 (degenerate launch), cohorts pass through unmodified.
    let cohorts = army.cohorts;
    if (s.initialSoldiers > 0) {
      const ratio = Math.max(0, Math.min(1, s.soldiers / s.initialSoldiers));
      cohorts = army.cohorts
        .map((c) => {
          const cur = c.currentHp ?? c.stats.hp;
          const scaled = Math.round(cur * ratio);
          return { ...c, currentHp: scaled, outOfAction: scaled <= 0 };
        })
        .filter((c) => (c.currentHp ?? 0) > 0);
    }
    // Unified supplies: leftover campaign supplies flow back, capped at the Hub carry cap.
    preparedArmy.value = {
      ...army,
      cohorts,
      size: computeArmySize(cohorts),
      supplies: Math.max(0, Math.min(SUPPLY_MAX_CARRY, s.supplies)),
    };
  }

  // Seated advisors earn XP for serving the campaign: +1 for completing it,
  // +1 more on victory. grantAdvisorXp auto-tiers-up and fires the promotion toast.
  const xpPerAdvisor = 1 + (outcome.victory ? 1 : 0);
  const seatedIds = councilSlots.value.flatMap((a) => (a ? [a.id] : []));
  for (const id of seatedIds) grantAdvisorXp(id, xpPerAdvisor);

  // Drain any campaign-event choices queued this march into the hub (D10).
  applyCampaignEventOutcomes();

  resetIterBelli();
  return { alreadyReturned: false, victory: outcome.victory, unlockedScenarioId };
}
