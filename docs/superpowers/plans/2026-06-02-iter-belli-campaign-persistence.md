# Iter Belli Campaign Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the in-progress Iter Belli campaign across a page reload, restoring straight back into the campaign screen.

**Architecture:** The campaign snapshot lives inside the existing `ActiveRunSave` (localStorage) — no new store. A pure `iter-belli-save.ts` module serializes `IterBelliState` to a JSON-safe projection (storing card-def ids instead of closure-bearing defs; doctrine modifiers recomputed by the caller). On boot, if a campaign is active, the run is auto-restored and the app routes to the Iter Belli screen.

**Tech Stack:** TypeScript, Preact, `@preact/signals`, Vite. No unit-test runner — the repo's convention is standalone `npx tsx tools/verify-*.ts` scripts, which this plan follows as its tests.

---

## File Structure

- **`src/game/iterBelli/iter-belli-state.ts`** (modify) — add `iterBelliActive` signal + `loadIterBelliState()` mutator; flip the flag in `startIterBelliCampaign`/`resetIterBelli`.
- **`src/game/iterBelli/iter-belli-save.ts`** (create) — `IterBelliSave` type, `SavedCardInstance`, `SCENARIOS_BY_ID`, `serializeIterBelli()`, `restoreIterBelli()`, `resolveCardDef()`.
- **`src/game/core/meta-save.ts`** (modify) — `iterBelli` field on `ActiveRunSave`; wire into build/migrate/restore.
- **`src/ui/screens/App.tsx`** (modify) — boot-time resume + `bootResuming` veil.
- **`tools/verify-iter-belli-save.ts`** (create) — round-trip verifier (this plan's test).

---

## Task 1: State plumbing — `iterBelliActive` + `loadIterBelliState`

**Files:**
- Modify: `src/game/iterBelli/iter-belli-state.ts`

- [ ] **Step 1: Add the `iterBelliActive` signal next to the existing signals**

In `src/game/iterBelli/iter-belli-state.ts`, find:

```ts
export const iterBelliState = signal<IterBelliState>(S);
export const iterBelliLog = signal<LogLine[]>(logLines);
```

Add immediately below:

```ts
/** True while a campaign is in flight (embark → return-to-hub). Gates serialization. */
export const iterBelliActive = signal<boolean>(false);
```

- [ ] **Step 2: Add the `loadIterBelliState` mutator**

In the same file, find the `resetIterBelli` function:

```ts
/** Reset to a clean slate (called from resetRun). */
export function resetIterBelli(): void {
  S = freshState();
  logLines = [];
  resetActiveScenario();
  commit();
}
```

Replace it with (adds the flag flip + the new loader directly after):

```ts
/** Reset to a clean slate (called from resetRun). */
export function resetIterBelli(): void {
  S = freshState();
  logLines = [];
  iterBelliActive.value = false;
  resetActiveScenario();
  commit();
}

/**
 * Replace the engine's live state and log wholesale (used by the persistence
 * layer to restore a saved campaign). The active scenario must already be set
 * by the caller. Marks the campaign active and publishes to the signals.
 */
export function loadIterBelliState(state: IterBelliState, log: LogLine[]): void {
  S = state;
  logLines = log;
  iterBelliActive.value = true;
  commit();
}
```

- [ ] **Step 3: Flip the flag true when a campaign starts**

In `startIterBelliCampaign`, find the final lines:

```ts
  refillPool();
  injectCrises();
  injectLocationQuests();
  commit();
}
```

Replace with:

```ts
  refillPool();
  injectCrises();
  injectLocationQuests();
  iterBelliActive.value = true;
  commit();
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). `iterBelliActive` and `loadIterBelliState` are exported but not yet consumed — that is fine (they are `export`s, not locals, so `noUnusedLocals` does not flag them).

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/iter-belli-state.ts
git commit -m "feat(iter-belli): add iterBelliActive flag and loadIterBelliState mutator"
```

---

## Task 2: The serialization module `iter-belli-save.ts`

**Files:**
- Create: `src/game/iterBelli/iter-belli-save.ts`

- [ ] **Step 1: Create the file with the full module**

Create `src/game/iterBelli/iter-belli-save.ts`:

```ts
/**
 * Iter Belli — campaign persistence (serialize / restore).
 *
 * Projects the live IterBelliState to a JSON-safe shape and back. The two
 * closure-bearing fields are NOT stored: card definitions are referenced by id
 * and re-resolved here; doctrine modifiers are recomputed by the caller and
 * passed into restore. This module imports only the campaign engine + its data
 * (cards, quests, scenario) — never the Hub stores — so it stays pure and
 * verifiable in isolation.
 */

import { iterBelliState, iterBelliLog, iterBelliActive, loadIterBelliState } from './iter-belli-state';
import { getActiveScenario, setActiveScenario } from './iter-belli-scenario';
import { SAGUNTUM } from '../../data/iter-belli-scenario-saguntum';
import { CARD_DEFS } from '../../data/iter-belli-cards';
import { makeQuestCard } from '../../data/iter-belli-quests';
import type {
  AnyCardDef, CampaignScenario, CardInstance, DoctrineCampaignModifier,
  IterBelliState, LogLine, SecondaryQuest,
} from './iter-belli-types';

/** Scenario registry for restore. Currently a single entry; grows with the roster. */
export const SCENARIOS_BY_ID: Record<string, CampaignScenario> = {
  [SAGUNTUM.id]: SAGUNTUM,
};

/** A pool card reduced to its persistable identity. */
export interface SavedCardInstance {
  instanceId: number;
  defId: string;
  timer: number;
}

/**
 * JSON-safe projection of a campaign: every IterBelliState field except the two
 * closure-bearing ones (`pool`, `doctrineModifiers`), plus the scenario id, the
 * id-reduced pool, and the log.
 */
export type IterBelliSave = Omit<IterBelliState, 'pool' | 'doctrineModifiers'> & {
  scenarioId: string;
  pool: SavedCardInstance[];
  log: LogLine[];
};

/**
 * Snapshot the live campaign, or null when none is active. Fields are listed
 * explicitly rather than spread-and-drop: the `IterBelliSave` type enforces
 * completeness (a missed field is a compile error), and explicit listing avoids
 * unused destructure bindings that `noUnusedLocals` would reject.
 */
export function serializeIterBelli(): IterBelliSave | null {
  if (!iterBelliActive.value) return null;
  const s = iterBelliState.value;
  return {
    scenarioId: getActiveScenario().id,
    soldiers: s.soldiers, morale: s.morale, discipline: s.discipline, supplies: s.supplies,
    gold: s.gold, iuniores: s.iuniores, threat: s.threat, timeRemaining: s.timeRemaining,
    turnNum: s.turnNum, locationIdx: s.locationIdx, cardIdCounter: s.cardIdCounter,
    ambushDetected: s.ambushDetected, fortified: s.fortified, truceTurns: s.truceTurns,
    finished: s.finished, enemyWeaken: s.enemyWeaken, brokenCommitments: s.brokenCommitments,
    phase: s.phase, outcome: s.outcome, archetype: s.archetype,
    initialSoldiers: s.initialSoldiers, spokeTerrain: s.spokeTerrain, spokeDuration: s.spokeDuration,
    missionId: s.missionId, quests: s.quests,
    pool: s.pool.map((c) => ({ instanceId: c.instanceId, defId: c.def.id, timer: c.timer })),
    log: iterBelliLog.value.slice(),
  };
}

/**
 * Re-resolve a saved card-def id to a live def. Quest cards are rebuilt from the
 * matching SecondaryQuest, crisis cards from the active scenario, everything else
 * from CARD_DEFS. Returns null for an unresolvable id (the card is then dropped).
 */
function resolveCardDef(defId: string, scenario: CampaignScenario, quests: SecondaryQuest[]): AnyCardDef | null {
  const quest = quests.find((q) => `card_${q.id}` === defId);
  if (quest) return makeQuestCard(quest);

  if (defId.startsWith('crisis_')) {
    const key = defId.slice('crisis_'.length) as keyof CampaignScenario['crises'];
    const crisis = scenario.crises[key];
    return crisis ? { ...crisis, id: defId } : null;
  }

  return CARD_DEFS.find((c) => c.id === defId) ?? null;
}

/**
 * Restore a saved campaign into the live engine. `doctrineModifiers` are supplied
 * by the caller (recomputed from the restored equipped doctrines) so this module
 * need not depend on the Hub doctrine store.
 */
export function restoreIterBelli(save: IterBelliSave, doctrineModifiers: DoctrineCampaignModifier[]): void {
  const scenario = SCENARIOS_BY_ID[save.scenarioId] ?? SAGUNTUM;
  setActiveScenario(scenario);

  const pool: CardInstance[] = save.pool
    .map((sc) => {
      const def = resolveCardDef(sc.defId, scenario, save.quests);
      return def ? { instanceId: sc.instanceId, def, timer: sc.timer } : null;
    })
    .filter((c): c is CardInstance => c !== null);

  const state: IterBelliState = {
    soldiers: save.soldiers, morale: save.morale, discipline: save.discipline, supplies: save.supplies,
    gold: save.gold, iuniores: save.iuniores, threat: save.threat, timeRemaining: save.timeRemaining,
    turnNum: save.turnNum, locationIdx: save.locationIdx, cardIdCounter: save.cardIdCounter,
    ambushDetected: save.ambushDetected, fortified: save.fortified, truceTurns: save.truceTurns,
    finished: save.finished, enemyWeaken: save.enemyWeaken, brokenCommitments: save.brokenCommitments,
    phase: save.phase, outcome: save.outcome, archetype: save.archetype,
    initialSoldiers: save.initialSoldiers, spokeTerrain: save.spokeTerrain, spokeDuration: save.spokeDuration,
    missionId: save.missionId, quests: save.quests,
    pool, doctrineModifiers,
  };
  loadIterBelliState(state, save.log.slice());
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. If a "missing property" error appears on the `serialize` return or
the `state` object, a field was added to `IterBelliState` after this plan was
written — add it to both the serialize return and the restore `state` object.

- [ ] **Step 3: Commit**

```bash
git add src/game/iterBelli/iter-belli-save.ts
git commit -m "feat(iter-belli): add campaign serialize/restore module"
```

---

## Task 3: Round-trip verifier (the test)

**Files:**
- Create: `tools/verify-iter-belli-save.ts`

- [ ] **Step 1: Write the verifier**

Create `tools/verify-iter-belli-save.ts`:

```ts
/**
 * Verifies Iter Belli campaign persistence: start a campaign, mutate it, then
 * serialize → reset → restore and assert the live state round-trips exactly
 * (scalars, pool identity + timers, log length, scenario id).
 *
 * Run: npx tsx tools/verify-iter-belli-save.ts
 */
import { startIterBelliCampaign, resetIterBelli, iterBelliState, iterBelliLog, camp } from '../src/game/iterBelli/iter-belli-state';
import { serializeIterBelli, restoreIterBelli } from '../src/game/iterBelli/iter-belli-save';
import { getActiveScenario } from '../src/game/iterBelli/iter-belli-scenario';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (!cond) { console.error(`  ✗ ${label}`); failures++; }
  else { console.log(`  ✓ ${label}`); }
}

