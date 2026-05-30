# Doctrine Hub Revival Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the 23 doctrines so their effects are live Hub effects (gold income, season upkeep, per-spoke gold/iuniores, Hub shop discount, and a new embark-army bonus), wire the missing surfaces, and show each doctrine's campaign effect on its card.

**Architecture:** Rewrite `doctrine-data.ts` to use a small live effect vocabulary (the only new type is `embark-bonus`, added to the `DoctrineEffect` union). New selectors aggregate equipped-doctrine effects; `shop-discount` is wired into Hub gold purchases; `embark-bonus` is summed and added to the Iter Belli campaign seed at embark. The deprecated battle effect types stay in the union (so battle code compiles) but are no longer used by the data.

**Tech Stack:** TypeScript, Preact, `@preact/signals`. Verification: `npx tsx tools/verify-*.ts` + `npx tsc --noEmit` + manual Chrome.

**Conventions:** Run from worktree root `C:\Users\Henrich von Kleist\workspace\Map2D\.claude\worktrees\experimentation`. Conventional Commits, scope `doctrine`. Project enables `noUnusedLocals`/`noUnusedParameters`.

---

## File Structure

- **Modify** `src/game/items/doctrine.ts` — add `embark-bonus` to the `DoctrineEffect` union.
- **Modify** `src/game/items/doctrine-store.ts` — add `getShopDiscount()` + `getEmbarkBonus()` selectors.
- **Modify** `src/data/doctrine-data.ts` — rewrite all 23 doctrines' `effects` + `description`.
- **Modify** `src/game/progression/strategic-store.ts` — apply shop-discount in `buySupplies` (and recruit gold).
- **Modify** `src/game/council/council-store.ts` — apply shop-discount in `hireAndSeatAdvisor` gold cost.
- **Modify** `src/ui/screens/forum/panels/EmbarkCard.tsx` — add embark-bonus to the campaign seed.
- **Modify** `src/ui/components/DoctrineRenderer.tsx` — render the `embark-bonus` effect type.
- **Modify** `src/ui/screens/forum/tabs/DoctrinaeTab.tsx` — show each doctrine's campaign (Iter Belli) effect.
- **Create** `tools/verify-doctrine-hub.ts` — verification, built across tasks.

---

## Task 1: `embark-bonus` type + selectors

**Files:**
- Modify: `src/game/items/doctrine.ts`
- Modify: `src/game/items/doctrine-store.ts`
- Create: `tools/verify-doctrine-hub.ts`

- [ ] **Step 1: Write the failing verification script**

Create `tools/verify-doctrine-hub.ts`:

```typescript
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-doctrine-hub.ts`
Expected: FAIL — `getShopDiscount` / `getEmbarkBonus` not exported.

- [ ] **Step 3: Add `embark-bonus` to the `DoctrineEffect` union**

In `src/game/items/doctrine.ts`, add the variant to the `DoctrineEffect` union (after `upkeep-reduction`):

```typescript
  | { type: 'upkeep-reduction'; percent: number }
  | { type: 'embark-bonus'; stat: 'soldiers' | 'morale' | 'supplies' | 'discipline'; amount: number };
```

- [ ] **Step 4: Add the selectors**

In `src/game/items/doctrine-store.ts`, after `getIncomeModifier` (the typed-effect-helpers section), add:

```typescript
/** Sum of shop-discount percents from equipped doctrines, clamped 0–75. */
export function getShopDiscount(): number {
  const sum = getActiveEffects()
    .filter((e): e is Extract<DoctrineEffect, { type: 'shop-discount' }> => e.type === 'shop-discount')
    .reduce((s, e) => s + e.percent, 0);
  return Math.max(0, Math.min(75, sum));
}

/** Aggregate embark-army bonus (per stat) from equipped doctrines. */
export function getEmbarkBonus(): { soldiers: number; morale: number; supplies: number; discipline: number } {
  const out = { soldiers: 0, morale: 0, supplies: 0, discipline: 0 };
  for (const e of getActiveEffects()) {
    if (e.type === 'embark-bonus') out[e.stat] += e.amount;
  }
  return out;
}
```

(`equippedDoctrines` is already exported from this module; the verify imports it. If it is not exported, add `export` to its declaration.)

- [ ] **Step 5: Run it to verify it passes**

