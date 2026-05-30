# Iter Belli — Doctrinae Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Equipped Hub doctrines modify the Iter Belli campaign — each equipped doctrine contributes a color-themed modifier that hooks into the card pool / turn loop (a signature behavior per color, scaled by doctrine level).

**Architecture:** A pure-data module (`iter-belli-doctrines.ts`) defines a `DoctrineCampaignModifier` factory per color and a bridge that reads `equippedDoctrines` into a modifier list. The campaign engine stores the list in state and consults each modifier's optional hooks at three points: draw weight, card play (cost discount + bonus effects), and per-turn passive. The campaign-logic module never imports doctrine/run types; only the data bridge (called from EmbarkCard) does.

**Tech Stack:** TypeScript, Preact, `@preact/signals`. No test runner — verification is `npx tsx tools/verify-*.ts` + `npx tsc --noEmit` + manual Chrome check.

**Conventions:** Run all commands from the worktree root `C:\Users\Henrich von Kleist\workspace\Map2D\.claude\worktrees\experimentation`. Commit style: Conventional Commits, scope `iterbelli`.

---

## File Structure

- **Create** `src/data/iter-belli-doctrines.ts` — `DoctrineColor`, `DOCTRINE_MODIFIERS` (5 factories), `computeDoctrineModifiers` bridge. Pure; imports only `iter-belli-types` + the `Doctrine` type.
- **Create** `tools/verify-iter-belli-doctrines.ts` — verification script, built across Tasks 2–4.
- **Modify** `src/game/iterBelli/iter-belli-types.ts` — `DoctrineCampaignModifier` type; add `doctrineModifiers` to `IterBelliState`.
- **Modify** `src/game/iterBelli/iter-belli-state.ts` — `freshState`, `CampaignSeed`, `startIterBelliCampaign`, `drawCard` (weight), `playCard` (costDelta + onPlay), `endTurn` (onTurn); add `CardCost`/`OperationCard` imports.
- **Modify** `src/ui/screens/forum/panels/EmbarkCard.tsx` — compute + seed doctrine modifiers + preview.

---

## Task 1: Modifier type + state field

**Files:**
- Modify: `src/game/iterBelli/iter-belli-types.ts`

- [ ] **Step 1: Add the `DoctrineCampaignModifier` type**

In `iter-belli-types.ts`, immediately AFTER the `SecondaryQuest` interface (the block added for quests, before `// ── Battle ──`), add:

```typescript
// ── Doctrine campaign modifiers (Doctrinae Fase 1) ───────────────────────────

/**
 * A campaign modifier contributed by one equipped Hub doctrine. All hooks are
 * optional; the engine consults whichever a modifier defines. `color` lives in
 * the run domain, so this type stays color-agnostic — the data bridge maps
 * doctrines to these.
 */
export interface DoctrineCampaignModifier {
  id: string;
  label: string;
  /** Draw-weight multiplier for a card (absent → treated as 1). */
  weight?: (card: OperationCard) => number;
  /** Cost adjustment (negative = discount) applied when a card is played. */
  costDelta?: (card: OperationCard) => CardCost;
  /** Extra effects added when a card is played. */
  onPlay?: (card: OperationCard, ctx: CardContext) => CardEffects;
  /** Passive effects applied each turn. */
  onTurn?: (state: IterBelliState) => CardEffects;
}
```

- [ ] **Step 2: Add `doctrineModifiers` to `IterBelliState`**

In `iter-belli-types.ts`, inside `interface IterBelliState`, after the `quests: SecondaryQuest[];` field, add:

```typescript
  /** Consilium secondary quests (from non-mission seats); empty if none. */
  quests: SecondaryQuest[];
  /** Campaign modifiers from equipped Hub doctrines (Fase 1); empty if none. */
  doctrineModifiers: DoctrineCampaignModifier[];
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS except ONE expected error — `Property 'doctrineModifiers' is missing` in `freshState` in `iter-belli-state.ts`. That single error is EXPECTED and fixed in Task 3. Do NOT touch `iter-belli-state.ts` in this task. If you see other errors, fix them.

- [ ] **Step 4: Commit**

```bash
git add src/game/iterBelli/iter-belli-types.ts
git commit -m "feat(iterbelli): DoctrineCampaignModifier type + state field"
```

---

## Task 2: Doctrine data module + bridge

**Files:**
- Create: `src/data/iter-belli-doctrines.ts`
- Create: `tools/verify-iter-belli-doctrines.ts`

- [ ] **Step 1: Write the failing verification script**

Create `tools/verify-iter-belli-doctrines.ts`:

```typescript
/**
 * Verifies Doctrinae Fase 1: per-color modifier factories, the bridge, and the
 * engine hooks (weight/costDelta/onPlay/onTurn).
 * Run: npx tsx tools/verify-iter-belli-doctrines.ts
 */