// 1. Start a campaign and advance a few turns so timers/turnNum/log are non-trivial.
startIterBelliCampaign({
  soldiers: 9000, gold: 120, iuniores: 30, discipline: 4,
  archetype: 'Warlord', spokeTerrain: 'plains', spokeDuration: 2,
  supplies: 40,
});
camp();
camp();

const before = iterBelliState.value;
const beforeLogLen = iterBelliLog.value.length;
const beforePoolIds = before.pool.map((c) => `${c.instanceId}:${c.def.id}:${c.timer}`);
const beforeScenario = getActiveScenario().id;

// 2. Serialize.
const save = serializeIterBelli();
check('serializeIterBelli returns a snapshot while active', save !== null);
if (!save) { process.exit(1); }
check('snapshot stores the scenario id', save.scenarioId === beforeScenario);
check('snapshot pool stores defId + timer', save.pool.length === before.pool.length);

// 3. Reset, then confirm serialize is null when inactive.
resetIterBelli();
check('serializeIterBelli returns null after reset', serializeIterBelli() === null);
check('reset clears the pool', iterBelliState.value.pool.length === 0);

// 4. Restore (no doctrines in this harness) and compare.
restoreIterBelli(save, []);
const after = iterBelliState.value;

check('soldiers round-trip', after.soldiers === before.soldiers);
check('gold round-trip', after.gold === before.gold);
check('morale round-trip', after.morale === before.morale);
check('turnNum round-trip', after.turnNum === before.turnNum);
check('locationIdx round-trip', after.locationIdx === before.locationIdx);
check('cardIdCounter round-trip', after.cardIdCounter === before.cardIdCounter);
check('phase round-trip', after.phase === before.phase);
check('archetype round-trip', after.archetype === before.archetype);
check('scenario id round-trip', getActiveScenario().id === beforeScenario);
check('log length round-trip', iterBelliLog.value.length === beforeLogLen);

