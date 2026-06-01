# Legacy Purge — Iter Belli as the only campaign/battle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete all legacy systems (bellum hex, spoke, old `src/battle/**` combat, Quick Battle, run-end screens), leaving Iter Belli as the only campaign + battle. Hub embark seeds Iter Belli directly.

**Architecture:** Two phases. **Phase 1 decouples** the live embark from the spoke (EmbarkCard reads terrain from the active scenario + duration from a new council helper; nothing live reads `plannedSpoke`/`currentSpoke` afterward). **Phase 2 deletes** the now-orphaned legacy in dependency order, each batch gated by `tsc --noEmit` + grep residue checks + the iter-belli verifiers.

**Tech Stack:** TypeScript, Preact + @preact/signals. No unit-test runner — "tests" = `npx tsc --noEmit`, `npx tsx tools/verify-*.ts`, and grep residue checks. `noUnusedLocals`/`noUnusedParameters` are on.

**Notes for the engineer:**
- Working dir: `C:\Users\Henrich von Kleist\workspace\Map2D\.claude\worktrees\experimentation`. Run commands by cd-ing in (home path has a space — keep quoted): `cd "C:/Users/Henrich von Kleist/workspace/Map2D/.claude/worktrees/experimentation" && npx tsc --noEmit`.
- Commit style: Conventional Commits. End each commit message with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Golden rule for Phase 2:** after every deletion batch, run `npx tsc --noEmit` and let its errors drive the next edit. Never delete a file that `tsc` still reports as imported by a *surviving* file without first removing that import.
- **Verified deletion inventory** (audited; safe once Phase 1 lands):
  - Whole dirs: `src/battle/**`, `src/game/campaign/**`, `src/ui/components/spoke/**`, `src/ui/components/bellum/**`.
  - `src/game/progression/`: `spoke.ts`, `spoke-generation.ts`, `spoke-effects.ts`, `spoke-scouting.ts`, `season-tick.ts`, `landmark-types.ts`, `battle-terrain-modifiers.ts`.
  - `src/game/army/`: `army-replenishment.ts`, `enemy-army-generator.ts`, `enemy-cohort-data.ts`, `morale.ts`, `supplies.ts`.
  - Screens: `BattleScreenV2.tsx`, `PostBattleScreen.tsx`, `QuickBattleScreen.tsx`, `VictoryScreen.tsx`, `DefeatScreen.tsx`, `EndScreen.tsx`, `BellumSystemsScreen.tsx`, `CampaignHexScreen.tsx`, `HubScreen.tsx`; plus `src/ui/components/ArmyDetailHUD.tsx`.
  - **KEEP** (live): `progression/strategic-store.ts`, `progression/npc-faction-store.ts`, `army/cohort.ts`, `army/cohort-data.ts`, `army/legate.ts`, `army/legate-traits.ts`, `army/legate-pool.ts`, all `forum/**`, all `iterBelli/**`/`iterbelli/**`, `council/**` (slimmed), `core/**` (cleaned), `province/**`, `items/**`.

---

## PHASE 1 — Decouple the embark from the spoke

### Task 1: Add `provinceTerrain` to the scenario

**Files:**
- Modify: `src/game/iterBelli/iter-belli-types.ts`
- Modify: `src/data/iter-belli-scenario-saguntum.ts`
- Modify: `tools/verify-iter-belli-scenario.ts`

- [ ] **Step 1: Add the field to the type**

In `src/game/iterBelli/iter-belli-types.ts`, add a `TerrainType` import at the top (near the other imports):

```ts
import type { TerrainType } from '../../data/terrain-data';
```

Then add `provinceTerrain` to the `CampaignScenario` interface (after `conquestNames`):

```ts
  conquestNames: string[];
  /** Terrain stamped on the province conquered on victory (was spoke.theme). */
  provinceTerrain: TerrainType;
```

- [ ] **Step 2: Set it on SAGUNTUM**

In `src/data/iter-belli-scenario-saguntum.ts`, add the field to the `SAGUNTUM` object (after `conquestNames: CONQUEST_NAMES,`):

```ts
  conquestNames: CONQUEST_NAMES,
  provinceTerrain: 'plains',
```

(`'plains'` equals the current `themeToTerrain(undefined)` default.)

- [ ] **Step 3: Extend the verifier**

In `tools/verify-iter-belli-scenario.ts`, after the narrative checks, add:

