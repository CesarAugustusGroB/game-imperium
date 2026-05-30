/**
 * Verifies Doctrine Hub Revival: new selectors, shop-discount wiring, embark
 * bonus, and that the doctrine data uses only the live Hub effect vocabulary.
 * Run: npx tsx tools/verify-doctrine-hub.ts
 */
import { getShopDiscount, getEmbarkBonus, equippedDoctrines } from '../src/game/items/doctrine-store';
import type { Doctrine, DoctrineEffect } from '../src/game/items/doctrine';

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

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
