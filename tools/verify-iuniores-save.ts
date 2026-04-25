import { IUNIORES } from '../src/config/game-config';
import { COMMANDERS } from '../src/data/commanders';
import { getCohortById } from '../src/game/army/cohort-data';
import { completedSpokes, globalSeason, resetRun, selectedCommander, startNewRun, threatLevel } from '../src/game/core/game-state';
import { metaSave, parseMetaSave, restoreActiveRun, saveActiveRunSnapshot } from '../src/game/core/meta-save';
import { initResources, iuniores } from '../src/game/core/resources';
import { preparedArmy } from '../src/game/progression/strategic-store';
import { currentNodeIndex, currentSpoke, ZERO_GAINS } from '../src/game/progression/spoke';
import { provinces } from '../src/game/province/province-store';
import { claimedIndices, territoryMap, topologyData } from '../src/game/province/province-map-store';
import type { Province } from '../src/game/province/province';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const augustus = COMMANDERS.find(c => c.id === 'augustus');
assert(augustus, 'Augustus commander should exist for verification');

const roundTripRaw = JSON.stringify({
  version: 2,
  runs: [],
  totalRunsStarted: 0,
  victories: 0,
  highScore: 0,
  commanderWins: [],
  activeRun: {
    commanderId: 'augustus',
    resources: {
      gold: 7,
      faith: 2,
      influence: 5,
      momentum: 1,
      iuniores: 1234,
    },
  },
});

const roundTrip = parseMetaSave(roundTripRaw);
assert(roundTrip.activeRun?.resources.iuniores === 1234, 'Round-trip save should preserve iuniores exactly');

const legacyRaw = JSON.stringify({
  version: 2,
  runs: [],
  totalRunsStarted: 0,
  victories: 0,
  highScore: 0,
  commanderWins: [],
  activeRun: {
    commanderId: 'augustus',
    resources: {
      gold: 7,
      faith: 2,
      influence: 5,
      momentum: 1,
    },
  },
});

const migrated = parseMetaSave(legacyRaw);
assert(migrated.activeRun?.resources.iuniores === IUNIORES.startingSeed, 'Legacy save should seed missing iuniores once');
assert(migrated.activeRun?.iunioresSeeded === true, 'Legacy save should mark the one-time iuniores seed');

const migratedRoundTrip = parseMetaSave(JSON.stringify(migrated));
assert(migratedRoundTrip.activeRun?.resources.iuniores === IUNIORES.startingSeed, 'Migrated save should not double-seed iuniores');

const legacyCohort = getCohortById('hastati');
assert(legacyCohort, 'Hastati cohort should exist for verification');

const legacyInstanceIdRaw = JSON.stringify({
  version: 2,
  runs: [],
  totalRunsStarted: 0,
  victories: 0,
  highScore: 0,
  commanderWins: [],
  activeRun: {
    commanderId: 'augustus',
    resources: {
      gold: 7,
      faith: 2,
      influence: 5,
      momentum: 1,
      iuniores: 1234,
    },
    preparedArmy: {
      id: 0,
      owner: 'rome',
      name: 'Legio I',
      size: legacyCohort.stats.hp,
      cohorts: [{ ...legacyCohort }],
      legateId: null,
      supplies: 4,
      provinceIndex: 0,
      targetProvinceIndex: null,
      progress: 0,
      path: [],
      inCombat: false,
      combatTarget: null,
      lastRoll: 0,
    },
    currentSpoke: {
      label: 'Legacy Spoke',
      completed: false,
      duration: 1,
      currentSeason: 1,
      posture: 'attacking',
      nodes: [{ id: 'node-0', type: 'battle', position: 0, resolved: false, reward: null }],
      boundArmy: {
        id: 0,
        owner: 'rome',
        name: 'Legio I',
        size: legacyCohort.stats.hp,
        cohorts: [{ ...legacyCohort, currentHp: Math.floor(legacyCohort.stats.hp / 2) }],
        legateId: null,
        supplies: 4,
        provinceIndex: 0,
        targetProvinceIndex: null,
        progress: 0,
        path: [],
        inCombat: false,
        combatTarget: null,
        lastRoll: 0,
      },
    },
  },
});

