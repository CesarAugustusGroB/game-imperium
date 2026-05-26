# Iter Belli — Iuniores Reinforcements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Hub's `iuniores` (recruit pool) matter inside Iter Belli by carrying it into the campaign as a spendable resource and adding a "Leva de iuniores" card that trades iuniores for fresh soldiers, with the remainder flowing back to the run.

**Architecture:** `iuniores` becomes a campaign-local resource in `IterBelliState`, seeded from the run at embark and written back on return — the exact same bridge pattern already used for `gold` (campaign owns its own copy; UI does the in/out at `EmbarkCard`/`EndgameCard`, so the logic module stays free of run-state imports and circular deps). A new operation card spends campaign `iuniores` (via `CardCost.iuniores`) to gain `soldiers`. No new cross-module coupling.

**Tech Stack:** TypeScript + Preact + @preact/signals. **No unit-test runner exists** in this repo — the established convention is pure-logic verification via `tools/verify-*.ts` scripts run with `npx tsx`, plus `npx tsc --noEmit` for types and browser checks for UI/integration. This plan follows that convention.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/game/iterBelli/iter-belli-types.ts` | `IterBelliState` gains `iuniores`; `CardCost` gains optional `iuniores` cost | Modify |
| `src/game/iterBelli/iter-belli-balance.ts` | Levy tuning constants | Modify |
| `src/game/iterBelli/iter-belli-state.ts` | Track/seed/reset iuniores; spend it as a card cost | Modify |
| `src/data/iter-belli-cards.ts` | The "Leva de iuniores" card definition | Modify |
| `src/ui/screens/forum/panels/EmbarkCard.tsx` | Seed campaign iuniores from run iuniores | Modify |
| `src/ui/screens/iterbelli/EndgameCard.tsx` | Write remaining campaign iuniores back to the run | Modify |
| `src/ui/screens/iterbelli/CampaignResourceBar.tsx` | Show the Iuniores chip | Modify |
| `src/ui/screens/iterbelli/OperationCard.tsx` | Affordability + iuniores cost row on cards | Modify |
| `tools/verify-iter-belli-reinforcements.ts` | Pure-logic verification (seed/reset/card contract) | Create |

---

## Task 1: Track, seed, and return campaign `iuniores`

Adds `iuniores` as a campaign-local resource that is seeded from the run at embark and written back on return — nothing spends it yet (the card comes in Task 2).

**Files:**
- Create: `tools/verify-iter-belli-reinforcements.ts`
- Modify: `src/game/iterBelli/iter-belli-types.ts` (`IterBelliState`)
- Modify: `src/game/iterBelli/iter-belli-state.ts` (`freshState`, `CampaignSeed`, `startIterBelliCampaign`)
- Modify: `src/ui/screens/forum/panels/EmbarkCard.tsx` (seed)
- Modify: `src/ui/screens/iterbelli/EndgameCard.tsx` (writeback)

- [ ] **Step 1: Write the failing verification script**

Create `tools/verify-iter-belli-reinforcements.ts`:

```ts
/**
 * Verifies the iuniores reinforcement bridge & levy card.
 * Run: npx tsx tools/verify-iter-belli-reinforcements.ts
 */
import { startIterBelliCampaign, resetIterBelli, iterBelliState } from '../src/game/iterBelli/iter-belli-state';
import { CARD_DEFS } from '../src/data/iter-belli-cards';
import { LOCATIONS } from '../src/data/iter-belli-locations';
import { LEVY_IUNIORES_COST, LEVY_IUNIORES_SOLDIERS } from '../src/game/iterBelli/iter-belli-balance';
import type { CardContext } from '../src/game/iterBelli/iter-belli-types';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

// --- Seed / reset (Task 1) ---
startIterBelliCampaign({ soldiers: 1200, gold: 40, iuniores: 1500 });
check('campaign seeds iuniores from run', iterBelliState.value.iuniores === 1500);
resetIterBelli();
check('resetIterBelli zeroes iuniores', iterBelliState.value.iuniores === 0);