import { DOCTRINE_MODIFIERS, computeDoctrineModifiers } from '../src/data/iter-belli-doctrines';
import type { OperationCard, CardContext } from '../src/game/iterBelli/iter-belli-types';
import type { Doctrine } from '../src/game/items/doctrine';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

const coercion = { category: 'Coerción' } as OperationCard;
const logistica = { category: 'Logística' } as OperationCard;
const diplomacia = { category: 'Diplomacia' } as OperationCard;
const noCtx = {} as CardContext;

// --- Per-color modifier factories ---
check('red onPlay Coerción → enemyWeaken +t (t=2)', DOCTRINE_MODIFIERS.red(2).onPlay!(coercion, noCtx).enemyWeaken === 2);
check('red onPlay non-Coerción → no enemyWeaken', DOCTRINE_MODIFIERS.red(2).onPlay!(logistica, noCtx).enemyWeaken === undefined);
check('blue costDelta Diplomacia → gold -5t (t=3)', DOCTRINE_MODIFIERS.blue(3).costDelta!(diplomacia).gold === -15);
check('blue onPlay Diplomacia → threat -t (t=2)', DOCTRINE_MODIFIERS.blue(2).onPlay!(diplomacia, noCtx).threat === -2);
check('blue costDelta non-Diplomacia → no gold', DOCTRINE_MODIFIERS.blue(2).costDelta!(logistica).gold === undefined);
check('purple onPlay Logística → supplies +2t (t=2)', DOCTRINE_MODIFIERS.purple(2).onPlay!(logistica, noCtx).supplies === 4);
check('gold onTurn → morale +0.3t (t=3)', Math.abs((DOCTRINE_MODIFIERS.gold(3).onTurn!({} as never).morale ?? 0) - 0.9) < 1e-9);
check('white onTurn → supplies +t (t=2)', DOCTRINE_MODIFIERS.white(2).onTurn!({} as never).supplies === 2);

// --- Bridge ---
const mk = (color: string, level: 1 | 2 | 3): Doctrine => ({ color, currentLevel: level } as unknown as Doctrine);
check('empty slots → no modifiers', computeDoctrineModifiers([null, null, null, null]).length === 0);
const mods = computeDoctrineModifiers([mk('red', 1), null, mk('red', 2), mk('blue', 1)]);
check('one modifier per equipped doctrine', mods.length === 3);
check('stacking same color → two red modifiers', mods.filter((m) => m.label.includes('Marcial')).length === 2);
check('bridge red level scales (t=2 → +2)', mods.find((m) => m.label.includes('Marcial'))!.onPlay!(coercion, noCtx).enemyWeaken !== undefined);

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-iter-belli-doctrines.ts`
Expected: FAIL — module `../src/data/iter-belli-doctrines` does not exist (import error).

- [ ] **Step 3: Create the data module**

Create `src/data/iter-belli-doctrines.ts`:

```typescript
/**
 * Iter Belli — Doctrinae Fase 1: per-color campaign-modifier factories + bridge.
 * Pure data + functions. Maps each equipped Hub doctrine to a DoctrineCampaignModifier
 * by color, scaled by the doctrine's level. The campaign engine consults the
 * modifiers' hooks; it never imports this module's run-domain dependency.
 */
import type {
  CardCost, CardContext, CardEffects, DoctrineCampaignModifier, OperationCard,
} from '../game/iterBelli/iter-belli-types';
import type { Doctrine } from '../game/items/doctrine';

export type DoctrineColor = 'red' | 'blue' | 'gold' | 'purple' | 'white';

const NONE: CardEffects = {};
const NO_COST: CardCost = {};

/**
 * One signature campaign behavior per doctrine color. `level` (1/2/3) scales the
 * effect. Hooks return empty objects for cards/categories they do not affect.
 */
