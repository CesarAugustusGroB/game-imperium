# Iter Belli — Scenario Abstraction (seam) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract everything Sagunto/Aníbal/Hispania-specific in the Iter Belli campaign into a generic `CampaignScenario` consumed via an active-scenario holder, with `SAGUNTUM` as the first concrete instance — gameplay identical, zero balance changes.

**Architecture:** A new module-level holder (`iter-belli-scenario.ts`) exposes `getActiveScenario()/setActiveScenario()/resetActiveScenario()` defaulting to `SAGUNTUM`. The campaign engine (`iter-belli-state.ts`) and battle engine (`iter-belli-combat.ts`) read scenario fields (itinerary, crises, enemy, narrative, objective/decisive-card ids) instead of importing globals/literals. The Hub bridge (`CampaignSeed`/`EmbarkCard`) is untouched. `SAGUNTUM` composes existing data (`LOCATIONS`, `CRISES`, `CONQUEST_NAMES`) and references balance enemy constants so values cannot drift.

**Tech Stack:** TypeScript, Preact + @preact/signals. No unit-test runner — verification is `npx tsx tools/verify-*.ts` scripts + `npx tsc --noEmit` (project enables `noUnusedLocals`/`noUnusedParameters`).

**Notes for the engineer:**
- Working dir: `C:\Users\Henrich von Kleist\workspace\Map2D\.claude\worktrees\experimentation`. The dev server serves from this worktree.
- "Tests" here = a `verify-*.ts` script run with `npx tsx`, plus `npx tsc --noEmit`. There is no jest/vitest.
- Commit style: Conventional Commits. End commit messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Each task compiles and leaves the app behaving identically on its own.

---

### Task 1: Add the `CampaignScenario` types

**Files:**
- Modify: `src/game/iterBelli/iter-belli-types.ts` (append after the existing `DoctrineCampaignModifier` / `CardInstance` types, near the `Location`/`Crisis`/`DoctrineName` declarations)

- [ ] **Step 1: Add the three interfaces**

Append this block to `src/game/iterBelli/iter-belli-types.ts` (anywhere top-level; put it right after the `Location` and `Crisis` interfaces so related types sit together). `DoctrineName` is already declared in this file, so no import is needed.

```ts
// ── Campaign scenario (Sagunto-abstraction seam) ─────────────────────────────

/** The enemy army faced in the decisive battle. Identity only — the battle
 *  math (threat scaling, weaken, fortified, max rounds) stays in balance. */
export interface ScenarioEnemy {
  name: string;
  doctrine: DoctrineName;
  baseSoldiers: number;
  minSoldiers: number;
  morale: number;
  discipline: number;
}

/** Narrative strings shown at campaign end. The two interpolated battle logs are
 *  functions so the survivor-count output matches the current text verbatim. */
export interface ScenarioNarrative {
  victoryTitle: string;
  defeatTitle: string;
  victoryText: string;
  defeatText: string;
  battleWonLog: (survivors: number) => string;
  battleLostLog: (survivors: number) => string;
}

/** A self-contained Iter Belli scenario: itinerary, crises, enemy, narrative.
 *  `SAGUNTUM` is the first instance; the engine reads the active one. */
export interface CampaignScenario {
  id: string;
  locations: Location[];
  objectiveLocationId: string;
  decisiveCardId: string;
  crises: Record<'hambre' | 'motin' | 'encuentro', Crisis>;
  enemy: ScenarioEnemy;
  narrative: ScenarioNarrative;
  conquestNames: string[];
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no output). The new types are unused so far — that is fine for an `interface` (only `noUnusedLocals` flags values, not exported types).

- [ ] **Step 3: Commit**

```bash
git add src/game/iterBelli/iter-belli-types.ts
git commit -m "feat(iterbelli): add CampaignScenario types for the scenario seam"
```

---

### Task 2: Create `SAGUNTUM`, the active-scenario holder, and the verify script

**Files:**
- Create: `src/data/iter-belli-scenario-saguntum.ts`
- Create: `src/game/iterBelli/iter-belli-scenario.ts`
- Create: `tools/verify-iter-belli-scenario.ts`

- [ ] **Step 1: Write the verify script (the failing "test")**

Create `tools/verify-iter-belli-scenario.ts`:

```ts
/**
 * Verifies the Iter Belli scenario seam: SAGUNTUM is well-formed and the active
 * scenario holder defaults to it and is settable/resettable. Run with:
 *   npx tsx tools/verify-iter-belli-scenario.ts
 */
