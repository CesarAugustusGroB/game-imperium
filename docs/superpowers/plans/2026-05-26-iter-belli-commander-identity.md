# Iter Belli — Commander Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each commander a distinct Iter Belli identity — a per-archetype starting discipline (II/III/IV/V), a legate ±1 discipline modifier, and an archetype-gated signature operation card.

**Architecture:** Extends the proven `CampaignSeed` bridge (`discipline` + `archetype` join `soldiers`/`gold`/`iuniores`). Discipline is computed at embark from the commander's archetype plus a ±1 modifier derived from the legate's existing `traitIds` (read-only — no legate/battle-code edits). `CardContext` gains an optional `archetype` so four new signature cards gate themselves to one commander via `requires`. Everything lives in `src/game/iterBelli/` + the embark bridge.

**Tech Stack:** TypeScript + Preact + @preact/signals. No unit-test runner — verification is `npx tsx tools/verify-*.ts` (pure logic) + `npx tsc --noEmit` + browser. Spec: `docs/superpowers/specs/2026-05-26-iter-belli-commander-identity-design.md`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/game/iterBelli/iter-belli-types.ts` | `Archetype` type; `IterBelliState.archetype`; optional `CardContext.archetype` | Modify |
| `src/game/iterBelli/iter-belli-balance.ts` | `DISCIPLINE_BY_ARCHETYPE`, `LEGATE_DISCIPLINE_TRAIT_MOD`, `SIGNATURE` constants | Modify |
| `src/game/iterBelli/iter-belli-state.ts` | seed/state archetype + discipline; `ctx()` exposes archetype; exported `computeStartingDiscipline` | Modify |
| `src/data/iter-belli-cards.ts` | the 4 archetype-gated signature cards | Modify |
| `src/ui/screens/forum/panels/EmbarkCard.tsx` | compute discipline + archetype at embark, pass in seed | Modify |
| `tools/verify-iter-belli-commander.ts` | pure-logic verification (discipline math, seed, signature gating) | Create |

---

## Task 1: Per-archetype discipline + legate ±1

Seeds the campaign with a commander-derived starting discipline. No signature cards yet (Task 2).

**Files:**
- Create: `tools/verify-iter-belli-commander.ts`
- Modify: `iter-belli-types.ts`, `iter-belli-balance.ts`, `iter-belli-state.ts`, `EmbarkCard.tsx`

- [ ] **Step 1: Write the failing verification script**

Create `tools/verify-iter-belli-commander.ts`:

```ts
/**
 * Verifies commander identity: per-archetype discipline + legate ±1 + (Task 2) signature cards.
 * Run: npx tsx tools/verify-iter-belli-commander.ts
 */
import { startIterBelliCampaign, resetIterBelli, iterBelliState, computeStartingDiscipline } from '../src/game/iterBelli/iter-belli-state';
import { START } from '../src/game/iterBelli/iter-belli-balance';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

// --- Discipline by archetype (no legate) ---
check('Warlord → II', computeStartingDiscipline('Warlord', []) === 2);
check('Religious → III', computeStartingDiscipline('Religious', []) === 3);
check('Merchant → IV', computeStartingDiscipline('Merchant', []) === 4);
check('Diplomat → V', computeStartingDiscipline('Diplomat', []) === 5);
check('null archetype → START.discipline', computeStartingDiscipline(null, []) === START.discipline);

// --- Legate ±1 ---
check('disciplined legate → +1 (Religious 3→4)', computeStartingDiscipline('Religious', ['disciplined']) === 4);
check('aggressive legate → −1 (Religious 3→2)', computeStartingDiscipline('Religious', ['aggressive']) === 2);
check('mixed traits net 0', computeStartingDiscipline('Religious', ['disciplined', 'aggressive']) === 3);
check('multiple +1 traits clamp to +1', computeStartingDiscipline('Religious', ['disciplined', 'cautious', 'tactician']) === 4);
check('neutral trait → 0', computeStartingDiscipline('Religious', ['veteran']) === 3);

// --- Final clamp 1–5 ---
check('Diplomat 5 + disciplined clamps to 5', computeStartingDiscipline('Diplomat', ['disciplined']) === 5);
check('Warlord 2 − aggressive = 1', computeStartingDiscipline('Warlord', ['aggressive']) === 1);