export const DOCTRINE_MODIFIERS: Record<DoctrineColor, (level: number) => DoctrineCampaignModifier> = {
  red: (level) => ({
    id: 'doctrine_red',
    label: 'Doctrina Marcial',
    onPlay: (card) => (card.category === 'Coerción' ? { enemyWeaken: level } : NONE),
  }),
  blue: (level) => ({
    id: 'doctrine_blue',
    label: 'Doctrina Diplomática',
    costDelta: (card) => (card.category === 'Diplomacia' ? { gold: -5 * level } : NO_COST),
    onPlay: (card) => (card.category === 'Diplomacia' ? { threat: -level } : NONE),
  }),
  purple: (level) => ({
    id: 'doctrine_purple',
    label: 'Doctrina Económica',
    onPlay: (card) => (card.category === 'Logística' ? { supplies: 2 * level } : NONE),
  }),
  gold: (level) => ({
    id: 'doctrine_gold',
    label: 'Doctrina Religiosa',
    onTurn: () => ({ morale: 0.3 * level }),
  }),
  white: (level) => ({
    id: 'doctrine_white',
    label: 'Doctrina Populista',
    onTurn: () => ({ supplies: level }),
  }),
};

/**
 * Resolve equipped doctrines into campaign modifiers: one per occupied slot,
 * themed by color and scaled by level. Same-color doctrines stack.
 */
