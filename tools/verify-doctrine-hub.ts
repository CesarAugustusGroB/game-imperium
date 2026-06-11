/**
 * Verifies Doctrine Hub Revival: new selectors, shop-discount wiring, embark
 * bonus, and that the doctrine data uses only the live Hub effect vocabulary.
 * Run: npx tsx tools/verify-doctrine-hub.ts
 */
import { getShopDiscount, getEmbarkBonus, equippedDoctrines } from '../src/game/items/doctrine-store';
import type { Doctrine, DoctrineEffect } from '../src/game/items/doctrine';
import { DOCTRINE_CATALOG } from '../src/data/doctrine-data';
import { buySupplies, preparedArmy } from '../src/game/progression/strategic-store';
import { gold, getResource } from '../src/game/core/resources';
import type { ArmyData } from '../src/types/index';
import { getDiscountedAdvisorCost } from '../src/game/council/council-store';
import type { Advisor } from '../src/game/council/advisor';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

const mkDoctrine = (effects: DoctrineEffect[]): Doctrine =>
  ({ id: 'd', name: 'D', color: 'white', currentLevel: 1, levels: [{ description: '', effects, upgradeCost: {} }, { description: '', effects, upgradeCost: {} }, { description: '', effects, upgradeCost: {} }] } as unknown as Doctrine);

// --- getShopDiscount ---
equippedDoctrines.value = [null, null, null, null];
check('no doctrines → 0 discount', getShopDiscount() === 0);
equippedDoctrines.value = [mkDoctrine([{ type: 'shop-discount', percent: 10 }]), mkDoctrine([{ type: 'shop-discount', percent: 20 }]), null, null];
check('shop-discount sums (10+20=30)', getShopDiscount() === 30);
equippedDoctrines.value = [mkDoctrine([{ type: 'shop-discount', percent: 50 }]), mkDoctrine([{ type: 'shop-discount', percent: 50 }]), null, null];
check('shop-discount clamps to 75', getShopDiscount() === 75);

// --- getEmbarkBonus ---
equippedDoctrines.value = [null, null, null, null];
const z = getEmbarkBonus();
check('no doctrines → zero embark bonus', z.soldiers === 0 && z.morale === 0 && z.supplies === 0 && z.discipline === 0);
equippedDoctrines.value = [
  mkDoctrine([{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }]),
  mkDoctrine([{ type: 'embark-bonus', stat: 'soldiers', amount: 200 }, { type: 'embark-bonus', stat: 'morale', amount: 2 }]),
  null, null,
];
const b = getEmbarkBonus();
check('embark soldiers sum (400+200=600)', b.soldiers === 600);
check('embark morale sum (2)', b.morale === 2);

equippedDoctrines.value = [null, null, null, null];

// --- data uses only the live Hub vocabulary ---
const LIVE_TYPES = new Set(['income-modifier', 'upkeep-reduction', 'resource-per-spoke', 'shop-discount', 'embark-bonus']);
const DEAD = DOCTRINE_CATALOG.flatMap((d) => d.levels.flatMap((l) => l.effects))
  .filter((e) => !LIVE_TYPES.has(e.type));
check('no doctrine uses a dead/battle effect type', DEAD.length === 0);
check('resource-per-spoke only grants live resources (gold/iuniores)',
  DOCTRINE_CATALOG.flatMap((d) => d.levels.flatMap((l) => l.effects))
    .filter((e): e is Extract<DoctrineEffect, { type: 'resource-per-spoke' }> => e.type === 'resource-per-spoke')
    .every((e) => e.resource === 'gold' || e.resource === 'iuniores'));

// --- shop-discount reduces buySupplies gold cost ---
preparedArmy.value = { supplies: 0, cohorts: [], size: 0 } as unknown as ArmyData;
equippedDoctrines.value = [null, null, null, null];
gold.value = 1000;
buySupplies(10);
const fullCost = 1000 - getResource('gold');
preparedArmy.value = { supplies: 0, cohorts: [], size: 0 } as unknown as ArmyData;
equippedDoctrines.value = [mkDoctrine([{ type: 'shop-discount', percent: 50 }]), null, null, null];
gold.value = 1000;
buySupplies(10);
const discCost = 1000 - getResource('gold');
check('shop-discount lowers buySupplies cost', discCost < fullCost && discCost >= 1);

equippedDoctrines.value = [null, null, null, null];
preparedArmy.value = null;

// --- advisor hire cost reflects shop-discount ---
const fakeAdvisor = { cost: 100 } as unknown as Advisor;
equippedDoctrines.value = [null, null, null, null];
check('no discount → full advisor cost', getDiscountedAdvisorCost(fakeAdvisor) === 100);
equippedDoctrines.value = [mkDoctrine([{ type: 'shop-discount', percent: 50 }]), null, null, null];
check('shop-discount lowers advisor cost (~50)', getDiscountedAdvisorCost(fakeAdvisor) === 50);
equippedDoctrines.value = [null, null, null, null];

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