// --- Seed application + reset ---
startIterBelliCampaign({ soldiers: 1000, gold: 0, iuniores: 0, discipline: 5, archetype: 'Diplomat' });
check('seed applies discipline', iterBelliState.value.discipline === 5);
check('seed applies archetype', iterBelliState.value.archetype === 'Diplomat');
resetIterBelli();
check('reset clears archetype to null', iterBelliState.value.archetype === null);

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll commander-identity checks passed.');
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx tsx tools/verify-iter-belli-commander.ts`
Expected: FAIL — `computeStartingDiscipline` is not exported yet (import is `undefined`, calling it throws) and the seed lacks `discipline`/`archetype`.

- [ ] **Step 3: Add the `Archetype` type + state/context fields**

In `src/game/iterBelli/iter-belli-types.ts`:

(a) Add the `Archetype` type and the optional `CardContext.archetype` — replace the `CardContext` block:
```ts
/** Player archetype, mirrors Commander['archetype']. null when no commander. */
export type Archetype = 'Religious' | 'Warlord' | 'Diplomat' | 'Merchant';

/** Read-only context handed to a card's behaviour functions. */
export interface CardContext {
  state: Readonly<IterBelliState>;
  loc: Location;
  /** Commander archetype for this campaign; gates signature cards. */
  archetype?: Archetype | null;
}
```

(b) Add `archetype` to `IterBelliState` — replace the lifecycle block:
```ts
  // Presentation / lifecycle
  phase: CampaignPhase;
  outcome: CampaignOutcome | null;
  /** Commander archetype for this campaign (gates signature cards). */
  archetype: Archetype | null;

  /** Soldiers the campaign began with — used to scale survivors back to cohorts. */
  initialSoldiers: number;
}
```

- [ ] **Step 4: Add balance maps**

In `src/game/iterBelli/iter-belli-balance.ts`:

(a) Add a type-only import at the very top of the file (above the first `export`):
```ts
import type { Archetype } from './iter-belli-types';
```
(b) Insert this section immediately after the `export const LEVY_IUNIORES_SOLDIERS = 500;` line:
```ts

// ── Commander identity ──
/** Starting discipline (1–5) by archetype; overrides START.discipline at embark. */
export const DISCIPLINE_BY_ARCHETYPE: Record<Archetype, number> = {
  Warlord: 2,
  Religious: 3,
  Merchant: 4,
  Diplomat: 5,
};
/** Legate trait id → discipline contribution. Net is clamped to ±1 by the caller. */
export const LEGATE_DISCIPLINE_TRAIT_MOD: Record<string, number> = {
  disciplined: 1, cautious: 1, tactician: 1, stoic: 1,
  aggressive: -1, rallying: -1,
};
```

- [ ] **Step 5: Wire state — import, freshState, seed, ctx, computeStartingDiscipline**

In `src/game/iterBelli/iter-belli-state.ts`:

(a) Add `Archetype` to the types import — change:
```ts
import type {
  CardContext, CardEffects, CardInstance, IterBelliState, Location, LogKind, LogLine,
} from './iter-belli-types';
```
to:
```ts
import type {
  Archetype, CardContext, CardEffects, CardInstance, IterBelliState, Location, LogKind, LogLine,
} from './iter-belli-types';
```

(b) In `freshState()`, add `archetype: null,` right after `outcome: null,`:
```ts
    phase: 'campaign',
    outcome: null,
    archetype: null,
    initialSoldiers: B.START.fallbackSoldiers,
```

(c) `ctx()` — expose archetype:
```ts
function ctx(): CardContext {
  return { state: S, loc: currentLocation(), archetype: S.archetype };
}
```

(d) Extend `CampaignSeed`:
```ts
export interface CampaignSeed {
  soldiers: number;
  gold: number;
  iuniores: number;
  discipline: number;
  archetype: Archetype | null;
}
```

(e) In `startIterBelliCampaign`, after the `S.iuniores = Math.max(seed.iuniores, 0);` line, add:
```ts
  S.iuniores = Math.max(seed.iuniores, 0);
  S.discipline = clamp(seed.discipline, B.DISCIPLINE_MIN, B.DISCIPLINE_MAX);
  S.archetype = seed.archetype;