import { SAGUNTUM } from '../src/data/iter-belli-scenario-saguntum';
import {
  getActiveScenario, setActiveScenario, resetActiveScenario,
} from '../src/game/iterBelli/iter-belli-scenario';
import { CARD_DEFS } from '../src/data/iter-belli-cards';
import type { CampaignScenario } from '../src/game/iterBelli/iter-belli-types';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) { console.log(`  ok  ${label}`); }
  else { console.error(`FAIL  ${label}`); failures++; }
}

console.log('SAGUNTUM scenario');
check('5 locations', SAGUNTUM.locations.length === 5);
check('objective id = sagunto', SAGUNTUM.objectiveLocationId === 'sagunto');
const obj = SAGUNTUM.locations.find((l) => l.id === SAGUNTUM.objectiveLocationId);
check('objective location exists & is type objetivo', !!obj && obj.type === 'objetivo');
check('decisive card id = asalto_decisivo', SAGUNTUM.decisiveCardId === 'asalto_decisivo');
check('decisive card exists in CARD_DEFS', CARD_DEFS.some((c) => c.id === SAGUNTUM.decisiveCardId));

console.log('SAGUNTUM enemy');
check('enemy name', SAGUNTUM.enemy.name === 'Aníbal Barca');
check('enemy doctrine Maniobrera', SAGUNTUM.enemy.doctrine === 'Maniobrera');
check('enemy baseSoldiers 7000', SAGUNTUM.enemy.baseSoldiers === 7000);
check('enemy minSoldiers 2000', SAGUNTUM.enemy.minSoldiers === 2000);
check('enemy morale 8', SAGUNTUM.enemy.morale === 8);
check('enemy discipline 5', SAGUNTUM.enemy.discipline === 5);

console.log('SAGUNTUM narrative');
const n = SAGUNTUM.narrative;
check('victoryTitle non-empty', n.victoryTitle.length > 0);
check('defeatTitle non-empty', n.defeatTitle.length > 0);
check('victoryText non-empty', n.victoryText.length > 0);
check('defeatText non-empty', n.defeatText.length > 0);
check('battleWonLog interpolates count + place', n.battleWonLog(123).includes('123') && n.battleWonLog(123).includes('Sagunto'));
check('battleLostLog interpolates count', n.battleLostLog(7).includes('7'));

console.log('Active-scenario holder');
check('defaults to SAGUNTUM', getActiveScenario() === SAGUNTUM);
const fake = { ...SAGUNTUM, id: 'fake' } as CampaignScenario;
setActiveScenario(fake);
check('setActiveScenario switches', getActiveScenario().id === 'fake');
resetActiveScenario();
check('resetActiveScenario restores SAGUNTUM', getActiveScenario() === SAGUNTUM);

if (failures > 0) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll scenario checks passed.');
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx tsx tools/verify-iter-belli-scenario.ts`
Expected: FAIL — module-not-found error for `../src/data/iter-belli-scenario-saguntum` and `../src/game/iterBelli/iter-belli-scenario` (they do not exist yet).

- [ ] **Step 3: Create the `SAGUNTUM` instance**

Create `src/data/iter-belli-scenario-saguntum.ts`:

```ts
/**
 * Iter Belli — the Sagunto / Aníbal Barca scenario.
 * First concrete CampaignScenario. Composes the existing itinerary, crises and
 * conquest names, and references the balance enemy constants so the values match
 * the previously-hardcoded battle exactly.
 */
