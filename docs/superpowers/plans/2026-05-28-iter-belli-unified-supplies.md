# Iter Belli — Unified supplies (one economy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make army supplies a single economy across the Hub and the Iter Belli campaign — the campaign starts from the Hub army's supply stock, consumes it on the Hub scale, and writes the leftover back on return.

**Architecture:** Extends the `CampaignSeed` bridge (same pattern as gold/iuniores/discipline): `EmbarkCard` seeds `supplies` from `preparedArmy.supplies`; `EndgameCard.returnToHub` writes the remainder back (clamped to the Hub carry cap). Three campaign balance constants are retuned to the Hub scale. The Iter Belli logic module gains no run-state imports; no bellum/battle code is touched.

**Tech Stack:** TypeScript, Preact `@preact/signals`, Vite. Verification: standalone `tools/verify-*.ts` run with `npx tsx` (tools/ is NOT type-checked — `tsconfig` `include` is `["src"]`); plus `npx tsc --noEmit` and a manual browser check. PowerShell shell — chain commands with `;` not `&&`.

---

### Task 1: Retune supply balance constants to the Hub scale

**Files:**
- Modify: `src/game/iterBelli/iter-belli-balance.ts`
- Test: `tools/verify-iter-belli-supplies.ts` (create)

- [ ] **Step 1: Write the failing verification script**

Create `tools/verify-iter-belli-supplies.ts`:

```ts
/**
 * Verifies unified supplies: retuned constants (Task 1) + seed round-trip (Task 2).
 * Run: npx tsx tools/verify-iter-belli-supplies.ts
 */
import { SUPPLY_UPKEEP_PER_TURN, CAMP_SUPPLY_COST, START } from '../src/game/iterBelli/iter-belli-balance';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

// --- Retuned constants (Hub scale) ---
check('upkeep per turn is 2', SUPPLY_UPKEEP_PER_TURN === 2);
check('camp supply cost is 4', CAMP_SUPPLY_COST === 4);
check('START.supplies is 28', START.supplies === 28);

// --- Seed round-trip (added in Task 2) ---

if (failures > 0) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll checks passed');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-iter-belli-supplies.ts`
Expected: FAIL — the three constant checks print `✗` (upkeep is still 1, camp 2, START.supplies 12); ends with `3 check(s) failed`.

- [ ] **Step 3: Retune the constants**

In `src/game/iterBelli/iter-belli-balance.ts`:

(a) In the `START` object, change the `supplies` line from `supplies: 12,` to:

```ts
  supplies: 28,
```

(b) Change `export const SUPPLY_UPKEEP_PER_TURN = 1;` to:

```ts
export const SUPPLY_UPKEEP_PER_TURN = 2;
```

(c) Change `export const CAMP_SUPPLY_COST = 2;` to:

```ts
export const CAMP_SUPPLY_COST = 4;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx tools/verify-iter-belli-supplies.ts`
Expected: PASS — three `✓`, ends with `All checks passed`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/game/iterBelli/iter-belli-balance.ts tools/verify-iter-belli-supplies.ts
git commit -m "feat(iterbelli): retune supply constants to the Hub scale"
```

---

### Task 2: Seed supplies through the CampaignSeed bridge

**Files:**
- Modify: `src/game/iterBelli/iter-belli-state.ts` (`CampaignSeed`, `startIterBelliCampaign`)
- Test: `tools/verify-iter-belli-supplies.ts` (extend)

- [ ] **Step 1: Add the seed round-trip checks (failing)**

In `tools/verify-iter-belli-supplies.ts`, add this import at the TOP with the other imports:

```ts
import { startIterBelliCampaign, resetIterBelli, iterBelliState } from '../src/game/iterBelli/iter-belli-state';
```

Then replace the `// --- Seed round-trip (added in Task 2) ---` line with:

```ts
// --- Seed round-trip ---
const seedBase = { soldiers: 1000, gold: 0, iuniores: 0, discipline: 4, archetype: null, spokeTerrain: 'plains', spokeDuration: 1 };
startIterBelliCampaign({ ...seedBase, supplies: 50 });
check('seed applies supplies', iterBelliState.value.supplies === 50);
startIterBelliCampaign({ ...seedBase, supplies: -3.7 });
check('seed floors & clamps supplies to >= 0', iterBelliState.value.supplies === 0);
startIterBelliCampaign({ ...seedBase });
check('omitted supplies falls back to START default (28)', iterBelliState.value.supplies === 28);
resetIterBelli();
check('reset restores supplies default (28)', iterBelliState.value.supplies === 28);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-iter-belli-supplies.ts`
Expected: FAIL — `seed applies supplies` prints `✗` (the seed does not yet carry `supplies`, so `iterBelliState.value.supplies` stays at the START default 28, not 50). Other constant checks still pass.

