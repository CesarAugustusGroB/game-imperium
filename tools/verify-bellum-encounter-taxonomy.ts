// S33-07: Bellum encounter taxonomy verification.
// Run with: npx tsx tools/verify-bellum-encounter-taxonomy.ts
//
// Covers:
//  1. Mapping coverage: every EventType except 'none' maps to a non-null EncounterType.
//  2. Content coverage: every EventType except 'none' returns non-null getEventContent.
//  3. Icon/color coverage: every non-none EventType returns non-empty icon and non-zero color.
//  4. Table coverage: every non-none EventType has at least one BELLUM_ENCOUNTER_TABLE entry
//     with well-formed effects (every effect has type + label).
//  5. Map-gen sample: generateCampaignMap(8) produces all expected event types.
//  6. Recruit hire emits 250 iuniores.
//  7. Boss launches battle.

import { eventTypeToEncounterType } from '../src/game/campaign/event-encounter-mapping';
import { getEventContent, getEventIcon, getEventColor } from '../src/game/campaign/events';
import { BELLUM_ENCOUNTER_TABLE } from '../src/game/campaign/encounter-effects-data';
import { generateCampaignMap } from '../src/game/campaign/campaign-map-generator';
import { applyBellumEffects } from '../src/game/campaign/bellum-encounter-effects';
import { preparedArmy } from '../src/game/progression/strategic-store';
import { iuniores } from '../src/game/core/resources';
import {
  __resetMoraleContributors,
  BASE_MORALE,
  registerMoraleContributor,
} from '../src/game/army/morale';
import { hexTiles, setTiles, campaignState } from '../src/game/campaign/campaign-state';
import { resetBellumDefeatState } from '../src/game/campaign/campaign-defeat';
import type { EventType, HexTile } from '../src/game/campaign/campaign-types';
import type { ArmyData, Cohort } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

// ── Setup helpers (mirrors verify-bellum-encounter-effects.ts) ────────────

__resetMoraleContributors();
registerMoraleContributor((spoke) => {
  const delta = spoke.boundArmy?.campaignMoraleDelta ?? 0;
  if (delta === 0) return [];
  return [{ source: 'campaign', label: 'Campaign events', delta }];
});

function makeCohort(id: string): Cohort {
  return {
    id,
    instanceId: id,
    name: id,
    role: 'vanguard',
    stats: { hp: 1000, atk: 100, def: 50, agi: 30 },
    spriteId: 'hastati',
  } as Cohort;
}

function makeArmy(supplies = 100, campaignMoraleDelta = 0): ArmyData {
  return {
    id: 1,
    owner: 'player',
    name: 'Legio Test',
    size: 1000,
    cohorts: [makeCohort('a')],
    legateId: null,
    supplies,
    campaignMoraleDelta,
    provinceIndex: 0,
    targetProvinceIndex: null,
    progress: 0,
    path: [],
    inCombat: false,
    combatTarget: null,
    lastRoll: 0,
  };
}

function makeTile(event: EventType, id = '0,0', q = 0, r = 0): HexTile {
  return {
    id,
    q,
    r,
    terrain: 'plains',
    event,
    discovered: true,
    visited: true,
    reachable: false,
    current: true,
    movementCost: 1,
  };
}

function resetState(): void {
  resetBellumDefeatState();
  campaignState.value = { currentTileId: '0,0', selectedTileId: null, movementPoints: 5 };
  preparedArmy.value = makeArmy();
  iuniores.value = 0;
}

// All non-none event types
const NON_NONE_EVENTS: EventType[] = [
  'battle', 'supply', 'ambush', 'rest', 'merchant', 'story', 'elite',
  'scout', 'recruit', 'hazard', 'boss',
];

// ── 1. Mapping coverage ────────────────────────────────────────────────────
{
  for (const evt of NON_NONE_EVENTS) {
    const mapped = eventTypeToEncounterType(evt);
    assert(mapped !== null, `1: '${evt}' maps to null (expected non-null EncounterType)`);
  }
  // 'none' should return null
  assert(eventTypeToEncounterType('none') === null, '1: none maps to null');
}
console.log('PASS 1: mapping coverage — all non-none EventTypes map to a non-null EncounterType');

// ── 2. Content coverage ───────────────────────────────────────────────────
{
  for (const evt of NON_NONE_EVENTS) {
    const tile = makeTile(evt);
    const content = getEventContent(tile);
    assert(content !== null, `2: '${evt}' getEventContent returns null`);
    assert(content!.title.length > 0, `2: '${evt}' content has empty title`);
    assert(content!.description.length > 0, `2: '${evt}' content has empty description`);
    assert(content!.actions.length > 0, `2: '${evt}' content has no actions`);
  }
}
console.log('PASS 2: content coverage — all non-none EventTypes return non-null getEventContent');

