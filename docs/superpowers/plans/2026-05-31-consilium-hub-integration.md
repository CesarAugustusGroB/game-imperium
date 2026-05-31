# Consilium Hub Integration + Passive Revival Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make seated Consilium advisors affect the Hub (shop prices, season upkeep, gold income, season threat, per-spoke grants) like equipped doctrines, while keeping their campaign-seed channel; and revive the dead advisor passives.

**Architecture:** Advisor-passive aggregators live in `council-store.ts` (read `councilSlots`). Hub consumers combine the doctrine source with the advisor source: in-file where possible (advisor hire, spoke grants in council-store), and via the existing injection/setter pattern where a direct import would be awkward (`strategic-store.discountedGold` and `season-tick`), with `game-state` wiring the setters in `initializeRunScaffold`/`resetRun` exactly like `setIncomeModifierFn`. The campaign-seed bridge (`passiveModifier`) is kept and its dead cases revived.

**Tech Stack:** TypeScript, Preact, `@preact/signals`. Verification: `npx tsx tools/verify-*.ts` + `npx tsc --noEmit` + manual Chrome. `noUnusedLocals`/`noUnusedParameters` on.

**Note on cycles:** `game-state ↔ council-store` already import each other (benign — runtime-called bindings). Adding game-state→council-store aggregator imports and game-state→strategic-store/season-tick setter imports follows the same benign pattern (functions invoked at runtime, not module init).

---

## File Structure

- **Modify** `src/data/iter-belli-consilium.ts` — revive `passiveModifier` dead cases.
- **Modify** `src/game/council/council-store.ts` — advisor aggregators; advisor hire shop-discount total; spoke-grant loop adds advisor grants.
- **Modify** `src/game/progression/strategic-store.ts` — `setExtraShopDiscountFn` setter; `discountedGold` adds it.
- **Modify** `src/game/progression/season-tick.ts` — `setExtraUpkeepReductionFn` + `setThreatReductionFn` setters; combine in upkeep + threat.
- **Modify** `src/game/core/game-state.ts` — wire the setters + combined income fn (init + reset).
- **Modify** `src/ui/screens/forum/tabs/ConsiliumTab.tsx` — show real effect (Hub + campaign).
- **Create** `tools/verify-consilium-hub.ts` — verification, built across tasks.

---

## Task 1: Revive `passiveModifier` (campaign seed)

**Files:**
- Modify: `src/data/iter-belli-consilium.ts`
- Create: `tools/verify-consilium-hub.ts`

- [ ] **Step 1: Write the failing verification script**

Create `tools/verify-consilium-hub.ts`:

```typescript
/**
 * Verifies Consilium Hub integration + passive revival: passiveModifier revived,
 * advisor aggregators, and Hub consumers combining doctrine + advisor sources.
 * Run: npx tsx tools/verify-consilium-hub.ts
 */
import { passiveModifier } from '../src/data/iter-belli-consilium';
import type { AdvisorPassive } from '../src/game/council/advisor';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

// --- passiveModifier revived ---
const pm = (p: AdvisorPassive) => passiveModifier(p);
check('upkeep-reduction → supplies', pm({ type: 'upkeep-reduction', percent: 20 }).supplies > 0);
check('threat-reduction → threat', pm({ type: 'threat-reduction', amount: 2 }).threat === 2);
check('loot-bonus → gold', pm({ type: 'loot-bonus', percent: 25 }).gold === 5);
check('heal-between-nodes → morale', pm({ type: 'heal-between-nodes', amount: 200 }).morale === 2);
check('resource-per-spoke gold → gold', pm({ type: 'resource-per-spoke', resource: 'gold', amount: 3 }).gold === 3);
check('REVIVED: resource-per-spoke faith → gold', pm({ type: 'resource-per-spoke', resource: 'faith', amount: 3 }).gold === 3);
check('REVIVED: resource-per-spoke influence → gold', pm({ type: 'resource-per-spoke', resource: 'influence', amount: 2 }).gold === 2);
check('REVIVED: extra-event-choices → gold (n*5)', pm({ type: 'extra-event-choices', count: 2 }).gold === 10);
check('shop-discount no longer seeds gold (real Hub discount instead)', pm({ type: 'shop-discount', percent: 10 }).gold === 0);

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-consilium-hub.ts`
Expected: FAIL — revived cases (faith→gold, extra-event-choices→gold) and shop-discount-no-seed don't hold yet.

