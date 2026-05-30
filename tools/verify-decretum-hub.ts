/**
 * Verifies Hub-cast Decreta (Fase 2): effect mapping, castability gate, active
 * continuous effects, cast application, and season-tick upkeep waive.
 * Run: npx tsx tools/verify-decretum-hub.ts
 */
import {
  toHubEffect, isCastableAtHub, describeHubEffect, isUpkeepWaived,
  tickActiveDecretumEffects, activeDecretumEffects, RECRUIT_IUNIORES_PER_UNIT,
  castDecretumAtHub, resetActiveDecretumEffects,
} from '../src/game/items/decretum-hub';
import type { Decretum, DecretumEffect } from '../src/game/items/decretum';
import { decretumHand } from '../src/game/items/decretum-store';
import { selectedCommander } from '../src/game/core/game-state';
import { getResource, addResource as addRes } from '../src/game/core/resources';
import { preparedArmy } from '../src/game/progression/strategic-store';
import type { ArmyData } from '../src/types/index';
import type { Commander } from '../src/game/core/commander';
import { runSeasonTick } from '../src/game/progression/season-tick';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

const mk = (effect: DecretumEffect, color = 'white'): Decretum =>
  ({ id: 'd', name: 'D', description: '', color, rarity: 'common', effect } as unknown as Decretum);

// --- toHubEffect mapping ---
const grant = toHubEffect(mk({ type: 'resource-gain', resource: 'gold', amount: 5 }));
check('gold resource-gain → grant', grant?.kind === 'grant' && grant.resource === 'gold' && grant.amount === 5);
check('iuniores resource-gain → grant', toHubEffect(mk({ type: 'resource-gain', resource: 'iuniores', amount: 7 }))?.kind === 'grant');
check('influence resource-gain → null (deprecated)', toHubEffect(mk({ type: 'resource-gain', resource: 'influence', amount: 3 })) === null);
const heal = toHubEffect(mk({ type: 'heal', amount: 0.3, target: 'all' }));
check('heal → heal-army with fraction', heal?.kind === 'heal-army' && heal.fraction === 0.3 && heal.target === 'all');
const recruit = toHubEffect(mk({ type: 'spawn', unitRole: 'vanguard', count: 2 }));
check('spawn → recruit (count×K)', recruit?.kind === 'recruit' && recruit.iuniores === 2 * RECRUIT_IUNIORES_PER_UNIT);
const waive = toHubEffect(mk({ type: 'upkeep-reduction', seasons: 2 }));
check('upkeep-reduction → waive-upkeep', waive?.kind === 'waive-upkeep' && waive.seasons === 2);
check('buff → null (inert)', toHubEffect(mk({ type: 'buff', stat: 'atk', multiplier: 0.5, duration: 'battle' })) === null);
check('damage → null (inert)', toHubEffect(mk({ type: 'damage', amount: 100, target: 'area' })) === null);
check('reveal → null (inert)', toHubEffect(mk({ type: 'reveal', target: 'enemies', count: 99 })) === null);
check('prevent-death → null (inert)', toHubEffect(mk({ type: 'prevent-death', count: 1 })) === null);

// --- describeHubEffect ---
check('describe grant', describeHubEffect({ kind: 'grant', resource: 'gold', amount: 5 }).includes('5'));
check('describe waive', describeHubEffect({ kind: 'waive-upkeep', seasons: 2 }).toLowerCase().includes('upkeep'));

// --- isCastableAtHub ---
const redGold = mk({ type: 'resource-gain', resource: 'gold', amount: 5 }, 'red');
check('null faction → not castable', !isCastableAtHub(redGold, null));
check('red scroll, red commander → castable', isCastableAtHub(redGold, 'red'));
check('red scroll, blue commander → not castable (faction-lock)', !isCastableAtHub(redGold, 'blue'));
check('white commander casts any color', isCastableAtHub(redGold, 'white'));
check('inert effect → not castable', !isCastableAtHub(mk({ type: 'buff', stat: 'atk', multiplier: 0.5, duration: 'battle' }, 'white'), 'white'));

// --- isUpkeepWaived + tickActiveDecretumEffects ---
activeDecretumEffects.value = [];
check('no actives → not waived', !isUpkeepWaived());
activeDecretumEffects.value = [{ decretumId: 'x', name: 'X', effect: { kind: 'waive-upkeep', seasons: 2 }, remainingSeasons: 2 }];
check('waive active → waived', isUpkeepWaived());
tickActiveDecretumEffects();
check('tick decrements remaining', activeDecretumEffects.value[0]?.remainingSeasons === 1);
tickActiveDecretumEffects();
check('tick to 0 → expired/removed', activeDecretumEffects.value.length === 0);
check('after expiry → not waived', !isUpkeepWaived());

