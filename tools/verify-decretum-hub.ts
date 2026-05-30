/**
 * Verifies Hub-cast Decreta (Fase 2): effect mapping, castability gate, active
 * continuous effects, cast application, and season-tick upkeep waive.
 * Run: npx tsx tools/verify-decretum-hub.ts
 */
import {
  toHubEffect, isCastableAtHub, describeHubEffect, isUpkeepWaived,
  tickActiveDecretumEffects, activeDecretumEffects, RECRUIT_IUNIORES_PER_UNIT,
} from '../src/game/items/decretum-hub';
import type { Decretum, DecretumEffect } from '../src/game/items/decretum';

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

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
