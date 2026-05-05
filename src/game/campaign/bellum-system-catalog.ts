import { MAX_SEASONS } from '../core/game-state';
import type { ResourceType } from '../core/commander';
import type { EncounterType } from '../progression/landmark-types';
import type { SpokeEffect } from '../progression/spoke-effects';
import type { TerrainType } from './campaign-types';
import { CAMPAIGN_MOVEMENT_POINTS_MAX, getMoraleDelta } from './campaign-balance';
import { BELLUM_ENCOUNTER_TABLE, HEX_BATTLE_OUTCOME_EFFECTS } from './encounter-effects-data';
import { getMovementCost } from './terrain';

const TERRAIN_ORDER: readonly TerrainType[] = [
  'camp',
  'road',
  'plains',
  'forest',
  'hills',
  'river',
  'ruins',
  'mountains',
];

const ENCOUNTER_ORDER: readonly EncounterType[] = [
  'rest',
  'forage',
  'merchant',
  'event',
  'scout',
  'recruit',
  'hazard',
  'ambush',
  'battle',
  'elite_battle',
  'boss',
  'siege',
  'unknown',
];

export type BellumTerrainRule = {
  terrain: TerrainType;
  movementCost: number;
  moraleDelta: number;
  blocked: boolean;
};

export type BellumEncounterRule = {
  encounter: EncounterType;
  actions: number;
  launchesBattle: boolean;
  refreshesMovement: boolean;
  effects: string[];
};

export type BellumBattleOutcomeRule = {
  outcome: string;
  effects: string[];
};

export type BellumSystemCatalog = {
  clock: {
    maxSeasons: number;
    movementPointsPerSeason: number;
    seasonTrigger: string;
    finalInvasion: string;
  };
  terrains: BellumTerrainRule[];
  encounters: BellumEncounterRule[];
  battleOutcomes: BellumBattleOutcomeRule[];
  defeatChecks: string[];
  stateStores: string[];
};

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

function effectSummary(effect: SpokeEffect): string {
  switch (effect.type) {
    case 'morale':
      return `${signed(effect.delta)} morale`;
    case 'supplies':
      return `${signed(effect.delta)} supplies`;
    case 'iuniores':
      return `${signed(effect.delta)} iuniores`;
    case 'threat':
      return `${signed(effect.delta)} Doom`;
    case 'reveal':
      return `reveal r${effect.radius}`;
    case 'scout':
      return `scout r${effect.radius} L${effect.toLevel}`;
    case 'battle-modifier':
      return `battle mod: ${effect.modifierId}`;
  }
}

function summarizeEffects(effects: readonly SpokeEffect[]): string[] {
  if (effects.length === 0) return ['no direct state change'];
  return effects.map(effectSummary);
}

function summarizeEncounter(encounter: EncounterType): BellumEncounterRule {
  const actions = BELLUM_ENCOUNTER_TABLE[encounter] ?? [];
  const effects = actions.flatMap((action) => summarizeEffects(action.effects));
  return {
    encounter,
    actions: actions.length,
    launchesBattle: actions.some((action) => action.launchesBattle === true),
    refreshesMovement: actions.some((action) => action.refreshesMovement === true),
    effects: Array.from(new Set(effects)),
  };
}

export function createBellumSystemCatalog(): BellumSystemCatalog {
  return {
    clock: {
      maxSeasons: MAX_SEASONS,
      movementPointsPerSeason: CAMPAIGN_MOVEMENT_POINTS_MAX,
      seasonTrigger: 'When march points hit 0, Bellum runs the canonical season tick.',
      finalInvasion: 'At the season cap, Bellum launches a boss battle; victory is awarded only after winning it.',
    },
    terrains: TERRAIN_ORDER.map((terrain) => ({
      terrain,
      movementCost: getMovementCost(terrain),
      moraleDelta: getMoraleDelta(terrain),
      blocked: getMovementCost(terrain) >= 999,
    })),
    encounters: ENCOUNTER_ORDER.map(summarizeEncounter),
    battleOutcomes: Object.entries(HEX_BATTLE_OUTCOME_EFFECTS).map(([outcome, effects]) => ({
      outcome,
      effects: summarizeEffects(effects),
    })),
    defeatChecks: [
      'Morale collapse: computed Bellum morale <= 0.',
      'Starvation collapse: 3 zero-supply march evaluations in the active run.',
      'Army wipe: no deployable prepared cohorts remain after attrition or battle write-back.',
      'Final Invasion defeat: losing the capstone boss battle routes to defeat.',
    ],
    stateStores: [
      'campaignState: current tile, selected tile, and march points.',
      'hexTiles: discovered, visited, reachable, events, and battle modifiers.',
      'preparedArmy: supplies, cohort HP, out-of-action state, and campaign morale delta.',
      'globalSeason/threatLevel/resources: canonical run clock, Doom pressure, upkeep, and income.',
      'bellumGains: resources earned during Bellum hex battles for run persistence.',
    ],
  };
}

export function formatResourceEffects(items: readonly { resource: ResourceType; amount?: number; deficit?: number }[]): string {
  if (items.length === 0) return 'none';
  return items.map((item) => `${item.amount ?? item.deficit ?? 0} ${item.resource}`).join(', ');
}