- [ ] **Step 3: Revive the dead cases**

In `src/data/iter-belli-consilium.ts`, add a constant near the top (after the imports / `UPKEEP_BUDGET`):

```typescript
/** Gold granted per extra-event-choice (advisor passive has no event system to widen). */
const EVENT_CHOICE_GOLD = 5;
```

Replace the `passiveModifier` switch body so it reads:

```typescript
  switch (passive.type) {
    case 'upkeep-reduction':
      return { ...z, supplies: Math.round((passive.percent / 100) * UPKEEP_BUDGET) };
    case 'threat-reduction':
      return { ...z, threat: passive.amount };
    case 'loot-bonus':
      return { ...z, gold: Math.round(passive.percent / 5) };
    case 'heal-between-nodes':
      return { ...z, morale: Math.round(passive.amount / 100) };
    case 'resource-per-spoke':
      // Deprecated resources (faith/influence/momentum) fold into gold.
      return { ...z, gold: passive.amount };
    case 'extra-event-choices':
      return { ...z, gold: passive.count * EVENT_CHOICE_GOLD };
    default:
      // shop-discount no longer seeds gold — it now applies as a real Hub discount.
      return z;
  }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx tools/verify-consilium-hub.ts`
Expected: PASS — all checks ✓.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 6: Commit**

```bash
git add src/data/iter-belli-consilium.ts tools/verify-consilium-hub.ts
git commit -m "feat(consilium): revive dead passive seed mappings (deprecated→gold, events→gold)"
```

---

## Task 2: Advisor aggregators in council-store

**Files:**
- Modify: `src/game/council/council-store.ts`
- Test: `tools/verify-consilium-hub.ts` (append)

- [ ] **Step 1: Append failing checks**

In `tools/verify-consilium-hub.ts`, add imports:

```typescript
import {
  councilSlots, advisorShopDiscount, advisorUpkeepReduction,
  advisorIncomeBonus, advisorThreatReduction, advisorSpokeGrants,
} from '../src/game/council/council-store';
import type { Advisor } from '../src/game/council/advisor';
```

Then add before the final `if (failures > 0)` block:

```typescript
// --- advisor aggregators ---
const mkA = (passive: AdvisorPassive): Advisor =>
  ({ currentTier: 1, color: 'white', tiers: [{ passive }, { passive }, { passive }] } as unknown as Advisor);

councilSlots.value = [null, null, null];
check('empty council → 0 shop discount', advisorShopDiscount() === 0);
check('empty council → 0 income bonus', advisorIncomeBonus('gold') === 0);
councilSlots.value = [
  mkA({ type: 'shop-discount', percent: 10 }),
  mkA({ type: 'upkeep-reduction', percent: 20 }),
  mkA({ type: 'threat-reduction', amount: 1 }),
];
check('advisorShopDiscount sums', advisorShopDiscount() === 10);
check('advisorUpkeepReduction sums', advisorUpkeepReduction() === 20);
check('advisorThreatReduction sums', advisorThreatReduction() === 1);
councilSlots.value = [mkA({ type: 'loot-bonus', percent: 25 }), null, null];
check('advisorIncomeBonus(gold) = loot %/100', Math.abs(advisorIncomeBonus('gold') - 0.25) < 1e-9);
check('advisorIncomeBonus(faith) = 0', advisorIncomeBonus('faith') === 0);
councilSlots.value = [
  mkA({ type: 'resource-per-spoke', resource: 'faith', amount: 3 }),
  mkA({ type: 'extra-event-choices', count: 2 }),
  null,
];
const grants = advisorSpokeGrants();
check('advisorSpokeGrants: deprecated res-per-spoke → gold', grants.some((g) => g.resource === 'gold' && g.amount === 3));
check('advisorSpokeGrants: extra-event-choices → gold n*5', grants.some((g) => g.resource === 'gold' && g.amount === 10));
councilSlots.value = [null, null, null];
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx tools/verify-consilium-hub.ts`
Expected: FAIL — aggregators not exported.