Run: `npx tsx tools/verify-doctrine-hub.ts`
Expected: PASS — all checks ✓.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors). Note: `DoctrineRenderer.tsx` switches over effect types but has a `default`/non-exhaustive handling; if tsc reports a missing case for `embark-bonus` there, that is handled in Task 5 — if tsc is clean now, proceed.

- [ ] **Step 7: Commit**

```bash
git add src/game/items/doctrine.ts src/game/items/doctrine-store.ts tools/verify-doctrine-hub.ts
git commit -m "feat(doctrine): embark-bonus effect type + shop-discount/embark selectors"
```

---

## Task 2: Rewrite the 23 doctrines to the live vocabulary

**Files:**
- Modify: `src/data/doctrine-data.ts`
- Test: `tools/verify-doctrine-hub.ts` (append)

- [ ] **Step 1: Append a failing data-guard check**

In `tools/verify-doctrine-hub.ts`, add the import:

```typescript
import { STARTER_DOCTRINES } from '../src/data/doctrine-data';
```

Then add before the final `if (failures > 0)` block:

```typescript
// --- data uses only the live Hub vocabulary ---
const LIVE_TYPES = new Set(['income-modifier', 'upkeep-reduction', 'resource-per-spoke', 'shop-discount', 'embark-bonus']);
const DEAD = STARTER_DOCTRINES.flatMap((d) => d.levels.flatMap((l) => l.effects))
  .filter((e) => !LIVE_TYPES.has(e.type));
check('no doctrine uses a dead/battle effect type', DEAD.length === 0);
check('resource-per-spoke only grants live resources (gold/iuniores)',
  STARTER_DOCTRINES.flatMap((d) => d.levels.flatMap((l) => l.effects))
    .filter((e): e is Extract<DoctrineEffect, { type: 'resource-per-spoke' }> => e.type === 'resource-per-spoke')
    .every((e) => e.resource === 'gold' || e.resource === 'iuniores'));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-doctrine-hub.ts`
Expected: FAIL — the current data uses dead types (stat-modifier, heal-on-kill, etc.).

- [ ] **Step 3: Rewrite each doctrine's `levels`**

In `src/data/doctrine-data.ts`, replace the `levels` array of EACH doctrine with the versions below. Keep `id`, `name`, `color`, `currentLevel`, and each level's `upgradeCost` exactly as they are now — change ONLY `description` and `effects`.

