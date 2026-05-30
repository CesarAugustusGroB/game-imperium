# Iter Belli — Consilium Fase 2 (Secondary Quests) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seats beyond the mission seat seed mid-campaign mini-quests: a dedicated quest-card appears on arrival at an assigned location and must be played before its turn window expires, granting a themed reward (or a themed penalty on failure).

**Architecture:** A new pure-data module (`iter-belli-quests.ts`) holds the 5 color quest defs + a card factory. The advisor-aware bridge (`iter-belli-consilium.ts`) resolves seated advisors into quest assignments at embark (mirroring `computeConsiliumSetup`). The campaign engine stores assignments in state, injects the card when the army reaches the quest's location (like `injectCrises`), and marks status on play/expiry — reusing the existing `effects`/`cost`/`penalty` card machinery. The campaign logic module never imports advisor/run types; only the data + UI bridges do.

**Tech Stack:** TypeScript, Preact, `@preact/signals`. No test runner — verification is standalone `npx tsx tools/verify-*.ts` scripts + `npx tsc --noEmit` + a manual Chrome check.

**Conventions:** Run all commands from the worktree root `C:\Users\Henrich von Kleist\workspace\Map2D\.claude\worktrees\experimentation`. Commit style: Conventional Commits, scope `iterbelli`.

---

## File Structure

- **Create** `src/data/iter-belli-quests.ts` — `QuestColor`, `SecondaryQuestDef`, `SECONDARY_QUESTS` (5 quests), `makeQuestCard()`. Pure data; no advisor/run imports.
- **Create** `tools/verify-iter-belli-quests.ts` — verification script, built up across Tasks 2–5.
- **Modify** `src/game/iterBelli/iter-belli-types.ts` — `QuestStatus`, `SecondaryQuest`; add `quests` to `IterBelliState`, `quests?` to `CampaignSeed` *(CampaignSeed lives in iter-belli-state.ts — see Task 4)*, `questId?` to `OperationCard`.
- **Modify** `src/game/iterBelli/iter-belli-balance.ts` — `QUEST_WINDOW_BASE`.
- **Modify** `src/data/iter-belli-consilium.ts` — `computeSecondaryQuests()`.
- **Modify** `src/game/iterBelli/iter-belli-state.ts` — `freshState`, `CampaignSeed`, `startIterBelliCampaign`, `injectLocationQuests`, `playCard`, `endTurn`.
- **Modify** `src/ui/screens/forum/panels/EmbarkCard.tsx` — compute + seed quests.
- **Modify** `src/ui/screens/iterbelli/IterBelliScreen.tsx` — active-quest display.
- **Modify** `src/ui/screens/iterbelli/EndgameCard.tsx` — quest-status rows.

---

## Task 1: Types & balance constant

**Files:**
- Modify: `src/game/iterBelli/iter-belli-types.ts`
- Modify: `src/game/iterBelli/iter-belli-balance.ts`

- [ ] **Step 1: Add `questId` to `OperationCard`**

In `iter-belli-types.ts`, inside `interface OperationCard`, add the field right after `weight` (line ~115):

```typescript
  /** Relative draw weight. */
  weight: number;
  /** Set when this card is a Consilium secondary-quest card; links it to a SecondaryQuest. */
  questId?: string;
```

- [ ] **Step 2: Add quest types**

In `iter-belli-types.ts`, immediately after the `OperationCard` interface (before `export type AnyCardDef`), add:

```typescript
// ── Secondary quests (Consilium Fase 2) ─────────────────────────────────────

export type QuestStatus = 'pending' | 'active' | 'completed' | 'failed';

/**
 * A Consilium secondary objective. Seeded at embark from a non-mission seat;
 * its card is injected when the army reaches `locationId` and must be played
 * within `window` turns. `color` is a plain string to keep this module free of
 * advisor/run types.
 */
export interface SecondaryQuest {
  id: string;
  color: string;
  title: string;
  locationId: string;
  window: number;
  status: QuestStatus;
}
```

- [ ] **Step 3: Add `quests` to `IterBelliState`**

In `iter-belli-types.ts`, inside `interface IterBelliState`, after the `missionId` field (line ~211), add:

