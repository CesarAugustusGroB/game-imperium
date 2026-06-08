# Iter Belli — Thread B: Real Discipline Scale (0–10) + Drill Progression

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the campaign discipline scale from 1–5 to the battle engine's native 0–10, removing the adapter's `×2` stopgap, and add a repeatable drill card so discipline grows during the march.

**Architecture:** Campaign discipline becomes 0–10 end-to-end. Commanders start LOW (base 2 + small archetype bonus + legate ±2) and must drill to unlock the higher formations (Triplex needs engine disc 6). The battle adapter stops scaling and just clamps. Old saves (1–5) are migrated `×2` via a new `schemaVersion` marker.

**Tech Stack:** TypeScript (strict), Vitest, Preact signals. All changes are in `src/game/iterBelli/` + `src/data/iter-belli-cards.ts`.

**Decisions (user-approved):**
- Starting curve: base 2; archetype additive `{Warlord:0, Religious:0, Merchant:1, Diplomat:2}`; legate trait net clamp ±2 → typical start disc 2–5.
- Drill card "Instrucción de campamento": category `Postura`, cost `{time:1, supplies:4}`, effect `discipline +1`, common/repeatable, gated `discipline < 10 && supplies >= 4`.
- Enemy discipline 5→6 (cosmetic; the live battle uses `ENEMY_ARCHETYPES`, not `scenario.enemy.discipline`).
- Doctrine/embark discipline bonuses stay as-is (small additive, clamped by `startIterBelliCampaign`).
- No existing card touches discipline, so there is nothing to rescale there.

---

### Task 1: Rescale discipline constants

**Files:**
- Modify: `src/game/iterBelli/iter-belli-balance.ts`
- Test: `src/game/iterBelli/__tests__/discipline-scale.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/game/iterBelli/__tests__/discipline-scale.test.ts
import { describe, it, expect } from 'vitest';
import * as B from '../iter-belli-balance';

describe('discipline constants are on the 0–10 engine scale', () => {
  it('clamps span 0..10', () => {
    expect(B.DISCIPLINE_MIN).toBe(0);
    expect(B.DISCIPLINE_MAX).toBe(10);
  });
  it('base start is the low "legate base 2"', () => {
    expect(B.START.discipline).toBe(2);
  });
  it('archetype values are small additive bonuses (not absolute 1–5)', () => {
    expect(B.DISCIPLINE_BY_ARCHETYPE).toEqual({ Warlord: 0, Religious: 0, Merchant: 1, Diplomat: 2 });
  });
  it('enemy discipline sits mid-high on the new scale', () => {
    expect(B.ENEMY_DISCIPLINE).toBe(6);
  });
  it('ROMAN covers 0..10', () => {
    expect(B.ROMAN).toHaveLength(11);
    expect(B.ROMAN[0]).toBe('—');
    expect(B.ROMAN[6]).toBe('VI');
    expect(B.ROMAN[10]).toBe('X');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/iterBelli/__tests__/discipline-scale.test.ts`
Expected: FAIL (DISCIPLINE_MIN is 1, ROMAN length 6, etc.)

- [ ] **Step 3: Edit the constants**

In `iter-belli-balance.ts`:
- `export const DISCIPLINE_MIN = 0;` (was 1)
- `export const DISCIPLINE_MAX = 10;` (was 5)
- In `START`, set `discipline: 2,` (was 4)
- `export const ENEMY_DISCIPLINE = 6;` (was 5)
- Replace `DISCIPLINE_BY_ARCHETYPE` block with:

```ts
/** Additive starting-discipline bonus by archetype on the 0–10 scale (base = START.discipline). */
export const DISCIPLINE_BY_ARCHETYPE: Record<Archetype, number> = {
  Warlord: 0,
  Religious: 0,
  Merchant: 1,
  Diplomat: 2,
};
/** Legate trait id → discipline contribution. Net is clamped to ±2 by the caller. */
export const LEGATE_DISCIPLINE_TRAIT_MOD: Record<string, number> = {
  disciplined: 1, cautious: 1, tactician: 1, stoic: 1,
  aggressive: -1, rallying: -1,
};
```

