/**
 * Verifies S26-05: completeSpoke() projects boundArmy.cohorts (with their
 * currentHp + outOfAction wounds) back onto preparedArmy.cohorts before the
 * spoke state is torn down.
 */

import type { Cohort } from '../src/game/army/cohort';
import { computeArmySize } from '../src/game/army/cohort';
import type { ArmyData } from '../src/types/index';
import { preparedArmy } from '../src/game/progression/strategic-store';
import { completeSpoke, currentSpoke, type Spoke } from '../src/game/progression/spoke';

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
    id: 1,
    owner: 'rome',
    name: 'Legio I',
    size: computeArmySize(cohorts),
    cohorts,
    legateId: null,
    supplies: 10,
    provinceIndex: 0,
    targetProvinceIndex: null,
    progress: 0,
    path: [],
    inCombat: false,
    combatTarget: null,
    lastRoll: 0,
  };
}

function makeSpoke(boundArmy: ArmyData | null): Spoke {
  return {
    nodes: [],
    label: 'Verifier',
    completed: false,
    duration: 1,
    currentSeason: 1,
    posture: 'attacking',
    boundArmy,
    boundLegate: null,
  };
}

function reset(): void {
  currentSpoke.value = null;
  preparedArmy.value = null;
}

// ── AC-3 happy path: damaged + outOfAction propagate to preparedArmy ─
{
  reset();
  const preCohorts = [
    makeCohort({ instanceId: 'inst-1', hp: 1000 }),
    makeCohort({ instanceId: 'inst-2', hp: 800 }),
    makeCohort({ instanceId: 'inst-3', hp: 1200 }),
  ];
  preparedArmy.value = makeArmy(preCohorts);

  const boundCohorts = [
    makeCohort({ instanceId: 'inst-1', hp: 1000, currentHp: 600 }),
    makeCohort({ instanceId: 'inst-2', hp: 800, currentHp: 1, outOfAction: true }),
    makeCohort({ instanceId: 'inst-3', hp: 1200 }), // unchanged
  ];
  currentSpoke.value = makeSpoke(makeArmy(boundCohorts));

  completeSpoke();

  assert(currentSpoke.value === null, 'completeSpoke clears currentSpoke');
  assert(preparedArmy.value !== null, 'preparedArmy survives spoke completion');
  const out = preparedArmy.value!.cohorts;
  assert(out.length === 3, 'AC-3: cohort count preserved when nothing was supply-killed');
  assert(out[0].currentHp === 600, 'AC-3: damaged cohort 1 propagates HP=600');
  assert(out[1].currentHp === 1 && out[1].outOfAction === true, 'AC-3: outOfAction cohort 2 propagates flag + 1HP');
  assert(out[2].currentHp === undefined && out[2].outOfAction !== true, 'AC-3: untouched cohort 3 stays canonical full-HP');
}

// ── Supply attrition removed a cohort mid-spoke → vanishes from preparedArmy ─
{
  reset();
  const preCohorts = [
    makeCohort({ instanceId: 'inst-A', hp: 1000 }),
    makeCohort({ instanceId: 'inst-B', hp: 800 }),
    makeCohort({ instanceId: 'inst-C', hp: 1200 }),
  ];
  preparedArmy.value = makeArmy(preCohorts);

  // Bound army has only A + C (B was killed by supply attrition mid-spoke).
  const boundCohorts = [
    makeCohort({ instanceId: 'inst-A', hp: 1000, currentHp: 750 }),
    makeCohort({ instanceId: 'inst-C', hp: 1200, currentHp: 400 }),
  ];
  currentSpoke.value = makeSpoke(makeArmy(boundCohorts));

  completeSpoke();

  const out = preparedArmy.value!.cohorts;
  assert(out.length === 2, 'Supply-killed cohort should also disappear from preparedArmy (replace, not merge)');
  assert(out.find(c => c.instanceId === 'inst-B') === undefined, 'Specifically the supply-killed cohort vanishes');
  assert(out[0].instanceId === 'inst-A' && out[0].currentHp === 750, 'Surviving cohort A retains its damaged HP');
  assert(out[1].instanceId === 'inst-C' && out[1].currentHp === 400, 'Surviving cohort C retains its damaged HP');
  assert(preparedArmy.value!.size === computeArmySize(out), 'Army size recomputed to match new roster');
}

// ── Defensive: completeSpoke with no boundArmy leaves preparedArmy untouched ─
{
  reset();
  const preCohorts = [makeCohort({ instanceId: 'inst-X', hp: 1000, currentHp: 500 })];
  preparedArmy.value = makeArmy(preCohorts);
  const before = preparedArmy.value;

  currentSpoke.value = makeSpoke(null); // no boundArmy
  completeSpoke();

  assert(preparedArmy.value === before, 'No boundArmy → preparedArmy reference is untouched');
  assert(preparedArmy.value!.cohorts[0].currentHp === 500, 'Pre-existing wounds preserved verbatim');
}

// ── Defensive: completeSpoke with no preparedArmy is a no-op ─────
{
  reset();
  preparedArmy.value = null;
  currentSpoke.value = makeSpoke(makeArmy([
    makeCohort({ instanceId: 'inst-Y', hp: 1000, currentHp: 200 }),
  ]));

  // Should not throw and should leave preparedArmy null.
  completeSpoke();
  assert(preparedArmy.value === null, 'Null preparedArmy → no-op (no spurious creation)');
}

// ── Defensive: completeSpoke with no currentSpoke is a no-op ─────
{
  reset();
  preparedArmy.value = makeArmy([makeCohort({ instanceId: 'inst-Z', hp: 1000, currentHp: 700 })]);
  const before = preparedArmy.value;
  currentSpoke.value = null;

  completeSpoke();
  assert(preparedArmy.value === before, 'Null currentSpoke → preparedArmy unchanged');
}

reset();
console.log('verify-spoke-completion: ok');