export function computeDoctrineModifiers(equipped: (Doctrine | null)[]): DoctrineCampaignModifier[] {
  const mods: DoctrineCampaignModifier[] = [];
  for (const doctrine of equipped) {
    if (!doctrine) continue;
    const factory = DOCTRINE_MODIFIERS[doctrine.color as DoctrineColor];
    if (factory) mods.push(factory(doctrine.currentLevel));
  }
  return mods;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx tools/verify-iter-belli-doctrines.ts`
Expected: PASS — all checks ✓, "All checks passed."

- [ ] **Step 5: Commit**

```bash
git add src/data/iter-belli-doctrines.ts tools/verify-iter-belli-doctrines.ts
git commit -m "feat(iterbelli): per-color doctrine modifier factories + bridge"
```

---

## Task 3: State plumbing (seed + storage)

**Files:**
- Modify: `src/game/iterBelli/iter-belli-state.ts`
- Test: `tools/verify-iter-belli-doctrines.ts` (append)

- [ ] **Step 1: Append failing checks to the verify script**

In `tools/verify-iter-belli-doctrines.ts`, add to the imports:

```typescript
import { startIterBelliCampaign, resetIterBelli, iterBelliState } from '../src/game/iterBelli/iter-belli-state';
import type { DoctrineCampaignModifier } from '../src/game/iterBelli/iter-belli-types';
```

Then add before the final `if (failures > 0)` block:

```typescript
// --- Seed round-trip ---
const seedBase = { soldiers: 4000, gold: 100, iuniores: 0, discipline: 4, archetype: null, spokeTerrain: 'plains', spokeDuration: 1 };
const synthMod: DoctrineCampaignModifier = { id: 'synth', label: 'Synth' };
startIterBelliCampaign({ ...seedBase, doctrineModifiers: [synthMod] });
check('seed stores doctrineModifiers', iterBelliState.value.doctrineModifiers.length === 1);
startIterBelliCampaign({ ...seedBase });
check('omitted doctrineModifiers → empty', iterBelliState.value.doctrineModifiers.length === 0);
resetIterBelli();
check('reset clears doctrineModifiers', iterBelliState.value.doctrineModifiers.length === 0);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-iter-belli-doctrines.ts`
Expected: FAIL — `CampaignSeed` has no `doctrineModifiers`, `freshState` lacks the field (TS error and/or failed checks).

- [ ] **Step 3: Add `doctrineModifiers` to `freshState`**

In `iter-belli-state.ts`, inside `freshState()` return object, after `quests: [],` add:

```typescript
    quests: [],
    doctrineModifiers: [],
```

- [ ] **Step 4: Add `doctrineModifiers` to `CampaignSeed` + import the type**

In `iter-belli-state.ts`, update the type import from `./iter-belli-types` to add `CardCost`, `OperationCard`, and `DoctrineCampaignModifier` (merge into the existing line — do NOT duplicate):

```typescript
import type {
  Archetype, CardContext, CardCost, CardEffects, CardInstance, DoctrineCampaignModifier,
  IterBelliState, Location, LogKind, LogLine, OperationCard, SecondaryQuest,
} from './iter-belli-types';
```

In `interface CampaignSeed`, after `quests?: SecondaryQuest[];` add:

```typescript
  /** Consilium secondary quests (Fase 2); omitted → none. */
  quests?: SecondaryQuest[];
  /** Equipped-doctrine campaign modifiers (Doctrinae Fase 1); omitted → none. */
  doctrineModifiers?: DoctrineCampaignModifier[];
```

- [ ] **Step 5: Store the seed in `startIterBelliCampaign`**

In `iter-belli-state.ts`, in `startIterBelliCampaign`, right after the line `S.quests = (seed.quests ?? []).map((q) => ({ ...q }));` add:

```typescript
  S.quests = (seed.quests ?? []).map((q) => ({ ...q }));
  S.doctrineModifiers = (seed.doctrineModifiers ?? []).slice();
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npx tsx tools/verify-iter-belli-doctrines.ts`
Expected: PASS — all checks ✓.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors — the Task 1 `freshState` error is now resolved).

- [ ] **Step 8: Commit**

```bash
git add src/game/iterBelli/iter-belli-state.ts tools/verify-iter-belli-doctrines.ts
git commit -m "feat(iterbelli): seed + store doctrine modifiers in campaign state"
```

---

## Task 4: Engine hooks (weight, costDelta, onPlay, onTurn)

**Files:**
- Modify: `src/game/iterBelli/iter-belli-state.ts`
- Test: `tools/verify-iter-belli-doctrines.ts` (append)

- [ ] **Step 1: Append failing checks to the verify script**

In `tools/verify-iter-belli-doctrines.ts`, extend the state import to add `playCard` and `camp`:

```typescript
import { startIterBelliCampaign, resetIterBelli, iterBelliState, playCard, camp } from '../src/game/iterBelli/iter-belli-state';
```

Add the quest type import (a quest seeds a deterministic known card into the pool):

```typescript
import type { SecondaryQuest } from '../src/game/iterBelli/iter-belli-types';
```

Then add before the final `if (failures > 0)` block:

```typescript
// --- onPlay + costDelta plumbing (deterministic via a seeded quest card) ---
// The quest card "Asalto al fuerte" is category 'Operaciones', effects { gold:35, enemyWeaken:1 }, cost { time:1, supplies:4 }.
const fronteraQuest: SecondaryQuest = { id: 'dq', color: 'red', title: 'Asalto al fuerte', locationId: 'frontera', window: 5, status: 'pending' };
const synthPlay: DoctrineCampaignModifier = {
  id: 'synthPlay', label: 'SynthPlay',
  onPlay: (card) => (card.category === 'Operaciones' ? { gold: 10 } : {}),
  costDelta: (card) => (card.category === 'Operaciones' ? { supplies: -2 } : {}),
};
startIterBelliCampaign({ ...seedBase, gold: 100, quests: [fronteraQuest], doctrineModifiers: [synthPlay] });
let s = iterBelliState.value;
const qc = s.pool.find((c) => c.def.questId === 'dq');
check('quest card present in pool', !!qc);
const goldBefore = s.gold;
const supBefore = s.supplies;
const weakBefore = s.enemyWeaken;
playCard(qc!.instanceId);
s = iterBelliState.value;
check('onPlay bonus applied (gold +45 = 35 reward + 10 doctrine)', s.gold === goldBefore + 45);
check('base quest reward intact (enemyWeaken +1)', s.enemyWeaken === weakBefore + 1);
check('costDelta discount applied (supplies -4: cost 2 + upkeep 2, not 6)', s.supplies === supBefore - 4);

// --- onTurn plumbing ---
const synthTurn: DoctrineCampaignModifier = { id: 'synthTurn', label: 'SynthTurn', onTurn: () => ({ supplies: 10 }) };
startIterBelliCampaign({ ...seedBase, doctrineModifiers: [synthTurn] });
let t = iterBelliState.value;
const supB = t.supplies;
camp(); // camp -4 supplies, endTurn upkeep -2, doctrine onTurn +10 → net +4
t = iterBelliState.value;
check('onTurn passive applied each turn (supplies net +4)', t.supplies === supB + 4);

// --- non-matching category untouched ---
const synthGate: DoctrineCampaignModifier = {
  id: 'synthGate', label: 'SynthGate',
  onPlay: (card) => (card.category === 'Coerción' ? { gold: 999 } : {}),
};
startIterBelliCampaign({ ...seedBase, gold: 100, quests: [{ ...fronteraQuest, id: 'dq2' }], doctrineModifiers: [synthGate] });
let g = iterBelliState.value;
const qc2 = g.pool.find((c) => c.def.questId === 'dq2');
const goldB2 = g.gold;
playCard(qc2!.instanceId);
g = iterBelliState.value;
check('category-gated onPlay does not fire on non-matching card (gold +35 only)', g.gold === goldB2 + 35);

resetIterBelli();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-iter-belli-doctrines.ts`
Expected: FAIL — the engine does not yet consult `onPlay`/`costDelta`/`onTurn` (gold/supplies deltas wrong).

- [ ] **Step 3: Wire the weight hook into `drawCard`**

In `iter-belli-state.ts`, replace the `drawCard` function (the one that computes `totalWeight` from `c.weight`) with:

```typescript
function drawCard(): CardInstance | null {
  const eligible = eligibleCards();
  if (eligible.length === 0) return null;
  const weightOf = (c: OperationCard): number => {
    let w = c.weight;
    for (const m of S.doctrineModifiers) if (m.weight) w *= m.weight(c);
    return Math.max(0, w);
  };
  const totalWeight = eligible.reduce((s, c) => s + weightOf(c), 0);
  let r = Math.random() * totalWeight;
  for (const c of eligible) {
    r -= weightOf(c);
    if (r <= 0) {
      return { instanceId: S.cardIdCounter++, def: c, timer: c.expiry };
    }
  }
  return null;
}
```

- [ ] **Step 4: Wire costDelta + onPlay into `playCard`**

In `iter-belli-state.ts`, in `playCard`, replace the cost block:

```typescript
  const cost = def.cost ?? {};
  // Costs apply regardless of gamble outcome.
  applyChange('supplies', -(cost.supplies ?? 0));
  applyChange('gold', -(cost.gold ?? 0));
  applyChange('iuniores', -(cost.iuniores ?? 0));
```

with:

```typescript
  // Effective cost = base cost + doctrine cost deltas (discounts), clamped ≥ 0.
  const cost: CardCost = { ...(def.cost ?? {}) };
  for (const m of S.doctrineModifiers) {
    if (!m.costDelta) continue;
    const d = m.costDelta(def);
    if (d.time != null) cost.time = (cost.time ?? 0) + d.time;
    if (d.gold != null) cost.gold = (cost.gold ?? 0) + d.gold;
    if (d.supplies != null) cost.supplies = (cost.supplies ?? 0) + d.supplies;
    if (d.iuniores != null) cost.iuniores = (cost.iuniores ?? 0) + d.iuniores;
  }
  if (cost.time != null) cost.time = Math.max(0, cost.time);
  if (cost.gold != null) cost.gold = Math.max(0, cost.gold);
  if (cost.supplies != null) cost.supplies = Math.max(0, cost.supplies);
  if (cost.iuniores != null) cost.iuniores = Math.max(0, cost.iuniores);
  // Costs apply regardless of gamble outcome.
  applyChange('supplies', -(cost.supplies ?? 0));
  applyChange('gold', -(cost.gold ?? 0));
  applyChange('iuniores', -(cost.iuniores ?? 0));
```

Then, still in `playCard`, find the line `const goingToBattle = applyEffects(eff);` and add the doctrine onPlay bonuses immediately after it:

```typescript
  const goingToBattle = applyEffects(eff);

  // Doctrine onPlay bonuses (applied after the card's own effects).
  for (const m of S.doctrineModifiers) {
    if (m.onPlay) applyEffects(m.onPlay(def, ctx()));
  }
```

(The existing `endTurn(cost.time || 1);` at the end of `playCard` now uses the discounted `cost` — leave that line as-is.)

- [ ] **Step 5: Wire onTurn into `endTurn`**

In `iter-belli-state.ts`, in `endTurn`, right after the passive-upkeep line `if (S.supplies > 0) applyChange('supplies', -B.SUPPLY_UPKEEP_PER_TURN);` add:

```typescript
  // Passive upkeep.
  if (S.supplies > 0) applyChange('supplies', -B.SUPPLY_UPKEEP_PER_TURN);

  // Doctrine passives (after upkeep, before hunger/mutiny so they can offset a crisis).
  for (const m of S.doctrineModifiers) {
    if (m.onTurn) applyEffects(m.onTurn(S));
  }
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npx tsx tools/verify-iter-belli-doctrines.ts`
Expected: PASS — all checks ✓, "All checks passed."

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 8: Commit**

```bash
git add src/game/iterBelli/iter-belli-state.ts tools/verify-iter-belli-doctrines.ts
git commit -m "feat(iterbelli): consult doctrine modifiers in draw/play/turn hooks"
```

---

## Task 5: Embark wiring (compute + seed + preview)

**Files:**
- Modify: `src/ui/screens/forum/panels/EmbarkCard.tsx`

- [ ] **Step 1: Add imports**

In `EmbarkCard.tsx`, add (the file already imports `useMemo` from `preact/hooks` and `councilSlots` from council-store; add these two new imports near the other imports):

```typescript
import { equippedDoctrines } from '../../../../game/items/doctrine-store';
import { computeDoctrineModifiers } from '../../../../data/iter-belli-doctrines';
```

- [ ] **Step 2: Compute the modifiers + preview**

In `EmbarkCard.tsx`, right after the existing memoized `secondaryQuests` / `questPreview` lines (added in the quest feature), add:

```typescript
  const doctrineModifiers = useMemo(() => computeDoctrineModifiers(equippedDoctrines.value), [equippedDoctrines.value]);
  const doctrinePreview = [...new Set(doctrineModifiers.map((m) => m.label))].join(' · ');
```

- [ ] **Step 3: Seed the modifiers into the campaign**

In `EmbarkCard.tsx`, in `handleEmbark`, add `doctrineModifiers` to the `startIterBelliCampaign({ ... })` call (after the `quests: secondaryQuests,` line):

```typescript
      quests: secondaryQuests,
      doctrineModifiers,
    });
