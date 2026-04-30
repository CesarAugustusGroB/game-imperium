import { MAX_SEASONS, globalSeason } from '../core/game-state';
import type { ResourceType } from '../core/commander';
import type { Posture } from '../council/advisor';
import { runSeasonTick, type SeasonTickResult } from '../progression/season-tick';
import { refreshMovementPoints } from './campaign-state';

export type BellumSeasonTickResult = SeasonTickResult & {
  finalInvasionReady: boolean;
};

export function advanceBellumSeason(posture: Posture = 'attacking'): BellumSeasonTickResult {
  const result = runSeasonTick(posture, globalSeason.value + 1);
  refreshMovementPoints();

  return {
    ...result,
    finalInvasionReady: result.globalSeason >= MAX_SEASONS,
  };
}

export function formatResourceList(items: { resource: ResourceType; amount?: number; deficit?: number }[]): string {
  if (items.length === 0) return 'none';
  return items.map((item) => `${item.amount ?? item.deficit ?? 0} ${item.resource}`).join(', ');
}