- Replace `ROMAN`:

```ts
/** Roman numerals for discipline display, index 0..10 (0 shown as a dash). */
export const ROMAN = ['—', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/iterBelli/__tests__/discipline-scale.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/iter-belli-balance.ts src/game/iterBelli/__tests__/discipline-scale.test.ts
git commit -m "feat(iter-belli): rescale discipline constants 1-5 -> 0-10 (Thread B)"
```

---

### Task 2: `computeStartingDiscipline` on the 0–10 scale

**Files:**
- Modify: `src/game/iterBelli/iter-belli-state.ts:450-458`
- Test: `src/game/iterBelli/__tests__/starting-discipline.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/game/iterBelli/__tests__/starting-discipline.test.ts
import { describe, it, expect } from 'vitest';
import { computeStartingDiscipline } from '../iter-belli-state';

describe('computeStartingDiscipline (0–10, base 2 + archetype + legate ±2)', () => {
  it('a plain Warlord starts at base 2', () => {
    expect(computeStartingDiscipline('Warlord', [])).toBe(2);
  });
  it('archetype bonus adds on top of base', () => {
    expect(computeStartingDiscipline('Diplomat', [])).toBe(4); // 2 + 2
    expect(computeStartingDiscipline('Merchant', [])).toBe(3); // 2 + 1
  });
  it('legate disciplined traits add, net-clamped to +2', () => {
    expect(computeStartingDiscipline('Warlord', ['disciplined'])).toBe(3);
    expect(computeStartingDiscipline('Warlord', ['disciplined', 'cautious', 'tactician'])).toBe(4); // +3 -> +2
  });
  it('negative traits net-clamp to -2 and the floor is 0', () => {
    expect(computeStartingDiscipline('Warlord', ['aggressive', 'rallying'])).toBe(0); // 2 - 2
  });
  it('null archetype falls back to base only', () => {
    expect(computeStartingDiscipline(null, [])).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/iterBelli/__tests__/starting-discipline.test.ts`
Expected: FAIL (old code returns archetype-absolute values clamped 1–5)

- [ ] **Step 3: Rewrite `computeStartingDiscipline`**

Replace the function body (currently `iter-belli-state.ts:450-458`):

```ts
/**
 * Starting campaign discipline (0–10) = base + archetype bonus + legate modifier (net ±2),
 * clamped 0–10. Reads legate trait ids as plain strings; does not touch the battle system.
 */
export function computeStartingDiscipline(
  archetype: Archetype | null,
  legateTraitIds: readonly string[],
): number {
  const base = B.START.discipline + (archetype ? B.DISCIPLINE_BY_ARCHETYPE[archetype] : 0);
  const rawMod = legateTraitIds.reduce((sum, id) => sum + (B.LEGATE_DISCIPLINE_TRAIT_MOD[id] ?? 0), 0);
  const legateMod = clamp(rawMod, -2, 2);
  return clamp(base + legateMod, B.DISCIPLINE_MIN, B.DISCIPLINE_MAX);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/iterBelli/__tests__/starting-discipline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/iter-belli-state.ts src/game/iterBelli/__tests__/starting-discipline.test.ts
git commit -m "feat(iter-belli): computeStartingDiscipline on 0-10 scale (Thread B)"
```

---

### Task 3: Drop the `×2` stopgap in the battle adapter

**Files:**
- Modify: `src/game/iterBelli/battle/adapter.ts:22-25,86`
- Modify (tests): `src/game/iterBelli/battle/__tests__/adapter.test.ts:1-2,20-25,72`

- [ ] **Step 1: Update the failing tests first**

In `adapter.test.ts`, change the import on lines 1–2 from `scaleDiscipline` to `clampEngineDiscipline`, and replace the `scaleDiscipline` describe block (lines 20–25) with:

```ts
  it('clampEngineDiscipline passes campaign 0..10 through, clamped', () => {
    expect(clampEngineDiscipline(2)).toBe(2);
    expect(clampEngineDiscipline(6)).toBe(6);
    expect(clampEngineDiscipline(13)).toBe(10);
    expect(clampEngineDiscipline(-1)).toBe(0);
  });
```

