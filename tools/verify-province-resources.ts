/**
 * Verifies the province system no longer uses deprecated resources
 * (faith/influence/momentum) and that income flows to gold/iuniores.
 * Run: npx tsx tools/verify-province-resources.ts
 */
import { INVESTMENT_DATA, getProvinceIncome, createProvince } from '../src/game/province/province';
import { ALL_FEATURES } from '../src/data/province-features';
import { TRADE_GOOD_DATA } from '../src/data/trade-goods';
import { ALL_GOVERNORS } from '../src/data/governor-data';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (!cond) { console.error(`  ✗ ${label}`); failures++; } else { console.log(`  ✓ ${label}`); }
}
const DEPR = ['faith', 'influence', 'momentum'];

// Buildings: no deprecated key in incomeBonus or buildCost
let bldBad = 0;
for (const data of Object.values(INVESTMENT_DATA)) {
  for (const lvl of data.levels) {
    for (const k of DEPR) {
      if (k in lvl.incomeBonus) bldBad++;
      if (k in lvl.buildCost) bldBad++;
    }
  }
}
check('no building uses a deprecated resource (income/cost)', bldBad === 0);

// Features: the deprecated fields are gone; iunioresPerSeason exists
const featBad = ALL_FEATURES.some(f => 'faithPerSeason' in f || 'influencePerSeason' in f || 'momentumPerSeason' in f);
check('no feature has a deprecated *PerSeason field', !featBad);
check('features expose iunioresPerSeason', ALL_FEATURES.every(f => typeof (f as { iunioresPerSeason?: number }).iunioresPerSeason === 'number'));

// Trade goods: deprecated flat fields gone; flatIuniores exists
const goods = Object.values(TRADE_GOOD_DATA);
check('no trade good has flatFaith/flatMomentum', !goods.some(g => 'flatFaith' in g || 'flatMomentum' in g));
check('trade goods expose flatIuniores', goods.every(g => typeof (g as { flatIuniores?: number }).flatIuniores === 'number'));

// Governors: no deprecated income-bonus resource, no deprecated hire cost
let govBad = 0;
for (const gov of ALL_GOVERNORS) {
  for (const tier of gov.tiers) {
    for (const t of tier.traits) {
      if (t.type === 'income-bonus' && DEPR.includes((t as { resource: string }).resource)) govBad++;
    }
    for (const k of DEPR) { if (k in tier.hireCost) govBad++; }
  }
}
check('no governor uses a deprecated resource (trait/cost)', govBad === 0);

// getProvinceIncome on a province with a momentum→iuniores building yields iuniores, no deprecated keys
const prov = createProvince('Test', { investments: [{ type: 'stables', level: 3 }], baseIncome: { gold: 2 } });
const income = getProvinceIncome(prov);
check('getProvinceIncome returns no deprecated keys', !DEPR.some(k => k in income));
check('stables T3 yields iuniores via getProvinceIncome', (income.iuniores ?? 0) >= 3);

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