// ── 3. Icon / color coverage ─────────────────────────────────────────────
{
  for (const evt of NON_NONE_EVENTS) {
    const icon = getEventIcon(evt);
    assert(icon.length > 0, `3: '${evt}' getEventIcon returns empty string`);
    const color = getEventColor(evt);
    assert(color !== 0, `3: '${evt}' getEventColor returns 0 (white / unset)`);
    assert(color !== 0xffffff, `3: '${evt}' getEventColor returns default white 0xffffff`);
  }
}
console.log('PASS 3: icon/color coverage — all non-none EventTypes have non-empty icon and non-zero color');

// ── 4. Table coverage ─────────────────────────────────────────────────────
{
  for (const evt of NON_NONE_EVENTS) {
    const encounterType = eventTypeToEncounterType(evt)!;
    const actions = BELLUM_ENCOUNTER_TABLE[encounterType];
    assert(
      actions !== undefined && actions.length > 0,
      `4: BELLUM_ENCOUNTER_TABLE['${encounterType}'] (from '${evt}') has no entries`,
    );
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      for (let j = 0; j < action.effects.length; j++) {
        const effect = action.effects[j];
        assert(
          typeof effect.type === 'string' && effect.type.length > 0,
          `4: ${encounterType}[${i}].effects[${j}] missing 'type'`,
        );
        assert(
          typeof effect.label === 'string' && effect.label.length > 0,
          `4: ${encounterType}[${i}].effects[${j}] missing 'label'`,
        );
      }
    }
  }
}
console.log('PASS 4: table coverage — all non-none EventTypes have at least one table entry with well-formed effects');

// ── 5. Map-gen sample ─────────────────────────────────────────────────────
// NOTE: radius=10 is the minimum that guarantees all non-boss encounter types
// appear. At radius=8 the deterministic hash leaves hazard unrepresented
// (hills/river hazard windows are narrow — 3% and 12% respectively — and the
// hash clusters happen to miss them at that radius).
{
  const tiles = generateCampaignMap(10);
  const presentEvents = new Set(tiles.map((t) => t.event));

  // Boss is intentionally never generated by map gen
  const EXPECTED_GENERATED: EventType[] = [
    'battle', 'supply', 'ambush', 'rest', 'merchant', 'story', 'elite',
    'scout', 'recruit', 'hazard',
  ];

  for (const evt of EXPECTED_GENERATED) {
    assert(
      presentEvents.has(evt),
      `5: generateCampaignMap(8) produced no '${evt}' tiles (found: ${[...presentEvents].join(', ')})`,
    );
  }

  // Boss should NOT appear in generated map
  assert(
    !presentEvents.has('boss'),
    `5: generateCampaignMap(8) should never generate 'boss' tiles`,
  );

  console.log(`  (${tiles.length} tiles generated, event types present: ${[...presentEvents].join(', ')})`);
}
console.log('PASS 5: map-gen sample — all expected event types present, boss absent');

// ── 6. Recruit hire emits 250 iuniores ───────────────────────────────────
{
  resetState();
  const tile = makeTile('recruit');
  setTiles([tile]);
  iuniores.value = 0;

  const recruitEncounterType = eventTypeToEncounterType('recruit')!;
  assert(recruitEncounterType === 'recruit', '6: recruit maps to recruit EncounterType');
  const hireAction = BELLUM_ENCOUNTER_TABLE[recruitEncounterType][0]; // idx 0 = Hire
  assert(hireAction !== undefined, '6: recruit[0] (Hire) exists in table');

  applyBellumEffects(hireAction.effects, tile);
  assert(iuniores.value === 250, `6: iuniores after Hire = 250, got ${iuniores.value}`);
}
console.log('PASS 6: recruit Hire action emits 250 iuniores');

// ── 7. Boss launches battle ───────────────────────────────────────────────
{
  const bossActions = BELLUM_ENCOUNTER_TABLE['boss'];
  assert(bossActions.length > 0, '7: BELLUM_ENCOUNTER_TABLE.boss has no entries');
  assert(
    bossActions[0].launchesBattle === true,
    `7: BELLUM_ENCOUNTER_TABLE.boss[0].launchesBattle should be true, got ${bossActions[0].launchesBattle}`,
  );
}
console.log('PASS 7: boss[0].launchesBattle === true');

preparedArmy.value = null;
console.log('\nAll bellum-encounter-taxonomy checks passed');