- [ ] **Step 3: Add the aggregators**

In `src/game/council/council-store.ts`, ensure `getCurrentPassive` is imported from `./advisor` (it imports `getCurrentSpokeTemplate, getTierForXp` already — add `getCurrentPassive`). Then add (near the other exported helpers):

```typescript
/** Sum of shop-discount percents from all seated advisors. */
export function advisorShopDiscount(): number {
  let sum = 0;
  for (const a of councilSlots.value) {
    if (!a) continue;
    const p = getCurrentPassive(a);
    if (p.type === 'shop-discount') sum += p.percent;
  }
  return sum;
}

/** Sum of upkeep-reduction percents from all seated advisors. */
export function advisorUpkeepReduction(): number {
  let sum = 0;
  for (const a of councilSlots.value) {
    if (!a) continue;
    const p = getCurrentPassive(a);
    if (p.type === 'upkeep-reduction') sum += p.percent;
  }
  return sum;
}

/** Sum of threat-reduction amounts from all seated advisors. */
export function advisorThreatReduction(): number {
  let sum = 0;
  for (const a of councilSlots.value) {
    if (!a) continue;
    const p = getCurrentPassive(a);
    if (p.type === 'threat-reduction') sum += p.amount;
  }
  return sum;
}

/** Additive income multiplier for a resource from seated advisors' loot-bonus (gold only). */
export function advisorIncomeBonus(resource: ResourceType): number {
  let bonus = 0;
  for (const a of councilSlots.value) {
    if (!a) continue;
    const p = getCurrentPassive(a);
    if (p.type === 'loot-bonus' && resource === 'gold') bonus += p.percent / 100;
  }
  return bonus;
}

/** Per-spoke grants from seated advisors: resource-per-spoke (deprecated→gold) + extra-event-choices→gold. */
export function advisorSpokeGrants(): { resource: ResourceType; amount: number }[] {
  const grants: { resource: ResourceType; amount: number }[] = [];
  for (const a of councilSlots.value) {
    if (!a) continue;
    const p = getCurrentPassive(a);
    if (p.type === 'resource-per-spoke') {
      const resource: ResourceType = p.resource === 'gold' || p.resource === 'iuniores' ? p.resource : 'gold';
      grants.push({ resource, amount: p.amount });
    } else if (p.type === 'extra-event-choices') {
      grants.push({ resource: 'gold', amount: p.count * 5 });
    }
  }
  return grants;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx tools/verify-consilium-hub.ts`
Expected: PASS — all checks ✓.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 6: Commit**

```bash
git add src/game/council/council-store.ts tools/verify-consilium-hub.ts
git commit -m "feat(consilium): advisor-passive Hub aggregators in council-store"
```

---

## Task 3: Wire advisors into Hub consumers

**Files:**
- Modify: `src/game/progression/strategic-store.ts`
- Modify: `src/game/progression/season-tick.ts`
- Modify: `src/game/council/council-store.ts`
- Modify: `src/game/core/game-state.ts`
- Test: `tools/verify-consilium-hub.ts` (append)

- [ ] **Step 1: Append failing integration checks**

In `tools/verify-consilium-hub.ts`, add imports:

```typescript
import { buySupplies, preparedArmy } from '../src/game/progression/strategic-store';
import { runSeasonTick } from '../src/game/progression/season-tick';
import { getDiscountedAdvisorCost } from '../src/game/council/council-store';
import { gold, getResource } from '../src/game/core/resources';
import { threatLevel } from '../src/game/core/game-state';
import { wireRunBonuses } from '../src/game/core/game-state';
import type { ArmyData } from '../src/types/index';
```

Then add before the final `if (failures > 0)` block:

