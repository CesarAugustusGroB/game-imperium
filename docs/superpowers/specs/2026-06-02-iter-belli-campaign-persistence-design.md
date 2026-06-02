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
| `doctrineModifiers` (hooks are functions) | Not stored. Recomputed by the **caller** (`meta-save`) via `computeDoctrineModifiers(equippedDoctrines.value)` and passed into `restoreIterBelli(save, modifiers)`. Keeps `iter-belli-save.ts` free of `doctrine-store` imports. Equipped doctrines cannot change mid-campaign, so recompute is safe. |
| All scalars/flags/`outcome`/`quests`/`archetype`/`missionId`/`locationIdx`/`turnNum`/`log` | Copied verbatim (already plain data). |
| `scenarioId` | Stored; on restore `setActiveScenario(SCENARIOS_BY_ID[id])`. Registry currently holds only `SAGUNTUM`. |

**Exact fidelity:** the pool and its timers are persisted as-is, so a reload does not
reroll the hand (prevents save-scumming).

## Components & Files

1. **`src/game/iterBelli/iter-belli-save.ts` (NEW)**
   - `IterBelliSave` interface (the JSON projection above).
   - `SavedCardInstance = { instanceId: number; defId: string; timer: number }`.
   - `serializeIterBelli(): IterBelliSave | null` — reads `iterBelliState.value` +
     `iterBelliLog.value` + `getActiveScenario().id`. Returns `null` when no
     campaign is active (the `iterBelliActive` flag is false).
   - `restoreIterBelli(save: IterBelliSave, doctrineModifiers: DoctrineCampaignModifier[]): void`
     — sets the active scenario, resolves card defs, builds a full
     `IterBelliState` (injecting the caller-supplied modifiers), and hands it to
     `loadIterBelliState`.
   - `SCENARIOS_BY_ID: Record<string, CampaignScenario>` — id → scenario lookup.
   - `resolveCardDef(defId, state): AnyCardDef | null` — the pool rehydrator.

2. **`src/game/iterBelli/iter-belli-state.ts`**
   - Add `export const iterBelliActive = signal<boolean>(false)` — true while a
     campaign is in flight. Set `true` at the end of `startIterBelliCampaign`,
     `false` in `resetIterBelli`.
   - Add `loadIterBelliState(state: IterBelliState, log: LogLine[]): void` — replaces
     the module-private `S` and `logLines`, sets `iterBelliActive` true, then
     `commit()`s. (Serialize needs no new export — it reads the committed signal.)

3. **`src/game/core/meta-save.ts`**
   - Add `iterBelli?: IterBelliSave | null` to `ActiveRunSave`.
   - `buildActiveRunSnapshot()` sets `iterBelli: serializeIterBelli()`.
   - `migrateActiveRun()` reads `run.iterBelli ?? null` (backward-compatible; no
     version bump — old saves simply lack the field).
   - `restoreActiveRun()`, after the Hub state (incl. `equippedDoctrines`) is
     restored, calls `if (snapshot.iterBelli) restoreIterBelli(snapshot.iterBelli,
     computeDoctrineModifiers(equippedDoctrines.value))`.

4. **`src/ui/screens/App.tsx`**
   - At boot (module scope, after `loadMetaSave()`): if the loaded save has a
     campaign (`activeRun.iterBelli != null` — only emitted while active), set a
     `bootResuming` signal true and kick off an async resume: `await
     restoreActiveRun()` → `navigateToIterBelli()` → `bootResuming = false`.
   - While `bootResuming` is true, `App` renders a bare dark veil (no content) to
     avoid a flash of the empty campaign before restore completes. Otherwise no-op —
     the existing Title/Continue flow is untouched.

5. **Autosave**
   - Extend the tracked `effect` in `startActiveRunPersistence` to read
     `iterBelliState.value`, so each committed turn debounce-saves the full snapshot
     (which now includes `iterBelli`).

## Edge Cases

- **Endgame reached, not yet returned** (`phase === 'endgame'`): the campaign stays
  `active`, so it **is** persisted and resumed to the `EndgameCard`. This is
  deliberate — `returnToHub()` is what applies the campaign rewards (gold, province,
  season advance, cohort scaling); resuming the endgame lets the player still claim
  them after a reload. The save is cleared (`iterBelliActive → false`) only once
  `returnToHub()` runs `resetIterBelli()`.
- **Reload mid decisive battle** (`phase === 'battle'`): the transient `BattleState`
  is **not** serialized. On restore with `phase === 'battle'`, the decisive battle is
  re-initialized from the persisted army (soldiers/morale/discipline/`enemyWeaken`/
  `fortified` + `scenario.enemy`). Dice are RNG regardless, so this is equivalent.
  Rare case, zero serialization cost. Confirmed mechanism: `BattleModal`'s mount
  effect calls `beginBattle()` whenever `iterBelliBattle.value` is null, and restore
  leaves that signal null — so re-entering the `battle` phase re-derives the battle
  automatically with no extra wiring.

## Testing

- `npx tsc --noEmit` clean.
- `tools/verify-iter-belli-save.ts` (NEW): start a campaign, play N turns,
  `serialize → restore` into a clean state, assert deep equality of scalars +
  pool ids/timers + log length + `scenarioId`.
- Manual: dev server → embark → play 2–3 turns → **F5** → reappear in the campaign
  at the same turn with the same cards.

## Open Questions

None.
