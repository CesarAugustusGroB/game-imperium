# Iter Belli — Thread C (slice 1): Ammunition as a Campaign Resource

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans / subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make ammunition a real campaign resource that sets the harass budget for the decisive battle, and give the engine teeth so harassing without ammo is feeble.

**Architecture:** The decisive battle is terminal, so ammunition is spent only as a *budget entering* the battle — no write-back. It is seeded at embark (START default), refilled by a buy card, shown on the resource bar, and passed into `buildPlayerSeed`. The engine harass branch collapses to ×0.15 damage when the attacker is out of ammo. Armor/fort keep their existing engine defaults (iron / 0) — the Hub upgrade UI is a deferred slice (avoids the codex-active ExercitusTab).

**Tech Stack:** TypeScript (strict), Vitest, Preact signals.

**Tuning:** `START.ammunition = 30`; buy card `Reabastecer munición` = `{time:1, gold:30}` → `+18`; `BAL.DRY_HARASS_MULT = 0.15`. Harass order costs today: skirmish 9, fireMissiles 14.

**Out of scope (later slice):** `armorMaterial` on ArmyData + Exercitus upgrade UI; fortification wiring; ammunition stock carried from the Hub army. Does NOT touch `EmbarkCard.tsx` or `ExercitusTab.tsx` (codex active).

---

### Task 1: Engine — harass needs ammo (dry volley ×0.15)

**Files:** Modify `src/game/iterBelli/battle/balance.ts`, `src/game/iterBelli/battle/resolver.ts:56-63`. Test: `src/game/iterBelli/battle/__tests__/harass-ammo.test.ts` (create).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { makeBattleArmy, makeBattleState } from '../engine';
import { resolveOrder } from '../resolver';
import { ORDERS, CENTERS, ENEMY_ARCHETYPES } from '../orders';

const army = (ammo: number) => makeBattleArmy('you', {
  hp: 10000, morale: 10, discipline: 4,
  stats: { charge: 5, harass: 16, push: 5, siege: 2, movement: 5 },
  armorPct: 0, armorName: 'None', ammo, formation: 'openOrder',
} as any);

function harassDamage(ammo: number): number {
  const you = army(ammo);
  const enemy = makeBattleArmy('enemy', ENEMY_ARCHETYPES.carthage);
  enemy.armorPct = 0; // isolate the ammo effect
  const S = makeBattleState(you, enemy, CENTERS.plain, 0);
  const before = enemy.hp;
  resolveOrder(S, you, enemy, ORDERS.skirmish, 5, ORDERS.holdLine);
  return before - enemy.hp;
}

