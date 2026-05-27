# Iter Belli — Result → Hub progression — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an Iter Belli campaign result feed the Hub run — wire the ignored progression signals (`battlesWon`, `globalSeason`, `spokesSinceLastBattle`) and grant a conquered province on victory whose terrain comes from the spoke theme and whose name is a random pick from a flat pool, with fixed income.

**Architecture:** A new pure data/helper module (`src/data/iter-belli-conquest.ts`) holds the theme→terrain map, the name pool + picker, and the fixed reward. The `CampaignSeed` bridge is extended so the campaign captures `spokeTerrain` + `spokeDuration` at embark; the write-back lives entirely in the UI layer (`EmbarkCard` seeds, `EndgameCard.returnToHub` applies). The Iter Belli logic module gains no run-state imports; no bellum/battle code is touched.

**Tech Stack:** TypeScript, Preact `@preact/signals`, Vite. Verification convention: `npx tsx tools/verify-*.ts` for pure logic + `npx tsc --noEmit` + manual browser check (no unit-test runner in this repo).

---

### Task 1: Conquest data + helper module

**Files:**
- Create: `src/data/iter-belli-conquest.ts`
- Test: `tools/verify-iter-belli-result-to-hub.ts`

- [ ] **Step 1: Write the failing verification script**

Create `tools/verify-iter-belli-result-to-hub.ts`:

```ts
/**
 * Verifies Result → Hub: conquest data/helper (Task 1) + seed round-trip (Task 2).
 * Run: npx tsx tools/verify-iter-belli-result-to-hub.ts
 */
import {
  THEME_TERRAIN, themeToTerrain, CONQUEST_NAMES, pickConquestName, PROVINCE_REWARD,
} from '../src/data/iter-belli-conquest';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

// --- THEME_TERRAIN / themeToTerrain ---
check('woodland → forest', THEME_TERRAIN.woodland === 'forest');
check('highlands → mountains', THEME_TERRAIN.highlands === 'mountains');
check('marshland → marsh', THEME_TERRAIN.marshland === 'marsh');
check('coastal → coast', THEME_TERRAIN.coastal === 'coast');
check('mixed → plains', THEME_TERRAIN.mixed === 'plains');
check('themeToTerrain known', themeToTerrain('coastal') === 'coast');
check('themeToTerrain unknown → plains', themeToTerrain('zzz') === 'plains');
check('themeToTerrain undefined → plains', themeToTerrain(undefined) === 'plains');
check('themeToTerrain null → plains', themeToTerrain(null) === 'plains');

// --- pickConquestName ---
check('pool is non-empty', CONQUEST_NAMES.length > 0);
check('picks a pool name when none taken', CONQUEST_NAMES.includes(pickConquestName(new Set())));
const allButFirst = new Set(CONQUEST_NAMES.slice(1));
check('picks the only free name', pickConquestName(allButFirst) === CONQUEST_NAMES[0]);
const all = new Set(CONQUEST_NAMES);
const suffixed = pickConquestName(all);
check('all taken → unused suffixed name', !all.has(suffixed) && / (II|III|IV|V|VI|VII|VIII|IX|X)$/.test(suffixed));

// --- PROVINCE_REWARD (gold + iuniores only; deprecated resources omitted ⇒ 0 income) ---
check('reward gold > 0', (PROVINCE_REWARD.gold ?? 0) > 0);
check('reward iuniores > 0', (PROVINCE_REWARD.iuniores ?? 0) > 0);
check('reward has no faith', PROVINCE_REWARD.faith === undefined);
check('reward has no influence', PROVINCE_REWARD.influence === undefined);
check('reward has no momentum', PROVINCE_REWARD.momentum === undefined);

// --- Seed round-trip (filled in by Task 2) ---
// (added in Task 2)

if (failures > 0) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll checks passed');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-iter-belli-result-to-hub.ts`
Expected: FAIL — `Cannot find module '../src/data/iter-belli-conquest'` (module not created yet).

- [ ] **Step 3: Create the conquest module**