```typescript
// DOCTRINE_SWORD
levels: [
  { description: '+200 soldiers on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 200 }], upgradeCost: { momentum: 3 } },
  { description: '+400 soldiers on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { momentum: 6 } },
  { description: '+600 soldiers on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 600 }], upgradeCost: {} },
],
// DOCTRINE_IRON
levels: [
  { description: '+400 soldiers on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { momentum: 4 } },
  { description: '+800 soldiers on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { momentum: 8 } },
  { description: '+1200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }], upgradeCost: {} },
],
// DOCTRINE_BLOOD
levels: [
  { description: '+1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { momentum: 2, gold: 2 } },
  { description: '+2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { momentum: 5, gold: 3 } },
  { description: '+3 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: {} },
],
// DOCTRINE_DIPLOMACY
levels: [
  { description: '+5 gold per spoke.',  effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 5 }], upgradeCost: { influence: 3 } },
  { description: '+10 gold per spoke.', effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 10 }], upgradeCost: { influence: 6 } },
  { description: '+15 gold per spoke.', effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 15 }], upgradeCost: {} },
],
// DOCTRINE_COURT
levels: [
  { description: '+5 gold per spoke.',  effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 5 }], upgradeCost: { influence: 4 } },
  { description: '+10 gold per spoke.', effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 10 }], upgradeCost: { influence: 8 } },
  { description: '+15 gold per spoke.', effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 15 }], upgradeCost: {} },
],
// DOCTRINE_ALLIANCES
levels: [
  { description: '+400 soldiers on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { influence: 3, gold: 2 } },
  { description: '+800 soldiers on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { influence: 6, gold: 4 } },
  { description: '+1200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }], upgradeCost: {} },
],
// DOCTRINE_FAITH
levels: [
  { description: '+5 gold per spoke.',  effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 5 }], upgradeCost: { faith: 3 } },
  { description: '+10 gold per spoke.', effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 10 }], upgradeCost: { faith: 6 } },
  { description: '+15 gold per spoke.', effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 15 }], upgradeCost: {} },
],
// DOCTRINE_MIRACLES
levels: [
  { description: '+1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { faith: 4 } },
  { description: '+2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { faith: 8 } },
  { description: '+3 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: {} },
],
// DOCTRINE_PANTHEON
levels: [
  { description: '+1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { faith: 3, gold: 3 } },
  { description: '+2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { faith: 7, gold: 5 } },
  { description: '+3 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: {} },
],
// DOCTRINE_TRADE — unchanged effects (income-modifier already live); keep as-is.
// DOCTRINE_INFRASTRUCTURE — unchanged (upkeep-reduction). Keep as-is.
// DOCTRINE_MARKET — unchanged effects (shop-discount; now wired). Keep as-is.
// DOCTRINE_ANNONA — unchanged (income + upkeep). Keep as-is.
// DOCTRINE_PEOPLE
levels: [
  { description: '+400 soldiers on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { gold: 3 } },
  { description: '+800 soldiers on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { gold: 6 } },
  { description: '+1200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }], upgradeCost: {} },
],
// DOCTRINE_MILITIA
levels: [
  { description: '+400 soldiers on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { gold: 4 } },
  { description: '+800 soldiers on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { gold: 8 } },
  { description: '+1200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }], upgradeCost: {} },
],
// DOCTRINE_RESILIENCE
levels: [
  { description: '+200 soldiers + 1 morale on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 200 }, { type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { gold: 3, momentum: 2 } },
  { description: '+400 soldiers + 2 morale on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }, { type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { gold: 6, momentum: 4 } },
  { description: '+600 soldiers + 3 morale on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 600 }, { type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: {} },
],
// DOCTRINE_LEX_MILITARIS
levels: [
  { description: '+400 soldiers on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }], upgradeCost: { momentum: 3 } },
  { description: '+800 soldiers on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { momentum: 6 } },
  { description: '+1200 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }], upgradeCost: {} },
],
// DOCTRINE_VIS_BELLICA
levels: [
  { description: '+200 soldiers + 1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 200 }, { type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { momentum: 4, gold: 2 } },
  { description: '+400 soldiers + 1 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }, { type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { momentum: 7, gold: 4 } },
  { description: '+600 soldiers + 2 morale on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 600 }, { type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: {} },
],
// DOCTRINE_PAX_ROMANA
levels: [
  { description: '+5 gold per spoke + shop prices reduced by 5%.',   effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 5 }, { type: 'shop-discount', percent: 5 }], upgradeCost: { influence: 4 } },
  { description: '+10 gold per spoke + shop prices reduced by 10%.', effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 10 }, { type: 'shop-discount', percent: 10 }], upgradeCost: { influence: 8 } },
  { description: '+15 gold per spoke + shop prices reduced by 15%.', effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 15 }, { type: 'shop-discount', percent: 15 }], upgradeCost: {} },
],
// DOCTRINE_FOEDUS_AETERNUM
levels: [
  { description: '+400 soldiers on campaign start + +15% gold income.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 400 }, { type: 'income-modifier', resource: 'gold', multiplier: 0.15 }], upgradeCost: { influence: 5, gold: 3 } },
  { description: '+800 soldiers on campaign start + +25% gold income.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }, { type: 'income-modifier', resource: 'gold', multiplier: 0.25 }], upgradeCost: { influence: 9, gold: 5 } },
  { description: '+1200 soldiers on campaign start + +40% gold income.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1200 }, { type: 'income-modifier', resource: 'gold', multiplier: 0.40 }], upgradeCost: {} },
],
// DOCTRINE_DIVINA_PROVIDENTIA
levels: [
  { description: '+5 gold per spoke + 1 morale on campaign start.',  effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 5 }, { type: 'embark-bonus', stat: 'morale', amount: 1 }], upgradeCost: { faith: 5 } },
  { description: '+10 gold per spoke + 2 morale on campaign start.', effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 10 }, { type: 'embark-bonus', stat: 'morale', amount: 2 }], upgradeCost: { faith: 9 } },
  { description: '+15 gold per spoke + 3 morale on campaign start.', effects: [{ type: 'resource-per-spoke', resource: 'gold', amount: 15 }, { type: 'embark-bonus', stat: 'morale', amount: 3 }], upgradeCost: {} },
],
// DOCTRINE_VIRTUS_POPULI
levels: [
  { description: '+800 soldiers on campaign start.',  effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 800 }], upgradeCost: { gold: 4 } },
  { description: '+1600 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 1600 }], upgradeCost: { gold: 8 } },
  { description: '+2400 soldiers on campaign start.', effects: [{ type: 'embark-bonus', stat: 'soldiers', amount: 2400 }], upgradeCost: {} },
],
// DOCTRINE_CONCORDIA
levels: [
  { description: '+1 morale on campaign start + 5 gold per spoke.',  effects: [{ type: 'embark-bonus', stat: 'morale', amount: 1 }, { type: 'resource-per-spoke', resource: 'gold', amount: 5 }], upgradeCost: { gold: 4, momentum: 2 } },
  { description: '+2 morale on campaign start + 10 gold per spoke.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 2 }, { type: 'resource-per-spoke', resource: 'gold', amount: 10 }], upgradeCost: { gold: 7, momentum: 4 } },
  { description: '+3 morale on campaign start + 15 gold per spoke.', effects: [{ type: 'embark-bonus', stat: 'morale', amount: 3 }, { type: 'resource-per-spoke', resource: 'gold', amount: 15 }], upgradeCost: {} },
],
```

