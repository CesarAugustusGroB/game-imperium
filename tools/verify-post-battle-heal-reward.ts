import { applyPostBattleHealReward } from '../src/game/army/army-replenishment';
import type { Cohort } from '../src/game/army/cohort';
import { currentSpoke, type Spoke } from '../src/game/progression/spoke';
import { preparedArmy } from '../src/game/progression/strategic-store';
import type { ArmyData } from '../src/types/index';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeCohort(overrides: {
  instanceId: string;
  hp: number;
  currentHp?: number;
  outOfAction?: boolean;
}): Cohort {
  return {
    id: 'hastati',
    instanceId: overrides.instanceId,
    name: 'Hastati',
    role: 'vanguard',
    stats: { atk: 100, def: 50, hp: overrides.hp, agi: 60 },
    aurumCost: 30,
    rarity: 'common',
    spriteId: 'roman_militia',
    description: '',
    movementProfile: 'vanguard-march',
    currentHp: overrides.currentHp,
    outOfAction: overrides.outOfAction,
  };
}

function makeArmy(cohorts: Cohort[]): ArmyData {
  return {
    id: 'army-test',
    name: 'Test Army',
    faction: 'rome',
    side: 'player',
    cohorts,
    size: cohorts.reduce((sum, c) => sum + c.stats.hp, 0),
    supplies: 10,
  };
}

function makeSpoke(boundArmy: ArmyData): Spoke {
  return {
    label: 'Test Spoke',
    completed: false,
    duration: 1,
    currentSeason: 1,
    posture: 'attacking',
    nodes: [],
    boundArmy,
  };
}

const cohorts = [
  makeCohort({ instanceId: 'damaged', hp: 1000, currentHp: 500 }),
  makeCohort({ instanceId: 'ooa', hp: 800, currentHp: 1, outOfAction: true }),
  makeCohort({ instanceId: 'full', hp: 1200 }),
  makeCohort({ instanceId: 'near-full', hp: 1000, currentHp: 950 }),
];

preparedArmy.value = makeArmy(cohorts);
currentSpoke.value = makeSpoke(makeArmy(cohorts));

const summary = applyPostBattleHealReward();
assert(summary?.cohortsHealed === 3, 'Should heal damaged, out-of-action, and near-full cohorts');
assert(summary.hpRestored === 410, '20% max HP heal should restore 200 + 160 + 50 HP');

const bound = currentSpoke.value?.boundArmy?.cohorts ?? [];
assert(bound[0].currentHp === 700, 'Damaged cohort should gain 20% max HP');
assert(bound[1].currentHp === 161, 'Out-of-action cohort should gain 20% max HP from 1 HP');
assert(bound[1].outOfAction !== true, 'Out-of-action flag should clear when heal reward is chosen');
assert(bound[2].currentHp === undefined, 'Full-health cohort should remain canonical full HP');
assert(bound[3].currentHp === undefined, 'Near-full cohort should cap at full and strip currentHp');

const prepared = preparedArmy.value?.cohorts ?? [];
assert(prepared[0].currentHp === 700, 'Prepared army should sync healed damaged cohort');
assert(prepared[1].currentHp === 161, 'Prepared army should sync healed out-of-action cohort');
assert(prepared[1].outOfAction !== true, 'Prepared army should sync cleared outOfAction flag');
assert(prepared[3].currentHp === undefined, 'Prepared army should sync full-health normalization');

console.log('verify-post-battle-heal-reward: ok');