```

(f) Add this exported pure function (place it just above `export interface CampaignSeed {`):
```ts
/**
 * Starting campaign discipline = archetype base + legate modifier (net ±1), clamped 1–5.
 * Reads legate trait ids as plain strings; does not touch the legate/battle system.
 */
export function computeStartingDiscipline(
  archetype: Archetype | null,
  legateTraitIds: readonly string[],
): number {
  const base = archetype ? B.DISCIPLINE_BY_ARCHETYPE[archetype] : B.START.discipline;
  const rawMod = legateTraitIds.reduce((sum, id) => sum + (B.LEGATE_DISCIPLINE_TRAIT_MOD[id] ?? 0), 0);
  const legateMod = clamp(rawMod, -1, 1);
  return clamp(base + legateMod, B.DISCIPLINE_MIN, B.DISCIPLINE_MAX);
}
```

- [ ] **Step 6: Run the verification — should pass**

Run: `npx tsx tools/verify-iter-belli-commander.ts`
Expected: PASS — "All commander-identity checks passed." (16 checks). `EmbarkCard` isn't exercised by the script; it's covered by tsc + browser.

- [ ] **Step 7: Seed from the commander + legate at embark**

In `src/ui/screens/forum/panels/EmbarkCard.tsx`:

(a) Update imports — change these three lines:
```ts
import { preparedArmy } from '../../../../game/progression/strategic-store';
import { getResource } from '../../../../game/core/resources';
import { startIterBelliCampaign } from '../../../../game/iterBelli/iter-belli-state';
```
to:
```ts
import { preparedArmy, preparedLegate } from '../../../../game/progression/strategic-store';
import { getResource } from '../../../../game/core/resources';
import { selectedCommander } from '../../../../game/core/game-state';
import { startIterBelliCampaign, computeStartingDiscipline } from '../../../../game/iterBelli/iter-belli-state';
```

(b) In `handleEmbark`, replace the seed block:
```ts
    const cohorts = army?.cohorts ?? [];
    const soldiers = cohorts.reduce((sum, c) => sum + (c.currentHp ?? c.stats.hp), 0);
    startIterBelliCampaign({ soldiers, gold: getResource('gold'), iuniores: getResource('iuniores') });
    navigateToIterBelli();
```
with:
```ts
    const cohorts = army?.cohorts ?? [];
    const soldiers = cohorts.reduce((sum, c) => sum + (c.currentHp ?? c.stats.hp), 0);
    const archetype = selectedCommander.value?.archetype ?? null;
    const discipline = computeStartingDiscipline(archetype, preparedLegate.value?.traitIds ?? []);
    startIterBelliCampaign({ soldiers, gold: getResource('gold'), iuniores: getResource('iuniores'), discipline, archetype });
    navigateToIterBelli();
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. (`selectedCommander.value.archetype` is `Commander['archetype']`, structurally identical to `Archetype`, so it assigns to `seed.archetype` cleanly.)

- [ ] **Step 9: Commit**

```bash
git add src/game/iterBelli/iter-belli-types.ts src/game/iterBelli/iter-belli-balance.ts src/game/iterBelli/iter-belli-state.ts src/ui/screens/forum/panels/EmbarkCard.tsx tools/verify-iter-belli-commander.ts
git commit -m "feat(iterbelli): per-commander starting discipline + legate modifier"
```

---

## Task 2: Signature cards (archetype-gated)

One unique operation card per commander, recurring only in that commander's campaigns.

**Files:**
- Modify: `iter-belli-balance.ts` (`SIGNATURE` constants), `iter-belli-cards.ts` (4 cards), `tools/verify-iter-belli-commander.ts` (extend)

- [ ] **Step 1: Add signature tuning constants**

In `src/game/iterBelli/iter-belli-balance.ts`, add immediately after the `LEGATE_DISCIPLINE_TRAIT_MOD` object (from Task 1):
```ts
/** Signature card tuning (one card per commander). */
export const SIGNATURE = {
  furiaGalaMorale: 2,
  furiaGalaThreat: 1,
  teDeumMorale: 2.5,
  mercenariosGold: 40,
  mercenariosSoldiers: 600,
  tratadoThreat: -3,
} as const;
```

- [ ] **Step 2: Extend the verification script (fails first)**

In `tools/verify-iter-belli-commander.ts`, add these imports at the top (below the existing imports):
```ts
import { CARD_DEFS } from '../src/data/iter-belli-cards';
import { LOCATIONS } from '../src/data/iter-belli-locations';
import { SIGNATURE } from '../src/game/iterBelli/iter-belli-balance';
import type { Archetype, CardContext } from '../src/game/iterBelli/iter-belli-types';
```
Then add these checks immediately before the final `if (failures > 0) {` line:
```ts
// --- Signature cards ---
const mkCtx = (archetype: Archetype | null, gold = 0): CardContext =>
  ({ state: { ...iterBelliState.value, gold }, loc: LOCATIONS[0], archetype });

const sig: Array<[string, Archetype, number | undefined]> = [
  ['firma_furia_gala', 'Warlord', SIGNATURE.furiaGalaMorale],
  ['firma_te_deum', 'Religious', SIGNATURE.teDeumMorale],
  ['firma_mercenarios', 'Merchant', undefined],
  ['firma_tratado', 'Diplomat', undefined],
];
for (const [id, arch] of sig) {
  const card = CARD_DEFS.find((c) => c.id === id);
  check(`${id} exists`, !!card);
  if (card) {
    check(`${id} gated to ${arch}`, card.requires!(mkCtx(arch, 999)) === true);
    check(`${id} blocked for other archetype`, card.requires!(mkCtx('Religious' === arch ? 'Warlord' : 'Religious', 999)) === false);
    check(`${id} locations '*'`, card.locations.includes('*'));
  }
}
check('furia gala effects', CARD_DEFS.find((c) => c.id === 'firma_furia_gala')!.effects(mkCtx('Warlord')).morale === SIGNATURE.furiaGalaMorale);
check('te deum morale', CARD_DEFS.find((c) => c.id === 'firma_te_deum')!.effects(mkCtx('Religious')).morale === SIGNATURE.teDeumMorale);
check('mercenarios soldiers', CARD_DEFS.find((c) => c.id === 'firma_mercenarios')!.effects(mkCtx('Merchant')).soldiers === SIGNATURE.mercenariosSoldiers);
check('mercenarios requires gold', CARD_DEFS.find((c) => c.id === 'firma_mercenarios')!.requires!(mkCtx('Merchant', 0)) === false);
check('tratado threat', CARD_DEFS.find((c) => c.id === 'firma_tratado')!.effects(mkCtx('Diplomat')).threat === SIGNATURE.tratadoThreat);
```

Run: `npx tsx tools/verify-iter-belli-commander.ts`
Expected: FAIL — the `firma_*` cards don't exist yet (`card` is undefined).

- [ ] **Step 3: Add the four signature cards**

In `src/data/iter-belli-cards.ts`:

(a) Extend the balance import — change:
```ts
import { LEVY_IUNIORES_COST, LEVY_IUNIORES_SOLDIERS } from '../game/iterBelli/iter-belli-balance';
```
to:
```ts
import { LEVY_IUNIORES_COST, LEVY_IUNIORES_SOLDIERS, SIGNATURE } from '../game/iterBelli/iter-belli-balance';
```

(b) Insert the four cards immediately before the `// ── OPERACIONES MAYORES` section comment:
```ts
  // ── CARTAS FIRMA (commander-gated, locations '*') ──────────────────────────
  {
    id: 'firma_furia_gala',
    name: 'Furia gala',
    category: 'Coerción',
    desc: 'Boudicca enardece a las tribus. El ardor de combate crece, pero el clamor llega lejos.',
    cost: { time: 1 },
    effects: () => ({ morale: SIGNATURE.furiaGalaMorale, threat: SIGNATURE.furiaGalaThreat }),
    expiry: 5,
    locations: ['*'],
    requires: ({ archetype }) => archetype === 'Warlord',
    weight: 3,
  },
  {
    id: 'firma_te_deum',
    name: 'Te Deum',
    category: 'Diplomacia',
    desc: 'El Papa entona acción de gracias. La fe reanima el ánimo de las legiones.',
    cost: { time: 1 },
    effects: () => ({ morale: SIGNATURE.teDeumMorale }),
    expiry: 5,
    locations: ['*'],
    requires: ({ archetype }) => archetype === 'Religious',
    weight: 3,
  },
  {
    id: 'firma_mercenarios',
    name: 'Mercenarios de Craso',
    category: 'Postura',
    desc: 'Craso abre su bolsa: lanzas a sueldo se unen a la columna.',
    cost: { time: 1, gold: SIGNATURE.mercenariosGold },
    effects: () => ({ soldiers: SIGNATURE.mercenariosSoldiers }),
    expiry: 5,
    locations: ['*'],
    requires: ({ archetype, state }) => archetype === 'Merchant' && state.gold >= SIGNATURE.mercenariosGold,
    weight: 3,
  },
  {
    id: 'firma_tratado',
    name: 'Tratado romano',
    category: 'Diplomacia',
    desc: 'Augusto negocia: un tratado desactiva la hostilidad local.',
    cost: { time: 1 },
    effects: () => ({ threat: SIGNATURE.tratadoThreat }),
    expiry: 5,
    locations: ['*'],
    requires: ({ archetype }) => archetype === 'Diplomat',
    weight: 3,
  },

  // ── OPERACIONES MAYORES ──────────────────────────────────────────────────────
```

- [ ] **Step 4: Run the verification — all pass**

Run: `npx tsx tools/verify-iter-belli-commander.ts`
Expected: PASS — "All commander-identity checks passed." (all discipline + signature checks green).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/game/iterBelli/iter-belli-balance.ts src/data/iter-belli-cards.ts tools/verify-iter-belli-commander.ts
git commit -m "feat(iterbelli): archetype-gated signature card per commander"
```

---

## Task 3: Browser end-to-end verification (controller-run)

No new code — signature cards render through the existing `OperationCard`, and discipline shows in the existing chip. The controller verifies the full flow in the browser (the `eval`-drive is unreliable post-HMR, so drive via real clicks).

- [ ] **Step 1: Verify in the browser**

With the dev server running:
1. Title → New Game → **Boudicca** (Warlord) → Begin → Hub → Embark.
2. Confirm the discipline chip reads **II** (not IV). Play turns and confirm **"Furia gala"** appears in the pool (and applies +2 morale / +1 threat); confirm **no other** commander's signature card appears.
3. Return to title, New Game → **Augustus** (Diplomat) → Embark. Discipline chip reads **V**; only **"Tratado romano"** appears (−3 threat).
4. (Legate spot-check, if a legate can be assigned in the run) Assign a legate with a `disciplined` trait to a commander and confirm discipline is one higher than the base; an `aggressive` legate one lower (clamped 1–5).
5. New Game → **Crassus** (Merchant) → Embark. Discipline **IV**; **"Mercenarios de Craso"** appears only when gold ≥ 40 and applies +600 soldiers for −40 gold.

Expected: each commander shows the right discipline and only its own signature card; effects apply as specified.

---

## Self-Review

**Spec coverage:**
- Discipline by archetype (2/3/4/5) → Task 1 (`DISCIPLINE_BY_ARCHETYPE`, `computeStartingDiscipline`, seed) ✓
- Legate ±1 from trait ids, net-clamped, no battle-code edits → Task 1 (`LEGATE_DISCIPLINE_TRAIT_MOD`, `computeStartingDiscipline` reads `traitIds` strings) ✓
- Signature card per commander, archetype-gated, recurring → Task 2 (4 cards, `requires` on `ctx.archetype`, `locations: ['*']`) ✓
- Data flow (seed += discipline/archetype; ctx exposes archetype) → Task 1 ✓
- Verification (discipline math, seed, gating) → Tasks 1–2 verify script + Task 3 browser ✓

**Placeholder scan:** none — all code is concrete.

**Type consistency:** `Archetype` defined once in types.ts, imported by balance.ts (type-only), state.ts, and the verify script. `computeStartingDiscipline(archetype, legateTraitIds)` signature matches its call in EmbarkCard and the verify script. `CardContext.archetype` is optional, so the existing `tools/verify-iter-belli-reinforcements.ts` `mkCtx` (no archetype) still type-checks. `CampaignSeed` now requires `discipline` + `archetype`; the only caller is `EmbarkCard` (updated in Task 1) — the iuniores plan's seed call is superseded by Task 1's edit. Signature `SIGNATURE.*` constant names match between balance.ts, cards.ts, and the verify script.

**Note:** Task 1 changes `CampaignSeed` (adds required fields). The only production caller is `EmbarkCard.handleEmbark`, updated in the same task — no other call site exists, so nothing breaks.

---

## Execution

After approval, implement via subagent-driven development (fresh implementer per task + two-stage spec/quality review), matching the iuniores feature. Task 3 is a controller-run browser check.