const migratedInstanceIds = parseMetaSave(legacyInstanceIdRaw);
const migratedPreparedId = migratedInstanceIds.activeRun?.preparedArmy?.cohorts[0]?.instanceId;
const migratedBoundId = migratedInstanceIds.activeRun?.currentSpoke?.boundArmy?.cohorts[0]?.instanceId;
assert(
  typeof migratedPreparedId === 'string' && migratedPreparedId.startsWith(`${legacyCohort.id}-`) && migratedPreparedId.length > legacyCohort.id.length + 1,
  'Legacy preparedArmy cohorts should receive a non-empty migrated instance id namespaced by catalog id',
);
assert(
  typeof migratedBoundId === 'string' && migratedBoundId.startsWith(`${legacyCohort.id}-`) && migratedBoundId.length > legacyCohort.id.length + 1,
  'Legacy boundArmy cohorts should receive a non-empty migrated instance id namespaced by catalog id',
);
assert(
  migratedPreparedId !== migratedBoundId,
  'preparedArmy and boundArmy cohorts should receive distinct instance ids',
);

// Full restore integration check.
topologyData.value = {
  centers: { '27': [0.5, 0.5] },
  adjacency: { '27': [] },
};

startNewRun(augustus, { recordRunStart: false, seedHomeProvince: false });
initResources({ gold: 9, faith: 4, influence: 6, momentum: 2, iuniores: 1234 });
completedSpokes.value = 2;
threatLevel.value = 3;
globalSeason.value = 5;

const savedInstanceId = 'verify-hastati-1';
const savedPreparedArmy = preparedArmy.value;
assert(savedPreparedArmy && savedPreparedArmy.cohorts.length >= 1, 'Starter army should exist for verification');
preparedArmy.value = {
  ...savedPreparedArmy,
  cohorts: savedPreparedArmy.cohorts.map((cohort, index) => (
    index === 0 ? { ...cohort, instanceId: savedInstanceId, currentHp: Math.floor(cohort.stats.hp * 0.6) } : cohort
  )),
};

const sampleProvince: Province = {
  id: 'prov-test',
  name: 'Test Province',
  population: 4,
  baseIncome: { gold: 1, iuniores: 0 },
  unrest: 12,
  baseExpenses: 1,
  investments: [],
  wealth: 10,
  devastation: 0,
  devastationTimer: 0,
  rebellionCount: 0,
  lowerTax: 3,
  upperTax: 3,
  growthAccumulator: 0,
  famineTimer: 0,
  rubbleTimer: 0,
  terrain: 'plains',
  tradeGood: null,
  uniqueFeature: null,
};

provinces.value = [sampleProvince];
territoryMap.value = new Map([['prov-test', 27]]);
claimedIndices.value = new Set([27]);
currentSpoke.value = {
  label: 'Verifier Spoke',
  completed: false,
  duration: 2,
  currentSeason: 1,
  posture: 'attacking',
  nodes: [
    { id: 'node-0', type: 'battle', position: 0, resolved: false, reward: null },
    { id: 'node-1', type: 'boss', position: 1, resolved: false, reward: null },
  ],
  boundArmy: preparedArmy.value,
};
currentNodeIndex.value = 1;

saveActiveRunSnapshot();
const saved = metaSave.value.activeRun;
assert(saved, 'Active run snapshot should be created');

const savedJson = JSON.stringify(saved);
resetRun();

metaSave.value = {
  ...metaSave.value,
  activeRun: JSON.parse(savedJson),
};

const restored = await restoreActiveRun();
assert(restored, 'restoreActiveRun should succeed for a valid snapshot');
assert(selectedCommander.value?.id === 'augustus', 'Restore should recover the saved commander');
assert(iuniores.value === 1234, 'Restore should recover the saved iuniores value');
assert(completedSpokes.value === 2, 'Restore should recover completed spokes');
assert(globalSeason.value === 5, 'Restore should recover global season');
assert(provinces.value.length === 1 && provinces.value[0].name === 'Test Province', 'Restore should recover provinces');
assert(currentSpoke.value?.label === 'Verifier Spoke', 'Restore should recover the active spoke');
assert(currentNodeIndex.value === 1, 'Restore should recover the active node index');
assert(preparedArmy.value?.cohorts[0]?.instanceId === savedInstanceId, 'Restore should preserve preparedArmy cohort instance ids');
assert(currentSpoke.value?.boundArmy?.cohorts[0]?.instanceId === savedInstanceId, 'Restore should preserve boundArmy cohort instance ids');
assert(JSON.stringify(metaSave.value.activeRun) === savedJson, 'Restore should preserve the serialized snapshot contents');
assert(JSON.stringify(ZERO_GAINS) === JSON.stringify({ gold: 0, faith: 0, influence: 0, momentum: 0, iuniores: 0 }), 'ZERO_GAINS contract changed unexpectedly');

resetRun();

console.log('verify-iuniores-save: ok');
