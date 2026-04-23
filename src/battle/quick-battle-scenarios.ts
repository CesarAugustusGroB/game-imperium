import { signal } from '@preact/signals';
import { COHORT_CATALOG, GALLIC_COHORT_POOL } from '../game/army/cohort-data';
import { ENEMY_COHORTS } from '../game/army/enemy-cohort-data';
import type { Cohort } from '../types/index';

export interface QuickBattleScenario {
  id: string;
  label: string;
  blueName: string;
  redName: string;
  buildBlueCohorts(): Cohort[];
  buildRedCohorts(): Cohort[];
}

function getCohort(id: string): Cohort {
  const c = COHORT_CATALOG.find(x => x.id === id);
  if (!c) throw new Error(`Quick-battle: unknown COHORT_CATALOG id "${id}"`);
  return c;
}

function getGallicCohort(id: string): Cohort {
  const c = GALLIC_COHORT_POOL.find(x => x.id === id);
  if (!c) throw new Error(`Quick-battle: unknown GALLIC_COHORT_POOL id "${id}"`);
  return c;
}

function getEnemyCohort(id: string): Cohort {
  const c = ENEMY_COHORTS.find(x => x.id === id);
  if (!c) throw new Error(`Quick-battle: unknown ENEMY_COHORTS id "${id}"`);
  return c;
}

const ATHENIAN_HOPLITE: Cohort = {
  id: 'athenian-hoplite',
  name: 'Athenian Hoplite',
  role: 'vanguard',
  stats: { atk: 125, def: 72, hp: 1050, agi: 38 },
  aurumCost: 0,
  description: 'Citizen hoplite of Athens. Heavy spear and aspis, close phalanx.',
  spriteId: 'athens_hoplite_uncommon',
  movementProfile: 'vanguard-march',
};

const ATHENIAN_EPILEKTOS: Cohort = {
  id: 'athenian-epilektos',
  name: 'Athenian Epilektos',
  role: 'guard',
  stats: { atk: 145, def: 85, hp: 1400, agi: 30 },
  aurumCost: 0,
  description: 'Select corps of Athens. The heavy rear rank who anchor the phalanx wall.',
  spriteId: 'athen_hoplite_elite_super_rare',
  movementProfile: 'guard-stand',
};

export const QUICK_BATTLE_SCENARIOS: readonly QuickBattleScenario[] = [
  {
    id: 'rome-vs-athens',
    label: 'Rome vs Athens',
    blueName: 'Legio Romana',
    redName: 'Polemos Hellenos',
    buildBlueCohorts: () => {
      const velites   = getCohort('velites');
      const hastati   = getCohort('hastati');
      const principes = getCohort('principes');
      const triarii   = getCohort('triarii');
      const equites   = getCohort('equites');
      return [
        ...Array(8).fill(velites),
        ...Array(12).fill(hastati),
        ...Array(10).fill(principes),
        ...Array(6).fill(triarii),
        ...Array(4).fill(equites),
      ];
    },
    buildRedCohorts: () => {
      const cretan = getCohort('cretan_archer');
      const hetairoi: Cohort = { ...getEnemyCohort('makedon-hetairoi'), movementProfile: 'flanker' };
      return [
        ...Array(8).fill(cretan),
        ...Array(12).fill(ATHENIAN_HOPLITE),
        ...Array(12).fill(ATHENIAN_EPILEKTOS),
        ...Array(8).fill(hetairoi),
      ];
    },
  },
  {
    id: 'rome-vs-gaul',
    label: 'Rome vs Gaul',
    blueName: 'Legio Romana',
    redName: 'Teuta Galliae',
    buildBlueCohorts: () => {
      const militia   = getCohort('militia');
      const velites   = getCohort('velites');
      const hastati   = getCohort('hastati');
      const principes = getCohort('principes');
      const triarii   = getCohort('triarii');
      const equites   = getCohort('equites');
      return [
        ...Array(6).fill(velites),    // skirmisher screen
        ...Array(6).fill(militia),    // civic levy front
        ...Array(10).fill(hastati),   // 1st heavy line
        ...Array(8).fill(principes),  // 2nd heavy line
        ...Array(4).fill(triarii),    // last-resort reserve
        ...Array(6).fill(equites),    // cavalry wings
      ]; // 40
    },
    buildRedCohorts: () => {
      const neitos     = getGallicCohort('neitos');
      const clansmen   = getGallicCohort('clansmen');
      const warband    = getGallicCohort('warband');
      const gaesatae   = getGallicCohort('gaesatae');
      const vergobret  = getGallicCohort('vergobret');
      const nobleHorse = getGallicCohort('noble_horse');
      return [
        ...Array(6).fill(neitos),      // javelineer screen
        ...Array(8).fill(clansmen),    // teuta levy
        ...Array(10).fill(warband),    // cingeti warband core
        ...Array(6).fill(gaesatae),    // naked berserker elite
        ...Array(4).fill(vergobret),   // war-king reserve
        ...Array(6).fill(nobleHorse),  // marcacoi cavalry wings
      ]; // 40
    },
  },
] as const;

export const DEFAULT_QUICK_BATTLE_SCENARIO_ID = 'rome-vs-athens';

export const selectedQuickBattleScenarioId = signal<string>(DEFAULT_QUICK_BATTLE_SCENARIO_ID);

export function getQuickBattleScenario(id: string): QuickBattleScenario {
  return QUICK_BATTLE_SCENARIOS.find(s => s.id === id) ?? QUICK_BATTLE_SCENARIOS[0];
}