describe('harass requires ammunition', () => {
  it('a dry volley (ammo 0) deals ~15% of a supplied volley', () => {
    const wet = harassDamage(50);
    const dry = harassDamage(0);
    expect(wet).toBeGreaterThan(0);
    expect(dry / wet).toBeCloseTo(0.15, 1);
  });
  it('supplied harass consumes ammo', () => {
    const you = army(50);
    const enemy = makeBattleArmy('enemy', ENEMY_ARCHETYPES.carthage);
    const S = makeBattleState(you, enemy, CENTERS.plain, 0);
    resolveOrder(S, you, enemy, ORDERS.skirmish, 5, ORDERS.holdLine);
    expect(you.ammo).toBe(50 - (ORDERS.skirmish.ammo ?? 0));
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (`npx vitest run src/game/iterBelli/battle/__tests__/harass-ammo.test.ts`) — dry ≈ wet (no gate yet).

- [ ] **Step 3: Add the constant.** In `balance.ts`, add `DRY_HARASS_MULT: 0.15,` to the `BAL` object.

- [ ] **Step 4: Gate the harass branch.** Replace `resolver.ts:56-63` with:

```ts
  if (o.sub === 'harass') {
    const dry = att.ammo <= 0;
    att.ammo = Math.max(0, att.ammo - (o.ammo ?? 0));
    let dmg = mitigate(statVal * die * (o.mult ?? 0) * discBonus * ms * BAL.DMG_SCALE, def, o);
    if (dry) { dmg *= BAL.DRY_HARASS_MULT; eMoraleHit *= 0.3; }
    if (def.formation.antiMissile) { dmg *= 0.12; eMoraleHit *= 0.3; }
    def.hp = Math.max(0, def.hp - dmg);
    log.push({ text:`${who} harass ${tgt} for ${Math.round(dmg)} (ammo ${att.ammo}${dry ? ' — out of ammo!' : ''}).`, kind: cls });
    return { eMoraleHit, log };
  }
```

- [ ] **Step 5: Run test — expect PASS.**

- [ ] **Step 6: Commit** — `git add` the three files; `feat(battle): harass collapses to 15% damage when out of ammo (Thread C)`.

---

### Task 2: Campaign ammunition state + types + balance

**Files:** Modify `src/game/iterBelli/iter-belli-types.ts`, `iter-belli-balance.ts`, `iter-belli-state.ts`. Test: `src/game/iterBelli/__tests__/ammunition-state.test.ts` (create).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import * as B from '../iter-belli-balance';

describe('ammunition campaign constant', () => {
  it('START seeds a starting ammunition budget', () => {
    expect(B.START.ammunition).toBe(30);
  });
});
```

(State mutation is covered indirectly by the save + battle tests; this guards the constant.)

- [ ] **Step 2: Run — expect FAIL** (`START.ammunition` undefined).

- [ ] **Step 3: Type changes (`iter-belli-types.ts`).**
  - In `IterBelliState`, change the stale discipline comment to `// clamped 0–10` and add after `iuniores`:
    `  /** Battle harass budget (proyectiles). Seeded at embark, refilled by cards, spent only in the decisive battle. */`
    `  ammunition: number;`
  - In `CardEffects`, add `  ammunition?: number;` (after `supplies?`).

- [ ] **Step 4: Balance (`iter-belli-balance.ts`).** Add `ammunition: 30,` to the `START` object (after `supplies`).

- [ ] **Step 5: State (`iter-belli-state.ts`).**
  - `freshState()`: add `ammunition: B.START.ammunition,` (after `iuniores: 0,`).
  - `applyChange`: add case `case 'ammunition': S.ammunition = Math.max(0, S.ammunition + delta); break;`
  - `applyEffects`: add case `case 'ammunition':  applyChange('ammunition', v as number); break;`
  - `CampaignSeed` interface: add `  /** Override starting ammunition; omitted → START.ammunition. */`  `  ammunition?: number;`
  - `startIterBelliCampaign`: after the supplies seed line add `  if (seed.ammunition != null) S.ammunition = Math.max(0, Math.floor(seed.ammunition));`

- [ ] **Step 6: Run — expect PASS** + `npx tsc --noEmit` clean (the new required field must be set everywhere; freshState + restore cover it).

- [ ] **Step 7: Commit** — `feat(iter-belli): add ammunition campaign resource (state + types) (Thread C)`.

---

### Task 3: Save serialize/restore + migration default

**Files:** Modify `src/game/iterBelli/iter-belli-save.ts`. Test: extend `src/game/iterBelli/__tests__/save-migration.test.ts`.

- [ ] **Step 1: Update the tests**

Replace the body of `save-migration.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { migrateSave } from '../iter-belli-save';

describe('save migration', () => {
  it('v1 (versionless, 1–5) doubles discipline, defaults ammo, bumps to v3', () => {
    const out = migrateSave({ discipline: 4 } as any);
    expect(out.discipline).toBe(8);
    expect(out.ammunition).toBe(30);
    expect(out.schemaVersion).toBe(3);
  });
  it('v2 keeps discipline, backfills ammo, bumps to v3', () => {
    const out = migrateSave({ discipline: 4, schemaVersion: 2 } as any);
    expect(out.discipline).toBe(4);
    expect(out.ammunition).toBe(30);
    expect(out.schemaVersion).toBe(3);
  });
  it('v3 with ammo is left untouched', () => {
    const out = migrateSave({ discipline: 4, ammunition: 12, schemaVersion: 3 } as any);
    expect(out).toEqual({ discipline: 4, ammunition: 12, schemaVersion: 3 });
  });
  it('clamps a migrated v1 discipline into 0–10', () => {
    expect(migrateSave({ discipline: 6 } as any).discipline).toBe(10);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (version is 2; ammo not handled).

- [ ] **Step 3: Implement.** In `iter-belli-save.ts`:
  - `import { START } from './iter-belli-balance';` (add to imports).
  - Bump `export const ITER_BELLI_SAVE_VERSION = 3;`
  - In `serializeIterBelli`, add `ammunition: s.ammunition,` (next to `iuniores`).
  - In `restoreIterBelli`'s state literal, add `ammunition: save.ammunition,` (next to `iuniores`). Safe because `migrateSave` runs first and backfills it.
  - Replace `migrateSave` with:

```ts
export function migrateSave(save: IterBelliSave): IterBelliSave {
  let out = save;
  if ((out.schemaVersion ?? 1) < 2) {
    out = { ...out, discipline: Math.max(0, Math.min(10, out.discipline * 2)) };
  }
  if (out.ammunition == null) {
    out = { ...out, ammunition: START.ammunition };
  }
  if ((out.schemaVersion ?? 1) < ITER_BELLI_SAVE_VERSION) {
    out = { ...out, schemaVersion: ITER_BELLI_SAVE_VERSION };
  }
  return out;
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit** — `feat(iter-belli): persist + migrate ammunition (save v3) (Thread C)`.

---

### Task 4: Buy card — "Reabastecer munición"

**Files:** Modify `src/data/iter-belli-cards.ts`. Test: `src/data/__tests__/ammo-card.test.ts` (create).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { CARD_DEFS } from '../iter-belli-cards';

const card = () => CARD_DEFS.find((c) => c.id === 'reabastecer_municion')!;

describe('ammunition buy card', () => {
  it('exists, costs gold + a day, grants ammunition', () => {
    expect(card().category).toBe('Logística');
    expect(card().cost).toEqual({ time: 1, gold: 30 });
    expect(card().effects({} as any)).toEqual({ ammunition: 18 });
  });
  it('requires the gold on hand', () => {
    expect(card().requires!({ state: { gold: 30 } } as any)).toBe(true);
    expect(card().requires!({ state: { gold: 10 } } as any)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Add the card** to the Logística section of `CARD_DEFS` (after `comprar_suministros`):

```ts
  {
    id: 'reabastecer_municion',
    name: 'Reabastecer munición',
    category: 'Logística',
    desc: 'Comprar flechas, jabalinas y proyectiles al arsenal de la ciudad aliada. Llena las aljabas para la batalla decisiva.',
    cost: { time: 1, gold: 30 },
    effects: () => ({ ammunition: 18 }),
    expiry: 5,
    locations: ['tarraco'],
    requires: ({ state }) => state.gold >= 30,
    weight: 3,
  },
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit** — `feat(iter-belli): add ammunition resupply card (Thread C)`.

---

### Task 5: Resource bar display

**Files:** Modify `src/ui/screens/iterbelli/CampaignResourceBar.tsx`. (Presentational — verified by tsc/build.)

- [ ] **Step 1:** Add an ammunition `ResourceDef` after the `supplies` entry:

```ts
    {
      key: 'ammunition', glyph: '➶', label: 'Munición', value: String(s.ammunition),
      tip: 'Proyectiles para hostigar en la batalla decisiva. Hostigar sin munición es casi inútil. Recárgala en ciudades aliadas.',
      alert: s.ammunition <= 0,
      warn: s.ammunition > 0 && s.ammunition < 10,
    },
```

- [ ] **Step 2:** Fix the now-stale discipline tip — replace `'Nivel táctico (I–V). Desbloquea posturas de batalla más avanzadas.'` with `'Nivel táctico (0–X). Desbloquea formaciones y órdenes más avanzadas; súbela con la instrucción de campamento.'`

- [ ] **Step 3:** `npx tsc --noEmit` clean.

- [ ] **Step 4: Commit** — `feat(iter-belli): show ammunition on the campaign resource bar (Thread C)`.

---

### Task 6: Wire campaign ammunition into the battle

**Files:** Modify `src/game/iterBelli/battle/adapter.ts`, `src/ui/screens/iterbelli/BattleModal.tsx:31`. Test: extend `adapter.test.ts`.

- [ ] **Step 1: Add a failing adapter test** (in the `army builders` describe):

```ts
  it('player seed takes ammunition from the snapshot when present', () => {
    const seed = buildPlayerSeed(
      { soldiers: 5000, initialSoldiers: 10000, morale: 7, discipline: 3, ammunition: 21 } as any,
      roster, null,
    );
    expect(seed.ammo).toBe(21);
  });
```

- [ ] **Step 2: Run — expect FAIL** (seed.ammo is the default 32).

- [ ] **Step 3: adapter.ts.**
  - In `CampaignSnapshot`, add `ammunition?: number;`.
  - In `buildPlayerSeed`, change `ammo: ammunition,` to `ammo: snap.ammunition ?? ammunition,`.

- [ ] **Step 4: BattleModal.tsx:31** — add `ammunition: cs.ammunition` to the `snap` object literal.

- [ ] **Step 5: Run — expect PASS** (`adapter.test.ts`).

- [ ] **Step 6: Commit** — `feat(battle): seed the harass budget from campaign ammunition (Thread C)`.

---

### Task 7: Full verification

- [ ] `npx tsc --noEmit` — no errors.
- [ ] `npx vitest run` — all green (engine, balance-regression, adapter, new Thread C suites). Note any balance-regression drift; the engine is symmetric, so mirror should stay ~50%.
- [ ] `npm run build` — succeeds.
- [ ] Manual note (user): on the march, the resource bar shows Munición; "Reabastecer munición" at Tarraco adds 18; in the decisive battle, skirmish/fire-missiles spend it and a dry volley reads "out of ammo!".

## Self-Review

- **Coverage:** ammunition resource (Tasks 2–5), engine teeth (Task 1), battle wiring (Task 6), persistence/migration (Task 3). Armor/fort use existing engine defaults; Hub UI deferred per the chosen scope.
- **Type consistency:** `ammunition` added to `IterBelliState` (required) + `CardEffects`/`CampaignSnapshot`/`CampaignSeed` (optional); `START.ammunition`, `BAL.DRY_HARASS_MULT`, `ITER_BELLI_SAVE_VERSION=3` defined once and reused. `migrateSave` backfills `ammunition` so `restoreIterBelli`'s required-field literal is always satisfied.
- **No codex collision:** changes avoid `EmbarkCard.tsx` and `ExercitusTab.tsx` (ammunition seeds from `START`, not the embark UI).