```ts
console.log('SAGUNTUM province terrain');
check('provinceTerrain present', typeof SAGUNTUM.provinceTerrain === 'string' && SAGUNTUM.provinceTerrain.length > 0);
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → PASS.
Run: `npx tsx tools/verify-iter-belli-scenario.ts` → all `ok`.

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/iter-belli-types.ts src/data/iter-belli-scenario-saguntum.ts tools/verify-iter-belli-scenario.ts
git commit -m "feat(iterbelli): scenario owns provinceTerrain (was spoke.theme)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2: Council embark helpers (duration + gate) without a spoke

**Files:**
- Modify: `src/game/council/council-store.ts`

- [ ] **Step 1: Add the two helpers**

In `src/game/council/council-store.ts`, add these exports near the other exported functions (they reuse the already-imported `getCurrentSpokeTemplate` and `councilSlots`; `Advisor` is already imported):

```ts
/**
 * Campaign duration (seasons) derived from seated advisors — the spoke-free
 * replacement for generateSpokeFromCouncil's duration block. 0 seated → 1
 * (matches the old `spoke?.duration ?? 1` fallback).
 */
export function plannedCampaignDuration(): number {
  const seated = councilSlots.value.filter((a): a is Advisor => a !== null);
  if (seated.length === 0) return 1;
  const avg = seated.reduce((sum, a) => {
    const [min, max] = getCurrentSpokeTemplate(a).durationRange;
    return sum + (min + max) / 2;
  }, 0) / seated.length;
  return Math.round(Math.min(4, Math.max(2, avg)));
}

/** Embark is allowed once at least one advisor is seated (preserves the old
 *  gate: no seated council → no plannedSpoke → embark disabled). */
