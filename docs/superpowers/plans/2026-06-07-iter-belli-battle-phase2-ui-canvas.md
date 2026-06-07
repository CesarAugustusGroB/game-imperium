# Iter Belli Battle — Phase 2 (UI + Canvas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the validated battle engine (`src/game/iterBelli/battle/`) into the live game — a pre-battle deployment screen, a round-loop `BattleModal`, and the procedural Canvas renderer — replacing the old stance battle, driven by campaign state.

**Architecture:** A pure **adapter** turns campaign state (`iterBelliState` + `preparedArmy` roster + `preparedLegate` + active scenario) into engine inputs (`BattleArmy`/`BattleState` + available formations). A signals **controller** wraps `playRound`/`makeBattleState` and writes results back via the existing `applyBattleOutcome`. The Preact UI (deployment → round loop) reads the controller signal; a presentation-only `BattleCanvas` reads battle state and renders (ported from the validated prototype `docs/superpowers/mockups/battle-rework.html`). No combat math lives in the UI.

**Tech Stack:** TypeScript, Preact + `@preact/signals`, HTML5 Canvas 2D, Vitest. Built on branch `feat/battle-engine-a` (engine already present). Engine is the source of truth; this plan only adds the adapter, controller, and UI.

**Prereqs / context (read before starting):**
- Engine API: `makeBattleArmy(side, seed)`, `makeBattleState(you, enemy, center, control?)`, `playRound(S, orderKey, rng)`, `realRng`, types in `battle/types.ts`, data in `battle/orders.ts` (`ORDERS`, `FORMATIONS`, `CENTERS`, `TERRAIN_CENTER`, `ENEMY_ARCHETYPES`).
- Campaign state: `iterBelliState` signal (`src/game/iterBelli/iter-belli-state.ts`) — fields `soldiers`, `initialSoldiers`, `morale` (0–10), `discipline` (1–5 today), `spokeTerrain` (string), `fortified` (bool), `enemyWeaken` (number), `phase`. Write-back: `applyBattleOutcome(victory, survivors, finalMorale)`.
- Roster: `preparedArmy` (`ArmyData` with `cohorts: Cohort[]`, each `cohort.stats: { hp, charge, harass, push, siege, movement }`) and `preparedLegate` (`Legate` with `traitIds: string[]`) — both signals in `src/game/progression/strategic-store.ts`.
- Scenario enemy: `getActiveScenario().enemy` (`ScenarioEnemy`: name, doctrine, baseSoldiers, minSoldiers, morale, discipline) — `src/game/iterBelli/iter-belli-scenario.ts`.
- The screen mounts the battle UI at `IterBelliScreen.tsx`: `{s.phase === 'battle' && <BattleModal />}`. Battle CSS is injected there (classes `ib-bm-*`, `ib-overlay`, `ib-section-title`).
- The OLD files to be replaced/retired: `src/game/iterBelli/iter-belli-combat.ts` (stance engine) and `src/ui/screens/iterbelli/BattleModal.tsx`. Do NOT delete them until Task 9 swaps them; keep the app compiling.

---

## File Structure

- `src/game/iterBelli/battle/adapter.ts` — pure: `sumRosterStats`, `strengthFrac`, `scaleDiscipline`, `legateFormationKeys`, `terrainToCenterKey`, `buildPlayerSeed`, `buildEnemyArchetype`, `availableFormations`.
- `src/game/iterBelli/battle/controller.ts` — signals + flow: `battleSession` signal, `beginBattleSession`, `chooseFormation`, `issueOrder`, `concludeBattleSession`.
- `src/ui/screens/iterbelli/battle/DeploymentPanel.tsx` — pre-battle formation picker.
- `src/ui/screens/iterbelli/battle/ArmyStatus.tsx` — HP/morale/ammo/armor/stat readout for one army.
- `src/ui/screens/iterbelli/battle/OrderBar.tsx` — order buttons (gated) + retreat.
- `src/ui/screens/iterbelli/battle/BattleCanvas.tsx` — Canvas renderer (port of the prototype).
- `src/ui/screens/iterbelli/BattleModal.tsx` — REWRITE: orchestrates Deployment → round loop, mounts Canvas + panels + OrderBar + log.
- `src/ui/screens/iterbelli/battle/battle-fx.ts` — the imperative Canvas engine (terrain/squads/projectiles/particles) extracted so `BattleCanvas.tsx` stays a thin React-to-canvas bridge.
- Tests: `src/game/iterBelli/battle/__tests__/adapter.test.ts`, `controller.test.ts`.

---

### Task 1: Adapter — roster stat summation + strength scaling

**Files:**
- Create: `src/game/iterBelli/battle/adapter.ts`
- Test: `src/game/iterBelli/battle/__tests__/adapter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { sumRosterStats, strengthFrac, scaleDiscipline } from '../adapter';

const cohort = (o: Partial<{charge:number;harass:number;push:number;siege:number;movement:number}>) =>
  ({ id:'c', name:'c', role:'vanguard', aurumCost:0, description:'',
     stats: { hp:1000, charge:0, harass:0, push:0, siege:0, movement:0, ...o } } as any);

describe('adapter stat summation', () => {
  it('sums each power stat across the roster', () => {
    const r = sumRosterStats([cohort({push:3,charge:1}), cohort({push:2,movement:2})]);
    expect(r).toEqual({ charge:1, harass:0, push:5, siege:0, movement:2 });
  });
  it('strengthFrac clamps soldiers/initial to 0..1', () => {
    expect(strengthFrac(6000, 10000)).toBeCloseTo(0.6);
    expect(strengthFrac(12000, 10000)).toBe(1);
    expect(strengthFrac(0, 0)).toBe(0);
  });
  it('scaleDiscipline maps campaign 1..5 onto engine 0..10 (×2), clamped', () => {
    expect(scaleDiscipline(2)).toBe(4);
    expect(scaleDiscipline(5)).toBe(10);
    expect(scaleDiscipline(7)).toBe(10);
    expect(scaleDiscipline(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/adapter.test.ts`