And in the `buildPlayerSeed` test (line ~72), the snapshot already passes `discipline: 3`; change the assertion to:

```ts
    expect(seed.discipline).toBe(3);          // pass-through (no ×2)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/adapter.test.ts`
Expected: FAIL (`clampEngineDiscipline` not exported; old buildPlayerSeed gave 6)

- [ ] **Step 3: Replace the stopgap in `adapter.ts`**

Replace lines 22–25:

```ts
/** Campaign discipline is now native 0–10 (Thread B); just clamp into the engine range. */
export function clampEngineDiscipline(campaignDiscipline: number): number {
  return Math.max(0, Math.min(10, Math.round(campaignDiscipline)));
}
```

And in `buildPlayerSeed` (line ~86) change `discipline: scaleDiscipline(snap.discipline),` to `discipline: clampEngineDiscipline(snap.discipline),`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/adapter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/battle/adapter.ts src/game/iterBelli/battle/__tests__/adapter.test.ts
git commit -m "refactor(battle): drop discipline x2 stopgap; campaign is now 0-10 (Thread B)"
```

---

### Task 4: Drill card — "Instrucción de campamento"

**Files:**
- Modify: `src/data/iter-belli-cards.ts` (append a card to `CARD_DEFS`)
- Test: `src/data/__tests__/drill-card.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/data/__tests__/drill-card.test.ts
import { describe, it, expect } from 'vitest';
import { CARD_DEFS } from '../iter-belli-cards';

const drill = () => CARD_DEFS.find((c) => c.id === 'instruccion_campamento')!;