- [ ] **Step 3: Add `supplies` to `CampaignSeed` (optional) and apply it**

In `src/game/iterBelli/iter-belli-state.ts`:

(a) Add an optional `supplies` field to the `CampaignSeed` interface, so it reads:

```ts
export interface CampaignSeed {
  soldiers: number;
  gold: number;
  iuniores: number;
  discipline: number;
  archetype: Archetype | null;
  spokeTerrain: string;
  spokeDuration: number;
  /** Supplies carried from the Hub army stock; omitted → keeps the START default. */
  supplies?: number;
}
```

(It is **optional** on purpose: the existing seed callers in `tools/verify-iter-belli-commander.ts` and `tools/verify-iter-belli-reinforcements.ts` do not pass `supplies`, and `freshState()` already initialises `S.supplies` to `START.supplies`. Optional keeps them working and avoids `NaN`.)

(b) In `startIterBelliCampaign`, after the existing line `S.spokeDuration = Math.max(1, Math.floor(seed.spokeDuration));` add:

```ts
  if (seed.supplies != null) S.supplies = Math.max(0, Math.floor(seed.supplies));
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx tools/verify-iter-belli-supplies.ts`
Expected: PASS — all checks (3 constants + 4 seed) print `✓`, ends with `All checks passed`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0 (the field is optional, so `EmbarkCard`'s existing seed call still compiles).

- [ ] **Step 6: Commit**

```bash
git add src/game/iterBelli/iter-belli-state.ts tools/verify-iter-belli-supplies.ts
git commit -m "feat(iterbelli): seed supplies through the campaign bridge"
```

---

### Task 3: Seed supplies at embark + fix the supply warning

**Files:**
- Modify: `src/ui/screens/forum/panels/EmbarkCard.tsx`

- [ ] **Step 1: Add the imports**

In `src/ui/screens/forum/panels/EmbarkCard.tsx`, after the existing import line
`import { themeToTerrain } from '../../../../data/iter-belli-conquest';` add:

```ts
import { SUPPLY_UPKEEP_PER_TURN, START } from '../../../../game/iterBelli/iter-belli-balance';
import { SUPPLIES_STARTING_STOCK } from '../../../../config/game-config';
```

- [ ] **Step 2: Replace the stale (node-based) supply-warning computation**

The current block (just after `const canEmbark = ...`) reads:

```ts
  // Supply warning: how many supplies are needed for the unresolved nodes
  const unresolvedNodes = nodes.filter((n) => !n.resolved);
  const cohortCount = army?.cohorts?.length ?? 0;
  const suppliesHave = army?.supplies ?? 0;
  const suppliesNeeded = cohortCount * unresolvedNodes.length;
  const supplyWarning = canEmbark && cohortCount > 0 && suppliesHave < suppliesNeeded;
```

Replace it with (Iter Belli has no nodes — warn against the campaign's upkeep budget instead):

```ts
  // Supply warning: warn if the Hub stock is below the campaign's upkeep budget.
  const suppliesHave = army?.supplies ?? 0;
  const suppliesRecommended = SUPPLY_UPKEEP_PER_TURN * START.timeRemaining;
  const supplyWarning = canEmbark && suppliesHave < suppliesRecommended;
```

(`unresolvedNodes`, `cohortCount`, and `suppliesNeeded` are removed — `noUnusedLocals` is on, so leaving any of them would fail tsc. `nodes` is still used by `canEmbark`, so it stays.)

- [ ] **Step 3: Update the warning message**

In the supply-warning JSX, change the message line from:

```tsx
            Supplies: {suppliesHave}/{suppliesNeeded} — cohorts will take HP & morale attrition
```

to:

```tsx
            Supplies: {suppliesHave}/{suppliesRecommended} — buy more in Exercitus or the campaign may starve
```

- [ ] **Step 4: Pass `supplies` in the seed**

In `handleEmbark()`, the current seed call is:

```ts
    startIterBelliCampaign({ soldiers, gold: getResource('gold'), iuniores: getResource('iuniores'), discipline, archetype, spokeTerrain, spokeDuration });
```

Replace it with (note `army` is already in component scope as `const army = preparedArmy.value;`):

```ts
    const supplies = army?.supplies ?? SUPPLIES_STARTING_STOCK;
    startIterBelliCampaign({ soldiers, gold: getResource('gold'), iuniores: getResource('iuniores'), discipline, archetype, spokeTerrain, spokeDuration, supplies });
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/forum/panels/EmbarkCard.tsx
git commit -m "feat(iterbelli): seed supplies from Hub stock + fix embark supply warning"
```

---

### Task 4: Write leftover supplies back to the Hub on return

**Files:**
- Modify: `src/ui/screens/iterbelli/EndgameCard.tsx`

- [ ] **Step 1: Add the import**

In `src/ui/screens/iterbelli/EndgameCard.tsx`, after the existing import line
`import type { ResourceType } from '../../../game/core/commander';` add:

```ts
import { SUPPLY_MAX_CARRY } from '../../../config/game-config';
```

- [ ] **Step 2: Fold the supplies write-back into the army reassignment**

In `returnToHub()`, the current army block reads:

```ts
  const army = preparedArmy.value;
  if (army && s.initialSoldiers > 0) {
    const ratio = Math.max(0, Math.min(1, s.soldiers / s.initialSoldiers));
    const cohorts = army.cohorts
      .map((c) => {
        const cur = c.currentHp ?? c.stats.hp;
        const scaled = Math.round(cur * ratio);
        return { ...c, currentHp: scaled, outOfAction: scaled <= 0 };
      })
      .filter((c) => (c.currentHp ?? 0) > 0);
    preparedArmy.value = { ...army, cohorts, size: computeArmySize(cohorts) };
  }
```

Replace the whole block with (guard on `army` only, so supplies always return when an army exists; cohort scaling stays conditional on `initialSoldiers > 0`):

```ts
  const army = preparedArmy.value;
  if (army) {
    // Surviving soldiers scale each cohort's HP (dead cohorts drop out).
    let cohorts = army.cohorts;
    if (s.initialSoldiers > 0) {
      const ratio = Math.max(0, Math.min(1, s.soldiers / s.initialSoldiers));
      cohorts = army.cohorts
        .map((c) => {
          const cur = c.currentHp ?? c.stats.hp;
          const scaled = Math.round(cur * ratio);
          return { ...c, currentHp: scaled, outOfAction: scaled <= 0 };
        })
        .filter((c) => (c.currentHp ?? 0) > 0);
    }
    // Unified supplies: leftover campaign supplies flow back, capped at the Hub carry cap.
    preparedArmy.value = {
      ...army,
      cohorts,
      size: computeArmySize(cohorts),
      supplies: Math.max(0, Math.min(SUPPLY_MAX_CARRY, s.supplies)),
    };
  }
```

- [ ] **Step 3: Update the function doc comment**

The block comment above `returnToHub` lists what flows back. Add a supplies bullet — change:

```ts
 *  • surviving soldiers scale each cohort's HP (dead cohorts drop out).
 */
```

to:

```ts
 *  • surviving soldiers scale each cohort's HP (dead cohorts drop out),
 *  • leftover campaign supplies flow back to the Hub army (capped at the carry cap).
 */
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Re-run the verification script (regression)**

Run: `npx tsx tools/verify-iter-belli-supplies.ts`
Expected: PASS — `All checks passed`.

- [ ] **Step 6: Manual browser check** (controller performs this; implementer stops at the commit)

1. New Game → commander → Hub.
2. Exercitus tab → buy supplies; watch the `📦 N/80` counter rise (e.g. to 60).
3. Back to Overview → Embark → the Iter Belli **Suministros** chip shows that stock (e.g. 60), not 12/28.
4. Play turns / Camp → supplies drain on the new scale (−2/turn, −4 camp).
5. Finish the campaign → at the Hub the Exercitus `📦` shows the leftover (less than before), confirming round-trip.
6. With Hub supplies below 24, the embark card shows the new upkeep-budget warning.

- [ ] **Step 7: Commit**

```bash
git add src/ui/screens/iterbelli/EndgameCard.tsx
git commit -m "feat(iterbelli): return leftover campaign supplies to the Hub army"
```

---

## Notes for the implementer

- Do NOT touch any bellum / node-map / battle code, `src/game/campaign/*`, `army/morale.ts`, or the `buySupplies`/Exercitus flow. This feature is confined to the Iter Belli balance/state module + the embark/endgame UI bridge + the new verify script.
- There is a pre-existing, unrelated uncommitted change to `src/ui/screens/TitleScreen.tsx`. Do NOT stage or commit it — use the exact targeted `git add` paths in each task; never `git commit -a`/`-am`.
- `supplies` is intentionally OPTIONAL on `CampaignSeed` (back-compat with other seed callers; `freshState` supplies the default). Do not make it required.
- Card supply deltas in `src/data/iter-belli-cards.ts` are intentionally left unscaled — do NOT rescale them.
- `tools/` is not type-checked by `tsc` (tsconfig `include` is `["src"]`); the verify script is validated only by running it with `npx tsx`.