```typescript
  /** Active campaign mission id (from the first-seated advisor's color); null if none. */
  missionId: string | null;
  /** Consilium secondary quests (from non-mission seats); empty if none. */
  quests: SecondaryQuest[];
```

- [ ] **Step 4: Add the window constant**

In `iter-belli-balance.ts`, after the `LEVY_*` block (line ~66), add:

```typescript
// ── Secondary quests (Consilium Fase 2) ──
/** Base quest window (turns); +1 per advisor tier above I → 3 / 4 / 5. */
export const QUEST_WINDOW_BASE = 3;
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). `quests` is now required on `IterBelliState`, so `freshState()` in `iter-belli-state.ts` will error until Task 4 — **at this point expect exactly one error**: `Property 'quests' is missing ... freshState`. That is fine; it is fixed in Task 4. If you see *other* errors, fix them.

- [ ] **Step 6: Commit**

```bash
git add src/game/iterBelli/iter-belli-types.ts src/game/iterBelli/iter-belli-balance.ts
git commit -m "feat(iterbelli): quest types + window constant for Consilium Fase 2"
```

---

## Task 2: Quest data module + factory

**Files:**
- Create: `src/data/iter-belli-quests.ts`
- Create/Test: `tools/verify-iter-belli-quests.ts`

- [ ] **Step 1: Write the failing verification script**

Create `tools/verify-iter-belli-quests.ts`:

```typescript
/**
 * Verifies Consilium Fase 2 secondary quests: data defs, card factory, bridge,
 * and campaign-state integration.
 * Run: npx tsx tools/verify-iter-belli-quests.ts
 */
import { SECONDARY_QUESTS, makeQuestCard } from '../src/data/iter-belli-quests';
import type { SecondaryQuest, CardContext } from '../src/game/iterBelli/iter-belli-types';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

const noCtx = {} as CardContext;

// --- SECONDARY_QUESTS defs ---
check('5 quest colors', Object.keys(SECONDARY_QUESTS).length === 5);
check('red is "Asalto al fuerte"', SECONDARY_QUESTS.red.title === 'Asalto al fuerte');
check('white reward soldiers +800', SECONDARY_QUESTS.white.effects(noCtx).soldiers === 800);
check('blue reward threat -3', SECONDARY_QUESTS.blue.effects(noCtx).threat === -3);
check('red penalty threat +2', SECONDARY_QUESTS.red.penalty(noCtx).effects?.threat === 2);
check('purple penalty morale -1 & threat +1',
  SECONDARY_QUESTS.purple.penalty(noCtx).effects?.morale === -1 &&
  SECONDARY_QUESTS.purple.penalty(noCtx).effects?.threat === 1);

// --- makeQuestCard ---
const q: SecondaryQuest = { id: 'quest_red_1', color: 'red', title: 'Asalto al fuerte', locationId: 'llanura', window: 4, status: 'pending' };
const card = makeQuestCard(q);
check('card carries questId', card.questId === 'quest_red_1');
check('card location = quest location', card.locations.length === 1 && card.locations[0] === 'llanura');
check('card expiry = window', card.expiry === 4);
check('card weight 0 (never drawn)', card.weight === 0);
check('card name = quest title', card.name === 'Asalto al fuerte');
check('card effects = quest reward', card.effects(noCtx).gold === 35 && card.effects(noCtx).enemyWeaken === 1);

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-iter-belli-quests.ts`
Expected: FAIL — module `../src/data/iter-belli-quests` does not exist (import error).

- [ ] **Step 3: Create the quest data module**

Create `src/data/iter-belli-quests.ts`:

```typescript
/**
 * Iter Belli — Consilium Fase 2 secondary-quest defs + card factory.
 * Pure data: maps each advisor color to a themed mini-quest (reward on play,
 * penalty on expiry). `makeQuestCard` turns a seeded assignment into a playable
 * OperationCard. No advisor/run-state imports — the campaign engine imports this.
 */
import type {
  CardContext, CardCost, CardEffects, OperationCard, PenaltyResult, SecondaryQuest,
} from '../game/iterBelli/iter-belli-types';

export type QuestColor = 'red' | 'blue' | 'gold' | 'purple' | 'white';