// --- castDecretumAtHub ---
selectedCommander.value = { faction: 'white' } as unknown as Commander; // white casts any color
activeDecretumEffects.value = [];

// grant: gold
decretumHand.value = [mk({ type: 'resource-gain', resource: 'gold', amount: 5 }, 'red')];
const goldBefore = getResource('gold');
check('cast grant returns true', castDecretumAtHub('d') === true);
check('grant added gold', getResource('gold') === goldBefore + 5);
check('grant removed scroll from hand', decretumHand.value.length === 0);

// recruit
decretumHand.value = [mk({ type: 'spawn', unitRole: 'guard', count: 3 }, 'white')];
const iunBefore = getResource('iuniores');
castDecretumAtHub('d');
check('recruit added iuniores (3×K)', getResource('iuniores') === iunBefore + 3 * RECRUIT_IUNIORES_PER_UNIT);

// heal-army (all): cohort at 500/1000 → +30% of 1000 = 800
preparedArmy.value = { cohorts: [{ currentHp: 500, stats: { hp: 1000 } }], size: 1000 } as unknown as ArmyData;
decretumHand.value = [mk({ type: 'heal', amount: 0.3, target: 'all' }, 'white')];
castDecretumAtHub('d');
check('heal-army healed cohort by fraction', (preparedArmy.value!.cohorts[0].currentHp ?? 0) === 800);

// waive-upkeep → pushed to actives, scroll consumed
activeDecretumEffects.value = [];
decretumHand.value = [mk({ type: 'upkeep-reduction', seasons: 2 }, 'white')];
castDecretumAtHub('d');
check('waive cast pushed active effect', activeDecretumEffects.value.length === 1 && activeDecretumEffects.value[0].remainingSeasons === 2);
check('waive cast removed scroll', decretumHand.value.length === 0);

// faction-lock: blue commander cannot cast a red scroll
selectedCommander.value = { faction: 'blue' } as unknown as Commander;
decretumHand.value = [mk({ type: 'resource-gain', resource: 'gold', amount: 5 }, 'red')];
check('faction-locked cast returns false', castDecretumAtHub('d') === false);
check('faction-locked cast left scroll in hand', decretumHand.value.length === 1);

// inert: a buff scroll is not castable at hub
selectedCommander.value = { faction: 'white' } as unknown as Commander;
decretumHand.value = [mk({ type: 'buff', stat: 'atk', multiplier: 0.5, duration: 'battle' }, 'white')];
check('inert cast returns false', castDecretumAtHub('d') === false);
check('inert cast left scroll in hand', decretumHand.value.length === 1);

// cleanup
decretumHand.value = [];
activeDecretumEffects.value = [];
preparedArmy.value = null;
selectedCommander.value = null;

// --- season-tick upkeep waive ---
// Control: defending posture, no provinces → only gold upkeep (BASE_UPKEEP gold:2) moves gold.
activeDecretumEffects.value = [];
addRes('gold', 100);
const ctrlBefore = getResource('gold');
runSeasonTick('defending', 1);
check('no waive → gold upkeep charged (−2)', getResource('gold') === ctrlBefore - 2);

// With an active waive-upkeep, no upkeep is charged this season.
activeDecretumEffects.value = [{ decretumId: 'x', name: 'X', effect: { kind: 'waive-upkeep', seasons: 2 }, remainingSeasons: 2 }];
const waiveBefore = getResource('gold');
runSeasonTick('defending', 1);
check('waive active → no gold upkeep', getResource('gold') === waiveBefore);
check('season tick decremented the active effect', activeDecretumEffects.value[0]?.remainingSeasons === 1);

// Second tick is the effect's last waived season: still free, then expires.
const expiryBefore = getResource('gold');
runSeasonTick('defending', 1);
check('waive still free on its last (expiry) season', getResource('gold') === expiryBefore);
check('waive expired after its seasons', activeDecretumEffects.value.length === 0);
const afterExpiry = getResource('gold');
runSeasonTick('defending', 1);
check('upkeep charged again after expiry (−2)', getResource('gold') === afterExpiry - 2);

activeDecretumEffects.value = [];

// --- reset helper clears actives ---
activeDecretumEffects.value = [{ decretumId: 'r', name: 'R', effect: { kind: 'waive-upkeep', seasons: 1 }, remainingSeasons: 1 }];
resetActiveDecretumEffects();
check('resetActiveDecretumEffects clears actives', activeDecretumEffects.value.length === 0);

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