(Trade, Infrastructure, Market, Annona keep their current `effects`/`description` — do not touch them. Apply the rewrites above to the other 19 by matching each `DOCTRINE_*` const.)

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx tools/verify-doctrine-hub.ts`
Expected: PASS — the data guard passes (no dead types; resource-per-spoke only gold/iuniores).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 6: Commit**

```bash
git add src/data/doctrine-data.ts tools/verify-doctrine-hub.ts
git commit -m "feat(doctrine): rewrite 23 doctrines to live Hub effects"
```

---

## Task 3: Wire `shop-discount` into Hub gold purchases

**Files:**
- Modify: `src/game/progression/strategic-store.ts`
- Modify: `src/game/council/council-store.ts`
- Test: `tools/verify-doctrine-hub.ts` (append)

- [ ] **Step 1: Append failing checks**

In `tools/verify-doctrine-hub.ts`, add imports:

```typescript
import { buySupplies, preparedArmy } from '../src/game/progression/strategic-store';
import { gold, getResource } from '../src/game/core/resources';
import type { ArmyData } from '../src/types/index';
```

Then add before the final `if (failures > 0)` block:

```typescript
// --- shop-discount reduces buySupplies gold cost ---
// buySupplies cost = ceil(qty / SUPPLIES_PER_GOLD); with 50% discount it halves (min 1).
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx tools/verify-doctrine-hub.ts`
Expected: FAIL — buySupplies cost is unchanged by the discount.

- [ ] **Step 3: Apply discount in `buySupplies`**

In `src/game/progression/strategic-store.ts`, add the import (merge with existing doctrine-store import if present; otherwise add):

```typescript
import { getShopDiscount } from '../items/doctrine-store';
```

In `buySupplies`, replace the cost line:

```typescript
  const cost = Math.ceil(buyable / SUPPLIES_PER_GOLD);
```

with:

```typescript
  const baseCost = Math.ceil(buyable / SUPPLIES_PER_GOLD);
  const cost = Math.max(1, Math.round(baseCost * (1 - getShopDiscount() / 100)));
```

- [ ] **Step 4: Apply discount in `recruitCohort` (gold side)**

In `src/game/progression/strategic-store.ts`, in `recruitCohort`, replace `spendResource('gold', cohort.aurumCost);` with a discounted spend, and discount the gold gate in `getRecruitFailureForCohort`. Add a local helper near the top of the file (after imports):

```typescript
/** Gold cost after equipped-doctrine shop-discount, min 1. */
function discountedGold(base: number): number {
  return Math.max(1, Math.round(base * (1 - getShopDiscount() / 100)));
}
```

In `getRecruitFailureForCohort`, change `if (!canAfford('gold', cohort.aurumCost)) return 'insufficient-gold';` to:

```typescript
  if (!canAfford('gold', discountedGold(cohort.aurumCost))) return 'insufficient-gold';