export interface SecondaryQuestDef {
  title: string;
  desc: string;
  cost: CardCost;
  /** Reward applied when the quest card is played. */
  effects: (ctx: CardContext) => CardEffects;
  /** Themed penalty applied when the quest card expires unplayed. */
  penalty: (ctx: CardContext) => PenaltyResult;
}

/** One mini-quest per advisor color. Themes + values are tunable. */
export const SECONDARY_QUESTS: Record<QuestColor, SecondaryQuestDef> = {
  red: {
    title: 'Asalto al fuerte',
    desc: 'Tomas por asalto el fuerte local; el botín llena la caja y el golpe debilita al enemigo.',
    cost: { time: 1, supplies: 4 },
    effects: () => ({ gold: 35, enemyWeaken: 1 }),
    penalty: () => ({ effects: { threat: 2 }, msg: 'El fuerte sigue en pie y hostiga tu retaguardia (+2 amenaza).' }),
  },
  blue: {
    title: 'Pacifica la tribu',
    desc: 'Repartes regalos y promesas a la tribu local; la región se calma.',
    cost: { gold: 20 },
    effects: () => ({ threat: -3 }),
    penalty: () => ({ effects: { threat: 2 }, msg: 'La tribu desairada se vuelve hostil (+2 amenaza).' }),
  },
  gold: {
    title: 'Rito de campaña',
    desc: 'Ofician un rito ante las legiones; el ánimo se enardece.',
    cost: { time: 1 },
    effects: () => ({ morale: 2 }),
    penalty: () => ({ effects: { morale: -2 }, msg: 'Los dioses fueron desatendidos; cunde el desánimo (−2 moral).' }),
  },
  purple: {
    title: 'Saquea la caravana',
    desc: 'Interceptas una caravana mercante; el botín llena la caja.',
    cost: { time: 1 },
    effects: () => ({ gold: 50 }),
    penalty: () => ({ effects: { morale: -1, threat: 1 }, msg: 'La caravana escapó; los hombres rezongan y el camino se enturbia (−1 moral, +1 amenaza).' }),
  },
  white: {
    title: 'Recluta auxiliares',
    desc: 'Levantas auxiliares locales que engrosan las filas.',
    cost: { gold: 25 },
    effects: () => ({ soldiers: 800 }),
    penalty: () => ({ effects: { morale: -2 }, msg: 'Los auxiliares prometidos nunca llegaron; cae el ánimo (−2 moral).' }),
  },
};