Create `src/data/iter-belli-conquest.ts`:

```ts
/**
 * Iter Belli — Result → Hub conquest data.
 * Pure data + a name picker; no signals, no run-state. Consumed by the embark
 * bridge (EmbarkCard) and the return bridge (EndgameCard.returnToHub).
 */
import type { ResourceType } from '../game/core/commander';
import type { TerrainType } from './terrain-data';

/** Spoke theme tag → conquered-province terrain. */
export const THEME_TERRAIN: Record<string, TerrainType> = {
  woodland: 'forest',
  highlands: 'mountains',
  marshland: 'marsh',
  coastal: 'coast',
  mixed: 'plains',
};

/** Resolve a spoke theme tag to a terrain; unknown / undefined / null → 'plains'. */
export function themeToTerrain(theme: string | undefined | null): TerrainType {
  return (theme != null && THEME_TERRAIN[theme]) || 'plains';
}

/** Flat pool of evocative place-names for conquered provinces (pure flavor). */
export const CONQUEST_NAMES: string[] = [
  'Numantia', 'Gades', 'Tarraco', 'Corduba', 'Ilerda', 'Osca', 'Bilbilis',
  'Carthago Nova', 'Saguntum', 'Emporiae', 'Carteia', 'Italica', 'Brigantium',
  'Lucentum', 'Toletum', 'Segovia', 'Pallantia', 'Asturica', 'Bracara', 'Olisipo',
];

const ROMAN_SUFFIX = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Pick a province name not already in `taken`. Random unused name from the pool;
 * if every base name is taken, append a roman-numeral suffix until one is free.
 */
export function pickConquestName(taken: Set<string>): string {
  const free = CONQUEST_NAMES.filter((n) => !taken.has(n));
  if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
  for (const suffix of ROMAN_SUFFIX) {
    for (const base of CONQUEST_NAMES) {
      const candidate = `${base} ${suffix}`;
      if (!taken.has(candidate)) return candidate;
    }
  }
  return `Provincia ${Date.now()}`; // effectively unreachable fallback
}

/**
 * Fixed per-spoke income for a conquered province. Only gold + iuniores are
 * granted — the deprecated resources are omitted (and `conquerProvince` floors
 * any present key at 1/spoke, so omitting them is the only way to keep 0).
 * Passed with `duration: 1` so per-spoke income equals these values exactly.
 * Tunable.
 */
export const PROVINCE_REWARD: Partial<Record<ResourceType, number>> = {
  gold: 5,
  iuniores: 2,
};
```

- [ ] **Step 4: Run it to verify the Task-1 checks pass**

Run: `npx tsx tools/verify-iter-belli-result-to-hub.ts`
Expected: PASS — all Task-1 checks print `✓`, ends with `All checks passed`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/data/iter-belli-conquest.ts tools/verify-iter-belli-result-to-hub.ts
git commit -m "feat(iterbelli): conquest data + name picker for result->hub"
```

---

### Task 2: Extend the CampaignSeed bridge with spokeTerrain + spokeDuration

**Files:**
- Modify: `src/game/iterBelli/iter-belli-types.ts` (add fields to `IterBelliState`)
- Modify: `src/game/iterBelli/iter-belli-state.ts` (`CampaignSeed`, `freshState`, `startIterBelliCampaign`)
- Test: `tools/verify-iter-belli-result-to-hub.ts` (extend)

- [ ] **Step 1: Add the seed round-trip checks (failing)**

In `tools/verify-iter-belli-result-to-hub.ts`, replace the `// (added in Task 2)` line with:

```ts
import { startIterBelliCampaign, resetIterBelli, iterBelliState } from '../src/game/iterBelli/iter-belli-state';

startIterBelliCampaign({
  soldiers: 1000, gold: 0, iuniores: 0, discipline: 4, archetype: null,
  spokeTerrain: 'coast', spokeDuration: 3,
});
check('seed applies spokeTerrain', iterBelliState.value.spokeTerrain === 'coast');
check('seed applies spokeDuration', iterBelliState.value.spokeDuration === 3);
resetIterBelli();
check('reset restores spokeTerrain → plains', iterBelliState.value.spokeTerrain === 'plains');
check('reset restores spokeDuration → 1', iterBelliState.value.spokeDuration === 1);
```

