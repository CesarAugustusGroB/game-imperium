import { IUNIORES } from '../src/config/game-config';
import { parseMetaSave } from '../src/game/core/meta-save';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

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

console.log('verify-iuniores-save: ok');