describe('drill card', () => {
  it('exists in the deck with the Postura category', () => {
    expect(drill()).toBeDefined();
    expect(drill().category).toBe('Postura');
  });
  it('costs a day + supplies and grants +1 discipline', () => {
    expect(drill().cost).toEqual({ time: 1, supplies: 4 });
    expect(drill().effects({ state: { supplies: 10, discipline: 3 } } as any)).toEqual({ discipline: 1 });
  });
  it('is gated off when discipline is maxed or supplies are short', () => {
    expect(drill().requires!({ state: { discipline: 10, supplies: 10 } } as any)).toBe(false);
    expect(drill().requires!({ state: { discipline: 3, supplies: 2 } } as any)).toBe(false);
    expect(drill().requires!({ state: { discipline: 3, supplies: 10 } } as any)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/__tests__/drill-card.test.ts`
Expected: FAIL (card not found)

- [ ] **Step 3: Append the card to `CARD_DEFS`**

Add a new "ADIESTRAMIENTO" section before the closing `];` of `CARD_DEFS`:

```ts
  // ── ADIESTRAMIENTO ───────────────────────────────────────────────────────────
  {
    id: 'instruccion_campamento',
    name: 'Instrucción de campamento',
    category: 'Postura',
    desc: 'Maniobras de formación en el campamento. Los hombres aprenden a moverse como una sola unidad. Cuesta tiempo y raciones, pero sube la disciplina.',
    cost: { time: 1, supplies: 4 },
    effects: () => ({ discipline: 1 }),
    expiry: 99,
    locations: ['*'],
    requires: ({ state }) => state.discipline < 10 && state.supplies >= 4,
    weight: 3,
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/__tests__/drill-card.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/iter-belli-cards.ts src/data/__tests__/drill-card.test.ts
git commit -m "feat(iter-belli): add repeatable drill card (+1 discipline) (Thread B)"
```

---

### Task 5: Save migration (1–5 saves → 0–10)

**Files:**
- Modify: `src/game/iterBelli/iter-belli-save.ts` (add `schemaVersion`, a `migrateSave` helper, call it in restore)
- Test: `src/game/iterBelli/__tests__/save-migration.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/game/iterBelli/__tests__/save-migration.test.ts
import { describe, it, expect } from 'vitest';
import { migrateSave } from '../iter-belli-save';

const base = { discipline: 4 } as any;

describe('save migration to discipline 0–10', () => {
  it('a versionless (v1, 1–5) save doubles discipline into 0–10', () => {
    const out = migrateSave({ ...base }); // no schemaVersion
    expect(out.discipline).toBe(8);
    expect(out.schemaVersion).toBe(2);
  });
  it('a v2 save is left untouched', () => {
    const out = migrateSave({ ...base, schemaVersion: 2 });
    expect(out.discipline).toBe(4);
    expect(out.schemaVersion).toBe(2);
  });
  it('clamps the migrated value into 0–10', () => {
    expect(migrateSave({ discipline: 6 } as any).discipline).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/iterBelli/__tests__/save-migration.test.ts`
Expected: FAIL (`migrateSave` not exported; `schemaVersion` not on the type)

- [ ] **Step 3: Add `schemaVersion`, `migrateSave`, and wire it into restore**

In `iter-belli-save.ts`:

1. Add a constant near the top (after imports):

```ts
/** Save schema version. v2 introduced the 0–10 discipline scale (was 1–5 in v1). */
export const ITER_BELLI_SAVE_VERSION = 2;
```

2. Add `schemaVersion?: number;` to the `IterBelliSave` type:

```ts
export type IterBelliSave = Omit<IterBelliState, 'pool' | 'doctrineModifiers'> & {
  scenarioId: string;
  schemaVersion?: number;
  pool: SavedCardInstance[];
  log: LogLine[];
};
```

3. In `serializeIterBelli`, add `schemaVersion: ITER_BELLI_SAVE_VERSION,` to the returned object (next to `scenarioId`).

4. Add the pure migration helper (export it):

```ts
/**
 * Forward-migrate a save to the current schema. v1 saves (no schemaVersion) used the
 * 1–5 discipline scale; double the value into the 0–10 engine scale (clamped).
 */
export function migrateSave(save: IterBelliSave): IterBelliSave {
  if ((save.schemaVersion ?? 1) < 2) {
    return { ...save, discipline: Math.max(0, Math.min(10, save.discipline * 2)), schemaVersion: 2 };
  }
  return save;
}
```

5. At the top of `restoreIterBelli`, migrate first:

```ts
export function restoreIterBelli(save: IterBelliSave, doctrineModifiers: DoctrineCampaignModifier[]): void {
  save = migrateSave(save);
  const scenario = SCENARIOS_BY_ID[save.scenarioId] ?? SAGUNTUM;
  // ...unchanged...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/iterBelli/__tests__/save-migration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/iter-belli-save.ts src/game/iterBelli/__tests__/save-migration.test.ts
git commit -m "feat(iter-belli): schemaVersion + migrate v1 saves to 0-10 discipline (Thread B)"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: all green (engine + adapter + new Thread B suites). The battle engine tests are unaffected — they already use native 0–10 discipline.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual sanity (note for the user, not automated)**

Embark with a non-disciplined commander → resource bar shows a low Roman numeral (≈ II). Play "Instrucción de campamento" a few times → discipline climbs; once it reaches VI the Triplex formation (if the legate unlocks it) becomes selectable in the battle deployment screen.

---

## Self-Review

- **Spec coverage:** Removes the `scaleDiscipline ×2` stopgap (Task 3); migrates the 1–5 → 0–10 scale (Tasks 1–2); adds drill progression (Task 4); handles save migration (Task 5). All Thread B items from `memory/battle-rework-spec.md` are covered. Roster stat summation was already done in Phase 2 (not repeated here).
- **Type consistency:** `clampEngineDiscipline` replaces `scaleDiscipline` in both `adapter.ts` and its test. `migrateSave`/`schemaVersion`/`ITER_BELLI_SAVE_VERSION` are defined in Task 5 and used consistently. `DISCIPLINE_BY_ARCHETYPE` stays a `Record<Archetype, number>` (now bonuses). `ROMAN` becomes a 0-indexed array (was 1-indexed); `CampaignResourceBar` and `startIterBelliCampaign` already index it by `discipline`, which is valid for 0–10.
- **Out of scope (Thread C/D):** ammunition resource, armor-tier UI, fortification, enemy `archetypeKey`, archetype tuning.