/** Build the playable card for a seeded quest assignment. */
export function makeQuestCard(quest: SecondaryQuest): OperationCard {
  const def = SECONDARY_QUESTS[quest.color as QuestColor];
  return {
    id: `card_${quest.id}`,
    questId: quest.id,
    name: def.title,
    category: 'Operaciones',
    desc: def.desc,
    cost: def.cost,
    effects: def.effects,
    penalty: def.penalty,
    locations: [quest.locationId],
    expiry: quest.window,
    weight: 0,
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx tools/verify-iter-belli-quests.ts`
Expected: PASS — all checks ✓, "All checks passed."

- [ ] **Step 5: Commit**

```bash
git add src/data/iter-belli-quests.ts tools/verify-iter-belli-quests.ts
git commit -m "feat(iterbelli): secondary-quest data defs + card factory"
```

---

## Task 3: Consilium → quest assignment bridge

**Files:**
- Modify: `src/data/iter-belli-consilium.ts`
- Test: `tools/verify-iter-belli-quests.ts` (append)

- [ ] **Step 1: Append failing checks to the verify script**

In `tools/verify-iter-belli-quests.ts`, add this import near the top imports:

```typescript
import { computeSecondaryQuests } from '../src/data/iter-belli-consilium';
import type { Advisor } from '../src/game/council/advisor';
```

Then add, just before the final `if (failures > 0)` block:

```typescript
// --- computeSecondaryQuests bridge ---
const mkA = (color: string, tier: 1 | 2 | 3): Advisor =>
  ({ color, currentTier: tier, tiers: [{}, {}, {}] } as unknown as Advisor);

const MID = ['tarraco', 'llanura', 'bosques'];

const emptyQ = computeSecondaryQuests([null, null, null]);
check('no seats → no quests', emptyQ.length === 0);

// First occupied seat is the mission seat (no quest); the rest seed quests.
const qs = computeSecondaryQuests([mkA('red', 1), mkA('blue', 2), mkA('white', 3)]);
check('first seat = mission, 2 quests seeded', qs.length === 2);
check('quest colors are the non-first seats', qs[0].color === 'blue' && qs[1].color === 'white');
check('window by tier (blue tier2 → 4)', qs.find((q) => q.color === 'blue')?.window === 4);
check('window by tier (white tier3 → 5)', qs.find((q) => q.color === 'white')?.window === 5);
check('quest locations are mid-3', qs.every((q) => MID.includes(q.locationId)));
check('quest locations distinct', new Set(qs.map((q) => q.locationId)).size === qs.length);
check('quest ids distinct', new Set(qs.map((q) => q.id)).size === qs.length);
check('quests start pending', qs.every((q) => q.status === 'pending'));

// Gaps: a null first slot is skipped; the first NON-null seat is the mission seat.
const qs2 = computeSecondaryQuests([null, mkA('gold', 1), mkA('purple', 1)]);
check('null-first skipped, gold = mission, purple = quest', qs2.length === 1 && qs2[0].color === 'purple');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-iter-belli-quests.ts`
Expected: FAIL — `computeSecondaryQuests` is not exported from `iter-belli-consilium`.

- [ ] **Step 3: Implement `computeSecondaryQuests`**

In `src/data/iter-belli-consilium.ts`, add to the imports (top of file):

```typescript
import type { IterBelliState, SecondaryQuest } from '../game/iterBelli/iter-belli-types';
import { SUPPLY_UPKEEP_PER_TURN, START, QUEST_WINDOW_BASE } from '../game/iterBelli/iter-belli-balance';
import { SECONDARY_QUESTS } from './iter-belli-quests';
import type { QuestColor } from './iter-belli-quests';
```

*(Note: the existing file already imports `IterBelliState` and `{ SUPPLY_UPKEEP_PER_TURN, START }` — merge these, do not duplicate the imports. Add `SecondaryQuest`, `QUEST_WINDOW_BASE`, and the two quest imports.)*

Then add at the end of the file:

```typescript
/** Mid-campaign locations a secondary quest can bind to (no start/final stop). */
const QUEST_LOCATIONS = ['tarraco', 'llanura', 'bosques'] as const;

/**
 * Resolve the seated council into secondary quests: the first occupied slot is
 * the mission seat (no quest); every other occupied slot seeds one quest, themed
 * by color, windowed by advisor tier, bound to a random distinct mid-location.
 */
export function computeSecondaryQuests(slots: (Advisor | null)[]): SecondaryQuest[] {
  const quests: SecondaryQuest[] = [];
  const available: string[] = [...QUEST_LOCATIONS];
  let firstSeen = false;
  let seatIdx = -1;
  for (const advisor of slots) {
    seatIdx++;
    if (!advisor) continue;
    if (!firstSeen) { firstSeen = true; continue; } // first occupied seat = mission
    if (available.length === 0) break;
    const color = advisor.color as QuestColor;
    const window = QUEST_WINDOW_BASE + (advisor.currentTier - 1);
    const pick = Math.floor(Math.random() * available.length);
    const locationId = available.splice(pick, 1)[0];
    quests.push({
      id: `quest_${color}_${seatIdx}`,
      color,
      title: SECONDARY_QUESTS[color].title,
      locationId,
      window,
      status: 'pending',
    });
  }
  return quests;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx tools/verify-iter-belli-quests.ts`
Expected: PASS — all checks ✓.

- [ ] **Step 5: Commit**

```bash
git add src/data/iter-belli-consilium.ts tools/verify-iter-belli-quests.ts
git commit -m "feat(iterbelli): Consilium bridge resolves seats into secondary quests"
```

---

## Task 4: Campaign-state plumbing + location injection

**Files:**
- Modify: `src/game/iterBelli/iter-belli-state.ts`
- Test: `tools/verify-iter-belli-quests.ts` (append)

- [ ] **Step 1: Append failing checks to the verify script**

In `tools/verify-iter-belli-quests.ts`, add to the imports:

```typescript
import { startIterBelliCampaign, resetIterBelli, iterBelliState, camp } from '../src/game/iterBelli/iter-belli-state';
```

Then add before the final `if (failures > 0)` block:

```typescript
// --- Campaign-state injection (quest bound to the START location 'frontera') ---
const seedBase = { soldiers: 4000, gold: 100, iuniores: 0, discipline: 4, archetype: null, spokeTerrain: 'plains', spokeDuration: 1 };
const fronteraQuest: SecondaryQuest = { id: 'quest_red_x', color: 'red', title: 'Asalto al fuerte', locationId: 'frontera', window: 2, status: 'pending' };

startIterBelliCampaign({ ...seedBase, quests: [fronteraQuest] });
let st = iterBelliState.value;
check('seed stores quests', st.quests.length === 1);
check('quest injected at start location → active', st.quests[0].status === 'active');
check('quest card present in pool', st.pool.filter((c) => c.def.questId === 'quest_red_x').length === 1);

// Idempotent: camping at frontera must not re-inject the (now active) quest.
camp();
st = iterBelliState.value;
check('quest card not duplicated after a turn', st.pool.filter((c) => c.def.questId === 'quest_red_x').length === 1);

// A quest bound to a not-yet-reached location stays pending and is not in the pool.
startIterBelliCampaign({ ...seedBase, quests: [{ ...fronteraQuest, id: 'quest_red_y', locationId: 'bosques' }] });
st = iterBelliState.value;
check('quest for far location stays pending', st.quests[0].status === 'pending');
check('quest for far location not in pool', st.pool.every((c) => c.def.questId !== 'quest_red_y'));

resetIterBelli();
check('reset clears quests', iterBelliState.value.quests.length === 0);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-iter-belli-quests.ts`
Expected: FAIL — `CampaignSeed` has no `quests`, `freshState` lacks `quests`, and no injection occurs (TS error on `seed.quests` and/or failed checks).

- [ ] **Step 3: Add `quests` to `freshState`**

In `iter-belli-state.ts`, inside `freshState()` return object, after `missionId: null,` (line ~50):

```typescript
    missionId: null,
    quests: [],
```

- [ ] **Step 4: Add `quests` to `CampaignSeed`**

In `iter-belli-state.ts`, add the import for the type at the top (merge into the existing `import type { ... } from './iter-belli-types'`):

```typescript
import type {
  Archetype, CardContext, CardEffects, CardInstance, IterBelliState, Location, LogKind, LogLine, SecondaryQuest,
} from './iter-belli-types';
```

Then in `interface CampaignSeed`, after `startMorale?: number;` (line ~409):

```typescript
  /** Override starting morale (Consilium modifier); omitted → START.morale. */
  startMorale?: number;
  /** Consilium secondary quests (Fase 2); omitted → none. */
  quests?: SecondaryQuest[];
```

- [ ] **Step 5: Add the injector + wire it into start & turns**

In `iter-belli-state.ts`, add the import for the factory at the top (near the `CARD_DEFS` import):

```typescript
import { makeQuestCard } from '../../data/iter-belli-quests';
```

Add the injector right after `injectCrises()` (after line ~148):

```typescript
/** Inject quest cards for any pending quest whose location the army just reached. */
function injectLocationQuests(): void {
  const here = currentLocation().id;
  for (const quest of S.quests) {
    if (quest.status !== 'pending' || quest.locationId !== here) continue;
    S.pool.unshift({ instanceId: S.cardIdCounter++, def: makeQuestCard(quest), timer: quest.window });
    quest.status = 'active';
    logEvent(`Objetivo del Consilium disponible: ${quest.title}.`, 'event');
  }
}
```

In `startIterBelliCampaign`, store the seed quests and inject. Replace the tail of the function (lines ~425–435) so it reads:

```typescript
  S.missionId = seed.missionId ?? null;
  S.quests = (seed.quests ?? []).map((q) => ({ ...q }));
  if (seed.startThreat != null) S.threat = clamp(seed.startThreat, B.THREAT_MIN, B.THREAT_MAX);
  if (seed.startMorale != null) S.morale = clamp(seed.startMorale, B.MORALE_MIN, B.MORALE_MAX);
  if (seed.supplies != null) S.supplies = Math.max(0, Math.floor(seed.supplies));

  logTurn('Día 1: Inicio de la campaña');
  logEvent(`El ejército parte de la frontera. ${S.soldiers} soldados, moral ${S.morale.toFixed(1)}, disciplina ${B.ROMAN[S.discipline]}.`);
  logEvent('El Senado espera resultados antes del invierno.');
  refillPool();
  injectCrises();
  injectLocationQuests();
  commit();
```

In `endTurn`, add the injection right after `refillPool();` (line ~307):

```typescript
  injectCrises();
  refillPool();
  injectLocationQuests();
  checkEndConditions();
  commit();
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npx tsx tools/verify-iter-belli-quests.ts`
Expected: PASS — all checks ✓.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). The Task 1 `freshState` error is now resolved.

- [ ] **Step 8: Commit**

```bash
git add src/game/iterBelli/iter-belli-state.ts tools/verify-iter-belli-quests.ts
git commit -m "feat(iterbelli): seed quests + inject quest card on location arrival"
```

---

## Task 5: Completion on play, themed penalty on expiry

**Files:**
- Modify: `src/game/iterBelli/iter-belli-state.ts`
- Test: `tools/verify-iter-belli-quests.ts` (append)

- [ ] **Step 1: Append failing checks to the verify script**

In `tools/verify-iter-belli-quests.ts`, add `playCard` to the state import:

```typescript
import { startIterBelliCampaign, resetIterBelli, iterBelliState, camp, playCard } from '../src/game/iterBelli/iter-belli-state';
```

Then add before the final `if (failures > 0)` block:

```typescript
// --- Completion on play (red quest at frontera: reward +35 gold, +1 enemyWeaken) ---
startIterBelliCampaign({ ...seedBase, gold: 100, quests: [{ id: 'quest_red_p', color: 'red', title: 'Asalto al fuerte', locationId: 'frontera', window: 3, status: 'pending' }] });
let ps = iterBelliState.value;
const questCard = ps.pool.find((c) => c.def.questId === 'quest_red_p');
check('quest card available to play', !!questCard);
const goldBefore = ps.gold;
const weakenBefore = ps.enemyWeaken;
playCard(questCard!.instanceId);
ps = iterBelliState.value;
check('playing quest card → completed', ps.quests[0].status === 'completed');
check('reward applied: gold +35', ps.gold === goldBefore + 35);
check('reward applied: enemyWeaken +1', ps.enemyWeaken === weakenBefore + 1);
check('quest card removed from pool after play', ps.pool.every((c) => c.def.questId !== 'quest_red_p'));

// --- Failure on expiry (window 2 → fails after 2 camps; themed penalty +2 threat) ---
startIterBelliCampaign({ ...seedBase, quests: [{ id: 'quest_red_f', color: 'red', title: 'Asalto al fuerte', locationId: 'frontera', window: 2, status: 'pending' }] });
let fs = iterBelliState.value;
const threatBefore = fs.threat;
const brokenBefore = fs.brokenCommitments;
camp(); // window 2 → 1
camp(); // window 1 → 0 → expires this turn
fs = iterBelliState.value;
check('expired quest card → failed', fs.quests[0].status === 'failed');
check('themed penalty applied: threat +2', fs.threat === threatBefore + 2);
check('quest failure does NOT bump brokenCommitments', fs.brokenCommitments === brokenBefore);
check('expired quest card removed from pool', fs.pool.every((c) => c.def.questId !== 'quest_red_f'));

resetIterBelli();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-iter-belli-quests.ts`
Expected: FAIL — quest status never becomes `completed`/`failed` and the penalty is not applied (no quest handling yet in `playCard`/`endTurn`).

- [ ] **Step 3: Mark completion in `playCard`**

In `iter-belli-state.ts`, in `playCard`, after the line removing the played card (`S.pool = S.pool.filter((c) => c.instanceId !== instanceId);`, line ~227), add:

```typescript
  // Remove the played card.
  S.pool = S.pool.filter((c) => c.instanceId !== instanceId);

  // Secondary-quest completion.
  if (def.questId) {
    const quest = S.quests.find((q) => q.id === def.questId);
    if (quest) quest.status = 'completed';
  }
```

*(`def` here is already narrowed to `OperationCard` by the earlier `isCrisisDef` guard at the top of `playCard`.)*

- [ ] **Step 4: Handle quest expiry in `endTurn`**

In `iter-belli-state.ts`, replace the expiry loop (lines ~283–295) with a version that handles quest cards first:

```typescript
  const expired = S.pool.filter((c) => c.timer <= 0 && c.def.category !== 'Crisis');
  for (const c of expired) {
    if (isCrisisDef(c.def)) continue;
    const def = c.def;
    if (def.questId) {
      const quest = S.quests.find((q) => q.id === def.questId);
      if (quest) quest.status = 'failed';
      logEvent(`Objetivo fallido: ${def.name}`, 'event');
      if (def.penalty) {
        const result = def.penalty(ctx());
        if (result.effects) applyEffects(result.effects);
        logEvent(result.msg, 'event');
      }
    } else if (def.cardType === 'compromiso') {
      logEvent(`Compromiso roto: ${def.name}`, 'event');
      if (def.penalty) {
        const result = def.penalty(ctx());
        if (result.effects) applyEffects(result.effects);
        logEvent(result.msg, 'event');
      }
      S.brokenCommitments++;
    } else {
      logEvent(`Oportunidad perdida: ${def.name} expiró`);
    }
  }
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx tsx tools/verify-iter-belli-quests.ts`
Expected: PASS — all checks ✓, "All checks passed."

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/iterBelli/iter-belli-state.ts tools/verify-iter-belli-quests.ts
git commit -m "feat(iterbelli): complete quest on play, themed penalty on expiry"
```

---

## Task 6: Embark wiring (compute + seed quests)

**Files:**
- Modify: `src/ui/screens/forum/panels/EmbarkCard.tsx`

- [ ] **Step 1: Import the bridge**

In `EmbarkCard.tsx`, update the consilium import (line 7):

```typescript
import { computeConsiliumSetup, getMissionById, computeSecondaryQuests } from '../../../../data/iter-belli-consilium';
```

- [ ] **Step 2: Compute quests and pass them in the seed**

In `EmbarkCard.tsx`, inside `handleEmbark`, add the quest computation and seed field. Replace the `startIterBelliCampaign({ ... })` call (lines 52–60) with:

```typescript
    const supplies = (army?.supplies ?? SUPPLIES_STARTING_STOCK) + consilium.supplies;
    startIterBelliCampaign({
      soldiers,
      gold: getResource('gold') + consilium.gold,
      iuniores: getResource('iuniores'),
      discipline, archetype, spokeTerrain, spokeDuration, supplies,
      missionId: consilium.missionId ?? undefined,
      startThreat: START.threat - consilium.threat,
      startMorale: START.morale + consilium.morale,
      quests: computeSecondaryQuests(councilSlots.value),
    });
```

- [ ] **Step 3: Add a quest preview to the Consilium box**

In `EmbarkCard.tsx`, compute a preview near the top of the component, after the `modSummary` block (line ~30):

```typescript
  const secondaryQuests = computeSecondaryQuests(councilSlots.value);
  const questPreview = secondaryQuests.map((q) => q.title).join(' · ');
```

Then in the Consilium box JSX, after the `modSummary` block (after line ~109, before the closing `</div>` of the box), add:

```tsx
          {questPreview && (
            <div style={{ fontSize: 10, color: 'var(--imp-text-lo)', fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic', marginTop: 4 }}>
              Objetivos secundarios: {questPreview} <span style={{ opacity: 0.7 }}>(aparecen en ruta)</span>
            </div>
          )}
```

Also widen the box's render guard (line ~93) so the box shows when only quests exist:

```tsx
      {(mission || modSummary || questPreview) && (
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/forum/panels/EmbarkCard.tsx
git commit -m "feat(iterbelli): embark seeds + previews Consilium secondary quests"
```

---

## Task 7: Active-quest display in the campaign header

**Files:**
- Modify: `src/ui/screens/iterbelli/IterBelliScreen.tsx`

- [ ] **Step 1: Ensure `isCrisisDef` is importable**

In `IterBelliScreen.tsx`, check the imports from `../../../game/iterBelli/iter-belli-types`. If `isCrisisDef` is not already imported, add it (merge into the existing type import, or add a value import):

```typescript
import { isCrisisDef } from '../../../game/iterBelli/iter-belli-types';
```

- [ ] **Step 2: Compute active quests**

In `IterBelliScreen.tsx`, in the `IterBelliScreen` component body, after `const mission = getMissionById(s.missionId);` (line 193):

```typescript
  const mission = getMissionById(s.missionId);
  const activeQuests = s.quests.filter((q) => q.status === 'active');
```

- [ ] **Step 3: Render active quests under the mission line**

In `IterBelliScreen.tsx`, after the `{mission && (...)}` block in the header (after line 208), add:

```tsx
        {activeQuests.map((q) => {
          const qc = s.pool.find((c) => !isCrisisDef(c.def) && c.def.questId === q.id);
          const turns = qc ? qc.timer : 0;
          return (
            <div key={q.id} class="ib-mission">
              ◆ Objetivo: {q.title} <span class="ib-mission-cond">— {turns} {turns === 1 ? 'turno' : 'turnos'} restantes</span>
            </div>
          );
        })}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/iterbelli/IterBelliScreen.tsx
git commit -m "feat(iterbelli): show active secondary quests in campaign header"
```

---

## Task 8: Quest-status rows in the endgame card

**Files:**
- Modify: `src/ui/screens/iterbelli/EndgameCard.tsx`

- [ ] **Step 1: Render a status row per quest**

In `EndgameCard.tsx`, inside the `ib-end-stats` block, after the `{mission && (...)}` block (after line 109), add:

```tsx
          {s.quests.map((q) => (
            <div key={q.id}>
              <span>Objetivo · {q.title}</span>
              <strong style={{ color: q.status === 'completed' ? 'var(--imp-gold-hi)' : q.status === 'failed' ? '#b23a3a' : 'var(--imp-text-lo)' }}>
                {q.status === 'completed' ? 'cumplido' : q.status === 'failed' ? 'fallido' : 'no activado'}
              </strong>
            </div>
          ))}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/screens/iterbelli/EndgameCard.tsx
git commit -m "feat(iterbelli): show secondary-quest outcomes in endgame card"
```

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the quest verification script**

Run: `npx tsx tools/verify-iter-belli-quests.ts`
Expected: PASS — "All checks passed."

- [ ] **Step 2: Run the Fase 1 verification (regression)**

Run: `npx tsx tools/verify-iter-belli-consilium.ts`
Expected: PASS — "All checks passed." (Fase 2 must not break the mission/modifier bridge.)

- [ ] **Step 3: Full type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 4: Manual Chrome check (Playwright or `npm run dev`)**

With `npm run dev` running (`http://localhost:5173/`):
1. Seat at least two advisors on the Consilium (one becomes the mission, the rest seed quests). Confirm EmbarkCard shows "Objetivos secundarios: …".
2. Embark. March until you reach a quest's location — confirm the quest card appears and the header lists "◆ Objetivo: … — N turnos restantes" with the timer counting down.
3. **Play** the quest card → confirm the reward lands (e.g. gold/threat/soldiers change) and the header entry disappears.
4. In another run, **let a quest card expire** → confirm the themed penalty fires in the log and "Compromisos rotos" does **not** increase.
5. Finish a campaign → confirm EndgameCard lists each quest as cumplido / fallido / no activado.

Report what you observed. Do not claim success without seeing each behavior.

- [ ] **Step 5: Final note**

No commit needed (verification only). If any check fails, return to the owning task, fix, and re-run this task.

---

## Self-Review notes (for the implementer)

- **Type consistency:** `questId` (camelCase) is used identically in types, factory, `playCard`, `endTurn`, and both UI screens. `SecondaryQuest.color` is `string` in types but indexed as `QuestColor` in the factory/bridge via `as QuestColor` — the unions are structurally identical, so this is safe.
- **Reward = card `effects`, cost = card `cost`, window = card `expiry`, penalty = card `penalty`** — no parallel reward/penalty system is introduced; the existing `applyEffects` / expiry machinery does the work.
- **`brokenCommitments` isolation:** the `endTurn` expiry loop checks `def.questId` *before* `def.cardType === 'compromiso'`, so quest cards never increment `brokenCommitments` (verified in Task 5).
- **Sagunto safety:** quests bind only to `tarraco`/`llanura`/`bosques`, never `sagunto`, so they never collide with the forced `asalto_decisivo` refill.