(Place this block just above the final `if (failures > 0)` guard, and move the new `import` to the top with the other imports.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-iter-belli-result-to-hub.ts`
Expected: FAIL — TypeScript/tsx error that `spokeTerrain`/`spokeDuration` are not in the seed/state type (or the new checks print `✗`).

- [ ] **Step 3: Add the fields to `IterBelliState`**

In `src/game/iterBelli/iter-belli-types.ts`, inside `interface IterBelliState`, immediately after the `initialSoldiers` field, add:

```ts
  /** Conquered-province terrain (from the spoke theme); seeded at embark. */
  spokeTerrain: string;
  /** Spoke duration in seasons (1–4); advances the Hub season clock on return. */
  spokeDuration: number;
```

- [ ] **Step 4: Add the fields to `CampaignSeed` + apply them**

In `src/game/iterBelli/iter-belli-state.ts`:

(a) Extend the `CampaignSeed` interface:

```ts
export interface CampaignSeed {
  soldiers: number;
  gold: number;
  iuniores: number;
  discipline: number;
  archetype: Archetype | null;
  spokeTerrain: string;
  spokeDuration: number;
}
```

(b) In `freshState()`, after `initialSoldiers: B.START.fallbackSoldiers,` add:

```ts
    spokeTerrain: 'plains',
    spokeDuration: 1,
```

(c) In `startIterBelliCampaign`, after `S.archetype = seed.archetype;` add:

```ts
  S.spokeTerrain = seed.spokeTerrain;
  S.spokeDuration = Math.max(1, Math.floor(seed.spokeDuration));
```

(`resetIterBelli` already calls `freshState()`, so it restores the defaults automatically.)

- [ ] **Step 5: Run it to verify it passes**

Run: `npx tsx tools/verify-iter-belli-result-to-hub.ts`
Expected: PASS — including the four new seed/reset checks.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: FAIL — `EmbarkCard.tsx` now errors because its `startIterBelliCampaign({...})` call is missing `spokeTerrain`/`spokeDuration`. This is expected and fixed in Task 3. (If any *other* file errors, investigate.)

- [ ] **Step 7: Commit**

```bash
git add src/game/iterBelli/iter-belli-types.ts src/game/iterBelli/iter-belli-state.ts tools/verify-iter-belli-result-to-hub.ts
git commit -m "feat(iterbelli): seed spokeTerrain + spokeDuration into campaign state"
```

---

### Task 3: Seed terrain + duration at embark

**Files:**
- Modify: `src/ui/screens/forum/panels/EmbarkCard.tsx`

- [ ] **Step 1: Import the theme→terrain helper**

In `src/ui/screens/forum/panels/EmbarkCard.tsx`, add to the imports (after the existing `startIterBelliCampaign` import line):

```ts
import { themeToTerrain } from '../../../../data/iter-belli-conquest';
```

- [ ] **Step 2: Pass spokeTerrain + spokeDuration in the seed**

In `handleEmbark()`, the existing call is:

```ts
    startIterBelliCampaign({ soldiers, gold: getResource('gold'), iuniores: getResource('iuniores'), discipline, archetype });
```

Replace it with (note `spoke` is already in component scope as `plannedSpoke.value`):

```ts
    const spokeTerrain = themeToTerrain(spoke?.theme);
    const spokeDuration = spoke?.duration ?? 1;
    startIterBelliCampaign({ soldiers, gold: getResource('gold'), iuniores: getResource('iuniores'), discipline, archetype, spokeTerrain, spokeDuration });
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0 (the Task-2 EmbarkCard error is now resolved).

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/forum/panels/EmbarkCard.tsx
git commit -m "feat(iterbelli): seed spoke terrain + duration at embark"
```

---

### Task 4: Apply result to the Hub in returnToHub

**Files:**
- Modify: `src/ui/screens/iterbelli/EndgameCard.tsx`

- [ ] **Step 1: Add the imports**

In `src/ui/screens/iterbelli/EndgameCard.tsx`:

(a) Replace the `completedSpokes` import line:

```ts
import { completedSpokes } from '../../../game/core/game-state';
```

with:

```ts
import { completedSpokes, battlesWon, globalSeason, MAX_SEASONS, spokesSinceLastBattle } from '../../../game/core/game-state';
```

(b) Add two new import lines (after the existing `START` import):

```ts
import { conquerProvince, provinces } from '../../../game/province/province-store';
import { pickConquestName, PROVINCE_REWARD } from '../../../data/iter-belli-conquest';
import type { TerrainType } from '../../../data/terrain-data';
import type { ResourceType } from '../../../game/core/commander';
```

- [ ] **Step 2: Wire the progression signals + conquest into returnToHub**

In `returnToHub()`, the current body starts:

```ts
  gold.value = s.gold;
  iuniores.value = s.iuniores;
  if (outcome?.victory) completedSpokes.value++;
```

Replace those three lines with:

```ts
  gold.value = s.gold;
  iuniores.value = s.iuniores;

  // Season clock advances regardless of outcome — campaign time elapsed.
  globalSeason.value = Math.min(MAX_SEASONS, globalSeason.value + s.spokeDuration);

  if (outcome?.victory) {
    completedSpokes.value++;
    battlesWon.value++;             // the decisive battle was won
    spokesSinceLastBattle.value = 0;

    // Conquer a province: terrain from the spoke theme, random unused name, fixed income.
    const taken = new Set(provinces.value.map((p) => p.name));
    const name = pickConquestName(taken);
    conquerProvince(name, PROVINCE_REWARD as Record<ResourceType, number>, 1, {
      terrain: s.spokeTerrain as TerrainType,
    });
  }
```

(The existing cohort-scaling block, `resetIterBelliBattle()`, `resetIterBelli()`, and `navigateTo('hub')` that follow stay unchanged. `s` is a snapshot captured at the top of the function, so reading `s.spokeDuration`/`s.spokeTerrain` before the reset is safe.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Re-run the verification script (regression)**

Run: `npx tsx tools/verify-iter-belli-result-to-hub.ts`
Expected: PASS — `All checks passed`.

- [ ] **Step 5: Manual browser check**

Run `npm run dev` (if not already running) and in Chrome at `http://localhost:5173/`:
1. Title → choose a commander → Hub.
2. Note the Overview masthead "Turn N" (= `completedSpokes`) and the current province count in Provinciae.
3. Embark → play through the campaign → win at Sagunto → "Volver al Hub".
4. Confirm: a **new province** appears in Provinciae (and painted on the map), "Turn" incremented by 1.
5. Embark + win again → confirm a **different** province name is granted.
6. Embark + **lose** a campaign → confirm **no** new province and "Turn" unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/iterbelli/EndgameCard.tsx
git commit -m "feat(iterbelli): apply campaign result to hub (signals + province conquest)"
```

---

## Notes for the implementer

- **Do NOT** touch any bellum / node-map / battle code, `legate-traits.ts`, or `src/game/campaign/*`. This feature is confined to the Iter Belli module + the embark/endgame UI bridge + the new data file.
- `conquerProvince(name, gains, duration, { terrain })` already auto-claims a free map territory via `claimTerritory`; no extra wiring needed. If the map has no free territory the province is still created with income (acceptable edge — same path used at run start for Roma).
- The `PROVINCE_REWARD as Record<ResourceType, number>` cast is intentional: the object only carries `gold` + `iuniores`, and `conquerProvince` iterates `Object.entries`, so the deprecated resources get 0 income (omitted keys) rather than the min-1 the helper would assign to a present-but-zero key.
- `threatLevel` is deliberately left untouched (defeat consequences are out of scope).