```typescript
// --- Hub integration (requires the setters wired) ---
wireRunBonuses(); // wires advisor aggregators into resources/strategic-store/season-tick

// advisor shop-discount lowers buySupplies cost
councilSlots.value = [mkA({ type: 'shop-discount', percent: 50 }), null, null];
preparedArmy.value = { supplies: 0, cohorts: [], size: 0 } as unknown as ArmyData;
gold.value = 1000;
buySupplies(10);
const discounted = 1000 - getResource('gold');
councilSlots.value = [null, null, null];
preparedArmy.value = { supplies: 0, cohorts: [], size: 0 } as unknown as ArmyData;
gold.value = 1000;
buySupplies(10);
const full = 1000 - getResource('gold');
check('advisor shop-discount lowers buySupplies cost', discounted < full && discounted >= 1);

// advisor shop-discount lowers advisor hire cost
councilSlots.value = [null, null, null];
const advBase = getDiscountedAdvisorCost({ cost: 100 } as unknown as Advisor);
councilSlots.value = [mkA({ type: 'shop-discount', percent: 50 }), null, null];
const advDisc = getDiscountedAdvisorCost({ cost: 100 } as unknown as Advisor);
check('advisor shop-discount lowers advisor hire cost', advDisc < advBase);

// advisor upkeep-reduction lowers season upkeep
councilSlots.value = [null, null, null];
gold.value = 100;
runSeasonTick('defending', 1);
const upFull = 100 - getResource('gold');
councilSlots.value = [mkA({ type: 'upkeep-reduction', percent: 100 }), null, null];
gold.value = 100;
runSeasonTick('defending', 1);
const upRed = 100 - getResource('gold');
check('advisor upkeep-reduction lowers season upkeep', upRed < upFull);

// advisor threat-reduction lowers season threat growth
councilSlots.value = [null, null, null];
threatLevel.value = 0;
runSeasonTick('defending', 1);
const thFull = threatLevel.value;
councilSlots.value = [mkA({ type: 'threat-reduction', amount: 1 }), null, null];
threatLevel.value = 0;
runSeasonTick('defending', 1);
const thRed = threatLevel.value;
check('advisor threat-reduction lowers season threat growth', thRed < thFull);

councilSlots.value = [null, null, null];
preparedArmy.value = null;
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx tools/verify-consilium-hub.ts`
Expected: FAIL — `wireRunBonuses` / `setExtraShopDiscountFn` / `THREAT_PER_SEASON` export not present; advisors not yet combined into consumers.

- [ ] **Step 3: Add the shop-discount setter to `strategic-store.ts`**