import { LOCATIONS, CRISES } from './iter-belli-locations';
import { CONQUEST_NAMES } from './iter-belli-conquest';
import * as B from '../game/iterBelli/iter-belli-balance';
import type { CampaignScenario } from '../game/iterBelli/iter-belli-types';

export const SAGUNTUM: CampaignScenario = {
  id: 'saguntum',
  locations: LOCATIONS,
  objectiveLocationId: 'sagunto',
  decisiveCardId: 'asalto_decisivo',
  crises: CRISES,
  enemy: {
    name: 'Aníbal Barca',
    doctrine: 'Maniobrera',
    baseSoldiers: B.ENEMY_BASE_SOLDIERS,
    minSoldiers: B.ENEMY_MIN_SOLDIERS,
    morale: B.ENEMY_MORALE,
    discipline: B.ENEMY_DISCIPLINE,
  },
  narrative: {
    victoryTitle: 'Triunfo en Hispania',
    defeatTitle: 'Campaña fallida',
    victoryText: 'Has derrotado al ejército púnico. Sagunto se rinde. La campaña es un éxito.',
    defeatText: 'Tu ejército ha sido derrotado en Sagunto. La campaña ha fracasado.',
    battleWonLog: (n) => `Has vencido en Sagunto. Quedan ${n} soldados.`,
    battleLostLog: (n) => `Derrota en Sagunto. Quedan ${n} soldados.`,
  },
  conquestNames: CONQUEST_NAMES,
};
```

- [ ] **Step 4: Create the active-scenario holder**

Create `src/game/iterBelli/iter-belli-scenario.ts`:

```ts
/**
 * Iter Belli — active-scenario holder.
 * Module-level singleton, matching the engine's singleton style. The campaign
 * and battle engines read the active scenario; default is SAGUNTUM.
 */
import type { CampaignScenario } from './iter-belli-types';
import { SAGUNTUM } from '../../data/iter-belli-scenario-saguntum';

let active: CampaignScenario = SAGUNTUM;

