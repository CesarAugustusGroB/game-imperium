import { getCohortById } from '../src/game/army/cohort-data';
import {
  healCohortInRoster,
  previewHubReplenishment,
  replenishHubRoster,
} from '../src/game/army/army-replenishment';
import type { Cohort } from '../src/game/army/cohort';
import { initResources, iuniores } from '../src/game/core/resources';
import { preparedArmy } from '../src/game/progression/strategic-store';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function cloneCohort(id: string, patch: Partial<Cohort> = {}): Cohort {
  const cohort = getCohortById(id);
  assert(cohort, `Missing cohort ${id}`);
  return { ...cohort, ...patch };
}

const damagedCitizen = cloneCohort('hastati', { currentHp: 500 });
const nearFullCitizen = cloneCohort('hastati', { currentHp: 990 });
const eliteCitizen = cloneCohort('triarii', { currentHp: 650 });
const mercenary = cloneCohort('cretan_archer', { mercenary: true, currentHp: 250 });
const outOfActionCitizen = cloneCohort('hastati', { currentHp: 1, outOfAction: true });

const preview = previewHubReplenishment(
  [damagedCitizen, nearFullCitizen, eliteCitizen, mercenary],
  700,
);

assert(preview.perCohort.length === 3, 'Hub preview should exclude mercenaries');
assert(preview.perCohort[0].iunioresToFullHeal === 10, '99% HP cohort should cost exactly 10 iuniores');
assert(preview.perCohort[1].iunioresToFullHeal === 500, '50% HP / 1000 max cohort should cost exactly 500 iuniores');
assert(preview.perCohort[2].iunioresToFullHeal === 500, '50% HP / 2000 max cohort should cost exactly 500 iuniores');
assert(preview.iunioresSpent === 700, 'Bulk preview should spend the entire available pool when demand exceeds it');
assert(preview.perCohort[2].hpRestored === 247, 'Bulk preview should partially heal the next cheapest cohort when iuniores runs dry');
assert(preview.nextCohorts[3].currentHp === 250, 'Mercenary cohorts should remain unchanged in hub preview');

preparedArmy.value = {
  id: 0,
  owner: 'rome',
  name: 'Legio I',
  size: damagedCitizen.stats.hp + mercenary.stats.hp + outOfActionCitizen.stats.hp,
  cohorts: [damagedCitizen, mercenary, outOfActionCitizen],
  legateId: null,
  supplies: 0,
  provinceIndex: 0,
  targetProvinceIndex: null,
  progress: 0,
  path: [],
  inCombat: false,
  combatTarget: null,
  lastRoll: 0,
};

initResources({ gold: 0, faith: 0, influence: 0, momentum: 0, iuniores: 300 });

const healedSingle = healCohortInRoster(2);
assert(healedSingle, 'Single-cohort heal should succeed for a damaged citizen cohort');
assert(iuniores.value === 0, 'Single-cohort heal should spend the entire available amount when short of a full heal');
assert(preparedArmy.value?.cohorts[2].outOfAction !== true, 'Healing should clear outOfAction automatically');
assert((preparedArmy.value?.cohorts[2].currentHp ?? 0) > 1, 'Healing should increase HP above the out-of-action floor');

initResources({ gold: 0, faith: 0, influence: 0, momentum: 0, iuniores: 500 });
const hubSummary = replenishHubRoster();
assert(hubSummary !== null, 'Bulk hub replenishment should return a summary when a roster exists');
assert(iuniores.value === 0, 'Bulk hub replenishment should spend the funded iuniores');
assert(preparedArmy.value?.cohorts[0].currentHp === undefined, 'Fully healed cohort should drop currentHp override');
assert(preparedArmy.value?.cohorts[1].currentHp === 250, 'Mercenary cohort should still be untouched by citizen replenishment');

preparedArmy.value = null;

console.log('verify-hub-replenishment: ok');
