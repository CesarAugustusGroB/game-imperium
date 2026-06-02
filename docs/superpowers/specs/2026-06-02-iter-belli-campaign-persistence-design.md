# Iter Belli — Campaign Persistence Across Reload

**Date:** 2026-06-02
**Status:** Approved design, pending implementation plan

## Problem

When the player reloads the page mid-campaign, the in-progress Iter Belli campaign
is lost. The Hub run survives (via `meta-save.ts` → `ActiveRunSave` → localStorage),
but campaign serialization was deliberately removed during the legacy purge. The
player wants a reload to drop them **straight back into the campaign** at the same
turn, with the same card hand.

## Goal

Persist the in-flight Iter Belli campaign as part of the existing active-run
meta-save. On boot, if a campaign is in flight, auto-restore it and route directly
to the Iter Belli screen. No new localStorage key; reuse the existing autosave,
restore, and migration plumbing.

## Non-Goals

- No serialization of the transient decisive-battle (`BattleState`) sub-state.
- No new "Continue" UI; reload routing is automatic.
- No meta-save version bump (the new field is backward-compatible).
- No persistence of finished campaigns (an ended run is not resumed).

## Architecture

The campaign is logically part of the active run: it launches from the Hub
(`EmbarkCard`) and writes resources back on return. So its snapshot lives **inside
`ActiveRunSave`**, not in a separate store.

```
meta-save.ts ──imports──> iter-belli-save.ts ──imports──> iter-belli-state.ts
                                              ──imports──> data (cards, quests, doctrines, scenario)
```

No import cycles: nothing under `iter-belli-save.ts` imports back into `meta-save.ts`.

## Data Model

New optional field on `ActiveRunSave`:

```ts
iterBelli?: IterBelliSave | null;   // absent/null = no campaign in flight
```

`IterBelliSave` is a JSON-safe projection of `IterBelliState` + `log` + `scenarioId`.
The two closure-bearing fields are **not stored** — they are re-derived on restore:

| Field | Strategy |
|---|---|
| `pool[].def` (card defs are functions) | Store `{ instanceId, defId, timer }`. On restore, resolve the def by id: normal cards from `CARD_DEFS`; crisis cards (`crisis_*`) from `getActiveScenario().crises`; quest cards via `makeQuestCard(quest)` matched against `state.quests`. |
| `doctrineModifiers` (hooks are functions) | Not stored. Recomputed via `computeDoctrineModifiers(equippedDoctrines.value)` at restore time. The Hub restore runs first and equipped doctrines cannot change mid-campaign, so recompute is safe. |
| All scalars/flags/`outcome`/`quests`/`archetype`/`missionId`/`locationIdx`/`turnNum`/`log` | Copied verbatim (already plain data). |
| `scenarioId` | Stored; on restore `setActiveScenario(SCENARIOS_BY_ID[id])`. Registry currently holds only `SAGUNTUM`. |

**Exact fidelity:** the pool and its timers are persisted as-is, so a reload does not
reroll the hand (prevents save-scumming).

## Components & Files

1. **`src/game/iterBelli/iter-belli-save.ts` (NEW)**
   - `IterBelliSave` interface (the JSON projection above).
   - `SavedCardInstance = { instanceId: number; defId: string; timer: number }`.
   - `serializeIterBelli(): IterBelliSave | null` — reads `iterBelliState.value` +
     `iterBelliLog.value` + `getActiveScenario().id`. Returns `null` when the
     campaign is finished or never started (so a finished run is not resumed).
   - `restoreIterBelli(save: IterBelliSave): void` — sets the active scenario,
     resolves card defs, recomputes doctrine modifiers, builds a full
     `IterBelliState`, and hands it to `loadIterBelliState`.
   - `SCENARIOS_BY_ID: Record<string, CampaignScenario>` — id → scenario lookup.
   - `resolveCardDef(defId, state): AnyCardDef | null` — the pool rehydrator.

2. **`src/game/iterBelli/iter-belli-state.ts`**
   - Add `loadIterBelliState(state: IterBelliState, log: LogLine[]): void` — replaces
     the module-private `S` and `logLines`, then `commit()`s. (Serialize needs no new
     export — it reads the committed signal.)

3. **`src/game/core/meta-save.ts`**
   - Add `iterBelli?: IterBelliSave | null` to `ActiveRunSave`.
   - `buildActiveRunSnapshot()` sets `iterBelli: serializeIterBelli()`.
   - `migrateActiveRun()` reads `run.iterBelli ?? null` (backward-compatible; no
     version bump — old saves simply lack the field).
   - `restoreActiveRun()`, after the Hub state is restored, calls
     `if (snapshot.iterBelli) restoreIterBelli(snapshot.iterBelli)`.

4. **`src/ui/screens/App.tsx`**
   - At boot, `maybeResumeCampaign()`: if the loaded save has an **in-flight**
     campaign (`activeRun.iterBelli && !activeRun.iterBelli.finished`),
     `await restoreActiveRun()` then `navigateToIterBelli()`. Otherwise no-op — the
     existing Title/Continue flow is untouched.

5. **Autosave**
   - Extend the tracked `effect` in `startActiveRunPersistence` to read
     `iterBelliState.value`, so each committed turn debounce-saves the full snapshot
     (which now includes `iterBelli`).

## Edge Cases

- **Finished campaign** (`state.finished`): `serializeIterBelli()` returns `null`,
  so nothing is restored or auto-routed.
- **Reload mid decisive battle** (`phase === 'battle'`): the transient `BattleState`
  is **not** serialized. On restore with `phase === 'battle'`, the decisive battle is
  re-initialized from the persisted army (soldiers/morale/discipline/`enemyWeaken`/
  `fortified` + `scenario.enemy`). Dice are RNG regardless, so this is equivalent.
  Rare case, zero serialization cost. (Implementation detail to confirm in planning:
  how `IterBelliScreen`/`BattleModal` enter the battle phase, to ensure re-entry
  re-derives the battle.)

## Testing

- `npx tsc --noEmit` clean.
- `tools/verify-iter-belli-save.ts` (NEW): start a campaign, play N turns,
  `serialize → restore` into a clean state, assert deep equality of scalars +
  pool ids/timers + log length + `scenarioId`.
- Manual: dev server → embark → play 2–3 turns → **F5** → reappear in the campaign
  at the same turn with the same cards.

## Open Questions

None.
