import type { ResourceType } from '../core/commander';
import { globalSeason, threatLevel } from '../core/game-state';
import { spendResource } from '../core/resources';
import type { DoctrineEffect } from '../items/doctrine';
import { getActiveEffects } from '../items/doctrine-store';
import { isUpkeepWaived, tickActiveDecretumEffects } from '../items/decretum-hub';
import { collectProvinceIncome, type ProvinceIncomeResult } from '../province/province-store';
import type { Posture } from '../council/advisor';

/** Base upkeep cost per season tick. */
export const BASE_UPKEEP: Partial<Record<ResourceType, number>> = { gold: 2, faith: 1 };

/** Additional upkeep for 'attacking' posture. */
export const ATTACKING_UPKEEP_BONUS: Partial<Record<ResourceType, number>> = { gold: 1, momentum: 1 };

/** Threat increase per season tick. */
export const THREAT_PER_SEASON = 1;

/** Result of a season tick, for the UI to display. */
export interface SeasonTickResult {
  season: number;
  globalSeason: number;
  upkeepPaid: { resource: ResourceType; amount: number }[];
  upkeepShortfall: { resource: ResourceType; deficit: number }[];
  threatIncrease: number;
  provinceIncome: ProvinceIncomeResult | null;
}

export function runSeasonTick(posture: Posture, localSeason: number): SeasonTickResult {
  const reductionPercent = getActiveEffects()
    .filter((e): e is Extract<DoctrineEffect, { type: 'upkeep-reduction'; percent: number }> => e.type === 'upkeep-reduction' && 'percent' in e)
    .reduce((sum, e) => sum + e.percent, 0);
  // A Decretum waive-upkeep zeroes upkeep this season; otherwise doctrine reduction applies.
  const reductionMultiplier = isUpkeepWaived() ? 0 : Math.max(0, 1 - reductionPercent / 100);

  const rawUpkeep: Partial<Record<ResourceType, number>> = { ...BASE_UPKEEP };
  if (posture === 'attacking') {
    for (const [res, amt] of Object.entries(ATTACKING_UPKEEP_BONUS) as [ResourceType, number][]) {
      rawUpkeep[res] = (rawUpkeep[res] ?? 0) + amt;
    }
  }

  const upkeepPaid: SeasonTickResult['upkeepPaid'] = [];
  const upkeepShortfall: SeasonTickResult['upkeepShortfall'] = [];

  for (const [res, rawAmt] of Object.entries(rawUpkeep) as [ResourceType, number][]) {
    const amount = Math.floor(rawAmt * reductionMultiplier);
    if (amount <= 0) continue;
    if (spendResource(res, amount)) {
      upkeepPaid.push({ resource: res, amount });
    } else {
      upkeepShortfall.push({ resource: res, deficit: amount });
    }
  }

  threatLevel.value += THREAT_PER_SEASON;
  globalSeason.value += 1;

  // Advance/expire continuous Decretum effects once per season.
  tickActiveDecretumEffects();

  const provinceIncome = collectProvinceIncome();

  return {
    season: localSeason,
    globalSeason: globalSeason.value,
    upkeepPaid,
    upkeepShortfall,
    threatIncrease: THREAT_PER_SEASON,
    provinceIncome,
  };
}