// --- Levy card contract (Task 2) ---
const levy = CARD_DEFS.find((c) => c.id === 'leva_iuniores');
check('leva_iuniores card exists', !!levy);
if (levy) {
  check('levy costs iuniores', levy.cost.iuniores === LEVY_IUNIORES_COST);
  const mkCtx = (iun: number): CardContext =>
    ({ state: { ...iterBelliState.value, iuniores: iun }, loc: LOCATIONS[0] });
  check('levy grants soldiers', levy.effects(mkCtx(LEVY_IUNIORES_COST)).soldiers === LEVY_IUNIORES_SOLDIERS);
  check('levy requires enough iuniores (pass)', levy.requires!(mkCtx(LEVY_IUNIORES_COST)) === true);
  check('levy requires enough iuniores (fail)', levy.requires!(mkCtx(LEVY_IUNIORES_COST - 1)) === false);
}

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll reinforcement checks passed.');
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx tsx tools/verify-iter-belli-reinforcements.ts`
Expected: FAIL — `campaign seeds iuniores from run` is ✗ (iuniores is `undefined`), and the `leva_iuniores`/balance imports are absent so the script errors or the card checks are ✗. (esbuild strips types, so the failure is at runtime.)

- [ ] **Step 3: Add `iuniores` to `IterBelliState`**

In `src/game/iterBelli/iter-belli-types.ts`, find the resources block of `IterBelliState` and add `iuniores` right after `gold`:

```ts
export interface IterBelliState {
  // Resources
  soldiers: number;
  morale: number;       // clamped 0–10
  discipline: number;   // clamped 1–5
  supplies: number;
  gold: number;
  /** Recruit pool carried from the run (seeded at embark, written back on return). */
  iuniores: number;
  threat: number;       // clamped 0–10
```

(Insert only the `iuniores` doc-comment + field; leave the surrounding lines unchanged.)

- [ ] **Step 4: Initialise it in `freshState`, extend the seed, and seed it**

In `src/game/iterBelli/iter-belli-state.ts`:

(a) In `freshState()`, add `iuniores: 0,` right after the `gold:` line:

```ts
    gold: B.START.fallbackGold,
    iuniores: 0,
    threat: B.START.threat,
```

(b) Extend the `CampaignSeed` interface:

```ts
export interface CampaignSeed {
  soldiers: number;
  gold: number;
  iuniores: number;
}
```

(c) In `startIterBelliCampaign`, seed it right after the gold seed line:

```ts
  S.gold = Math.max(seed.gold, 0);
  S.iuniores = Math.max(seed.iuniores, 0);
```

- [ ] **Step 5: Seed from the run at embark**

In `src/ui/screens/forum/panels/EmbarkCard.tsx`, update the seed call inside `handleEmbark`:

```ts
    startIterBelliCampaign({ soldiers, gold: getResource('gold'), iuniores: getResource('iuniores') });
```

(`getResource` is already imported in this file.)

- [ ] **Step 6: Write the remainder back on return**

In `src/ui/screens/iterbelli/EndgameCard.tsx`:

(a) Extend the resources import:

```ts
import { gold, iuniores } from '../../../game/core/resources';
```

(b) In `returnToHub`, write iuniores back right after the gold writeback:

```ts
  gold.value = s.gold;
  iuniores.value = s.iuniores;
  if (outcome?.victory) completedSpokes.value++;
```

- [ ] **Step 7: Run the verification — seed/reset checks pass**

Run: `npx tsx tools/verify-iter-belli-reinforcements.ts`
Expected: the first two checks (`seeds iuniores`, `resetIterBelli zeroes iuniores`) now PASS. The `leva_iuniores` checks still FAIL (card not added yet) — that's expected; Task 2 finishes them.

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. (The verify script's `LEVY_*` imports don't yet exist → if tsc errors on the script, that's fine to leave until Task 2; if you want a clean tsc now, complete Task 2 before committing. Otherwise commit and proceed — tsc goes green at the end of Task 2.)

- [ ] **Step 9: Commit**

```bash
git add src/game/iterBelli/iter-belli-types.ts src/game/iterBelli/iter-belli-state.ts src/ui/screens/forum/panels/EmbarkCard.tsx src/ui/screens/iterbelli/EndgameCard.tsx tools/verify-iter-belli-reinforcements.ts
git commit -m "feat(iterbelli): carry run iuniores into the campaign and back"
```

---

## Task 2: "Leva de iuniores" card (spend iuniores → +soldiers)

Adds the cost field, the spend in `playCard`, the `applyChange` case, the tuning constants, and the card itself.

**Files:**
- Modify: `src/game/iterBelli/iter-belli-balance.ts` (constants)
- Modify: `src/game/iterBelli/iter-belli-types.ts` (`CardCost`)
- Modify: `src/game/iterBelli/iter-belli-state.ts` (`applyChange` case + `playCard` cost)
- Modify: `src/data/iter-belli-cards.ts` (card def + import)

- [ ] **Step 1: Add tuning constants**

In `src/game/iterBelli/iter-belli-balance.ts`, add a new section after the `VICTORY_GOLD_BONUS` line:

```ts
// ── Return-to-hub rewards ──
export const VICTORY_GOLD_BONUS = 200;

// ── Reinforcements (iuniores levy) ──
/** Iuniores spent per "Leva de iuniores" card. */
export const LEVY_IUNIORES_COST = 500;
/** Soldiers gained per levy — 1:1 with the Hub's iuniores→cohort-HP ratio (1000 iuniores ≈ a 1000-HP cohort). */
export const LEVY_IUNIORES_SOLDIERS = 500;
```

- [ ] **Step 2: Run the verification to confirm the levy checks still fail**

Run: `npx tsx tools/verify-iter-belli-reinforcements.ts`
Expected: `leva_iuniores card exists` is ✗ (card not added yet). The constants now import cleanly.

- [ ] **Step 3: Add `iuniores` to `CardCost`**

In `src/game/iterBelli/iter-belli-types.ts`, extend `CardCost`:

```ts
export interface CardCost {
  /** Days consumed (defaults to 1 when omitted). */
  time?: number;
  gold?: number;
  supplies?: number;
  /** Iuniores (recruit pool) spent — used by the levy card. */
  iuniores?: number;
}
```

- [ ] **Step 4: Spend it in `playCard` + handle it in `applyChange`**

In `src/game/iterBelli/iter-belli-state.ts`:

(a) Add an `iuniores` case to `applyChange`, right after the `gold` case:

```ts
    case 'gold':       S.gold = Math.max(0, S.gold + delta); break;
    case 'iuniores':   S.iuniores = Math.max(0, S.iuniores + delta); break;
    case 'threat':     S.threat = clamp(S.threat + delta, B.THREAT_MIN, B.THREAT_MAX); break;
```

(b) In `playCard`, apply the iuniores cost next to the existing supplies/gold costs:

```ts
  const cost = def.cost ?? {};
  // Costs apply regardless of gamble outcome.
  applyChange('supplies', -(cost.supplies ?? 0));
  applyChange('gold', -(cost.gold ?? 0));
  applyChange('iuniores', -(cost.iuniores ?? 0));
```

- [ ] **Step 5: Add the card definition**

In `src/data/iter-belli-cards.ts`:

(a) Add a value import below the existing type import at the top:

```ts
import type { OperationCard } from '../game/iterBelli/iter-belli-types';
import { LEVY_IUNIORES_COST, LEVY_IUNIORES_SOLDIERS } from '../game/iterBelli/iter-belli-balance';
```

(b) Insert the levy card immediately before the `// ── OPERACIONES MAYORES` section comment:

```ts
  {
    id: 'leva_iuniores',
    name: 'Leva de iuniores',
    category: 'Postura',
    desc: 'Llamar a filas a los iuniores de tus provincias. Refuerzos frescos a cambio de tu reserva de reclutas.',
    cost: { time: 1, iuniores: LEVY_IUNIORES_COST },
    effects: () => ({ soldiers: LEVY_IUNIORES_SOLDIERS }),
    expiry: 4,
    locations: ['*'],
    requires: ({ state }) => state.iuniores >= LEVY_IUNIORES_COST,
    weight: 3,
  },

  // ── OPERACIONES MAYORES ──────────────────────────────────────────────────────
```

(Anchor the edit on the `// ── OPERACIONES MAYORES` comment so the card is inserted right before it.)

- [ ] **Step 6: Run the verification — all checks pass**

Run: `npx tsx tools/verify-iter-belli-reinforcements.ts`
Expected: PASS — all checks green, ending with "All reinforcement checks passed."

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/game/iterBelli/iter-belli-balance.ts src/game/iterBelli/iter-belli-types.ts src/game/iterBelli/iter-belli-state.ts src/data/iter-belli-cards.ts
git commit -m "feat(iterbelli): add Leva de iuniores card (iuniores -> soldiers)"
```

---

## Task 3: Surface iuniores in the UI + end-to-end browser check

Shows the Iuniores chip in the campaign resource bar and the iuniores cost on cards (with affordability gating), then verifies the whole loop in the browser.

**Files:**
- Modify: `src/ui/screens/iterbelli/CampaignResourceBar.tsx`
- Modify: `src/ui/screens/iterbelli/OperationCard.tsx`

- [ ] **Step 1: Add the Iuniores chip to the resource bar**

In `src/ui/screens/iterbelli/CampaignResourceBar.tsx`, add an iuniores entry to the `resources(s)` array, right after the `gold` entry:

```ts
    {
      key: 'gold', glyph: '⚜', label: 'Oro', value: String(s.gold),
      tip: 'Oro de campaña (heredado del run). Paga cartas, sobornos y tributos; vuelve al hub al terminar.',
    },
    {
      key: 'iuniores', glyph: '🛡', label: 'Iuniores', value: s.iuniores.toLocaleString('es'),
      tip: 'Reclutas heredados del run. Gástalos con la "Leva de iuniores" para reforzar soldados; el resto vuelve al hub.',
    },
```

- [ ] **Step 2: Show the iuniores cost + gate affordability on cards**

In `src/ui/screens/iterbelli/OperationCard.tsx`:

(a) Extend the affordability check:

```ts
  let canPlay = true;
  if (cost.gold && state.gold < cost.gold) canPlay = false;
  if (cost.supplies && state.supplies < cost.supplies) canPlay = false;
  if (cost.iuniores && state.iuniores < cost.iuniores) canPlay = false;
```

(b) Add an iuniores cost row right after the gold cost row in the cost preview:

```tsx
        {cost.gold ? <div class="ib-effect"><span class="label">Oro</span><span class="neg">−{cost.gold}</span></div> : null}
        {cost.iuniores ? <div class="ib-effect"><span class="label">Iuniores</span><span class="neg">−{cost.iuniores}</span></div> : null}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Browser verification (the integrated spend)**

Start the dev server if not running: `npm run dev`. Then in the app:
1. Title → New Game → choose any commander → **Begin** → Hub.
2. **Embark** → Iter Belli loads. Confirm the resource bar now shows an **Iuniores** chip equal to the run's iuniores (e.g. 2000 on a fresh run).
3. Play turns until a **"Leva de iuniores"** card appears (it is `locations: ['*']`, weight 3, so it shows whenever iuniores ≥ 500). Confirm it displays a `−500 Iuniores` cost row.
4. Play it → **soldiers increase by 500** and **iuniores decrease by 500** in the bar; a turn passes.
5. With iuniores below 500, confirm the card no longer appears (drawn-out by `requires`).
6. Reach Sagunto, resolve the battle, **Volver al Hub** → confirm the run's iuniores at the Hub equals the campaign's remaining iuniores (i.e. reduced by exactly what you levied).

Expected: all six observations hold.

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/iterbelli/CampaignResourceBar.tsx src/ui/screens/iterbelli/OperationCard.tsx
git commit -m "feat(iterbelli): surface iuniores chip + levy cost on cards"
```

---

## Self-Review

**Spec coverage** (the thread = "iuniores → refuerzos: sembrar soldiers o carta que repone soldados a cambio de iuniores del run"):
- "iuniores del run" carried in → Task 1 (seed) ✓
- spent for soldiers via a card ("Leva de iuniores") → Task 2 ✓
- remainder returns to the run → Task 1 (writeback) ✓
- player can see/use it → Task 3 (chip + cost row + gating) ✓
- The user's first alternative ("sembrar soldiers extra al embarcar") is intentionally **not** implemented: the card mechanism is the chosen design (player-driven, reuses the card loop, no hidden auto-drain of the pool). Flagged here so it's a conscious omission, not a gap.

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `iuniores` is `number` on `IterBelliState` and `CampaignSeed`; `CardCost.iuniores?: number`; `applyChange('iuniores', …)` matches the new `IterBelliState` key; `LEVY_IUNIORES_COST` / `LEVY_IUNIORES_SOLDIERS` names are identical across balance, cards, and the verify script. Card `effects` returns `{ soldiers }` (existing `CardEffects` field — no `CardEffects` change needed). Consistent.

---

## Roadmap for the other six threads (NOT in this plan)

This plan deliberately covers **only Thread 1**. The rest each need a short brainstorm/spec first because their numbers and mappings are undefined (the writing-plans skill forbids invented design). Suggested order, easiest/most-defined first:

1. ✅ **Iuniores → refuerzos** — this plan.
2. **Comandante/Legado → disciplina e identidad** — small; needs a spec deciding each commander's starting discipline and any signature card/stance. Reuses the `CampaignSeed` (add `discipline`).
3. **Resultado → progresión del Hub** — extends the existing `EndgameCard.returnToHub`; needs a spec for the reward/penalty table (victory → iuniores/loyalty? defeat → unrest/threat?).
4. **Provincias → condiciones iniciales** — needs formulas (wealth→supplies/gold, unrest→threat, population→cap). Reuses `CampaignSeed`.
5. **Consilium → modificadores** — needs an advisor→bonus mapping table. Reuses `CampaignSeed` (a `modifiers` bag).
6. **Doctrinae / Decreta → cartas/batalla** — larger; needs a doctrine→card / decretum→trump-card mapping and pool-injection design.
7. **Unificar moral/suministros** — a refactor of the (deprecated) bellum morale/supplies model; biggest blast radius, do last.

Threads 2, 4, 5 share an obvious foundation: once a second thread needs it, refactor `CampaignSeed` into a richer `buildCampaignSeed(runState)` builder + a `CampaignModifiers` bag. **Don't build that abstraction yet (YAGNI)** — `CampaignSeed` already extends cleanly field-by-field (as Thread 1 shows).
