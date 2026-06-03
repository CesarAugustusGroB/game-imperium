# Provinciae Resource Adaptation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the province system off the deprecated resources (faith/influence/momentum) onto the live economy (gold/iuniores) — `momentum → iuniores`, `faith/influence → gold`, all deprecated costs → gold — and wire the orphaned income tick so provinces actually pay out.

**Architecture:** Pure data remaps in the province data files (buildings, features, governors, trade goods, terrain) following a fixed transformation, plus small edits to the income functions (`getProvinceIncome`, `collectProvinceIncome`) and the ProvinceScreen UI, plus one call site to run `collectProvinceIncome` on Hub return (× elapsed seasons). Schema fields for the deprecated resources are removed so TypeScript flags any remaining UI references.

**Tech Stack:** TypeScript (strict, `noUnusedLocals`), Preact, `@preact/signals`, Vite. No unit-test runner — verification via `npx tsx tools/verify-*.ts` + `npx tsc --noEmit` + `npx vite build`.

Spec: `docs/superpowers/specs/2026-06-03-provinciae-resource-adaptation-design.md`.

**Transformation rule (applies everywhere):** `gold' = gold + faith + influence`; `iuniores' = momentum`; drop the faith/influence/momentum fields. For costs: `gold' = gold + faith + influence + momentum` (all fold to gold).

---

## Task 1: Province features → gold/iuniores

**Files:** `src/data/province-features.ts`, `src/game/province/province.ts`, `src/ui/screens/ProvinceScreen.tsx`

- [ ] **Step 1: Change the `ProvinceFeature` schema** (`src/data/province-features.ts`)

In the `ProvinceFeature` interface, replace these four lines:
```ts
  /** Flat faith income per season. */
  faithPerSeason: number;
  /** Flat influence income per season. */
  influencePerSeason: number;
  /** Flat momentum income per season. */
  momentumPerSeason: number;
```
with:
```ts
  /** Flat iuniores (recruit) income per season. */
  iunioresPerSeason: number;
```

- [ ] **Step 2: Remap all 28 features**

For EACH feature object in `ALL_FEATURES`, change its resource line. Currently each reads:
`goldPerSeason: G, foodPerSeason: F, faithPerSeason: A, influencePerSeason: B, momentumPerSeason: C,`
Replace the resource portion with: `goldPerSeason: (G+A+B), foodPerSeason: F, iunioresPerSeason: C,`
(food/unrest/beautiness/buildCostDiscount/wealthGrowthBonus/special stay unchanged). The exact resulting values per feature id:

| id | goldPerSeason | iunioresPerSeason |
|---|---|---|
| nile_delta | 2 | 0 |
| fertile_crescent | 0 | 0 |
| volcanic_soil | 1 | 0 |
| thermopylae_pass | 0 | 3 |
| natural_harbour | 3 | 0 |
| mountain_spring | 2 | 0 |
| great_river_ford | 3 | 0 |
| oracle_of_delphi | 5 | 0 |
| mount_olympus | 5 | 0 |
| eleusinian_mysteries | 5 | 0 |
| druidic_stones | 3 | 0 |
| temple_of_vesta | 5 | 0 |
| isle_of_the_dead | 2 | 1 |
| sacred_grove | 2 | 0 |
| library_of_alexandria | 3 | 0 |
| romulus_monument | 3 | 2 |
| forum_of_augustus | 5 | 0 |
| carthaginian_ruins | 3 | 0 |
| appian_way | 2 | 2 |
| colosseum | 1 | 3 |
| silver_mines_laurion | 5 | 0 |
| phoenician_trade_hub | 5 | 0 |
| amber_road | 3 | 0 |
| tin_islands | 3 | 1 |
| grain_dole | 0 | 0 |
| hannibals_crossing | 0 | 4 |
| spartan_agoge | 0 | 5 |
| praetorian_barracks | 2 | 3 |

(Tip: keep `foodPerSeason` as it already is per feature — only the gold/iuniores numbers and the dropped fields change. `grain_dole` keeps `foodPerSeason: 3`; its gold becomes 0.)

- [ ] **Step 3: Update `getProvinceIncome`** (`src/game/province/province.ts`)