export function getActiveScenario(): CampaignScenario { return active; }
export function setActiveScenario(scenario: CampaignScenario): void { active = scenario; }
export function resetActiveScenario(): void { active = SAGUNTUM; }
```

- [ ] **Step 5: Run the verify script — expect PASS**

Run: `npx tsx tools/verify-iter-belli-scenario.ts`
Expected: PASS — every line prints `ok` and ends with `All scenario checks passed.`

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no output).

- [ ] **Step 7: Commit**

```bash
git add src/data/iter-belli-scenario-saguntum.ts src/game/iterBelli/iter-belli-scenario.ts tools/verify-iter-belli-scenario.ts
git commit -m "feat(iterbelli): add SAGUNTUM scenario + active-scenario holder + verify"
```

---

### Task 3: Wire `iter-belli-state.ts` to the active scenario

**Files:**
- Modify: `src/game/iterBelli/iter-belli-state.ts`

This task removes the `LOCATIONS`/`CRISES` imports and all `'sagunto'`/`'asalto_decisivo'`/narrative literals, reading them from `getActiveScenario()`. Behavior is identical because SAGUNTUM carries the same values.

- [ ] **Step 1: Swap the import**

Find (around line 16):

```ts
import { CRISES, LOCATIONS } from '../../data/iter-belli-locations';
```

Replace with:

```ts
import { getActiveScenario, resetActiveScenario } from './iter-belli-scenario';
```

- [ ] **Step 2: Read locations from the scenario in `currentLocation()`**

Find:

```ts
export function currentLocation(): Location {
  return LOCATIONS[S.locationIdx];
}
```

Replace with:

```ts
export function currentLocation(): Location {
  return getActiveScenario().locations[S.locationIdx];
}
```

- [ ] **Step 3: Use scenario objective + decisive card in `refillPool()`**

Find:

```ts
function refillPool(): void {
  // At Sagunto, force the decisive assault to be the only option.
  if (currentLocation().id === 'sagunto' && !S.pool.find((c) => c.def.id === 'asalto_decisivo')) {
    const assault = CARD_DEFS.find((c) => c.id === 'asalto_decisivo');
    if (assault) {
      S.pool = [{ instanceId: S.cardIdCounter++, def: assault, timer: 99 }];
    }
  }
```

Replace with:

```ts
function refillPool(): void {
  const scenario = getActiveScenario();
  // At the objective, force the decisive assault to be the only option.
  if (currentLocation().id === scenario.objectiveLocationId && !S.pool.find((c) => c.def.id === scenario.decisiveCardId)) {
    const assault = CARD_DEFS.find((c) => c.id === scenario.decisiveCardId);
    if (assault) {
      S.pool = [{ instanceId: S.cardIdCounter++, def: assault, timer: 99 }];
    }
  }
```

- [ ] **Step 4: Read crises from the scenario in `injectCrises()`**

Find:

```ts
function injectCrises(): void {
  S.pool = S.pool.filter((c) => c.def.category !== 'Crisis');
  if (S.supplies <= 0) {
    S.pool.unshift({ instanceId: S.cardIdCounter++, def: { ...CRISES.hambre, id: 'crisis_hambre' }, timer: 99 });
  }
  if (S.morale < B.MUTINY_MORALE_THRESHOLD) {
    S.pool.unshift({ instanceId: S.cardIdCounter++, def: { ...CRISES.motin, id: 'crisis_motin' }, timer: 99 });
  }
}
```

Replace with:

```ts
function injectCrises(): void {
  const { crises } = getActiveScenario();
  S.pool = S.pool.filter((c) => c.def.category !== 'Crisis');
  if (S.supplies <= 0) {
    S.pool.unshift({ instanceId: S.cardIdCounter++, def: { ...crises.hambre, id: 'crisis_hambre' }, timer: 99 });
  }
  if (S.morale < B.MUTINY_MORALE_THRESHOLD) {
    S.pool.unshift({ instanceId: S.cardIdCounter++, def: { ...crises.motin, id: 'crisis_motin' }, timer: 99 });
  }
}
```

- [ ] **Step 5: Use scenario objective id in `checkEndConditions()`**

Find:

```ts
  if (S.timeRemaining <= 0 && currentLocation().id !== 'sagunto') {
```

Replace with:

```ts
  if (S.timeRemaining <= 0 && currentLocation().id !== getActiveScenario().objectiveLocationId) {
```

- [ ] **Step 6: Read titles from narrative in `finishCampaign()`**

Find:

```ts
    title: victory ? 'Triunfo en Hispania' : 'Campaña fallida',
```

Replace with:

```ts
    title: victory ? getActiveScenario().narrative.victoryTitle : getActiveScenario().narrative.defeatTitle,
```

- [ ] **Step 7: Read battle logs + closing texts from narrative in `applyBattleOutcome()`**

Find:

```ts
  if (victory) {
    applyChange('gold', B.VICTORY_GOLD_BONUS);
    logEvent(`Has vencido en Sagunto. Quedan ${S.soldiers} soldados.`, 'battle');
    finishCampaign(true, 'Has derrotado al ejército púnico. Sagunto se rinde. La campaña es un éxito.');
  } else {
    logEvent(`Derrota en Sagunto. Quedan ${S.soldiers} soldados.`, 'battle');
    finishCampaign(false, 'Tu ejército ha sido derrotado en Sagunto. La campaña ha fracasado.');
  }
```

Replace with:

```ts
  const { narrative } = getActiveScenario();
  if (victory) {
    applyChange('gold', B.VICTORY_GOLD_BONUS);
    logEvent(narrative.battleWonLog(S.soldiers), 'battle');
    finishCampaign(true, narrative.victoryText);
  } else {
    logEvent(narrative.battleLostLog(S.soldiers), 'battle');
    finishCampaign(false, narrative.defeatText);
  }
```

- [ ] **Step 8: Reset the active scenario on campaign start and on full reset**

In `startIterBelliCampaign(seed)`, find the first line of the body:

```ts
  S = freshState();
  logLines = [];
```

Replace with (adds the reset so the default scenario is restored each campaign — harmless today, correct once `setActiveScenario` is used in a later phase):

```ts
  S = freshState();
  logLines = [];
  resetActiveScenario();
```

In `resetIterBelli()`, find:

```ts
export function resetIterBelli(): void {
  S = freshState();
  logLines = [];
  commit();
}
```

Replace with:

```ts
export function resetIterBelli(): void {
  S = freshState();
  logLines = [];
  resetActiveScenario();
  commit();
}
```

- [ ] **Step 9: Type-check (catches the now-unused import if anything was missed)**

Run: `npx tsc --noEmit`
Expected: PASS. If it reports `LOCATIONS`/`CRISES` is undefined, a literal reference was missed — grep `src/game/iterBelli/iter-belli-state.ts` for `LOCATIONS`, `CRISES`, `'sagunto'`, `'asalto_decisivo'`, `Hispania`, `púnico` and convert any stragglers.

- [ ] **Step 10: Regression — existing Iter Belli verifiers still pass**

Run: `npx tsx tools/verify-iter-belli-consilium.ts`
Run: `npx tsx tools/verify-iter-belli-doctrines.ts`
Run: `npx tsx tools/verify-iter-belli-quests.ts`
Expected: each prints its passing summary (no failures / non-zero exit).

- [ ] **Step 11: Commit**

```bash
git add src/game/iterBelli/iter-belli-state.ts
git commit -m "refactor(iterbelli): campaign engine reads itinerary/crises/narrative from active scenario"
```

---

### Task 4: Wire `iter-belli-combat.ts` enemy from the active scenario

**Files:**
- Modify: `src/game/iterBelli/iter-belli-combat.ts`

- [ ] **Step 1: Add the holder import**

Find (top of file, after the existing imports — around line 13):

```ts
import { applyBattleOutcome, iterBelliState } from './iter-belli-state';
```

Add directly below it:

```ts
import { getActiveScenario } from './iter-belli-scenario';
```

- [ ] **Step 2: Build the enemy from the scenario in `beginBattle()`**

Find:

```ts
export function beginBattle(): void {
  const s = iterBelliState.value;
  const enemyMult = (1 + s.threat / B.ENEMY_THREAT_DIVISOR) * (1 - s.enemyWeaken * B.ENEMY_WEAKEN_PER_POINT);
  const enemySoldiers = Math.max(B.ENEMY_MIN_SOLDIERS, Math.floor(B.ENEMY_BASE_SOLDIERS * enemyMult));

  BS = {
    atk: makeArmy('Tu ejército', s.soldiers, s.morale, s.discipline, 'PLAYER'),
    dfn: makeArmy('Aníbal Barca', enemySoldiers, B.ENEMY_MORALE, B.ENEMY_DISCIPLINE, 'Maniobrera'),
```

Replace with:

```ts
export function beginBattle(): void {
  const s = iterBelliState.value;
  const enemy = getActiveScenario().enemy;
  const enemyMult = (1 + s.threat / B.ENEMY_THREAT_DIVISOR) * (1 - s.enemyWeaken * B.ENEMY_WEAKEN_PER_POINT);
  const enemySoldiers = Math.max(enemy.minSoldiers, Math.floor(enemy.baseSoldiers * enemyMult));

  BS = {
    atk: makeArmy('Tu ejército', s.soldiers, s.morale, s.discipline, 'PLAYER'),
    dfn: makeArmy(enemy.name, enemySoldiers, enemy.morale, enemy.discipline, enemy.doctrine),
```

- [ ] **Step 3: Use the scenario enemy in the header log line**

Find:

```ts
  bmLog(`Aníbal Barca: ${BS.dfn.soldiers.toLocaleString('es')} sold · M${BS.dfn.morale.toFixed(1)} · Disciplina V · Maniobrera`);
```

Replace with:

```ts
  bmLog(`${enemy.name}: ${BS.dfn.soldiers.toLocaleString('es')} sold · M${BS.dfn.morale.toFixed(1)} · Disciplina ${B.ROMAN[enemy.discipline]} · ${enemy.doctrine}`);
```

(For SAGUNTUM this renders `Aníbal Barca: … · Disciplina V · Maniobrera` — identical to before.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. `B` is still used (threat divisor, weaken, ROMAN, fortified, max rounds), so its import stays.

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/iter-belli-combat.ts
git commit -m "refactor(iterbelli): decisive battle builds the enemy from the active scenario"
```

---

### Task 5: Source conquest names from the scenario in the return bridge

**Files:**
- Modify: `src/data/iter-belli-conquest.ts` (function `pickConquestName`)
- Modify: `src/ui/screens/iterbelli/EndgameCard.tsx` (the `pickConquestName` call + one import)

- [ ] **Step 1: Add an optional `names` parameter to `pickConquestName`**

In `src/data/iter-belli-conquest.ts`, find:

```ts
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
```

Replace with (default keeps every existing call behaving identically):

```ts
export function pickConquestName(taken: Set<string>, names: string[] = CONQUEST_NAMES): string {
  const free = names.filter((n) => !taken.has(n));
  if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
  for (const suffix of ROMAN_SUFFIX) {
    for (const base of names) {
      const candidate = `${base} ${suffix}`;
      if (!taken.has(candidate)) return candidate;
    }
  }
  return `Provincia ${Date.now()}`; // effectively unreachable fallback
}
```

- [ ] **Step 2: Pass the scenario's names from `EndgameCard`**

In `src/ui/screens/iterbelli/EndgameCard.tsx`, find the existing import of the campaign state (around line 8):

```ts
import { iterBelliState, resetIterBelli } from '../../../game/iterBelli/iter-belli-state';
```

Add directly below it:

```ts
import { getActiveScenario } from '../../../game/iterBelli/iter-belli-scenario';
```

Then find (inside `returnToHub`, around line 45):

```ts
    const name = pickConquestName(taken);
```

Replace with:

```ts
    const name = pickConquestName(taken, getActiveScenario().conquestNames);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data/iter-belli-conquest.ts src/ui/screens/iterbelli/EndgameCard.tsx
git commit -m "refactor(iterbelli): conquered-province names come from the active scenario"
```

---

### Task 6: Final verification (no Sagunto literals remain in the engine)

**Files:** none modified — verification only.

- [ ] **Step 1: Confirm the engine no longer hardcodes the scenario**

Run (PowerShell): `Select-String -Path src/game/iterBelli/iter-belli-state.ts, src/game/iterBelli/iter-belli-combat.ts -Pattern "sagunto","asalto_decisivo","Aníbal","Hispania","púnico","LOCATIONS","CRISES" -CaseSensitive:$false`
Expected: **no matches** in either engine file. (Matches are expected only in `src/data/*` — the scenario/data layer.)

- [ ] **Step 2: Full type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no output).

- [ ] **Step 3: Run every relevant verifier**

Run: `npx tsx tools/verify-iter-belli-scenario.ts`
Run: `npx tsx tools/verify-iter-belli-consilium.ts`
Run: `npx tsx tools/verify-iter-belli-doctrines.ts`
Run: `npx tsx tools/verify-iter-belli-quests.ts`
Expected: all pass.

- [ ] **Step 4: Smoke-test in the browser**

Run: `npx vite --port 5188 --strictPort`
Open `http://localhost:5188/` (confirm the page title is **IMPERIVM**). New Game → pick a commander → Embark → play the march to **Sagunto** → fight the decisive battle. Confirm: the enemy is **Aníbal Barca · Disciplina V · Maniobrera**, the battle-log lines and the victory/defeat screen read exactly as before ("Triunfo en Hispania" / "Has vencido en Sagunto…" / "Campaña fallida"), and a province is conquered with an Iberian name on victory.

- [ ] **Step 5: No commit needed**

This task changes no files. If Step 1 surfaced a straggler literal, fix it in the relevant engine file and fold it into that file's task commit.