export function canEmbarkFromCouncil(): boolean {
  return councilSlots.value.some(Boolean);
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/game/council/council-store.ts
git commit -m "feat(council): spoke-free embark helpers (plannedCampaignDuration, canEmbarkFromCouncil)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 3: Rewrite EmbarkCard to drop the spoke

**Files:**
- Modify: `src/ui/screens/forum/panels/EmbarkCard.tsx`

- [ ] **Step 1: Swap imports**

Replace the council-store import (line 2):

```ts
import { plannedSpoke, councilSlots } from '../../../../game/council/council-store';
```

with:

```ts
import { councilSlots, plannedCampaignDuration, canEmbarkFromCouncil } from '../../../../game/council/council-store';
```

Add a scenario import (next to the other iterBelli imports near line 6):

```ts
import { getActiveScenario } from '../../../../game/iterBelli/iter-belli-scenario';
```

Remove the now-unused `themeToTerrain` import (it was imported from `iter-belli-conquest`; delete that import line).

- [ ] **Step 2: Replace the spoke reads**

Find:

```ts
  const spoke = plannedSpoke.value;
  const army = preparedArmy.value;
```

Replace with:

```ts
  const army = preparedArmy.value;
```

Find:

```ts
  const campaignTitle = spoke?.label ?? 'No campaign planned';
  const nodes = spoke?.nodes ?? [];
  const canEmbark = !!spoke && nodes.length > 0;
```

Replace with:

```ts
  const campaignTitle = `Campaña — ${getActiveScenario().enemy.name}`;
  const canEmbark = canEmbarkFromCouncil();
```

(If `nodes` is referenced anywhere else in the file, remove those references — it was only the embark gate.)

- [ ] **Step 3: Replace the seed terrain/duration in `handleEmbark`**

Find:

```ts
    const spokeTerrain = themeToTerrain(spoke?.theme);
    const spokeDuration = spoke?.duration ?? 1;
```

Replace with:

```ts
    const spokeTerrain = getActiveScenario().provinceTerrain;
    const spokeDuration = plannedCampaignDuration();
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → PASS. If it reports `themeToTerrain` or `plannedSpoke` still referenced, grep `EmbarkCard.tsx` for them and remove the stragglers.
Run: `npx tsx tools/verify-iter-belli-scenario.ts` → all `ok`.
Confirm nothing else in the live Forum reads the spoke:
Run (PowerShell): `Select-String -Path src/ui/screens/forum -Recurse -Pattern "plannedSpoke"` → expect **no matches**.

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/forum/panels/EmbarkCard.tsx
git commit -m "refactor(forum): EmbarkCard seeds terrain/duration from scenario+council, not spoke" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## PHASE 2 — The purge (deletion, tsc-guided)

> After Phase 1 the only remaining importers of the legacy modules are themselves legacy, plus a handful of explicit cleanups listed below. Work top-down: cut the live cleanup edits first (so the dead modules become fully orphaned), then delete the dead files, running `npx tsc --noEmit` after each task.

### Task 4: Cut the remaining live couplings (game-state, meta-save, advisor, TitleScreen, council spoke-gen)

**Files:**
- Modify: `src/game/core/game-state.ts`
- Modify: `src/game/core/meta-save.ts`
- Modify: `src/game/council/advisor.ts`
- Modify: `src/game/council/council-store.ts`
- Modify: `src/ui/screens/TitleScreen.tsx`

- [ ] **Step 1: game-state.ts — drop spoke/season-tick/campaign wiring**

- Remove `import { resetSpoke } from '../progression/spoke';` (line ~11) and its call `resetSpoke();` (in `resetRun`, line ~245).
- Remove `import { resetCampaign } from '../campaign/campaign-state';` (line ~20) and its call `resetCampaign();` (line ~230).
- Remove the `season-tick` wiring: the imports of `setExtraUpkeepReductionFn`/`setThreatReductionFn` (from `../progression/season-tick`) and their calls in `wireRunBonuses`, plus their reset to `() => 0` in `resetRun`. Keep the `advisorIncomeBonus`/`setIncomeModifierFn`/`setExtraShopDiscountFn` wiring (those target strategic-store, which survives).
- Keep signals `completedSpokes`, `battlesWon`, `spokesSinceLastBattle`, `veteranStacks`, `globalSeason`, `threatLevel`, `MAX_SEASONS`.

After editing, run `npx tsc --noEmit` — expect errors only about now-missing modules you have not deleted yet; the game-state file itself must have no unresolved local symbols.

- [ ] **Step 2: meta-save.ts — drop spoke + campaign persistence**

- Remove the import of `plannedSpoke`/`currentSpoke` from council/spoke and the campaign-state import block (`campaignState, hexTiles, activeEventTileId, ... from '../campaign/campaign-state'`) and `bellumGains` from `../campaign/bellum-run-gains`.
- Delete the `CampaignSnapshot` interface, the `campaign?: CampaignSnapshot | null` field on `ActiveRunSave`, the `migrateCampaignSnapshot` + `isLikelyHexTile` helpers, and the `campaign: {...}` write in the snapshot builder + the `if (snapshot.campaign) {...}` restore block.
- Delete the `plannedSpoke`/`currentSpoke` fields from the save shape and their save/restore lines.
- Delete `recordRunComplete` (no caller after EndScreen is deleted) — or, if it is simpler, leave it and delete in Task 7 once EndScreen is gone. Either way it must be gone by the end.
- Keep all other persistence (resources, council slots/market, doctrines, decreta, completedSpokes, provinces, commander).

Run `npx tsc --noEmit` after; resolve any local unresolved symbol in this file.

- [ ] **Step 3: advisor.ts — drop the spoke `NodeType` coupling**

- Remove `import type { NodeType } from '../progression/spoke';` (line 2).
- In the `SpokeTemplate` interface, remove the field typed with `NodeType` (the per-node-type weights — spoke-generation-only, dead). Keep `durationRange` and `posture`.
- If `getCurrentSpokeTemplate` or the advisor data literals populate that removed field, delete those entries too.

Run `npx tsc --noEmit` — the advisor file must compile standalone.

- [ ] **Step 4: council-store.ts — remove spoke generation**

- Delete `generateSpokeFromCouncil`, `startSpokeFromCouncil`, `regeneratePlannedSpoke`, and the `plannedSpoke` signal.
- Remove the `import { generateLandmarkSpoke } from '../progression/spoke-generation';` and the `Spoke`/`SpokeNode`/`NodeType`/`SpokeTheme` type imports from `../progression/spoke`, plus any `currentSpoke`/`spokeGains`/`currentNodeIndex`/`resetSpokeEvents` imports used only by the deleted functions.
- Remove the `regeneratePlannedSpoke()` calls inside `seatAdvisor`/`unseatAdvisor`/`hireAndSeatAdvisor`.
- Keep: `councilSlots`, `advisorMarket`, `seatAdvisor`/`unseatAdvisor`/`hireAndSeatAdvisor` (minus the regenerate call), `resetCouncilStore`, the advisor passive aggregators, and the Phase-1 helpers `plannedCampaignDuration`/`canEmbarkFromCouncil`.

Run `npx tsc --noEmit` — council-store must compile; remaining errors should only be in files importing the deleted symbols (handled next).

- [ ] **Step 5: TitleScreen.tsx — drop the spoke resume + Quick Battle button**

- Remove `import { currentSpoke } from ...spoke` and change the resume handler `handleContinue` so it always does `navigateTo('forum')` (delete the `if (currentSpoke.value) navigateToBellum();` branch and the `navigateToBellum` import).
- Remove the Quick Battle `<MenuButton ... onClick={() => navigateTo('quick-battle')}>` block.

Run `npx tsc --noEmit`.

- [ ] **Step 6: Commit the live cleanups**

```bash
git add src/game/core/game-state.ts src/game/core/meta-save.ts src/game/council/advisor.ts src/game/council/council-store.ts src/ui/screens/TitleScreen.tsx
git commit -m "refactor: cut live couplings to spoke/season-tick/campaign ahead of purge" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 5: Delete the battle render loop from main.tsx + the screen registry

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/ui/screens/App.tsx`
- Modify: `src/ui/screens.ts`
- Modify: `src/ui/screens/forum/state.ts`
- Modify: `src/ui/screens/forum/ForumShell.tsx`

- [ ] **Step 1: main.tsx — remove all battle integration**

Delete every battle/spoke/campaign import (BattleMode, isFinalBattle, currentSpoke, lastBattleResult, syncPreparedFromBoundArmy, battle-signals, casualties, hex-battle, campaign-defeat), the navigation-injection calls, the `new BattleMode(...)` instance + its callback, the initial battle-screen DOM toggle, the `effect(currentScreen)` enter/exit block, the resize listener, and the RAF render loop. `main.tsx` should end up only mounting the Preact `<App/>` (keep the meta-save/battle-settings bootstrap that App already triggers — i.e. keep only non-battle bootstrap, or none if App handles it).

Run `npx tsc --noEmit`.

- [ ] **Step 2: App.tsx — remove deleted screens**

Remove imports + `SCREEN_COMPONENTS` entries + `BARE_SCREENS` membership for: `QuickBattleScreen`, `BattleScreenV2`, `PostBattleScreen`, `VictoryScreen`, `DefeatScreen`, and `BellumSystemsScreen` if present. Keep `TitleScreen`, `CommanderSelectScreen`, `ForumShell`, `IterBelliScreen`.

- [ ] **Step 3: screens.ts — prune ScreenName + nav**

Remove `'quick-battle'`, `'battle'`, `'battleV2'`, `'post-battle'`, `'victory'`, `'defeat'`, `'bellum-systems'` from `ScreenName`, `VALID_SCREENS`, `REQUIRES_RUN`, and the battle-screen DOM toggles in `applyScreenDOM`. Delete `navigateToBellum`. Keep `navigateToIterBelli`, `navigateTo`, `currentScreen`, `'forum'`, `'hub'`, `'iterbelli'`, `'title'`, `'commander-select'`.

- [ ] **Step 4: Remove the `bellum` Forum tab**

In `src/ui/screens/forum/state.ts` remove `'bellum'` from the tab union/list; in `src/ui/screens/forum/ForumShell.tsx` remove the `bellum` → `CampaignHexScreen` import + tab mounting case.

- [ ] **Step 5: Verify + commit**

Run `npx tsc --noEmit` — remaining errors should now be exclusively "cannot find module" from the about-to-be-deleted files being still imported by *other dead files* (fine) or unused imports in the files you just edited (fix those). Commit:

```bash
git add src/main.tsx src/ui/screens/App.tsx src/ui/screens.ts src/ui/screens/forum/state.ts src/ui/screens/forum/ForumShell.tsx
git commit -m "refactor(ui): remove battle render loop, battle/bellum screens, and nav" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 6: Delete the dead modules

**Files:** deletions only.

- [ ] **Step 1: Delete the dead screens + components**

```bash
git rm src/ui/screens/BattleScreenV2.tsx src/ui/screens/PostBattleScreen.tsx src/ui/screens/QuickBattleScreen.tsx src/ui/screens/VictoryScreen.tsx src/ui/screens/DefeatScreen.tsx src/ui/screens/EndScreen.tsx src/ui/screens/BellumSystemsScreen.tsx src/ui/screens/CampaignHexScreen.tsx src/ui/screens/HubScreen.tsx src/ui/components/ArmyDetailHUD.tsx
git rm -r src/ui/components/spoke src/ui/components/bellum
```

- [ ] **Step 2: Delete the dead game modules**

```bash
git rm -r src/battle src/game/campaign
git rm src/game/progression/spoke.ts src/game/progression/spoke-generation.ts src/game/progression/spoke-effects.ts src/game/progression/spoke-scouting.ts src/game/progression/season-tick.ts src/game/progression/landmark-types.ts src/game/progression/battle-terrain-modifiers.ts
git rm src/game/army/army-replenishment.ts src/game/army/enemy-army-generator.ts src/game/army/enemy-cohort-data.ts src/game/army/morale.ts src/game/army/supplies.ts
```

- [ ] **Step 2b: Fix the progression barrel**

If `src/game/progression/index.ts` exists and re-exports any deleted file, remove those export lines (keep `strategic-store`, `npc-faction-store`).

- [ ] **Step 3: Type-check and chase stragglers**

Run: `npx tsc --noEmit`.
Expected: PASS. If any error remains, it names a surviving file still importing a deleted symbol — open it and remove the import/usage (it will be a leftover the audit did not predict). Re-run until clean. If a deleted file turns out to be imported by a survivor you cannot trivially decouple, STOP and report it.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete legacy bellum, spoke, old battle engine, and quick battle" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 7: Final verification

**Files:** none (verification only) — except any straggler edit Task 6 Step 3 surfaced.

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit` → PASS (no output).

- [ ] **Step 2: Verifiers**

Run each, expect pass:
`npx tsx tools/verify-iter-belli-scenario.ts`
`npx tsx tools/verify-iter-belli-consilium.ts`
`npx tsx tools/verify-iter-belli-doctrines.ts`
`npx tsx tools/verify-iter-belli-quests.ts`
`npx tsx tools/verify-decretum-hub.ts`
`npx tsx tools/verify-consilium-hub.ts`

- [ ] **Step 3: Residue grep (expect zero matches in `src/`)**

Run (PowerShell):
`Select-String -Path src -Recurse -Pattern "from '.*/battle/","/game/campaign/","plannedSpoke","currentSpoke","startSpokeFromCouncil","runSeasonTick","BattleMode","navigateToBellum","quick-battle","'battleV2'","recordRunComplete"`
Expected: **no matches**. Any hit is a leftover to clean.

- [ ] **Step 4: Build + boot smoke test**

Run: `npx vite --port 5188 --strictPort` and open `http://localhost:5188/` (confirm title **IMPERIVM**). Walk: Title → New Game → CommanderSelect → Forum/Hub (no `bellum` tab, no Quick Battle button) → seat an advisor → Embark → Iter Belli campaign → dice battle → EndgameCard → back to Hub. "Abandon Run" returns to title. No console errors.

- [ ] **Step 5: Commit any straggler fix** (only if Step 3 found residue)

```bash
git add -A
git commit -m "chore: remove final legacy residue after purge" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Risks / edge cases

- **Cascading deletion:** the inventory is audited but Task 6 Step 3 is the real safety net — `tsc` must drive the final cleanup. Do not force-delete past a `tsc` error from a surviving file.
- **`supplies.ts`:** only `spoke.ts` imported it; deleted with spoke. If `tsc` shows a live importer, keep it and report (Iter Belli has its own supplies, so this is unexpected).
- **No run-end:** intentional (confirmed). `globalSeason` still ticks/shows; reaching `MAX_SEASONS` no longer triggers anything. Run ends via "Abandon Run".
- **Dead passives removed:** season-tick upkeep/threat-reduction + spoke-grants were not live; removed with no live-behavior change. Re-wiring to Iter Belli is a separate Consilium follow-up.
- **Old saves:** dropping spoke/campaign save fields invalidates old active-run saves; acceptable (no users). The loader must ignore unknown/absent keys rather than throw.

## Follow-up (out of scope, already designed)
- 5-scenario roster (mission→scenario): trivial after this purge — embark already pulls `provinceTerrain` + enemy from the active scenario.