Expected: FAIL — cannot find module `../adapter`.

- [ ] **Step 3: Implement**

```ts
import type { Cohort } from '../../army/cohort';
import type { PowerStats } from './types';

export function sumRosterStats(cohorts: readonly Cohort[]): PowerStats {
  const t: PowerStats = { charge: 0, harass: 0, push: 0, siege: 0, movement: 0 };
  for (const c of cohorts) {
    t.charge += c.stats.charge; t.harass += c.stats.harass; t.push += c.stats.push;
    t.siege += c.stats.siege; t.movement += c.stats.movement;
  }
  return t;
}

export function strengthFrac(soldiers: number, initialSoldiers: number): number {
  if (initialSoldiers <= 0) return 0;
  return Math.max(0, Math.min(1, soldiers / initialSoldiers));
}

/** STOPGAP: campaign discipline is 1–5; engine wants 0–10. ×2 until Thread B migrates the scale. */
export function scaleDiscipline(campaignDiscipline: number): number {
  return Math.max(0, Math.min(10, Math.round(campaignDiscipline * 2)));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/adapter.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/battle/adapter.ts src/game/iterBelli/battle/__tests__/adapter.test.ts
git commit -m "feat(battle): adapter — roster stat sum + strength/discipline scaling"
```

---

### Task 2: Adapter — formations from legate, terrain→center

**Files:**
- Modify: `src/game/iterBelli/battle/adapter.ts`
- Test: `src/game/iterBelli/battle/__tests__/adapter.test.ts`

Trait→formation mapping mirrors `FORMATIONS[*].trait`: `'Roman Veteran'→triplex`, `'Engineer'→testudo`, `'Shock'→cuneus`. Commons are always available. A legate's `traitIds` are lowercase ids; map them to the formation trait labels via a table.

- [ ] **Step 1: Add the failing tests (append to adapter.test.ts)**

```ts
import { legateFormationKeys, terrainToCenterKey, availableFormations } from '../adapter';
import { FORMATIONS, CENTERS } from '../orders';

describe('adapter formations + terrain', () => {
  it('commons always available; null legate → commons only', () => {
    const keys = legateFormationKeys(null);
    expect(keys).toEqual(['battleLine','openOrder','shieldWall']);
  });
  it('a veteran legate unlocks triplex', () => {
    const keys = legateFormationKeys({ traitIds:['veteran'] } as any);
    expect(keys).toContain('triplex');
  });
  it('terrain maps to a real center; unknown falls back to plain', () => {
    expect(CENTERS[terrainToCenterKey('hills')].name).toBe('Hill');
    expect(CENTERS[terrainToCenterKey('marsh')]).toBeDefined();
  });
  it('availableFormations filters by discipline req', () => {
    const keys = availableFormations({ traitIds:['veteran'] } as any, 4); // engine disc 4
    expect(keys).toContain('battleLine');     // disc 2
    expect(keys).not.toContain('triplex');    // disc 6 > 4, locked
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/adapter.test.ts`
Expected: FAIL — `legateFormationKeys` not exported.

- [ ] **Step 3: Implement (append to adapter.ts)**

```ts
import type { Legate } from '../army/legate';
import type { FormationKey } from './types';
import { FORMATIONS, TERRAIN_CENTER } from './orders';

/** Legate trait id → the FORMATIONS trait label that unlocks a unique formation. */
const TRAIT_TO_FORMATION_TRAIT: Record<string, string> = {
  veteran: 'Roman Veteran',
  engineer: 'Engineer',
  shock: 'Shock',
};

export function legateFormationKeys(legate: Legate | null): FormationKey[] {
  const unlockedTraits = new Set(
    (legate?.traitIds ?? []).map((id) => TRAIT_TO_FORMATION_TRAIT[id]).filter(Boolean) as string[],
  );
  return (Object.keys(FORMATIONS) as FormationKey[]).filter((k) => {
    const f = FORMATIONS[k];
    return f.kind === 'common' || (f.trait != null && unlockedTraits.has(f.trait));
  });
}

export function terrainToCenterKey(terrain: string): string {
  return TERRAIN_CENTER[terrain] ?? 'plain';
}

/** Formations the player can field now: from the legate AND within engine discipline. */
export function availableFormations(legate: Legate | null, engineDiscipline: number): FormationKey[] {
  return legateFormationKeys(legate).filter((k) => engineDiscipline >= FORMATIONS[k].disc);
}
```

NOTE: if `src/game/army/legate.ts` does not export a `Legate` type with `traitIds`, import the type from wherever `preparedLegate` is typed (check `strategic-store.ts`); adjust the import path accordingly and report it as a concern if the shape differs.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/adapter.test.ts`
Expected: 7 passed (3 prior + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/battle/adapter.ts src/game/iterBelli/battle/__tests__/adapter.test.ts
git commit -m "feat(battle): adapter — legate formations + terrain→center"
```

---

### Task 3: Adapter — build player seed + enemy archetype from campaign state

**Files:**
- Modify: `src/game/iterBelli/battle/adapter.ts`
- Test: `src/game/iterBelli/battle/__tests__/adapter.test.ts`