const afterPoolIds = after.pool.map((c) => `${c.instanceId}:${c.def.id}:${c.timer}`);
check('pool identity + timers round-trip', JSON.stringify(afterPoolIds) === JSON.stringify(beforePoolIds));
check('restored pool defs are live (have effects fn)', after.pool.every((c) => c.def.category === 'Crisis' || typeof (c.def as { effects?: unknown }).effects === 'function'));

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
```

- [ ] **Step 2: Run it — expect PASS**

Run: `npx tsx tools/verify-iter-belli-save.ts`
Expected: all `✓` lines, ending `All checks passed.` (exit 0).

If any check fails, fix the implementation in Task 1/2 before continuing — the serializer/resolver is wrong, not the test.

- [ ] **Step 3: Commit**

```bash
git add tools/verify-iter-belli-save.ts
git commit -m "test(iter-belli): round-trip verifier for campaign persistence"
```

---

## Task 4: Wire the snapshot into `meta-save.ts`

**Files:**
- Modify: `src/game/core/meta-save.ts`

- [ ] **Step 1: Add imports**

In `src/game/core/meta-save.ts`, near the other `../items/doctrine-store` import line:

```ts
import { doctrineCollection, equippedDoctrines } from '../items/doctrine-store';
```

confirm `equippedDoctrines` is imported (it already is). Then add two new imports — one for the save module, one for the doctrine recompute:

```ts
import { serializeIterBelli, restoreIterBelli, type IterBelliSave } from '../iterBelli/iter-belli-save';
import { computeDoctrineModifiers } from '../../data/iter-belli-doctrines';
```

- [ ] **Step 2: Add the field to `ActiveRunSave`**

In the `ActiveRunSave` interface, after the `activeDecretumEffects?` line, add:

```ts
  /** In-flight Iter Belli campaign snapshot. Absent/null = no campaign in flight. */
  iterBelli?: IterBelliSave | null;