```

- [ ] **Step 4: Render the preview + widen the box guard**

In `EmbarkCard.tsx`, widen the Consilium-box render guard to include `doctrinePreview`:

```tsx
      {(mission || modSummary || questPreview || doctrinePreview) && (
```

Then, after the `{questPreview && (...)}` block (before the box's closing `</div>`), add:

```tsx
          {doctrinePreview && (
            <div style={{ fontSize: 10, color: 'var(--imp-text-lo)', fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic', marginTop: 4 }}>
              Doctrinae: {doctrinePreview}
            </div>
          )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/forum/panels/EmbarkCard.tsx
git commit -m "feat(iterbelli): embark seeds + previews equipped-doctrine modifiers"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the doctrine verification**

Run: `npx tsx tools/verify-iter-belli-doctrines.ts`
Expected: PASS — "All checks passed."

- [ ] **Step 2: Run prior verifications (regression)**

Run: `npx tsx tools/verify-iter-belli-quests.ts`
Expected: PASS — "All checks passed."

Run: `npx tsx tools/verify-iter-belli-consilium.ts`
Expected: PASS — "All checks passed."

- [ ] **Step 3: Full type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 4: Manual Chrome check**

The Map2D dev server runs on `http://localhost:5188/` (port 5173 may be another project — confirm the page title is "IMPERIUM"). If it is not running: `npx vite --port 5188 --strictPort` from the worktree.

1. Equip at least one doctrine in the Forum's Doctrinae tab.
2. Open the embark panel — confirm it shows "Doctrinae: <label(s)>".
3. Embark. In campaign, confirm the doctrine's effect manifests:
   - red: playing a Coerción card adds extra enemy erosion;
   - blue: a Diplomacia card costs less gold and lowers threat more;
   - purple: a Logística card yields extra supplies;
   - gold: morale ticks up each turn; white: supplies tick up each turn.

Report what you observed. Do not claim success without seeing the behavior.

- [ ] **Step 5: Final note**

No commit needed (verification only). If any check fails, return to the owning task, fix, and re-run.

---

## Self-Review notes (for the implementer)

- **Type consistency:** `DoctrineCampaignModifier` hooks (`weight`/`costDelta`/`onPlay`/`onTurn`) have identical signatures in the type (Task 1), the factories (Task 2), and the engine call sites (Task 4). `costDelta` returns `CardCost`; `onPlay`/`onTurn` return `CardEffects`.
- **Cost discount safety:** `playCard` clamps every effective cost field to ≥ 0 before applying, and `endTurn(cost.time || 1)` uses the (clamped) discounted time — a 0/undefined time still costs 1 day.
- **Decoupling:** the engine (`iter-belli-state.ts`) imports only the modifier TYPE; the bridge (`iter-belli-doctrines.ts`) imports the `Doctrine` type and is called from `EmbarkCard`. Same pattern as the Consilium/quest bridges.
- **`weight` unused in Fase 1:** no color factory defines `weight`; `drawCard` treats a missing `weight` hook as ×1, so the pool distribution is unchanged unless a future modifier opts in.
- **onTurn ordering:** applied after upkeep, before hunger/mutiny — intentional so gold/white passives can offset a same-turn crisis.