The player's HP pool = `state.soldiers`; stats = `sumRosterStats(roster) × strengthFrac` (mass stats scaled, movement NOT scaled — matches the engine spec §2.2); discipline = `scaleDiscipline(state.discipline)`; armor from `preparedArmy.armorTier` if present else Iron default; ammo from `preparedArmy.ammunition` if present else a default; morale = `state.morale`. The enemy is chosen by `scenario.enemy.archetypeKey` if present, else mapped from `scenario.enemy.doctrine`; its soldiers come from the existing threat/weaken formula; its stats scale by `enemyWeaken`.

- [ ] **Step 1: Add the failing test (append)**

```ts
import { buildPlayerSeed, buildEnemyArchetype } from '../adapter';
import { ENEMY_ARCHETYPES } from '../orders';

describe('adapter army builders', () => {
  const roster = [cohort({push:3}), cohort({push:3}), cohort({charge:2,movement:2})];
  it('player seed scales mass stats by strength, keeps movement, scales discipline', () => {
    const seed = buildPlayerSeed(
      { soldiers: 5000, initialSoldiers: 10000, morale: 7, discipline: 3 } as any,
      roster, null,
    );
    expect(seed.hp).toBe(5000);
    expect(seed.morale).toBe(7);
    expect(seed.discipline).toBe(6);          // scaleDiscipline(3)
    expect(seed.stats.push).toBe(3);          // 6 × 0.5 strength
    expect(seed.stats.movement).toBe(2);      // movement NOT scaled
  });
  it('enemy archetype scales mass stats by enemyWeaken', () => {
    const e = buildEnemyArchetype('carthage', 0, 10000); // no weaken
    expect(e.stats.charge).toBe(ENEMY_ARCHETYPES.carthage.stats.charge);
    const w = buildEnemyArchetype('carthage', 5, 10000); // 5 × 7% = 35% weaker
    expect(w.stats.charge).toBeLessThan(ENEMY_ARCHETYPES.carthage.stats.charge);
    expect(w.stats.movement).toBe(ENEMY_ARCHETYPES.carthage.stats.movement); // movement unscaled
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/adapter.test.ts`
Expected: FAIL — `buildPlayerSeed` not exported.

- [ ] **Step 3: Implement (append to adapter.ts)**

```ts
import type { ArmyData } from '../army/army';
import type { EnemyArchetype, FormationDef } from './types';
import { FORMATIONS as F2, ENEMY_ARCHETYPES, ORDERS } from './orders';
import { ARMORS } from './balance';

/** Minimal shape this adapter reads from the campaign — keeps it decoupled from the full state type. */
export interface CampaignSnapshot { soldiers: number; initialSoldiers: number; morale: number; discipline: number; }

export interface PlayerSeed {
  hp: number; morale: number; discipline: number;
  stats: PowerStats; armorPct: number; armorName: string; ammo: number;
  formation: FormationDef;
}

const ENEMY_WEAKEN_PER_POINT = 0.07; // mirrors iter-belli-balance

export function buildPlayerSeed(
  snap: CampaignSnapshot, roster: readonly Cohort[], legate: Legate | null,
  formation: FormationDef = F2.battleLine,
  armor: { material: keyof typeof ARMORS } | null = null,
  ammunition = 32,
): PlayerSeed {
  void legate; // formation chosen separately; legate gates that choice upstream
  const frac = strengthFrac(snap.soldiers, snap.initialSoldiers);
  const raw = sumRosterStats(roster);
  const material = armor?.material ?? 'iron';
  return {
    hp: Math.max(1, Math.round(snap.soldiers)),
    morale: snap.morale,
    discipline: scaleDiscipline(snap.discipline),
    stats: {
      charge: Math.round(raw.charge * frac),
      harass: Math.round(raw.harass * frac),
      push: Math.round(raw.push * frac),
      siege: Math.round(raw.siege * frac),
      movement: raw.movement, // maneuver not scaled by attrition
    },
    armorPct: ARMORS[material],
    armorName: material.charAt(0).toUpperCase() + material.slice(1),
    ammo: ammunition,
    formation,
  };
}

export function buildEnemyArchetype(key: string, enemyWeaken: number, soldiers: number): EnemyArchetype {
  const base = ENEMY_ARCHETYPES[key] ?? ENEMY_ARCHETYPES.carthage;
  const frac = Math.max(0.2, 1 - enemyWeaken * ENEMY_WEAKEN_PER_POINT);
  return {
    ...base,
    hp: Math.max(1, Math.round(soldiers)),
    stats: {
      charge: Math.round(base.stats.charge * frac),
      harass: Math.round(base.stats.harass * frac),
      push: Math.round(base.stats.push * frac),
      siege: Math.round(base.stats.siege * frac),
      movement: base.stats.movement,
    },
  };
}
```

NOTE: `preparedArmy` (`ArmyData`) may not yet have `armorTier`/`ammunition` fields (those are Thread C). The signatures above take `armor`/`ammunition` as optional params with defaults, so Phase 2 works before Thread C. If `ArmyData` import path differs, adjust and report. `ORDERS` import is only needed if you reference it — remove it if unused to keep `tsc` clean.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/adapter.test.ts`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/battle/adapter.ts src/game/iterBelli/battle/__tests__/adapter.test.ts
git commit -m "feat(battle): adapter — player seed + enemy archetype builders"
```

---

### Task 4: Battle session controller (signals wrapper)

**Files:**
- Create: `src/game/iterBelli/battle/controller.ts`
- Test: `src/game/iterBelli/battle/__tests__/controller.test.ts`

The controller owns the live battle as a signal and drives the deployment→loop→conclude flow, calling `applyBattleOutcome` on conclude. It is UI-agnostic.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { battleSession, beginBattleSession, chooseFormation, issueOrder, concludeBattleSession } from '../controller';
import { FORMATIONS, ENEMY_ARCHETYPES, CENTERS } from '../orders';