```

- [ ] **Step 3: Serialize it in `buildActiveRunSnapshot`**

In `buildActiveRunSnapshot()`, find the final field `activeDecretumEffects: activeDecretumEffects.value,` and add after it:

```ts
    iterBelli: serializeIterBelli(),
```

- [ ] **Step 4: Carry it through migration**

In `migrateActiveRun()`, find the final returned field `activeDecretumEffects: Array.isArray(run.activeDecretumEffects) ? run.activeDecretumEffects : [],` and add after it:

```ts
    iterBelli: (run.iterBelli && typeof run.iterBelli === 'object') ? run.iterBelli as IterBelliSave : null,
```

- [ ] **Step 5: Restore it in `restoreActiveRun`**

In `restoreActiveRun()`, find where the doctrine signals are restored:

```ts
    doctrineCollection.value = snapshot.doctrineCollection;
    equippedDoctrines.value = snapshot.equippedDoctrines;
    decretumHand.value = snapshot.decretumHand;
    maxHandSize.value = snapshot.maxHandSize;
    activeDecretumEffects.value = snapshot.activeDecretumEffects ?? [];
```

Add immediately after that block (equipped doctrines are now set, so the recompute is valid):

```ts
    if (snapshot.iterBelli) {
      restoreIterBelli(snapshot.iterBelli, computeDoctrineModifiers(equippedDoctrines.value));
    }
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Re-run the verifier (guards against import-cycle / regression)**

Run: `npx tsx tools/verify-iter-belli-save.ts`
Expected: `All checks passed.`

- [ ] **Step 8: Commit**

```bash
git add src/game/core/meta-save.ts
git commit -m "feat(meta-save): persist and restore the in-flight Iter Belli campaign"
```

---

## Task 5: Autosave the campaign each turn

**Files:**
- Modify: `src/game/core/meta-save.ts`

- [ ] **Step 1: Import the campaign signal**

In `src/game/core/meta-save.ts`, add this import near the other `../iterBelli/*` imports (the signal lives in `iter-belli-state`, a different module from the save helpers added in Task 4):

```ts
import { iterBelliState } from '../iterBelli/iter-belli-state';
```

- [ ] **Step 2: Track the campaign signal in the autosave effect**

In `startActiveRunPersistence()`, find the effect:

```ts
  const stop = effect(() => {
    if (!selectedCommander.value) return;

    flushPendingPersist();
    pendingPersistTimer = setTimeout(() => {
      pendingPersistTimer = null;
      saveActiveRunSnapshot();
    }, SAVE_DEBOUNCE_MS);
  });
```

Replace with (reads `iterBelliState.value` first so each committed turn is tracked and debounce-saved):

```ts
  const stop = effect(() => {
    // Track the campaign so each committed turn debounce-saves the run snapshot.
    void iterBelliState.value;
    if (!selectedCommander.value) return;

    flushPendingPersist();
    pendingPersistTimer = setTimeout(() => {
      pendingPersistTimer = null;
      saveActiveRunSnapshot();
    }, SAVE_DEBOUNCE_MS);
  });
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/core/meta-save.ts
git commit -m "feat(meta-save): autosave campaign state on every turn commit"
```

---

## Task 6: Boot-time resume in `App.tsx`

