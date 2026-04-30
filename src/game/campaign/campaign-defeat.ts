import { signal } from '@preact/signals';
import type { CampaignState } from './campaign-types';
import { preparedArmy } from '../progression/strategic-store';

export type BellumDefeatReason =
  | 'morale-collapse'
  | 'starvation-collapse'
  | 'army-wiped';

export type BellumWarningState = {
  zeroSupplyMoveStreak: number;
  starvationWarning: boolean;
  moraleCritical: boolean;
  armyWiped: boolean;
};

export type BellumDefeatEvaluation = {
  defeated: boolean;
  triggered: boolean;
  reason: BellumDefeatReason | null;
  warning: BellumWarningState;
};

export const BELLUM_ZERO_SUPPLY_WARNING_THRESHOLD = 1;
export const BELLUM_ZERO_SUPPLY_DEFEAT_THRESHOLD = 3;
export const BELLUM_MORALE_WARNING_THRESHOLD = 20;

const EMPTY_WARNING: BellumWarningState = {
  zeroSupplyMoveStreak: 0,
  starvationWarning: false,
  moraleCritical: false,
  armyWiped: false,
};

export const bellumWarningState = signal<BellumWarningState>({ ...EMPTY_WARNING });
export const bellumDefeatReason = signal<BellumDefeatReason | null>(null);

let navigateToDefeat: (() => void) | null = null;

export function setBellumDefeatNavigation(fn: (() => void) | null): void {
  navigateToDefeat = fn;
}

export function resetBellumDefeatState(): void {
  bellumWarningState.value = { ...EMPTY_WARNING };
  bellumDefeatReason.value = null;
}

export function evaluateBellumDefeat(
  state: CampaignState,
  opts?: {
    countZeroSupplyMove?: boolean;
    checkArmy?: boolean;
  },
): BellumDefeatEvaluation {
  const countZeroSupplyMove = opts?.countZeroSupplyMove === true;
  const checkArmy = opts?.checkArmy === true;

  const zeroSupplyMoveStreak = state.supplies > 0
    ? 0
    : bellumWarningState.value.zeroSupplyMoveStreak + (countZeroSupplyMove ? 1 : 0);

  const armyWiped = checkArmy ? isPreparedArmyWiped() : bellumWarningState.value.armyWiped;
  const warning: BellumWarningState = {
    zeroSupplyMoveStreak,
    starvationWarning: zeroSupplyMoveStreak >= BELLUM_ZERO_SUPPLY_WARNING_THRESHOLD,
    moraleCritical: state.morale > 0 && state.morale <= BELLUM_MORALE_WARNING_THRESHOLD,
    armyWiped,
  };
  bellumWarningState.value = warning;

  if (state.morale <= 0) return triggerBellumDefeat('morale-collapse', warning);
  if (zeroSupplyMoveStreak >= BELLUM_ZERO_SUPPLY_DEFEAT_THRESHOLD) {
    return triggerBellumDefeat('starvation-collapse', warning);
  }
  if (armyWiped) return triggerBellumDefeat('army-wiped', warning);

  return {
    defeated: bellumDefeatReason.value !== null,
    triggered: false,
    reason: bellumDefeatReason.value,
    warning,
  };
}

function triggerBellumDefeat(
  reason: BellumDefeatReason,
  warning: BellumWarningState,
): BellumDefeatEvaluation {
  if (bellumDefeatReason.value !== null) {
    return {
      defeated: true,
      triggered: false,
      reason: bellumDefeatReason.value,
      warning,
    };
  }

  bellumDefeatReason.value = reason;
  navigateToDefeat?.();

  return {
    defeated: true,
    triggered: true,
    reason,
    warning,
  };
}

function isPreparedArmyWiped(): boolean {
  const cohorts = preparedArmy.value?.cohorts;
  if (!cohorts) return false;
  if (cohorts.length === 0) return true;
  return cohorts.every((cohort) => cohort.outOfAction === true);
}