const playerSeed = () => ({
  hp:10000, morale:10, discipline:6,
  stats:{charge:10,harass:8,push:16,siege:5,movement:9},
  armorPct:20, armorName:'Iron', ammo:32, formation: FORMATIONS.battleLine,
});

describe('battle controller', () => {
  beforeEach(() => { battleSession.value = null; });
  it('begins in deployment with the given formation options', () => {
    beginBattleSession({
      playerSeedFor: (f) => ({ ...playerSeed(), formation: FORMATIONS[f] }),
      formationOptions: ['battleLine','shieldWall'],
      enemy: ENEMY_ARCHETYPES.gauls, center: CENTERS.plain,
      onConclude: () => {},
    });
    expect(battleSession.value?.phase).toBe('deployment');
    expect(battleSession.value?.formationOptions).toEqual(['battleLine','shieldWall']);
  });
  it('chooseFormation starts the fight; issueOrder advances a round', () => {
    beginBattleSession({
      playerSeedFor: (f) => ({ ...playerSeed(), formation: FORMATIONS[f] }),
      formationOptions: ['battleLine'], enemy: ENEMY_ARCHETYPES.gauls, center: CENTERS.plain,
      onConclude: () => {},
    });
    chooseFormation('battleLine');
    expect(battleSession.value?.phase).toBe('fighting');
    const before = battleSession.value!.state.round;
    issueOrder('charge');
    expect(battleSession.value!.state.round).toBe(before + 1);
  });
  it('concludeBattleSession calls onConclude with victory/survivors/morale and clears the signal', () => {
    const onConclude = vi.fn();
    beginBattleSession({
      playerSeedFor: (f) => ({ ...playerSeed(), formation: FORMATIONS[f], hp: 50, discipline: 10, stats:{charge:40,harass:8,push:20,siege:5,movement:9} }),
      formationOptions: ['battleLine'], enemy: ENEMY_ARCHETYPES.gauls, center: CENTERS.plain, onConclude,
    });
    chooseFormation('battleLine');
    let guard = 0;
    while (battleSession.value!.phase === 'fighting' && guard++ < 40) issueOrder('charge');
    concludeBattleSession();
    expect(onConclude).toHaveBeenCalledOnce();
    const arg = onConclude.mock.calls[0][0];
    expect(typeof arg.victory).toBe('boolean');
    expect(typeof arg.survivors).toBe('number');
    expect(typeof arg.finalMorale).toBe('number');
    expect(battleSession.value).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/controller.test.ts`
Expected: FAIL — cannot find module `../controller`.

- [ ] **Step 3: Implement**

```ts
import { signal } from '@preact/signals';
import type { BattleState, EnemyArchetype, CenterDef, FormationKey, OrderKey, RoundLogLine, Rng } from './types';
import type { PlayerSeed } from './adapter';
import { makeBattleArmy, makeBattleState, playRound, realRng } from './engine';

export interface ConcludeResult { victory: boolean; survivors: number; finalMorale: number; }
export interface BeginOpts {
  playerSeedFor: (formation: FormationKey) => PlayerSeed;
  formationOptions: FormationKey[];
  enemy: EnemyArchetype;
  center: CenterDef;
  onConclude: (r: ConcludeResult) => void;
  rng?: Rng;
}
export interface BattleSession {
  phase: 'deployment' | 'fighting' | 'resolved';
  formationOptions: FormationKey[];
  state: BattleState;        // valid once fighting; in deployment it is a placeholder built from the first option
  log: RoundLogLine[];
}

let OPTS: BeginOpts | null = null;
let RNG: Rng = realRng;
export const battleSession = signal<BattleSession | null>(null);

export function beginBattleSession(opts: BeginOpts): void {
  OPTS = opts; RNG = opts.rng ?? realRng;
  const seed = opts.playerSeedFor(opts.formationOptions[0]);
  const you = makeBattleArmy('you', seed);
  const enemy = makeBattleArmy('enemy', opts.enemy);
  battleSession.value = {
    phase: 'deployment',
    formationOptions: opts.formationOptions,
    state: makeBattleState(you, enemy, opts.center),
    log: [],
  };
}

export function chooseFormation(formation: FormationKey): void {
  const s = battleSession.value; if (!s || s.phase !== 'deployment' || !OPTS) return;
  const you = makeBattleArmy('you', OPTS.playerSeedFor(formation));
  const enemy = makeBattleArmy('enemy', OPTS.enemy);
  battleSession.value = { ...s, phase: 'fighting', state: makeBattleState(you, enemy, OPTS.center), log: [] };
}

export function issueOrder(order: OrderKey): void {
  const s = battleSession.value; if (!s || s.phase !== 'fighting') return;
  const lines = playRound(s.state, order, RNG);
  const phase = s.state.finished ? 'resolved' : 'fighting';
  battleSession.value = { ...s, phase, state: s.state, log: [...s.log, ...lines] };
}

export function concludeBattleSession(): void {
  const s = battleSession.value; if (!s || !OPTS) return;
  const cb = OPTS.onConclude;
  const result: ConcludeResult = {
    victory: s.state.victory === true,
    survivors: Math.max(0, Math.round(s.state.you.hp)),
    finalMorale: s.state.you.morale,
  };
  battleSession.value = null; OPTS = null;
  cb(result);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/controller.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/battle/controller.ts src/game/iterBelli/battle/__tests__/controller.test.ts
git commit -m "feat(battle): signals controller (deployment → loop → conclude)"
```

---

### Task 5: Canvas FX engine (port from prototype)

**Files:**
- Create: `src/ui/screens/iterbelli/battle/battle-fx.ts`

This is the imperative Canvas renderer. **Port it directly from the validated prototype** at `docs/superpowers/mockups/battle-rework.html` — the `<script>` section from the comment `PROCEDURAL 2D BATTLE ENGINE` through `vizLoop` (functions: `vizResize`, `vizInit`, `battleLineX`, `drawTerrain`, `bg`, `drawAmbient`, `drawStandard`, `drawSoldier`, `drawSquad`, projectiles/particles/floats, `triggerVisualEffects`, `drawLabels`, `vizLoop`, plus the `anim`/`shake`/arrays state).

Refactor for module use:
- Export a class or factory `createBattleFx(canvas: HTMLCanvasElement)` that owns the `anim`/`shake`/`projectiles`/`particles`/`floats`/`ambient` state internally (no module globals), and returns `{ resize(), start(), stop(), setState(s), triggerVisualEffects(side, orderKey), spawnDamageFloat(side, amount) }`.
- `setState(s)` receives the engine `BattleState` each frame source-of-truth (the loop reads `fx.state`); the canvas reads `state.control`, `state.center`, `state.you/enemy` (hp/maxHp/morale/stats/formation/encircled/drums), `state.lastDice`.
- The colour tokens and all drawing maths stay byte-identical to the prototype.

- [ ] **Step 1: Create the file**

Port the prototype's canvas code into a `createBattleFx` factory as described. (The prototype is the exact reference — reproduce its drawing functions and the `vizLoop` pipeline order: clear → shake → terrain → ambient → pinned → anim decay → standards → squads → projectiles → particles → floats → labels.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `battle-fx.ts` (add explicit `CanvasRenderingContext2D`/`number` types where TS needs them; the prototype was untyped JS).

- [ ] **Step 3: Commit**

```bash
git add src/ui/screens/iterbelli/battle/battle-fx.ts
git commit -m "feat(battle): canvas FX engine (ported from prototype)"
```

---

### Task 6: `BattleCanvas` Preact bridge

**Files:**
- Create: `src/ui/screens/iterbelli/battle/BattleCanvas.tsx`

Thin component: mounts a `<canvas>`, creates the FX engine on mount, starts the RAF loop, feeds it the current `BattleState` each render, and calls `triggerVisualEffects`/`spawnDamageFloat` when a new round's log arrives.

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useRef } from 'preact/hooks';
import type { BattleState, Side } from '../../../../game/iterBelli/battle/types';
import { createBattleFx } from './battle-fx';

interface Props {
  state: BattleState;
  /** Increments each round so the canvas knows to fire FX for the latest orders. */
  round: number;
  lastOrders: { you: string; enemy: string } | null;
  lastLosses: { you: number; enemy: number } | null;
}

export function BattleCanvas({ state, round, lastOrders, lastLosses }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<ReturnType<typeof createBattleFx> | null>(null);
  const lastRound = useRef(0);

  useEffect(() => {
    if (!ref.current) return;
    const fx = createBattleFx(ref.current);
    fxRef.current = fx; fx.resize(); fx.start();
    const onResize = () => fx.resize();
    addEventListener('resize', onResize);
    return () => { removeEventListener('resize', onResize); fx.stop(); };
  }, []);

  // Keep the FX engine pointed at the latest battle state.
  fxRef.current?.setState(state);

  // Fire visual effects once per new round.
  useEffect(() => {
    const fx = fxRef.current; if (!fx || round === lastRound.current) return;
    lastRound.current = round;
    if (lastOrders) { fx.triggerVisualEffects('you', lastOrders.you); fx.triggerVisualEffects('enemy', lastOrders.enemy); }
    if (lastLosses) {
      if (lastLosses.enemy > 0) fx.spawnDamageFloat('enemy' as Side, lastLosses.enemy);
      if (lastLosses.you > 0) fx.spawnDamageFloat('you' as Side, lastLosses.you);
    }
  }, [round]);

  return <canvas ref={ref} class="ib-bm-canvas" />;
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` (expect clean; `createBattleFx` signature from Task 5 must match).

- [ ] **Step 3: Commit**

```bash
git add src/ui/screens/iterbelli/battle/BattleCanvas.tsx
git commit -m "feat(battle): BattleCanvas Preact bridge"
```

---

### Task 7: Deployment, ArmyStatus, OrderBar components

**Files:**
- Create: `src/ui/screens/iterbelli/battle/DeploymentPanel.tsx`
- Create: `src/ui/screens/iterbelli/battle/ArmyStatus.tsx`
- Create: `src/ui/screens/iterbelli/battle/OrderBar.tsx`

These are presentational. They read the controller signal and call `chooseFormation` / `issueOrder`. Gating logic uses the engine data (`FORMATIONS`, `ORDERS`) and the player army's discipline/ammo/morale exactly as the prototype's deployment + order rendering did (see `docs/superpowers/mockups/battle-rework.html` `renderForms`, `ordersHTML`, `armyHTML`). Reuse existing `ib-bm-*` CSS where possible; add new classes in Task 8.

- [ ] **Step 1: Implement `DeploymentPanel.tsx`**

```tsx
import { battleSession, chooseFormation } from '../../../../game/iterBelli/battle/controller';
import { FORMATIONS } from '../../../../game/iterBelli/battle/orders';

export function DeploymentPanel() {
  const s = battleSession.value;
  if (!s || s.phase !== 'deployment') return null;
  const disc = s.state.you.discipline;
  return (
    <div class="ib-bm-deploy">
      <div class="ib-section-title">Choose your formation</div>
      <div class="ib-bm-forms">
        {s.formationOptions.map((key) => {
          const f = FORMATIONS[key];
          const locked = disc < f.disc;
          return (
            <button key={key} class={`ib-bm-form${locked ? ' locked' : ''}`} disabled={locked}
              onClick={() => chooseFormation(key)}>
              <div class="ib-bm-form-name">{f.name}</div>
              <div class="ib-bm-form-req">disc {f.disc}{f.trait ? ` · ${f.trait}` : ' · common'}</div>
              <div class="ib-bm-form-desc">{f.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `ArmyStatus.tsx`**

```tsx
import type { BattleArmy } from '../../../../game/iterBelli/battle/types';

function moraleLabel(m: number) { return m <= 0 ? 'Broken' : m < 3 ? 'Wavering' : m < 6 ? 'Shaken' : 'Steady'; }

export function ArmyStatus({ army }: { army: BattleArmy }) {
  const hpPct = Math.max(0, Math.min(100, (army.hp / army.maxHp) * 100));
  const morPct = Math.max(0, Math.min(100, (army.morale / 10) * 100));
  return (
    <div class="ib-bm-army">
      <div class="ib-bm-army-name">{army.name}</div>
      <div class="ib-bm-army-meta">{army.formation.name} · Disc {army.discipline} · Armor {army.armorName} {army.armorPct}%{army.fortPct > 0 ? ` · Fort ${army.fortPct}%` : ''}</div>
      <div class="ib-bm-stat-row"><span>Soldiers</span><span>{Math.round(army.hp).toLocaleString('en-US')} / {army.maxHp.toLocaleString('en-US')}</span></div>
      <div class="ib-bm-bar"><div class="ib-bm-bar-fill" style={{ width: `${hpPct}%` }} /></div>
      <div class="ib-bm-stat-row"><span>Morale · {moraleLabel(army.morale)}</span><span>{army.morale.toFixed(1)} / 10</span></div>
      <div class="ib-bm-bar"><div class="ib-bm-bar-fill morale" style={{ width: `${morPct}%` }} /></div>
      {army.side === 'you' && <div class="ib-bm-stat-row"><span>Ammunition</span><span>{army.ammo} / {army.maxAmmo}</span></div>}
    </div>
  );
}
```

- [ ] **Step 3: Implement `OrderBar.tsx`**

```tsx
import { battleSession, issueOrder } from '../../../../game/iterBelli/battle/controller';
import { ORDERS } from '../../../../game/iterBelli/battle/orders';
import type { OrderKey } from '../../../../game/iterBelli/battle/types';

function moraleMult(m: number) { return m <= 0 ? 0 : m < 3 ? 0.6 : m < 6 ? 0.8 : 1; }

export function OrderBar() {
  const s = battleSession.value;
  if (!s || s.phase !== 'fighting') return null;
  const you = s.state.you;
  const ms = moraleMult(you.morale);
  const keys = [...you.formation.orders, 'retreat' as OrderKey];
  return (
    <div class="ib-bm-orders">
      {keys.map((key) => {
        const o = ORDERS[key];
        const lockDisc = you.discipline < o.disc;
        const lockAmmo = !!o.ammo && you.ammo < o.ammo;
        const lockMorale = ms < 1 && (o.reckless || o.disc >= 6) && !(o.sMorale && o.sMorale > 0);
        const locked = lockDisc || lockAmmo || lockMorale;
        return (
          <button key={key} class={`ib-bm-order sub-${o.sub}`} disabled={locked} onClick={() => issueOrder(key)}>
            <div class="ib-bm-order-name">{o.name}</div>
            <div class="ib-bm-order-desc">{o.desc}</div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Type-check** — `npx tsc --noEmit` (expect clean).

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/iterbelli/battle/DeploymentPanel.tsx src/ui/screens/iterbelli/battle/ArmyStatus.tsx src/ui/screens/iterbelli/battle/OrderBar.tsx
git commit -m "feat(battle): deployment + army status + order bar components"
```

---

### Task 8: BattleModal rewrite + CSS

**Files:**
- Modify: `src/ui/screens/iterbelli/BattleModal.tsx` (full rewrite)
- Modify: `src/ui/screens/iterbelli/IterBelliScreen.tsx` (append new CSS classes to the injected `<style>`: `.ib-bm-canvas`, `.ib-bm-deploy`, `.ib-bm-forms`, `.ib-bm-form`, `.ib-bm-orders`, `.ib-bm-order`, `.sub-*`)

The modal: on mount, build deployment options + seeds from campaign state via the adapter and call `beginBattleSession`. Render deployment OR (canvas + two `ArmyStatus` + `OrderBar` + log) OR the resolved screen with a Continue button that calls `concludeBattleSession` (which writes back via `applyBattleOutcome`).

- [ ] **Step 1: Rewrite `BattleModal.tsx`**

```tsx
import { useEffect, useRef } from 'preact/hooks';
import { OrnateFrame } from '../../components/OrnateFrame';
import { playSfx } from '../../sound/sfx';
import { iterBelliState, applyBattleOutcome } from '../../../game/iterBelli/iter-belli-state';
import { getActiveScenario } from '../../../game/iterBelli/iter-belli-scenario';
import { preparedArmy, preparedLegate } from '../../../game/progression/strategic-store';
import {
  battleSession, beginBattleSession, issueOrder, concludeBattleSession,
} from '../../../game/iterBelli/battle/controller';
import {
  availableFormations, buildPlayerSeed, buildEnemyArchetype, terrainToCenterKey,
} from '../../../game/iterBelli/battle/adapter';
import { CENTERS, FORMATIONS } from '../../../game/iterBelli/battle/orders';
import { DeploymentPanel } from './battle/DeploymentPanel';
import { ArmyStatus } from './battle/ArmyStatus';
import { OrderBar } from './battle/OrderBar';
import { BattleCanvas } from './battle/BattleCanvas';

export function BattleModal() {
  const started = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (started.current || battleSession.value) return;
    started.current = true;
    const cs = iterBelliState.value;
    const roster = preparedArmy.value?.cohorts ?? [];
    const legate = preparedLegate.value;
    const scenario = getActiveScenario();
    // engine discipline drives which formations unlock
    const seed0 = buildPlayerSeed({ soldiers: cs.soldiers, initialSoldiers: cs.initialSoldiers, morale: cs.morale, discipline: cs.discipline }, roster, legate);
    const options = availableFormations(legate, seed0.discipline);
    const formationOptions = options.length ? options : ['battleLine' as const];
    // enemy soldiers reuse the campaign's threat/weaken sizing already computed for the scenario
    const enemySoldiers = Math.max(scenario.enemy.minSoldiers, Math.round(scenario.enemy.baseSoldiers * (1 - cs.enemyWeaken * 0.07)));
    const enemyKey = (scenario.enemy as { archetypeKey?: string }).archetypeKey ?? 'carthage';
    const enemy = buildEnemyArchetype(enemyKey, cs.enemyWeaken, enemySoldiers);
    if (cs.fortified) { /* player camp fortified — leave enemy fort from archetype */ }
    beginBattleSession({
      playerSeedFor: (f) => buildPlayerSeed(
        { soldiers: cs.soldiers, initialSoldiers: cs.initialSoldiers, morale: cs.morale, discipline: cs.discipline },
        roster, legate, FORMATIONS[f],
      ),
      formationOptions,
      enemy,
      center: CENTERS[terrainToCenterKey(cs.spokeTerrain)],
      onConclude: (r) => applyBattleOutcome(r.victory, r.survivors, r.finalMorale),
    });
  }, []);

  useEffect(() => {
    const el = logRef.current; if (el) el.scrollTop = el.scrollHeight;
  }, [battleSession.value?.log.length]);

  const s = battleSession.value;
  if (!s) return null;

  return (
    <div class="ib-overlay">
      <OrnateFrame width="min(960px, 96vw)" padding="compact" style={{ maxHeight: '94vh', overflow: 'auto' }}>
        {s.phase === 'deployment' ? (
          <DeploymentPanel />
        ) : (
          <>
            <BattleCanvas state={s.state} round={s.state.round} lastOrders={null} lastLosses={null} />
            <div class="ib-bm-arena">
              <ArmyStatus army={s.state.you} />
              <div class="ib-bm-round"><div class="ib-bm-round-label">Round</div><div class="ib-bm-round-num">{s.state.round}</div></div>
              <ArmyStatus army={s.state.enemy} />
            </div>
            {s.phase === 'fighting' ? (
              <OrderBar />
            ) : (
              <div class="ib-bm-stances-section" style={{ textAlign: 'center' }}>
                <div class="ib-section-title">{s.state.victory ? 'Victory in the field' : 'Defeat in the field'}</div>
                <button class="ornate-btn" style={{ marginTop: 8 }} onClick={() => { playSfx(s.state.victory ? 'victory_fanfare' : 'defeat_sting'); concludeBattleSession(); }}>Continue</button>
              </div>
            )}
            <div class="ib-bm-log" ref={logRef}>
              {s.log.map((l, i) => <div key={i} class={`ib-bm-log-line ${l.kind}`}>{l.text}</div>)}
            </div>
          </>
        )}
      </OrnateFrame>
    </div>
  );
}
```

- [ ] **Step 2: Append CSS** to the injected `<style>` in `IterBelliScreen.tsx` (after the existing `ib-bm-*` block):

```css
.ib-bm-canvas { display:block; width:100%; height:300px; background:#07050a; border:1px solid var(--imp-gold-faint); border-radius: var(--radius-sm); margin-bottom: 12px; }
.ib-bm-deploy { padding: 6px 2px 2px; }
.ib-bm-forms { display:grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap:10px; }
.ib-bm-form { text-align:left; padding:12px; border-radius:3px; cursor:pointer; background: var(--imp-panel-soft); border:1px solid var(--imp-gold-dim); border-left:3px solid var(--imp-gold); color: var(--imp-text); }
.ib-bm-form:hover:not(:disabled) { border-color: var(--imp-gold); background: var(--imp-panel-hover); }
.ib-bm-form.locked, .ib-bm-form:disabled { opacity:.4; cursor:not-allowed; }
.ib-bm-form-name { font-family: var(--imp-font-display); font-size:14px; color: var(--imp-gold-hi); }
.ib-bm-form-req { font-size:10px; letter-spacing:1px; text-transform:uppercase; color: var(--imp-text-lo); margin:2px 0 4px; }
.ib-bm-form-desc { font-size:11px; color: var(--imp-text-mid); line-height:1.35; }
.ib-bm-orders { display:grid; grid-template-columns: repeat(auto-fill, minmax(150px,1fr)); gap:8px; margin-bottom:12px; }
.ib-bm-order { text-align:left; padding:8px 10px; border-radius:3px; cursor:pointer; background: var(--imp-panel-soft); border:1px solid var(--imp-gold-dim); border-left:3px solid var(--imp-gold); color: var(--imp-text); }
.ib-bm-order:hover:not(:disabled) { border-color: var(--imp-gold); background: var(--imp-panel-hover); }
.ib-bm-order:disabled { opacity:.4; cursor:not-allowed; }
.ib-bm-order-name { font-size:12px; font-weight:700; color: var(--imp-gold-hi); }
.ib-bm-order-desc { font-size:10px; color: var(--imp-text-mid); margin-top:2px; line-height:1.3; }
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit`
Expected: clean. (If `getActiveScenario().enemy` lacks `archetypeKey`, the `as { archetypeKey?: string }` cast keeps it optional — fine.)

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/iterbelli/BattleModal.tsx src/ui/screens/iterbelli/IterBelliScreen.tsx
git commit -m "feat(battle): rewrite BattleModal for the new engine (deployment + round loop + canvas)"
```

---

### Task 9: Round-FX wiring + retire the stance engine

**Files:**
- Modify: `src/ui/screens/iterbelli/BattleModal.tsx` (pass real `lastOrders`/`lastLosses` to `BattleCanvas`)
- Modify: `src/game/iterBelli/battle/controller.ts` (expose last round's orders + losses)
- Delete: `src/game/iterBelli/iter-belli-combat.ts`, `src/ui/screens/iterbelli/BattleModal.tsx` old stance code (already replaced)
- Grep + remove any remaining imports of the old `iterBelliBattle`/`beginBattle`/`playerChoosesStance`.

- [ ] **Step 1: Extend the controller** to record the last round's orders + HP losses on the session, so the canvas can fire FX.

In `controller.ts`, add to `BattleSession`: `lastOrders: { you: OrderKey; enemy: OrderKey } | null; lastLosses: { you: number; enemy: number } | null;`. In `issueOrder`, capture `yHp`/`eHp` before `playRound`, the player order, and read the enemy's chosen order. Since `playRound` calls `enemyChoose` internally, expose it: change `playRound` is NOT modified; instead in `issueOrder` compute losses from hp deltas and set `lastOrders.you = order`; for the enemy order, re-derive via the first `head` log line is brittle — instead have `playRound` return the enemy key. **Update `engine.playRound` to return `{ log, enemyOrder }`** (small, additive) and adjust Task 4's call sites + the engine test that checks `log` (it currently treats the return as an array).

```ts
// engine.ts playRound — change the return to:
//   return { log, enemyOrder: eKey };
// and update its type. Update __tests__/engine.test.ts: `const { log } = playRound(...)`.
```

Then in `issueOrder`:
```ts
export function issueOrder(order: OrderKey): void {
  const s = battleSession.value; if (!s || s.phase !== 'fighting') return;
  const yHp = s.state.you.hp, eHp = s.state.enemy.hp;
  const { log: lines, enemyOrder } = playRound(s.state, order, RNG);
  const phase = s.state.finished ? 'resolved' : 'fighting';
  battleSession.value = {
    ...s, phase, state: s.state, log: [...s.log, ...lines],
    lastOrders: { you: order, enemy: enemyOrder },
    lastLosses: { you: yHp - s.state.you.hp, enemy: eHp - s.state.enemy.hp },
  };
}
```
(Initialise `lastOrders`/`lastLosses` to `null` in `beginBattleSession`/`chooseFormation`.)

- [ ] **Step 2: Pass them to the canvas** in `BattleModal.tsx`:
```tsx
<BattleCanvas state={s.state} round={s.state.round} lastOrders={s.lastOrders} lastLosses={s.lastLosses} />
```

- [ ] **Step 3: Retire the old engine.** Confirm nothing imports the old module:

Run: `grep -rn "iter-belli-combat\|iterBelliBattle\|playerChoosesStance" src/`
Expected: only matches inside `iter-belli-combat.ts` itself. Then delete it:
```bash
git rm src/game/iterBelli/iter-belli-combat.ts
```

- [ ] **Step 4: Full verify**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all tests pass, no type errors, production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(battle): wire round FX + retire the stance engine"
```

- [ ] **Step 6: Manual smoke test** (the only way to verify the UI/canvas)

Run `npm run dev`, start a campaign, reach the decisive battle (play the assault card), and verify: deployment screen lists formations gated by discipline; picking one starts the fight; the canvas animates (squads, terrain, projectiles, screen shake on charge, floating casualties); orders resolve rounds; the log updates; victory/defeat → Continue writes survivors+morale back to the campaign (check the endgame card numbers). Note any issues for a follow-up fix task.

---

## Phase 3 (next plans, out of scope here)
- **Thread B:** real discipline 1–5 → 0–10 migration (remove the `scaleDiscipline ×2` stopgap), drill-card progression.
- **Thread C:** ammunition resource + armor-tier on `preparedArmy` + Exercitus upgrade UI + fortification + save migration (the adapter already accepts `armor`/`ammunition` params).
- **Thread D:** author `archetypeKey` on each `ScenarioEnemy`; expand enemy archetypes.

---

## Self-review notes
- **Spec coverage:** deployment+formation gating (Tasks 7–8), round loop + orders + retreat (Tasks 4,7,8), canvas renderer (Tasks 5–6,9), campaign→engine wiring incl. strengthFrac + terrain→center + legate formations + enemy weaken (Tasks 1–3,8), write-back via `applyBattleOutcome` (Tasks 4,8). Discipline 0–10 is a documented ×2 stopgap (Task 1) pending Thread B.
- **Type consistency:** `PlayerSeed` (Task 3) is consumed by `beginBattleSession`/`playerSeedFor` (Task 4) and `BattleModal` (Task 8). `playRound` return shape changes to `{ log, enemyOrder }` in Task 9 — Task 4's call sites and the engine test are updated in the same task. `createBattleFx` API (Task 5) matches `BattleCanvas` usage (Task 6).
- **Known stopgaps (intentional, not placeholders):** discipline ×2; armor/ammo defaults until Thread C; enemy `archetypeKey` falls back to `'carthage'` until Thread D.
- **Testability:** adapter + controller are unit-tested (pure/signals). The Canvas + Preact rendering is verified by `tsc` + `npm run build` + the Task 9 manual smoke test — UI rendering is not unit-tested by design.