```

In `recruitCohort`, change `spendResource('gold', cohort.aurumCost);` to:

```typescript
  spendResource('gold', discountedGold(cohort.aurumCost));
```

- [ ] **Step 5: Apply discount in `hireAndSeatAdvisor`**

In `src/game/council/council-store.ts`, add the import:

```typescript
import { getShopDiscount } from '../items/doctrine-store';
```

In `getAdvisorCost` (or wherever the advisor gold cost is computed for the hire), apply the discount so the hire spends the discounted amount. Read the function and replace the returned amount:

```typescript
function getAdvisorCost(advisor: Advisor): { resource: ResourceType; amount: number } {
  return { resource: 'gold', amount: Math.max(1, Math.round(advisor.cost * (1 - getShopDiscount() / 100))) };
}
```

(If `hireAndSeatAdvisor` reads `advisor.cost` directly instead of via `getAdvisorCost`, apply the same discount at the spend + afford site there.)

- [ ] **Step 6: Run to verify it passes**

Run: `npx tsx tools/verify-doctrine-hub.ts`
Expected: PASS — all checks ✓.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. Confirm no import cycle (`doctrine-store` does not import `strategic-store`/`council-store`).

- [ ] **Step 8: Commit**

```bash
git add src/game/progression/strategic-store.ts src/game/council/council-store.ts tools/verify-doctrine-hub.ts
git commit -m "feat(doctrine): wire shop-discount into supply/recruit/advisor purchases"
```

---

## Task 4: Apply `embark-bonus` to the campaign seed

**Files:**
- Modify: `src/ui/screens/forum/panels/EmbarkCard.tsx`

- [ ] **Step 1: Import the selector**

In `EmbarkCard.tsx`, add:

```typescript
import { getEmbarkBonus } from '../../../../game/items/doctrine-store';
```

- [ ] **Step 2: Compute and apply the bonus in `handleEmbark`**

In `EmbarkCard.tsx`, inside `handleEmbark`, after the existing `const soldiers = ...` / `const discipline = ...` / `const supplies = ...` computations and before `startIterBelliCampaign({ ... })`, add:

```typescript
    const embark = getEmbarkBonus();
```

Then modify the seed values passed to `startIterBelliCampaign`:
- `soldiers: soldiers + embark.soldiers`
- `discipline: discipline + embark.discipline` (the seed already clamps discipline 1–5 in `startIterBelliCampaign`)
- `supplies: supplies + embark.supplies`
- `startMorale: START.morale + consilium.morale + embark.morale`

Concretely, update the call so those four fields read:

```typescript
    startIterBelliCampaign({
      soldiers: soldiers + embark.soldiers,
      gold: getResource('gold') + consilium.gold,
      iuniores: getResource('iuniores'),
      discipline: discipline + embark.discipline,
      archetype, spokeTerrain, spokeDuration,
      supplies: supplies + embark.supplies,
      missionId: consilium.missionId ?? undefined,
      startThreat: START.threat - consilium.threat,
      startMorale: START.morale + consilium.morale + embark.morale,
      quests: secondaryQuests,
      doctrineModifiers,
    });
```

(Match the existing property set; only `soldiers`, `discipline`, `supplies`, and `startMorale` change to add the `embark.*` terms. `soldiers`/`discipline`/`supplies` were previously passed via the `discipline, archetype, ... supplies` shorthand — expand them to explicit `key: value` as shown.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/forum/panels/EmbarkCard.tsx
git commit -m "feat(doctrine): embark applies equipped-doctrine army/morale bonus to the seed"
```

---

## Task 5: UI — render `embark-bonus` + show each doctrine's campaign effect

**Files:**
- Modify: `src/ui/components/DoctrineRenderer.tsx`
- Modify: `src/ui/screens/forum/tabs/DoctrinaeTab.tsx`

- [ ] **Step 1: Render the `embark-bonus` effect type**

In `src/ui/components/DoctrineRenderer.tsx`, find the two `switch` blocks over `effect.type` (icon/short label ~line 86, and full text ~line 117). Add an `embark-bonus` case to BOTH, mirroring the style of the sibling cases. For the text switch:

```typescript
    case 'embark-bonus':
      return `+${effect.amount} ${effect.stat} on campaign start`;
```

For the icon/short switch (around line 86–110), add a case returning a sensible glyph/short label consistent with the others, e.g.:

```typescript
    case 'embark-bonus':
      return '⚔';
```

(Read the surrounding cases to match exact return shapes — one returns an icon string, the other a description string.)

- [ ] **Step 2: Add a color→campaign-effect helper + show it on the doctrine card**

In `src/ui/screens/forum/tabs/DoctrinaeTab.tsx`, add a small module-level map describing the Iter Belli (Fase 1) behavior per color:

```typescript
const CAMPAIGN_EFFECT_BY_COLOR: Record<string, string> = {
  red: 'Campaña: las cartas de Coerción erosionan más al enemigo.',
  blue: 'Campaña: las cartas de Diplomacia cuestan menos oro y bajan más la amenaza.',
  gold: 'Campaña: +moral cada turno.',
  purple: 'Campaña: las cartas de Logística dan más suministros.',
  white: 'Campaña: +suministros cada turno.',
};
```

In the doctrine detail panel (where the Hub effect/description is shown for the selected doctrine), add a line beneath it:

```tsx
        <div style={{ fontSize: 11, color: 'var(--imp-text-lo)', fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic', marginTop: 6 }}>
          {CAMPAIGN_EFFECT_BY_COLOR[selected.color] ?? ''}
        </div>
```

(Use the actual variable name the detail panel uses for the selected doctrine — read the file to confirm; `selected.color` is illustrative.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/DoctrineRenderer.tsx src/ui/screens/forum/tabs/DoctrinaeTab.tsx
git commit -m "feat(doctrine): render embark-bonus + show campaign effect on doctrine card"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the doctrine-hub verification**

Run: `npx tsx tools/verify-doctrine-hub.ts`
Expected: PASS — "All checks passed."

- [ ] **Step 2: Run prior verifications (regression)**

Each must print "All checks passed.":
- `npx tsx tools/verify-iter-belli-doctrines.ts`
- `npx tsx tools/verify-iter-belli-quests.ts`
- `npx tsx tools/verify-iter-belli-consilium.ts`
- `npx tsx tools/verify-decretum-hub.ts`

- [ ] **Step 3: Full type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 4: Manual Chrome check**

Dev server on `http://localhost:5188/` (title "IMPERIUM"; if not running: `npx vite --port 5188 --strictPort`).

1. Forum → Doctrinae: confirm each equipped doctrine's description matches its real effect (no more "shop prices" with no effect, etc.) and shows a "Campaña: …" line.
2. Equip a `shop-discount` doctrine (Market / Pax Romana) → buy supplies / recruit / hire an advisor and confirm the gold cost is reduced.
3. Equip an `embark-bonus` doctrine (Sword / People / Miracles) → embark Iter Belli and confirm the campaign starts with the extra soldiers/morale.
4. Equip a `resource-per-spoke gold` doctrine → confirm gold is granted at spoke start.

Report what you observed. Do not claim success without seeing the behavior.

- [ ] **Step 5: Final note**

No commit needed. If any check fails, return to the owning task, fix, and re-run.

---

## Self-Review notes (for the implementer)

- **Only new type:** `embark-bonus`. All other effect types in the data already exist in the union. Battle types stay in the union for the deprecated battle code; the data no longer uses them (Task 2's guard enforces this).
- **Decoupling / no cycle:** `doctrine-store` exports the selectors; `strategic-store` and `council-store` import them (one direction — `doctrine-store` must not import those).
- **Shop-discount math:** `cost = max(1, round(base * (1 - pct/100)))`, pct clamped 0–75 in `getShopDiscount`. Applied to supply purchase, cohort recruit (gate + spend), and advisor hire.
- **Embark-bonus:** summed per stat by `getEmbarkBonus`; added to the campaign seed in `EmbarkCard` (soldiers/discipline/supplies/morale). `discipline` is clamped 1–5 inside `startIterBelliCampaign`. It only affects Iter Belli (no army mutation in the Hub).
- **Type consistency:** `getShopDiscount(): number`, `getEmbarkBonus(): {soldiers,morale,supplies,discipline}`, `embark-bonus` stat ∈ those four keys — identical across data, selectors, and EmbarkCard.