**Files:**
- Modify: `src/ui/screens/App.tsx`

- [ ] **Step 1: Add imports + boot logic at module scope**

In `src/ui/screens/App.tsx`, find the top imports and the boot line:

```ts
import { loadMetaSave, startActiveRunPersistence } from '../../game/core/meta-save';

// Load meta-save from localStorage on startup
loadMetaSave();
```

Replace with:

```ts
import { signal } from '@preact/signals';
import { loadMetaSave, startActiveRunPersistence, restoreActiveRun, metaSave } from '../../game/core/meta-save';
import { currentScreen, navigateTo, navigateToIterBelli } from '../screens';

// Load meta-save from localStorage on startup
loadMetaSave();

/**
 * True while a saved in-flight campaign is being restored at boot. `App` renders
 * a bare veil during this window so the empty campaign never flashes before the
 * async restore (which may load topology) completes.
 */
export const bootResuming = signal<boolean>(metaSave.value.activeRun?.iterBelli != null);

if (bootResuming.value) {
  void (async () => {
    const ok = await restoreActiveRun();
    if (ok) {
      // A mid-campaign reload keeps the `#iterbelli` hash, so we are usually
      // already on the right screen — only navigate (and play its cue) if not.
      if (currentScreen.value !== 'iterbelli') navigateToIterBelli();
    } else {
      navigateTo('title');
    }
    bootResuming.value = false;
  })();
}
```

Note: `currentScreen`, `navigateTo`, and `navigateToIterBelli` are all exported from `../screens`. `metaSave` and `restoreActiveRun` are already exported from `meta-save.ts`.

- [ ] **Step 2: Render the veil while resuming**

In the `App` component, find:

```ts
export function App() {
  const screen = currentScreen.value;
  const exiting = transitionState.value === 'exiting';
  const showResourceBar = !BARE_SCREENS.has(screen);

  useEffect(() => {
    return startActiveRunPersistence();
  }, []);

  return (
```

Replace with (hooks still run unconditionally; the veil returns after them):

```ts
export function App() {
  const screen = currentScreen.value;
  const exiting = transitionState.value === 'exiting';
  const showResourceBar = !BARE_SCREENS.has(screen);
  const resuming = bootResuming.value;

  useEffect(() => {
    return startActiveRunPersistence();
  }, []);

  if (resuming) {
    return <div style={{ position: 'fixed', inset: 0, background: 'var(--color-bg-primary, #0a0a14)' }} />;
  }

  return (
```

- [ ] **Step 3: Type-check + production build**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npx vite build`
Expected: build succeeds (bundle emitted, no errors).

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/App.tsx
git commit -m "feat(app): auto-resume in-flight Iter Belli campaign on reload"
```

---

## Task 7: Manual runtime verification

**Files:** none (manual check).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server on http://localhost:5173/.

- [ ] **Step 2: Reach and mutate a campaign**

In the browser: Title → New Game → pick a commander → Forum → Embark. On the Iter Belli screen, play 2–3 cards / camp so `turnNum > 0` and the hand has changed. Note the current turn number and the cards in hand.

- [ ] **Step 3: Reload**

Press F5. Expected: after a brief dark veil, the app lands **directly** on the Iter Belli screen at the **same turn** with the **same cards/timers** — not the Title screen, not a fresh campaign.

- [ ] **Step 4: Verify the hub round-trip still works**

Continue to the decisive battle, finish it, reach the Endgame card. Reload **before** clicking "Volver al Hub". Expected: returns to the Endgame card (rewards still claimable). Click "Volver al Hub". Reload again. Expected: no auto-resume — normal boot (Title), and Continue restores the Hub with the campaign cleared.

- [ ] **Step 5: Check the console**

Expected: no errors beyond the known benign favicon 404. In particular, no `[meta-save] Failed to restore active run` warning.

---

## Self-Review Notes (resolved during planning)

- **Endgame persistence:** campaigns are persisted while `iterBelliActive` is true, which includes the `endgame` phase (until `returnToHub` resets). This avoids losing unclaimed rewards on a reload at the endgame card.
- **Mid-battle reload:** `BattleState` is not serialized; `BattleModal`'s mount effect re-derives the battle from the restored campaign army. Verified mechanism in `BattleModal.tsx`.
- **Doctrine modifiers:** recomputed by `meta-save` (which owns `equippedDoctrines`) and passed into `restoreIterBelli`, keeping `iter-belli-save.ts` free of Hub-store imports and verifiable in isolation.
- **No version bump:** `iterBelli?` is optional on `ActiveRunSave`; old v3 saves lacking it migrate to `null`.