Find the feature block (~line 369):
```ts
  if (feat) {
    if (feat.goldPerSeason) total.gold = (total.gold ?? 0) + feat.goldPerSeason;
    if (feat.faithPerSeason) total.faith = (total.faith ?? 0) + feat.faithPerSeason;
    if (feat.influencePerSeason) total.influence = (total.influence ?? 0) + feat.influencePerSeason;
    if (feat.momentumPerSeason) total.momentum = (total.momentum ?? 0) + feat.momentumPerSeason;
  }
```
Replace with:
```ts
  if (feat) {
    if (feat.goldPerSeason) total.gold = (total.gold ?? 0) + feat.goldPerSeason;
    if (feat.iunioresPerSeason) total.iuniores = (total.iuniores ?? 0) + feat.iunioresPerSeason;
  }
```

- [ ] **Step 4: Fix the feature tooltip in ProvinceScreen**

Around line 1692, `tsc` will now error on `f.faithPerSeason`/`f.influencePerSeason`/`f.momentumPerSeason`. Replace those three `rows.push(...)` lines (the ones building `Faith/season`, `Influence/season`, `Momentum/season`) with a single iuniores row. The current lines read:
```ts
            if (f.faithPerSeason) rows.push(`+${f.faithPerSeason} Faith/season`);
            if (f.influencePerSeason) rows.push(`+${f.influencePerSeason} Influence/season`);
            if (f.momentumPerSeason) rows.push(`+${f.momentumPerSeason} Momentum/season`);
```
Replace with:
```ts
            if (f.iunioresPerSeason) rows.push(`+${f.iunioresPerSeason} Iuniores/season`);
```
(If the surrounding `goldPerSeason`/`foodPerSeason`/`unrestPerSeason` rows differ slightly, leave them; only swap the three deprecated rows for the one iuniores row.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. If it errors elsewhere on a removed feature field, that's another display site — apply the same gold/iuniores swap.

- [ ] **Step 6: Commit**
```bash
git add src/data/province-features.ts src/game/province/province.ts src/ui/screens/ProvinceScreen.tsx
git commit -m "refactor(province): features produce gold/iuniores instead of faith/influence/momentum"
```
(End the commit message body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`)

---

## Task 2: Trade goods → gold/iuniores

**Files:** `src/data/trade-goods.ts`, `src/game/province/province-store.ts`, `src/ui/screens/ProvinceScreen.tsx`

- [ ] **Step 1: Change the `TradeGoodData` schema** (`src/data/trade-goods.ts`)

Replace:
```ts
  /** Flat faith income per season. */
  flatFaith: number;
  /** Flat momentum income per season. */
  flatMomentum: number;
```
with:
```ts
  /** Flat iuniores (recruit) income per season. */
  flatIuniores: number;
```

- [ ] **Step 2: Remap all 12 goods**

For each good, replace `flatFaith: A, flatMomentum: C` with `flatIuniores: C` and set `flatGold' = flatGold + A`. Resulting `flatGold`/`flatIuniores` per good (other fields unchanged):

| good | flatGold | flatIuniores |
|---|---|---|
| grain | 0 | 0 |
| iron | 1 | 1 |
| silk | 3 | 0 |
| marble | 1 | 0 |
| wine | 1 | 0 |
| timber | 1 | 0 |
| fish | 1 | 0 |
| horses | 0 | 1 |
| gold_ore | 4 | 0 |
| incense | 2 | 0 |
| salt | 2 | 0 |
| olives | 1 | 0 |

(Only `incense` and `iron`/`horses` actually change value: incense gold 0→2; iron/horses gain flatIuniores 1.)

- [ ] **Step 3: Update `collectProvinceIncome` trade-good block** (`src/game/province/province-store.ts`)

Find (~line 305):
```ts
    if (prov.tradeGood) {
      const good = TRADE_GOOD_DATA[prov.tradeGood];
      if (good.flatGold > 0)     provIncome.gold     = (provIncome.gold     ?? 0) + good.flatGold;
      if (good.flatFaith > 0)    provIncome.faith    = (provIncome.faith    ?? 0) + good.flatFaith;
      if (good.flatMomentum > 0) provIncome.momentum = (provIncome.momentum ?? 0) + good.flatMomentum;
    }
```
Replace with:
```ts
    if (prov.tradeGood) {
      const good = TRADE_GOOD_DATA[prov.tradeGood];
      if (good.flatGold > 0)     provIncome.gold     = (provIncome.gold     ?? 0) + good.flatGold;
      if (good.flatIuniores > 0) provIncome.iuniores = (provIncome.iuniores ?? 0) + good.flatIuniores;
    }
```

- [ ] **Step 4: Update the IncomeLedger trade-good block** (`src/ui/screens/ProvinceScreen.tsx`)

Find (~line 2016):
```ts
  const tradeGoodGold     = province.tradeGood ? TRADE_GOOD_DATA[province.tradeGood].flatGold     : 0;
  const tradeGoodFaith    = province.tradeGood ? TRADE_GOOD_DATA[province.tradeGood].flatFaith    : 0;
  const tradeGoodMomentum = province.tradeGood ? TRADE_GOOD_DATA[province.tradeGood].flatMomentum : 0;
```
Replace with:
```ts
  const tradeGoodGold     = province.tradeGood ? TRADE_GOOD_DATA[province.tradeGood].flatGold     : 0;
  const tradeGoodIuniores = province.tradeGood ? TRADE_GOOD_DATA[province.tradeGood].flatIuniores : 0;
```
Then find (~line 2025):
```ts
  if (tradeGoodFaith    > 0) nonGoldIncome.faith    = (nonGoldIncome.faith    ?? 0) + tradeGoodFaith;
  if (tradeGoodMomentum > 0) nonGoldIncome.momentum = (nonGoldIncome.momentum ?? 0) + tradeGoodMomentum;
```
Replace with:
```ts
  if (tradeGoodIuniores > 0) nonGoldIncome.iuniores = (nonGoldIncome.iuniores ?? 0) + tradeGoodIuniores;
```

- [ ] **Step 5: Type-check + commit**
```bash
npx tsc --noEmit
git add src/data/trade-goods.ts src/game/province/province-store.ts src/ui/screens/ProvinceScreen.tsx
git commit -m "refactor(province): trade goods produce gold/iuniores instead of faith/momentum"
```
Expected tsc: PASS. (Co-Authored-By trailer.)

---

## Task 3: Terrain → drop orphan faith/momentum bonuses

**Files:** `src/data/terrain-data.ts`, `src/ui/screens/ProvinceScreen.tsx`

- [ ] **Step 1: Remove the fields from `TerrainModifiers`** (`src/data/terrain-data.ts`)

In the `TerrainModifiers` interface delete:
```ts
  /** Bonus faith income per season (+1 forest/marsh). */
  faithBonus: number;
  /** Bonus momentum income per season (+1 plains). */
  momentumBonus: number;
```
In `ZERO_MODIFIERS` delete the two lines `faithBonus: 0,` and `momentumBonus: 0,`.

- [ ] **Step 2: Update the three terrains that set them**

- forest: `baseModifiers: { ...ZERO_MODIFIERS, faithBonus: 1 },` → `baseModifiers: { ...ZERO_MODIFIERS },`
- plains: `baseModifiers: { ...ZERO_MODIFIERS, momentumBonus: 1 },` → `baseModifiers: { ...ZERO_MODIFIERS },`
- marsh: `baseModifiers: { ...ZERO_MODIFIERS, growthModifier: -1, faithBonus: 1 },` → `baseModifiers: { ...ZERO_MODIFIERS, growthModifier: -1 },`

- [ ] **Step 3: Remove the terrain tooltip rows in ProvinceScreen**

Around line 1482, `tsc` will error on `mods.faithBonus`/`mods.momentumBonus`. Delete the two rows that render `Faith +N/s` and `Momentum +N/s` from the terrain modifier tooltip (the `mods.faithBonus !== 0 && (...)` and `mods.momentumBonus !== 0 && (...)` blocks).

- [ ] **Step 4: Type-check + commit**
```bash
npx tsc --noEmit
git add src/data/terrain-data.ts src/ui/screens/ProvinceScreen.tsx
git commit -m "refactor(province): drop display-only faith/momentum terrain bonuses"
```
Expected tsc: PASS. (Co-Authored-By trailer.)

---

## Task 4: Buildings → gold/iuniores income + gold-only costs

**Files:** `src/game/province/province.ts`

- [ ] **Step 1: Remap the deprecated building entries in `INVESTMENT_DATA`**

Apply these exact edits (only the listed `incomeBonus`/`buildCost` values change; descriptions and other fields stay — though see Step 2 for description text):

| Building.tier | Field | Old | New |
|---|---|---|---|
| castrum.T2 | buildCost | `{ gold: 10, momentum: 3 }` | `{ gold: 13 }` |
| castrum.T3 | incomeBonus | `{ momentum: 1 }` | `{ iuniores: 1 }` |
| castrum.T3 | buildCost | `{ gold: 20, momentum: 6 }` | `{ gold: 26 }` |
| basilica.T1 | incomeBonus | `{ influence: 1 }` | `{ gold: 1 }` |
| basilica.T2 | incomeBonus | `{ influence: 2 }` | `{ gold: 2 }` |
| basilica.T2 | buildCost | `{ gold: 10, influence: 3 }` | `{ gold: 13 }` |
| basilica.T3 | incomeBonus | `{ influence: 3 }` | `{ gold: 3 }` |
| basilica.T3 | buildCost | `{ gold: 20, influence: 6 }` | `{ gold: 26 }` |
| pantheon.T1 | incomeBonus | `{ faith: 1 }` | `{ gold: 1 }` |
| pantheon.T2 | incomeBonus | `{ faith: 2 }` | `{ gold: 2 }` |
| pantheon.T2 | buildCost | `{ gold: 10, faith: 3 }` | `{ gold: 13 }` |
| pantheon.T3 | incomeBonus | `{ faith: 3 }` | `{ gold: 3 }` |
| pantheon.T3 | buildCost | `{ gold: 20, faith: 6 }` | `{ gold: 26 }` |
| insula.T3 | incomeBonus | `{ momentum: 1 }` | `{ iuniores: 1 }` |
| stables.T1 | incomeBonus | `{ momentum: 1 }` | `{ iuniores: 1 }` |
| stables.T1 | buildCost | `{ gold: 5, momentum: 2 }` | `{ gold: 7 }` |
| stables.T2 | incomeBonus | `{ momentum: 2 }` | `{ iuniores: 2 }` |
| stables.T2 | buildCost | `{ gold: 10, momentum: 4 }` | `{ gold: 14 }` |
| stables.T3 | incomeBonus | `{ momentum: 3 }` | `{ iuniores: 3 }` |
| stables.T3 | buildCost | `{ gold: 18, momentum: 6 }` | `{ gold: 24 }` |
| mountain_pass.T1 | incomeBonus | `{ momentum: 1 }` | `{ iuniores: 1 }` |
| mountain_pass.T1 | buildCost | `{ gold: 5, momentum: 2 }` | `{ gold: 7 }` |
| mountain_pass.T2 | incomeBonus | `{ momentum: 1, gold: 1 }` | `{ iuniores: 1, gold: 1 }` |
| mountain_pass.T2 | buildCost | `{ gold: 12, momentum: 4 }` | `{ gold: 16 }` |
| mountain_pass.T3 | incomeBonus | `{ momentum: 2, gold: 2 }` | `{ iuniores: 2, gold: 2 }` |
| mountain_pass.T3 | buildCost | `{ gold: 22, momentum: 6 }` | `{ gold: 28 }` |
| oracle_shrine.T1 | incomeBonus | `{ faith: 1 }` | `{ gold: 1 }` |
| oracle_shrine.T1 | buildCost | `{ gold: 4, faith: 2 }` | `{ gold: 6 }` |
| oracle_shrine.T2 | incomeBonus | `{ faith: 2 }` | `{ gold: 2 }` |
| oracle_shrine.T2 | buildCost | `{ gold: 8, faith: 4 }` | `{ gold: 12 }` |
| oracle_shrine.T3 | incomeBonus | `{ faith: 3 }` | `{ gold: 3 }` |
| oracle_shrine.T3 | buildCost | `{ gold: 15, faith: 6 }` | `{ gold: 21 }` |
| gardens.T1 | buildCost | `{ gold: 6, influence: 2 }` | `{ gold: 8 }` |
| gardens.T2 | buildCost | `{ gold: 12, influence: 4 }` | `{ gold: 16 }` |
| gardens.T3 | buildCost | `{ gold: 22, influence: 6 }` | `{ gold: 28 }` |

- [ ] **Step 2: Update the building `description` strings that name deprecated resources**

In the same building levels, swap the description wording: `Momentum/season` → `Iuniores/season`; `Faith/season` → `Gold/season`; `Influence/season` → `Gold/season`. (e.g. castrum.T3 "+1 Momentum/season" → "+1 Iuniores/season"; basilica.T1 "+1 Influence/season." → "+1 Gold/season."; pantheon.T1 "+1 Faith/season." → "+1 Gold/season.".) Leave non-resource description text (unrest, free units, etc.) untouched.

- [ ] **Step 3: Simplify `investmentCostValue`** (cosmetic — the deprecated terms are now always 0)

Find (~line 904):
```ts
function investmentCostValue(inv: Investment): number {
  const cost = INVESTMENT_DATA[inv.type].levels[inv.level - 1].buildCost;
  // Gold + resource costs (other resources treated as 2× gold equivalent)
  return (cost.gold ?? 0)
    + (cost.momentum ?? 0) * 2
    + (cost.influence ?? 0) * 2
    + (cost.faith ?? 0) * 2;
}
```
Replace with:
```ts
function investmentCostValue(inv: Investment): number {
  const cost = INVESTMENT_DATA[inv.type].levels[inv.level - 1].buildCost;
  return (cost.gold ?? 0) + (cost.iuniores ?? 0) * 2;
}
```

- [ ] **Step 4: Type-check + commit**
```bash
npx tsc --noEmit
git add src/game/province/province.ts
git commit -m "refactor(province): buildings yield gold/iuniores, cost gold only"
```
Expected tsc: PASS. (Co-Authored-By trailer.)

---

## Task 5: Governors → gold income + gold-only hire costs

**Files:** `src/data/governor-data.ts`

- [ ] **Step 1: GOVERNOR_LEGATUS hire costs → gold**
- T1 `hireCost: { gold: 5, momentum: 2 }` → `{ gold: 7 }`
- T2 `hireCost: { gold: 10, momentum: 4 }` → `{ gold: 14 }`
- T3 `hireCost: { gold: 18, momentum: 6 }` → `{ gold: 24 }`

- [ ] **Step 2: GOVERNOR_PONTIFEX income → gold, costs → gold, descriptions**
- T1: trait `{ type: 'income-bonus', resource: 'faith', percent: 10 }` → `resource: 'gold'`; `hireCost: { gold: 4, faith: 3 }` → `{ gold: 7 }`; description `'+10% faith income.'` → `'+10% gold income.'`
- T2: trait `resource: 'faith', percent: 18` → `resource: 'gold'`; `hireCost: { gold: 8, faith: 6 }` → `{ gold: 14 }`; description `'+18% faith income, −8 unrest.'` → `'+18% gold income, −8 unrest.'`
- T3: trait `resource: 'faith', percent: 25` → `resource: 'gold'`; `hireCost: { gold: 14, faith: 10 }` → `{ gold: 24 }`; description `'+25% faith income, −15 unrest, −10% investment cost.'` → `'+25% gold income, −15 unrest, −10% investment cost.'`

- [ ] **Step 3: GOVERNOR_SENATOR income → gold, costs → gold, descriptions**
- T1: trait `{ type: 'income-bonus', resource: 'influence', percent: 10 }` → `resource: 'gold'`; `hireCost: { gold: 4, influence: 3 }` → `{ gold: 7 }`; description `'+10% influence income.'` → `'+10% gold income.'`
- T2: trait `resource: 'influence', percent: 18` → `resource: 'gold'`; `hireCost: { gold: 8, influence: 6 }` → `{ gold: 14 }`; description `'+18% influence income, +1 population growth.'` → `'+18% gold income, +1 population growth.'`
- T3: trait `resource: 'influence', percent: 25` → `resource: 'gold'`; `hireCost: { gold: 14, influence: 10 }` → `{ gold: 24 }`; description `'+25% influence income, +2 population growth, −10% expenses.'` → `'+25% gold income, +2 population growth, −10% expenses.'`

(Procurator, Legatus traits, and Prefect are already gold-only and stay as-is.)

- [ ] **Step 4: Type-check + commit**
```bash
npx tsc --noEmit
git add src/data/governor-data.ts
git commit -m "refactor(governor): gold income bonus + gold-only hire costs"
```
Expected tsc: PASS. (Co-Authored-By trailer.)

---

## Task 6: Income-tick iuniores fix + UI force-reads

**Files:** `src/game/province/province-store.ts`, `src/ui/screens/ProvinceScreen.tsx`

- [ ] **Step 1: Fix the iuniores overwrite in `collectProvinceIncome`** (`province-store.ts`)

Building/feature iuniores income currently gets clobbered by the population yield. Find (~line 314):
```ts
    const iunioresYield = Math.floor(prov.population * IUNIORES.perPop);
    if (iunioresYield > 0) {
      provIncome.iuniores = iunioresYield;
    }
```
Replace with (add instead of overwrite):
```ts
    const iunioresYield = Math.floor(prov.population * IUNIORES.perPop);
    if (iunioresYield > 0) {
      provIncome.iuniores = (provIncome.iuniores ?? 0) + iunioresYield;
    }
```

- [ ] **Step 2: Fix the ProvinceScreen force-reads** (`ProvinceScreen.tsx` ~line 631)

Replace:
```ts
  // Force signal reads for reactivity on resource changes
  getResource('gold');
  getResource('faith');
  getResource('influence');
  getResource('momentum');
```
with:
```ts
  // Force signal reads for reactivity on resource changes
  getResource('gold');
  getResource('iuniores');
```

- [ ] **Step 3: Type-check + commit**
```bash
npx tsc --noEmit
git add src/game/province/province-store.ts src/ui/screens/ProvinceScreen.tsx
git commit -m "fix(province): building iuniores adds to population yield; drop deprecated force-reads"
```
Expected tsc: PASS. (Co-Authored-By trailer.)

---

## Task 7: Wire the income tick on Hub return

**Files:** `src/ui/screens/iterbelli/EndgameCard.tsx`

- [ ] **Step 1: Import `collectProvinceIncome`**

In `EndgameCard.tsx`, find the province-store import:
```ts
import { conquerProvince, provinces } from '../../../game/province/province-store';
```
Replace with:
```ts
import { conquerProvince, provinces, collectProvinceIncome } from '../../../game/province/province-store';
```

- [ ] **Step 2: Run the tick once per elapsed season in `returnToHub`**

Find (in `returnToHub`):
```ts
  // Season clock advances regardless of outcome — campaign time elapsed.
  globalSeason.value = Math.min(MAX_SEASONS, globalSeason.value + s.spokeDuration);
```
Add immediately after it:
```ts
  // Provinces accrue income/ticks for each season spent on campaign.
  for (let i = 0; i < s.spokeDuration; i++) collectProvinceIncome();
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit` — expect PASS.
Run: `npx vite build` — expect success.

- [ ] **Step 4: Commit**
```bash
git add src/ui/screens/iterbelli/EndgameCard.tsx
git commit -m "feat(province): collect province income on Hub return (per elapsed season)"
```
(Co-Authored-By trailer.)

---

## Task 8: Verifier + final checks

**Files:** `tools/verify-province-resources.ts` (new)

- [ ] **Step 1: Write the verifier**

Create `tools/verify-province-resources.ts`:
```ts
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
```

- [ ] **Step 2: Run it — expect PASS**

Run: `npx tsx tools/verify-province-resources.ts`
Expected: all `✓`, ending `All checks passed.` (exit 0). If a check fails, a data file still references a deprecated resource — fix the data, not the assertion.

- [ ] **Step 3: Final checks**

Run: `npx tsc --noEmit` — clean.
Run: `npx vite build` — success.
Grep deprecated resources in the province data/UI surface — `grep -rE "faith|influence|momentum" src/data/province-features.ts src/data/trade-goods.ts src/data/governor-data.ts src/game/province/` should return ZERO matches (the `investmentCostValue` deprecated terms were removed in Task 4). ProvinceScreen may still mention them only in unrelated text — confirm none are resource references.

- [ ] **Step 4: Commit**
```bash
git add tools/verify-province-resources.ts
git commit -m "test(province): verifier for deprecated-resource-free province economy"
```
(Co-Authored-By trailer.)

- [ ] **Step 5: Manual runtime check**

`npm run dev` → New Game → embark → finish a campaign → return to Hub. Confirm gold and iuniores increased (province income ran). Open Provinciae: no ⭐/👑/🔥 anywhere; building costs gold-only; income ledger shows gold + iuniores; the Hire Governor modal shows gold-only costs.

---

## Self-Review Notes (resolved during planning)

- **Per-task tsc-clean:** each schema removal (ProvinceFeature, TradeGoodData, TerrainModifiers) is done in the same task as ALL its consumers (income functions + ProvinceScreen), so `tsc` stays green per task.
- **iuniores double-source:** after the remap, the income ledger shows building/feature/trade iuniores (in `nonGoldEntries`) AND the population iuniores row — these are distinct sources; intended.
- **Governor redundancy:** Procurator/Pontifex/Senator all become gold-income governors (accepted per spec); their secondary traits still differ.
- **Tick placement:** wired once, in `returnToHub` after the season-clock advance and before conquest, so a freshly-conquered province doesn't pay on the same return.
- **`collectProvinceIncome` signature:** confirmed it takes no args and runs ONE season per call → looped `spokeDuration` times.
