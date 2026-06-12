import { COMMANDERS } from '../src/data/commanders';
import { advisorMarket, councilSlots } from '../src/game/council/council-store';
import { COMMANDER_DEFAULT_LOADOUTS, startNewRun } from '../src/game/core/game-state';
import { doctrineCollection, equippedDoctrines } from '../src/game/items/doctrine-store';
import { DOCTRINE_CATALOG } from '../src/data/doctrine-data';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Loadouts may only reference starter doctrines — the rest of the catalog is
// earned via the victory draft and is not in the collection at run start.
const STARTER_IDS = new Set(DOCTRINE_CATALOG.filter(d => d.starter).map(d => d.id));

for (const commander of COMMANDERS) {
  const loadout = COMMANDER_DEFAULT_LOADOUTS[commander.id];
  assert(loadout, `Missing loadout for ${commander.id}`);

  for (const doctrineId of loadout.doctrineIds) {
    assert(
      STARTER_IDS.has(doctrineId),
      `${commander.id}: loadout doctrine ${doctrineId} is not a starter doctrine (unreachable at run start)`,
    );
  }

  startNewRun(commander, { recordRunStart: false, seedHomeProvince: false });

  const equippedIds = equippedDoctrines.value.map(d => d?.id ?? null);
  assert(
    JSON.stringify(equippedIds) === JSON.stringify(loadout.doctrineIds),
    `${commander.id}: doctrine slots ${JSON.stringify(equippedIds)} did not match ${JSON.stringify(loadout.doctrineIds)}`,
  );

  for (const doctrineId of loadout.doctrineIds) {
    assert(
      !doctrineCollection.value.some(d => d.id === doctrineId),
      `${commander.id}: equipped doctrine ${doctrineId} remained in collection`,
    );
  }

  const seatedIds = councilSlots.value.map(a => a?.id ?? null);
  assert(
    JSON.stringify(seatedIds) === JSON.stringify(loadout.advisorIds),
    `${commander.id}: council slots ${JSON.stringify(seatedIds)} did not match ${JSON.stringify(loadout.advisorIds)}`,
  );

  for (const advisorId of loadout.advisorIds) {
    assert(
      !advisorMarket.value.some(a => a.id === advisorId),
      `${commander.id}: seated advisor ${advisorId} remained in the market`,
    );
  }
}

console.log('verify-commander-loadouts: ok');