In `src/game/progression/strategic-store.ts`, after the imports, add the setter (mirroring resources' `setIncomeModifierFn`):

```typescript
// Advisor shop-discount is pushed in from game-state to avoid an import cycle
// (council-store imports strategic-store; the reverse would be circular).
let extraShopDiscountFn: () => number = () => 0;
export function setExtraShopDiscountFn(fn: () => number): void {
  extraShopDiscountFn = fn;
}
```

Update `discountedGold` to combine doctrine + advisor, clamped 0–75:

```typescript
function discountedGold(base: number): number {
  const pct = Math.min(75, getShopDiscount() + extraShopDiscountFn());
  return Math.max(1, Math.round(base * (1 - pct / 100)));
}
```

(`buySupplies` already calls `discountedGold` after the earlier doctrine task, so supplies + recruit both pick this up.)

- [ ] **Step 4: Add upkeep + threat setters to `season-tick.ts` and combine**

In `src/game/progression/season-tick.ts`, after the existing exports (e.g. `THREAT_PER_SEASON`), add:

```typescript
// Advisor passives are pushed in from game-state (avoids importing council-store here).
let extraUpkeepReductionFn: () => number = () => 0;
export function setExtraUpkeepReductionFn(fn: () => number): void {
  extraUpkeepReductionFn = fn;
}
let threatReductionFn: () => number = () => 0;
export function setThreatReductionFn(fn: () => number): void {
  threatReductionFn = fn;
}
```

In `runSeasonTick`, change the `reductionPercent` line to add advisors:

```typescript
  const reductionPercent = getActiveEffects()
    .filter((e): e is Extract<DoctrineEffect, { type: 'upkeep-reduction'; percent: number }> => e.type === 'upkeep-reduction' && 'percent' in e)
    .reduce((sum, e) => sum + e.percent, 0) + extraUpkeepReductionFn();
```

Change the threat line to subtract advisor reduction (floored at 0):

```typescript
  threatLevel.value += Math.max(0, THREAT_PER_SEASON - threatReductionFn());
```

(Confirm `THREAT_PER_SEASON` is exported — it is declared `export const THREAT_PER_SEASON = 1;`.)

- [ ] **Step 5: Combine advisors into advisor-hire cost + spoke grants in `council-store.ts`**

In `src/game/council/council-store.ts`, `getAdvisorCost` (which already applies the doctrine discount) now also adds the advisor discount:

```typescript
function getAdvisorCost(advisor: Advisor): { resource: ResourceType; amount: number } {
  const pct = Math.min(75, getShopDiscount() + advisorShopDiscount());
  return { resource: 'gold', amount: Math.max(1, Math.round(advisor.cost * (1 - pct / 100))) };
}
```

In the spoke-start grant loop (the one that iterates `getActiveEffects()` granting doctrine `resource-per-spoke` via `grantSpokeResource`), after that loop add:

```typescript
  for (const g of advisorSpokeGrants()) {
    grantSpokeResource(g.resource, g.amount, faction);
  }
```

(`faction` is already in scope in that function — the same one passed to the doctrine grants. If the variable has a different name there, use it.)

- [ ] **Step 6: Wire the setters in `game-state.ts`**

In `src/game/core/game-state.ts`, add imports:

```typescript
import { advisorShopDiscount, advisorUpkeepReduction, advisorThreatReduction, advisorIncomeBonus } from '../council/council-store';
import { setExtraShopDiscountFn } from '../progression/strategic-store';
import { setExtraUpkeepReductionFn, setThreatReductionFn } from '../progression/season-tick';
```

(merge `advisor*` into the existing `'../council/council-store'` import line.)

Add an exported wiring helper (so the verify can call it directly) and call it from `initializeRunScaffold`:

```typescript
/** Wire equipped-doctrine + seated-advisor bonuses into the resource/strategic/season layers. */
export function wireRunBonuses(): void {
  setIncomeModifierFn((res) => getIncomeModifier(res) + advisorIncomeBonus(res));
  setExtraShopDiscountFn(advisorShopDiscount);
  setExtraUpkeepReductionFn(advisorUpkeepReduction);
  setThreatReductionFn(advisorThreatReduction);
}
```

In `initializeRunScaffold`, REPLACE the existing `setIncomeModifierFn(getIncomeModifier);` line with `wireRunBonuses();` (keep `setWarProfiler`/`setExchangeBonusFn` as they are).

In `resetRun`, after `setIncomeModifierFn(null);` add:

```typescript
  setIncomeModifierFn(null);
  setExtraShopDiscountFn(() => 0);
  setExtraUpkeepReductionFn(() => 0);
  setThreatReductionFn(() => 0);
```

- [ ] **Step 7: Run to verify it passes**

Run: `npx tsx tools/verify-consilium-hub.ts`
Expected: PASS — all checks ✓, "All checks passed."

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 9: Commit**

```bash
git add src/game/progression/strategic-store.ts src/game/progression/season-tick.ts src/game/council/council-store.ts src/game/core/game-state.ts tools/verify-consilium-hub.ts
git commit -m "feat(consilium): seated advisors affect Hub shop/upkeep/threat/income/spoke"
```

---

## Task 4: Show real effect on the Consilium card

**Files:**
- Modify: `src/ui/screens/forum/tabs/ConsiliumTab.tsx`

- [ ] **Step 1: Add a real-effect describer**

In `src/ui/screens/forum/tabs/ConsiliumTab.tsx`, read `describePassive` (~line 1039) and `heroLine` (~line 1081). Replace the body of `describePassive` so each passive describes its actual Hub + campaign effect (Spanish, consistent with the existing UI copy):

```typescript
function describePassive(p: AdvisorPassive): string {
  switch (p.type) {
    case 'upkeep-reduction':   return `−${p.percent}% upkeep de temporada · +suministros al embarcar`;
    case 'shop-discount':      return `−${p.percent}% precios del Hub`;
    case 'loot-bonus':         return `+${p.percent}% income de oro · +oro al embarcar`;
    case 'threat-reduction':   return `−${p.amount} amenaza/temporada · −amenaza al embarcar`;
    case 'heal-between-nodes': return `+moral al embarcar`;
    case 'resource-per-spoke': return `+${p.amount} oro por spoke · +oro al embarcar`;
    case 'extra-event-choices':return `+${p.count * 5} oro por spoke`;
  }
}
```

(If `describePassive` is used in a context that needs a shorter string, keep it concise; the switch must remain exhaustive over `AdvisorPassive`. If `heroLine` duplicates per-type text, update it to call `describePassive` or mirror the same effect wording so the hero blurb matches the real effect.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 3: Commit**

```bash
git add src/ui/screens/forum/tabs/ConsiliumTab.tsx
git commit -m "feat(consilium): doctrine card shows advisors' real Hub + campaign effect"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the consilium-hub verification**

Run: `npx tsx tools/verify-consilium-hub.ts`
Expected: PASS — "All checks passed."

- [ ] **Step 2: Run prior verifications (regression)**

Each must print "All checks passed.":
- `npx tsx tools/verify-doctrine-hub.ts`
- `npx tsx tools/verify-iter-belli-consilium.ts`
- `npx tsx tools/verify-iter-belli-quests.ts`
- `npx tsx tools/verify-iter-belli-doctrines.ts`
- `npx tsx tools/verify-decretum-hub.ts`

- [ ] **Step 3: Full type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 4: Manual Chrome check**

Dev server `http://localhost:5188/` (title "IMPERIUM"; if down: `npx vite --port 5188 --strictPort`).

1. New Game → Forum → Consilium: seat advisors; confirm the card descriptions read as the REAL effect (e.g. "−10% precios del Hub", "+5 oro por spoke") not the old generic text.
2. Seat a `shop-discount` advisor → buy supplies / hire another advisor → confirm the gold cost drops.
3. Seat an `upkeep-reduction` / `threat-reduction` advisor → advance a season → confirm less upkeep paid / less threat gained.
4. Seat a `loot-bonus` advisor → confirm gold income is boosted; seat a `resource-per-spoke`/`extra-event-choices` advisor → confirm gold granted at spoke start.
5. Embark → confirm the campaign seed still reflects the (revived) passive modifiers.

Report what you observed. Do not claim success without seeing the behavior.

- [ ] **Step 5: Final note**

No commit. If any check fails, return to the owning task, fix, and re-run.

---

## Self-Review notes (for the implementer)

- **Aggregators read `councilSlots`** (all seated advisors) for Hub effects; the campaign-seed bridge (`computeConsiliumSetup`) keeps its mission-seat exclusion unchanged.
- **Injection pattern** mirrors `setIncomeModifierFn`: setters default to `() => 0`, game-state pushes the advisor aggregators in `wireRunBonuses()` (called from `initializeRunScaffold`) and clears them in `resetRun`. This avoids the strategic-store/season-tick → council-store cycle.
- **Shop-discount total** is clamped 0–75 at BOTH consumers (`discountedGold`, `getAdvisorCost`).
- **Threat floor:** `Math.max(0, THREAT_PER_SEASON - threatReductionFn())`.
- **`game-state ↔ council-store`** already import each other (benign, runtime-called); the new advisor aggregator imports follow the same pattern.
- **Type consistency:** `advisorShopDiscount/UpkeepReduction/ThreatReduction(): number`, `advisorIncomeBonus(resource): number`, `advisorSpokeGrants(): {resource,amount}[]`, `wireRunBonuses(): void`, setters `(fn:()=>number)=>void` — identical across council-store, strategic-store, season-tick, game-state, and the verify.
- **EVENT_CHOICE_GOLD = 5** used in both `passiveModifier` (seed) and `advisorSpokeGrants` (Hub); literal 5 in council-store with a comment is acceptable (tuning constant).
