# Iter Belli Battle Engine (Thread A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, fully-tested combat engine for the reworked Iter Belli decisive battle (formations → orders → additive power stats), with **fixed stats** — no roster summation, no campaign wiring yet.

**Architecture:** A self-contained `src/game/iterBelli/battle/` module. Pure data (`orders.ts`), pure resolver functions that mutate a passed `BattleState` (`resolver.ts`), pure enemy AI (`enemy-ai.ts`), and a thin round orchestrator that injects RNG for determinism (`engine.ts`). All logic is DOM-free and unit-tested. The Preact `BattleModal` rewrite + Canvas renderer are **Phase 2** (a separate plan) that consumes this engine.

**Tech Stack:** TypeScript (strict), Vitest (new), @preact/signals (later, Phase 2). Source of truth for all logic & tuned values: the validated prototype `docs/superpowers/mockups/battle-rework.html` and spec `docs/superpowers/specs/2026-06-07-iter-belli-battle-rework-design.md`.

**Branch:** Work on a feature branch off the current worktree branch (e.g. `feat/battle-engine-a`) to avoid clobbering concurrent WIP. Do NOT touch the existing `iter-belli-combat.ts` / `BattleModal.tsx` in this thread — the new module lives beside them; the swap happens in Phase 2.

---

## File Structure

- `src/game/iterBelli/battle/types.ts` — `PowerStats`, `OrderKey`, `OrderDef`, `FormationKey`, `FormationDef`, `CenterDef`, `EnemyArchetype`, `BattleArmy`, `BattleState`, `RoundLogLine`, `Rng`.
- `src/game/iterBelli/battle/balance.ts` — the `BAL` constants block + `ARMORS` + `FORTS`.
- `src/game/iterBelli/battle/orders.ts` — `ORDERS`, `FORMATIONS`, `CENTERS`, `TERRAIN_CENTER`, `ENEMY_ARCHETYPES`.
- `src/game/iterBelli/battle/resolver.ts` — `centerTier`, `mitigate`, `resolveOrder`, `resolveCenter`, `applyMorale`, `checkEnd`.
- `src/game/iterBelli/battle/enemy-ai.ts` — `enemyChoose`.
- `src/game/iterBelli/battle/engine.ts` — `makeBattleArmy`, `makeBattleState`, `playRound`.
- `src/game/iterBelli/battle/__tests__/*.test.ts` — Vitest suites.
- `vitest.config.ts` (root), `package.json` (add `test` script + devDep).

---

### Task 1: Test runner setup (Vitest)

**Files:**
- Modify: `package.json` (add devDep + script)
- Create: `vitest.config.ts`
- Create: `src/game/iterBelli/battle/__tests__/smoke.test.ts`

- [ ] **Step 1: Install Vitest**

Run: `npm i -D vitest@^2`
Expected: `vitest` added to devDependencies, no peer-dep errors.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add the test script to `package.json`**

In `"scripts"`, add: `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 4: Write a smoke test**

```ts
import { describe, it, expect } from 'vitest';
describe('vitest', () => { it('runs', () => { expect(1 + 1).toBe(2); }); });
```

- [ ] **Step 5: Run it**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/smoke.test.ts`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/game/iterBelli/battle/__tests__/smoke.test.ts
git commit -m "test: add vitest runner"
```

---

### Task 2: Battle types

**Files:**
- Create: `src/game/iterBelli/battle/types.ts`

- [ ] **Step 1: Write the types**

```ts
/** The five additive power stats summed across an army's roster. */
export interface PowerStats {
  charge: number; harass: number; push: number; siege: number; movement: number;
}
export type StatKey = keyof PowerStats;
export type Subsystem = 'push' | 'harass' | 'charge' | 'siege' | 'move' | 'moral';

export type OrderKey =
  | 'advance' | 'holdLine' | 'charge' | 'skirmish' | 'siege'
  | 'envelop' | 'flank' | 'drums' | 'taunt' | 'rally'
  | 'warCry' | 'fireMissiles' | 'hitRun' | 'wedge' | 'allOut'
  | 'lineRelief' | 'retreat';

export interface OrderDef {
  name: string;
  sub: Subsystem;
  stat?: StatKey;
  mult?: number;
  disc: number;
  /** Damage to enemy morale (routed through applyMorale, discipline-resisted). */
  eMorale?: number;
  /** Change to own morale (applied directly; negative = reckless self-cost). */
  sMorale?: number;
  ammo?: number;
  push?: number;          // center-move weight (push orders only)
  defensive?: boolean;    // braces vs charge
  protect?: number;       // casualty-morale reduction when bracing
  pierce?: boolean;       // ignores armor + fortification (siege)
  pierceBrace?: boolean;  // ignores the defensive brace (wedge)
  breakCenter?: boolean;  // seizes the center on a landing hit (wedge)
  reckless?: boolean;     // bold order, locked when shaken
  allIn?: boolean;        // amplified recoil
  drums?: boolean;        // sets sustained drums
  refresh?: boolean;      // line relief: +morale + incoming-damage cut
  wedge?: boolean;        // log/animation flavor
  check?: number;         // movement skill-check threshold
  effect?: 'encircle' | 'flank' | 'hitrun' | 'retreat';
  desc: string;
}

export type FormationKey =
  | 'battleLine' | 'openOrder' | 'shieldWall' | 'triplex' | 'testudo' | 'cuneus';

export interface FormationDef {
  name: string;
  kind: 'common' | 'unique';
  disc: number;
  trait: string | null;
  antiMissile?: boolean;
  orders: OrderKey[];
  desc: string;
}

export interface CenterDef {
  name: string;
  terrain: string;
  desc: string;
  dmg?: number;                 // +damage to holder
  chargeBonus?: number;         // +charge to holder
  enemyChargePenalty?: number;  // −charge to the holder's attacker
  moraleRegen?: number;         // +morale/round to holder
}

export interface EnemyArchetype {
  name: string;
  formation: FormationKey;
  hp: number; morale: number; disc: number;
  stats: PowerStats;
  armorPct: number; armorName: string;
  ammo: number;
  fortPct: number; fortName?: string;
  desc: string;
}

export type Side = 'you' | 'enemy';

export interface BattleArmy {
  name: string;
  side: Side;
  hp: number; maxHp: number;
  morale: number;
  discipline: number;
  stats: PowerStats;
  armorPct: number; armorName: string;
  fortPct: number; fortName: string | null;
  ammo: number; maxAmmo: number;
  formation: FormationDef;
  encircled: boolean; encircleTurns: number;
  drums: number;
  guardMult: number;       // per-round incoming-damage multiplier (hit&run / relief)
  defendedLast: boolean;
  retreated: boolean;
  strengthPct: number;     // display only in Thread A
}

export interface DieData { raw: number; faces: number; bonus: number; }

export interface BattleState {
  you: BattleArmy;
  enemy: BattleArmy;
  round: number;
  control: number;         // −100..+100
  center: CenterDef;
  finished: boolean;
  victory: boolean | null;
  endMsg: string;
  lastDice: { you: DieData | null; enemy: DieData | null };
}

export type RoundLogLine = { text: string; kind: '' | 'head' | 'you' | 'en' | 'mor' | 'crit' | 'out' };

/** Injectable dice so rounds are deterministic in tests. */
export interface Rng { rollDie(faces: number): number; }
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/game/iterBelli/battle/types.ts
git commit -m "feat(battle): add battle engine types"
```

---

### Task 3: Balance constants

**Files:**
- Create: `src/game/iterBelli/battle/balance.ts`
- Test: `src/game/iterBelli/battle/__tests__/balance.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { BAL, ARMORS, FORTS } from '../balance';

describe('balance constants', () => {
  it('exposes the tuned battle knobs', () => {
    expect(BAL.DMG_SCALE).toBe(17);
    expect(BAL.MORALE_RESIST).toBeCloseTo(0.05);
    expect(BAL.MAX_ROUNDS).toBe(14);
  });
  it('has the armor + fort ladders', () => {
    expect(ARMORS.iron).toBe(20);
    expect(FORTS.wall).toBe(35);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/balance.test.ts`
Expected: FAIL — cannot find module `../balance`.

- [ ] **Step 3: Implement**

```ts
export const BAL = {
  DMG_SCALE:     17,
  RECOIL_SCALE:  26,
  CENTER_MOVE:   0.55,
  START_MORALE:  10,
  MORALE_K:      10,
  MORALE_RESIST: 0.05,
  DISC_DMG:      0.05,
  MAX_ROUNDS:    14,
} as const;

/** Armor material → physical mitigation %. */
export const ARMORS = { copper: 5, bronze: 12, iron: 20, steel: 30 } as const;
/** Fortification tier → non-siege mitigation % (defender). */
export const FORTS = { camp: 10, palisade: 20, wall: 35, fortress: 50 } as const;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/balance.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/battle/balance.ts src/game/iterBelli/battle/__tests__/balance.test.ts
git commit -m "feat(battle): add tuned balance constants"
```

---

### Task 4: Orders, formations, centers, enemy archetypes (data)

**Files:**
- Create: `src/game/iterBelli/battle/orders.ts`
- Test: `src/game/iterBelli/battle/__tests__/orders.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { ORDERS, FORMATIONS, CENTERS, TERRAIN_CENTER, ENEMY_ARCHETYPES } from '../orders';

describe('battle data', () => {
  it('every formation references real orders', () => {
    for (const f of Object.values(FORMATIONS))
      for (const k of f.orders) expect(ORDERS[k], `missing order ${k}`).toBeDefined();
  });
  it('maps terrains to real centers', () => {
    for (const c of Object.values(TERRAIN_CENTER)) expect(CENTERS[c]).toBeDefined();
  });
  it('every enemy archetype names a real formation', () => {
    for (const e of Object.values(ENEMY_ARCHETYPES)) expect(FORMATIONS[e.formation]).toBeDefined();
  });
  it('tuned values match the prototype', () => {
    expect(ORDERS.siege.mult).toBe(1.45);
    expect(ORDERS.holdLine.protect).toBeCloseTo(0.38);
    expect(ORDERS.envelop.check).toBe(12);
    expect(FORMATIONS.triplex.disc).toBe(6);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/orders.test.ts`
Expected: FAIL — cannot find module `../orders`.

- [ ] **Step 3: Implement (port the validated catalog from the prototype)**

```ts
import type { OrderDef, OrderKey, FormationDef, FormationKey, CenterDef, EnemyArchetype } from './types';
import { ARMORS } from './balance';

export const ORDERS: Record<OrderKey, OrderDef> = {
  advance:    { name:'Advance', sub:'push', stat:'push', mult:0.55, disc:2, push:22,
                desc:'Steady push. Gains ground toward the center; low, safe damage.' },
  holdLine:   { name:'Hold the Line', sub:'push', stat:'push', mult:0.30, disc:2, push:14, defensive:true, protect:0.38,
                desc:'Defensive brace. Halts the enemy charge and protects your morale.' },
  charge:     { name:'Charge', sub:'charge', stat:'charge', mult:1.05, disc:2, eMorale:1,
                desc:'Impact + recoil. Big burst but you take a return blow; breaks morale.' },
  skirmish:   { name:'Skirmish', sub:'harass', stat:'harass', mult:0.85, disc:2, ammo:9, eMorale:0.4,
                desc:'Safe ranged damage. Costs ammo, blunted by armor, does not push the center.' },
  siege:      { name:'Siege Assault', sub:'siege', stat:'siege', mult:1.45, disc:4, pierce:true, eMorale:0.7,
                desc:'Pierces armor and fortification. The answer to an armored/entrenched foe.' },
  envelop:    { name:'Envelopment', sub:'move', stat:'movement', mult:1.1, disc:6, check:12, eMorale:1.0, effect:'encircle',
                desc:'Check (die+movement ≥ 12). Success: encircles the enemy (~2 rounds) + high damage.' },
  flank:      { name:'Flank', sub:'move', stat:'movement', mult:0.7, disc:5, check:9, effect:'flank',
                desc:'Check (die+movement ≥ 9). Crit (×2.5) if the enemy holds the center.' },
  drums:      { name:'War Drums', sub:'moral', disc:3, sMorale:1.6, drums:true,
                desc:'Raises your morale steadily (scales with discipline), no damage.' },
  taunt:      { name:'Taunt', sub:'moral', disc:3, eMorale:1.0, mult:0.05, stat:'harass',
                desc:'Hits enemy morale directly, almost no physical damage.' },
  rally:      { name:'Rally', sub:'moral', disc:2, sMorale:2.6,
                desc:'Recovers strong morale; you forgo the offensive round.' },
  warCry:     { name:'War Cry', sub:'push', stat:'push', mult:0.35, disc:3, push:16, eMorale:0.85, sMorale:0.5,
                desc:'Push with a roar. Gains some ground and hits enemy morale.' },
  fireMissiles:{ name:'Fire Missiles', sub:'harass', stat:'harass', mult:0.8, disc:4, ammo:14, eMorale:1.4,
                desc:'Incendiary volleys. Safe damage + terror. Burns more ammo.' },
  hitRun:     { name:'Hit and Run', sub:'move', stat:'movement', mult:0.65, disc:4, check:9, effect:'hitrun', eMorale:0.5,
                desc:'Check. Strike and withdraw: damage and you avoid nearly all incoming damage. Cedes center.' },
  wedge:      { name:'Wedge (Caput Porci)', sub:'charge', stat:'charge', mult:1.35, disc:5, eMorale:1.5, pierceBrace:true, breakCenter:true, wedge:true,
                desc:'Pierces the shield wall (ignores the brace) and, on a hit, seizes the center.' },
  allOut:     { name:'All-Out Charge', sub:'charge', stat:'charge', mult:2.2, disc:6, eMorale:2.5, sMorale:-3, reckless:true, allIn:true,
                desc:'The total gamble. Devastating impact and shock; if braced or you roll low, the recoil wrecks you.' },
  lineRelief: { name:'Line Relief', sub:'moral', disc:6, sMorale:1.5, refresh:true,
                desc:'Fresh troops to the front: +morale and you take less damage this round.' },
  retreat:    { name:'Retreat', sub:'move', stat:'movement', disc:1, check:11, effect:'retreat',
                desc:'Movement check (+6 if encircled). Break off: a fast army escapes; slow/ringed ones get caught.' },
};

export const FORMATIONS: Record<FormationKey, FormationDef> = {
  battleLine: { name:'Battle Line', kind:'common', disc:2, trait:null,
    desc:'Balanced. The reliable default.', orders:['advance','charge','skirmish','holdLine','rally'] },
  openOrder:  { name:'Open Order', kind:'common', disc:2, trait:null,
    desc:'Light, mobile skirmish. Cedes the center.', orders:['skirmish','fireMissiles','hitRun','flank','charge','rally'] },
  shieldWall: { name:'Shield Wall', kind:'common', disc:3, trait:null,
    desc:'Defensive and morale-driven.', orders:['holdLine','warCry','drums','taunt','advance','rally'] },
  triplex:    { name:'Triplex Acies', kind:'unique', disc:6, trait:'Roman Veteran',
    desc:'The full manipular machine.', orders:['advance','charge','holdLine','lineRelief','envelop','rally'] },
  testudo:    { name:'Testudo', kind:'unique', disc:5, trait:'Engineer', antiMissile:true,
    desc:'Tortoise fortress. Immune to skirmishing.', orders:['holdLine','advance','siege','rally'] },
  cuneus:     { name:'Cuneus (Wedge)', kind:'unique', disc:5, trait:'Shock',
    desc:'Heavy shock breakthrough.', orders:['charge','wedge','allOut','flank','advance','rally'] },
};

export const CENTERS: Record<string, CenterDef> = {
  hill:  { name:'Hill', terrain:'hills', desc:'+15% damage to whoever holds it', dmg:0.15 },
  ford:  { name:'River Ford', terrain:'river', desc:'−25% enemy charge', enemyChargePenalty:0.25 },
  camp:  { name:'Camp', terrain:'settlement', desc:'+0.8 morale/round to the holder', moraleRegen:0.8 },
  plain: { name:'Open Plain', terrain:'plains', desc:'+25% charge to the holder', chargeBonus:0.25 },
};
export const TERRAIN_CENTER: Record<string, string> = {
  plains:'plain', hills:'hill', river:'ford', settlement:'camp', forest:'hill',
};

export const ENEMY_ARCHETYPES: Record<string, EnemyArchetype> = {
  carthage:  { name:'Carthaginian Host', formation:'cuneus', hp:10000, morale:10, disc:6,
    stats:{charge:15,harass:9,push:12,siege:5,movement:12}, armorPct:ARMORS.bronze, armorName:'Bronze', ammo:26, fortPct:15, fortName:'Camp',
    desc:'Cavalry & elephants — high charge and mobility, entrenched.' },
  gauls:     { name:'Gallic Warband', formation:'openOrder', hp:11000, morale:10, disc:3,
    stats:{charge:20,harass:4,push:8,siege:2,movement:9}, armorPct:ARMORS.copper, armorName:'Copper', ammo:14, fortPct:0,
    desc:'Furious chargers, no discipline, no armor.' },
  iberians:  { name:'Iberian Caetrati', formation:'openOrder', hp:9000, morale:10, disc:5,
    stats:{charge:8,harass:16,push:6,siege:3,movement:16}, armorPct:ARMORS.copper, armorName:'Copper', ammo:42, fortPct:0,
    desc:'Light skirmishers & kiters.' },
  garrison:  { name:'Fortified Garrison', formation:'shieldWall', hp:9000, morale:10, disc:6,
    stats:{charge:4,harass:8,push:18,siege:6,movement:5}, armorPct:ARMORS.steel, armorName:'Steel', ammo:30, fortPct:35, fortName:'Wall',
    desc:'Steel wall behind ramparts. Bring siege.' },
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/orders.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/battle/orders.ts src/game/iterBelli/battle/__tests__/orders.test.ts
git commit -m "feat(battle): add orders/formations/centers/enemy data"
```

---

### Task 5: `centerTier` + `mitigate`

**Files:**
- Create: `src/game/iterBelli/battle/resolver.ts`
- Test: `src/game/iterBelli/battle/__tests__/resolver-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { centerTier, mitigate } from '../resolver';
import type { BattleArmy } from '../types';

const army = (over: Partial<BattleArmy> = {}): BattleArmy => ({
  name:'x', side:'enemy', hp:10000, maxHp:10000, morale:10, discipline:6,
  stats:{charge:10,harass:8,push:16,siege:5,movement:9}, armorPct:20, armorName:'Iron',
  fortPct:0, fortName:null, ammo:32, maxAmmo:32,
  formation:{name:'',kind:'common',disc:2,trait:null,orders:[],desc:''},
  encircled:false, encircleTurns:0, drums:0, guardMult:1, defendedLast:false, retreated:false, strengthPct:100, ...over,
});

describe('centerTier', () => {
  it('grows by control band, capped at +3', () => {
    expect(centerTier(0,'you')).toBe(0);
    expect(centerTier(30,'you')).toBe(1);
    expect(centerTier(60,'you')).toBe(2);
    expect(centerTier(80,'you')).toBe(3);
    expect(centerTier(-80,'you')).toBe(0);
    expect(centerTier(-80,'enemy')).toBe(3);
  });
});
describe('mitigate', () => {
  it('applies armor + fort, but siege pierces both', () => {
    const d = army({ armorPct:20, fortPct:35 });
    expect(mitigate(1000, d, { pierce:true } as any)).toBe(1000);
    expect(mitigate(1000, d, {} as any)).toBeCloseTo(1000*0.8*0.65, 5);
  });
  it('applies the round guard multiplier (hit & run / relief)', () => {
    const d = army({ armorPct:0, guardMult:0.25 });
    expect(mitigate(1000, d, {} as any)).toBeCloseTo(250, 5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/resolver-helpers.test.ts`
Expected: FAIL — cannot find module `../resolver`.

- [ ] **Step 3: Implement (start `resolver.ts`)**

```ts
import type { BattleArmy, BattleState, OrderDef, OrderKey, Side, RoundLogLine } from './types';
import { ORDERS } from './orders';
import { BAL } from './balance';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function centerTier(control: number, side: Side): number {
  const c = side === 'you' ? control : -control;
  if (c < 25) return 0;
  if (c < 50) return 1;
  if (c < 75) return 2;
  return 3;
}

export function mitigate(raw: number, def: BattleArmy, o: Partial<OrderDef>): number {
  let m = raw;
  if (!(o && o.pierce)) {
    m *= (1 - def.armorPct / 100);
    if (def.fortPct > 0) m *= (1 - def.fortPct / 100);
  }
  m *= (def.guardMult ?? 1);
  return m;
}

export function moraleMult(m: number): number {
  if (m <= 0) return 0;
  if (m < 3) return 0.6;
  if (m < 6) return 0.8;
  return 1.0;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/resolver-helpers.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/battle/resolver.ts src/game/iterBelli/battle/__tests__/resolver-helpers.test.ts
git commit -m "feat(battle): centerTier + mitigate + moraleMult"
```

---

### Task 6: `resolveOrder` — push, harass, siege

**Files:**
- Modify: `src/game/iterBelli/battle/resolver.ts`
- Test: `src/game/iterBelli/battle/__tests__/resolve-order-basic.test.ts`

`resolveOrder(state, att, def, order, die, defOrder)` mutates `def.hp`/`att`/`state`, returns `{ eMoraleHit, log }`. Morale hits are NOT applied here (routed via `applyMorale`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { resolveOrder } from '../resolver';
import { ORDERS, CENTERS } from '../orders';
import type { BattleArmy, BattleState } from '../types';

const mkArmy = (side:'you'|'enemy', over:Partial<BattleArmy>={}):BattleArmy => ({
  name:side, side, hp:10000, maxHp:10000, morale:10, discipline:6,
  stats:{charge:10,harass:8,push:16,siege:5,movement:9}, armorPct:0, armorName:'-',
  fortPct:0, fortName:null, ammo:32, maxAmmo:32,
  formation:{name:'',kind:'common',disc:2,trait:null,orders:[],desc:''},
  encircled:false, encircleTurns:0, drums:0, guardMult:1, defendedLast:false, retreated:false, strengthPct:100, ...over,
});
const mkState = (you:BattleArmy, enemy:BattleArmy, control=0):BattleState => ({
  you, enemy, round:0, control, center:CENTERS.plain, finished:false, victory:null, endMsg:'',
  lastDice:{you:null,enemy:null},
});

describe('resolveOrder basic subsystems', () => {
  it('push deals damage and reports no morale by default', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    const r = resolveOrder(s, you, enemy, ORDERS.advance, 4, ORDERS.holdLine);
    expect(enemy.hp).toBeLessThan(10000);
    expect(r.eMoraleHit).toBe(0);
  });
  it('skirmish spends ammo and is blunted by armor', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy',{armorPct:30}); const s=mkState(you,enemy);
    const before = enemy.hp;
    resolveOrder(s, you, enemy, ORDERS.skirmish, 4, ORDERS.advance);
    expect(you.ammo).toBe(32 - 9);
    expect(before - enemy.hp).toBeLessThan( (before - mkArmy('enemy').hp) ); // armor reduced it vs unarmored baseline is implicit
  });
  it('testudo absorbs missiles', () => {
    const you=mkArmy('you'); const enemy=mkArmy('enemy');
    enemy.formation = { ...enemy.formation, antiMissile:true };
    const s=mkState(you,enemy); const before=enemy.hp;
    resolveOrder(s, you, enemy, ORDERS.skirmish, 6, ORDERS.advance);
    expect(before - enemy.hp).toBeLessThan(200); // heavily reduced
  });
  it('siege ignores armor and fortification', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy',{armorPct:30, fortPct:35}); const s=mkState(you,enemy);
    const before = enemy.hp;
    resolveOrder(s, you, enemy, ORDERS.siege, 4, ORDERS.advance);
    // siege dmg == raw (no mitigation): siegeStat 5 * die 4 * 1.45 * discBonus 1.3 * ms 1 * DMG_SCALE 17
    expect(before - enemy.hp).toBeCloseTo(5*4*1.45*1.3*1*17, 0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/resolve-order-basic.test.ts`
Expected: FAIL — `resolveOrder` not exported.

- [ ] **Step 3: Implement (append to `resolver.ts`)**

```ts
export interface OrderResult { eMoraleHit: number; log: RoundLogLine[]; }

export function resolveOrder(
  S: BattleState, att: BattleArmy, def: BattleArmy, o: OrderDef, die: number, defO: OrderDef,
): OrderResult {
  const cls: RoundLogLine['kind'] = att.side === 'you' ? 'you' : 'en';
  const who = att.side === 'you' ? 'You' : 'Enemy';
  const tgt = att.side === 'you' ? 'the enemy' : 'your legion';
  const log: RoundLogLine[] = [];
  let eMoraleHit = o.eMorale ?? 0;
  const discBonus = 1 + att.discipline * BAL.DISC_DMG;
  const ms = moraleMult(att.morale);
  const attHasCenter = controllerOf(S) === att.side;
  const centerDmgBonus = (attHasCenter && S.center.dmg) ? S.center.dmg : 0;
  const statVal = o.stat ? att.stats[o.stat] : 0;

  // pure morale orders (drums / rally / line relief / taunt)
  if (o.sub === 'moral' && !o.mult) {
    if (o.drums) { att.drums = 3; log.push({ text:`${who} sound the war drums.`, kind:'mor' }); }
    else if (o.refresh) { att.morale = clamp(att.morale + (o.sMorale ?? 0), 0, 10); att.guardMult = 0.5; log.push({ text:`${who} relieve the line — fresh troops forward.`, kind:'mor' }); }
    else if (o.sMorale) { att.morale = clamp(att.morale + o.sMorale, 0, 10); log.push({ text:`${who} rally the line.`, kind:'mor' }); }
    if (eMoraleHit) log.push({ text:`${who} taunt the enemy.`, kind:'mor' });
    return { eMoraleHit, log };
  }

  if (o.sub === 'harass') {
    att.ammo = Math.max(0, att.ammo - (o.ammo ?? 0));
    let dmg = mitigate(statVal * die * (o.mult ?? 0) * discBonus * ms * BAL.DMG_SCALE, def, o);
    if (def.formation.antiMissile) { dmg *= 0.12; eMoraleHit *= 0.3; }
    def.hp = Math.max(0, def.hp - dmg);
    log.push({ text:`${who} harass ${tgt} for ${Math.round(dmg)} (ammo ${att.ammo}).`, kind: cls });
    return { eMoraleHit, log };
  }

  if (o.sub === 'siege') {
    let dmg = statVal * die * (o.mult ?? 0) * discBonus * ms * (1 + centerDmgBonus) * BAL.DMG_SCALE;
    dmg *= (def.guardMult ?? 1);
    def.hp = Math.max(0, def.hp - dmg);
    log.push({ text:`${who} storm with siege for ${Math.round(dmg)} (pierces armor & fort).`, kind: cls });
    return { eMoraleHit, log };
  }

  if (o.sub === 'push') {
    const dmg = mitigate(statVal * die * (o.mult ?? 0) * discBonus * ms * (1 + centerDmgBonus) * BAL.DMG_SCALE, def, o);
    def.hp = Math.max(0, def.hp - dmg);
    if (o.sMorale) att.morale = clamp(att.morale + o.sMorale, 0, 10);
    log.push({ text:`${who} ${o.defensive ? 'hold the line' : 'advance'} for ${Math.round(dmg)}.`, kind: cls });
    return { eMoraleHit, log };
  }

  // charge + move handled in later tasks
  return chargeAndMove(S, att, def, o, die, defO, { cls, who, tgt, log, eMoraleHit, discBonus, ms, attHasCenter, centerDmgBonus, statVal });
}

export function controllerOf(S: BattleState): Side | null {
  if (S.control >= 25) return 'you';
  if (S.control <= -25) return 'enemy';
  return null;
}

// placeholder filled in Tasks 7–8
function chargeAndMove(_S: BattleState, _att: BattleArmy, _def: BattleArmy, _o: OrderDef, _die: number, _defO: OrderDef, ctx: any): OrderResult {
  return { eMoraleHit: ctx.eMoraleHit, log: ctx.log };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/resolve-order-basic.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/battle/resolver.ts src/game/iterBelli/battle/__tests__/resolve-order-basic.test.ts
git commit -m "feat(battle): resolveOrder — push/harass/siege"
```

---

### Task 7: `resolveOrder` — charge (impact + recoil, brace, wedge, all-out)

**Files:**
- Modify: `src/game/iterBelli/battle/resolver.ts`
- Test: `src/game/iterBelli/battle/__tests__/resolve-charge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { resolveOrder } from '../resolver';
import { ORDERS, CENTERS } from '../orders';
import type { BattleArmy, BattleState } from '../types';
// reuse mkArmy/mkState helpers (copy from resolve-order-basic.test.ts)
const mkArmy = (side:'you'|'enemy', over:Partial<BattleArmy>={}):BattleArmy => ({
  name:side, side, hp:10000, maxHp:10000, morale:10, discipline:6,
  stats:{charge:10,harass:8,push:16,siege:5,movement:9}, armorPct:0, armorName:'-',
  fortPct:0, fortName:null, ammo:32, maxAmmo:32,
  formation:{name:'',kind:'common',disc:2,trait:null,orders:[],desc:''},
  encircled:false, encircleTurns:0, drums:0, guardMult:1, defendedLast:false, retreated:false, strengthPct:100, ...over,
});
const mkState = (you:BattleArmy, enemy:BattleArmy, control=0):BattleState => ({
  you, enemy, round:0, control, center:CENTERS.plain, finished:false, victory:null, endMsg:'',
  lastDice:{you:null,enemy:null},
});

describe('charge', () => {
  it('deals impact and inflicts recoil on the attacker', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    resolveOrder(s, you, enemy, ORDERS.charge, 5, ORDERS.advance);
    expect(enemy.hp).toBeLessThan(10000);   // impact
    expect(you.hp).toBeLessThan(10000);     // recoil
  });
  it('a braced defender amplifies recoil and cuts impact', () => {
    const a=mkArmy('you'), bracedDef=mkArmy('enemy'); const s1=mkState(a,bracedDef);
    resolveOrder(s1, a, bracedDef, ORDERS.charge, 5, ORDERS.holdLine);
    const openA=mkArmy('you'), openDef=mkArmy('enemy'); const s2=mkState(openA,openDef);
    resolveOrder(s2, openA, openDef, ORDERS.charge, 5, ORDERS.advance);
    expect(10000-bracedDef.hp).toBeLessThan(10000-openDef.hp); // braced took less
    expect(10000-a.hp).toBeGreaterThan(10000-openA.hp);        // attacker took more recoil
  });
  it('the wedge ignores the brace and can seize the center', () => {
    const a=mkArmy('you'), def=mkArmy('enemy'); const s=mkState(a,def,0);
    resolveOrder(s, a, def, ORDERS.wedge, 6, ORDERS.holdLine);
    expect(s.control).toBeGreaterThan(0); // seized toward you
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/resolve-charge.test.ts`
Expected: FAIL — braced/open assertions fail (placeholder does nothing).

- [ ] **Step 3: Implement — replace the `chargeAndMove` placeholder with the charge branch**

```ts
function chargeAndMove(
  S: BattleState, att: BattleArmy, def: BattleArmy, o: OrderDef, die: number, defO: OrderDef, ctx: any,
): OrderResult {
  const { cls, who, tgt, log, discBonus, ms, attHasCenter, centerDmgBonus, statVal } = ctx;
  let eMoraleHit = ctx.eMoraleHit as number;

  if (o.sub === 'charge') {
    let impactMult = o.mult ?? 0;
    let recoilMult = 0.55;
    const defBraced = defO && defO.defensive;
    if (defBraced && !o.pierceBrace) { impactMult *= 0.6; recoilMult = 1.8; }
    if (o.allIn) recoilMult *= 1.5;
    if (S.center.chargeBonus && attHasCenter) impactMult *= (1 + S.center.chargeBonus);
    if (S.center.enemyChargePenalty && controllerOf(S) === def.side) impactMult *= (1 - S.center.enemyChargePenalty);
    const impact = mitigate(statVal * die * impactMult * discBonus * ms * (1 + centerDmgBonus) * BAL.DMG_SCALE, def, o);
    def.hp = Math.max(0, def.hp - impact);
    const exposure = 1 + Math.max(0, 7 - die) / 10;
    const recoil = mitigate(def.stats.push * recoilMult * exposure * BAL.RECOIL_SCALE, att, {});
    att.hp = Math.max(0, att.hp - recoil);
    eMoraleHit += impact > recoil ? 0.6 : -0.2;
    if (o.sMorale) att.morale = clamp(att.morale + o.sMorale, 0, 10);
    if (o.breakCenter && impact > recoil) S.control = clamp(S.control + (att.side === 'you' ? 1 : -1) * 32, -100, 100);
    const verdict = impact > recoil ? 'the charge lands' : (defBraced && !o.pierceBrace ? 'the defense halts it' : 'even exchange');
    log.push({ text:`${who} ${o.wedge ? 'drive the wedge' : 'charge'} → impact ${Math.round(impact)} / recoil ${Math.round(recoil)} — ${verdict}.`, kind: cls });
    return { eMoraleHit: Math.max(0, eMoraleHit), log };
  }

  // move handled in Task 8
  return resolveMove(S, att, def, o, die, ctx, eMoraleHit);
}

function resolveMove(_S: BattleState, _att: BattleArmy, _def: BattleArmy, _o: OrderDef, _die: number, ctx: any, eMoraleHit: number): OrderResult {
  return { eMoraleHit, log: ctx.log };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/resolve-charge.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/battle/resolver.ts src/game/iterBelli/battle/__tests__/resolve-charge.test.ts
git commit -m "feat(battle): resolveOrder — charge impact/recoil/wedge"
```

---

### Task 8: `resolveOrder` — movement (envelop, flank, hit&run, retreat)

**Files:**
- Modify: `src/game/iterBelli/battle/resolver.ts`
- Test: `src/game/iterBelli/battle/__tests__/resolve-move.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { resolveOrder } from '../resolver';
import { ORDERS, CENTERS } from '../orders';
import type { BattleArmy, BattleState } from '../types';
const mkArmy = (side:'you'|'enemy', over:Partial<BattleArmy>={}):BattleArmy => ({
  name:side, side, hp:10000, maxHp:10000, morale:10, discipline:6,
  stats:{charge:10,harass:8,push:16,siege:5,movement:9}, armorPct:0, armorName:'-',
  fortPct:0, fortName:null, ammo:32, maxAmmo:32,
  formation:{name:'',kind:'common',disc:2,trait:null,orders:[],desc:''},
  encircled:false, encircleTurns:0, drums:0, guardMult:1, defendedLast:false, retreated:false, strengthPct:100, ...over,
});
const mkState = (you:BattleArmy, enemy:BattleArmy, control=0):BattleState => ({
  you, enemy, round:0, control, center:CENTERS.plain, finished:false, victory:null, endMsg:'',
  lastDice:{you:null,enemy:null},
});

describe('movement orders', () => {
  it('envelop succeeds above threshold and encircles for ~2 rounds', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    resolveOrder(s, you, enemy, ORDERS.envelop, 6, ORDERS.advance); // 6+mov9=15 ≥ 12
    expect(enemy.encircled).toBe(true);
    expect(enemy.encircleTurns).toBe(2);
  });
  it('envelop fails below threshold', () => {
    const you=mkArmy('you',{stats:{charge:0,harass:0,push:0,siege:0,movement:2}}), enemy=mkArmy('enemy');
    const s=mkState(you,enemy);
    resolveOrder(s, you, enemy, ORDERS.envelop, 1, ORDERS.advance); // 1+2=3 < 12
    expect(enemy.encircled).toBe(false);
  });
  it('flank crits when the defender holds the center', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy');
    const s=mkState(you,enemy,-60); // enemy holds center
    const before=enemy.hp;
    resolveOrder(s, you, enemy, ORDERS.flank, 5, ORDERS.advance);
    const youB=mkArmy('you'), enB=mkArmy('enemy'); const s2=mkState(youB,enB,0); // no center
    resolveOrder(s2, youB, enB, ORDERS.flank, 5, ORDERS.advance);
    expect(before-enemy.hp).toBeGreaterThan(10000-enB.hp); // crit > normal
  });
  it('hit & run sets a guard reduction on the attacker', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    resolveOrder(s, you, enemy, ORDERS.hitRun, 6, ORDERS.advance);
    expect(you.guardMult).toBeCloseTo(0.25);
  });
  it('retreat success flags the army; encircled raises the bar', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    resolveOrder(s, you, enemy, ORDERS.retreat, 6, ORDERS.advance); // 6+9=15 ≥ 11
    expect(you.retreated).toBe(true);
    const ring=mkArmy('you',{encircled:true}), e2=mkArmy('enemy'); const s2=mkState(ring,e2);
    resolveOrder(s2, ring, e2, ORDERS.retreat, 1, ORDERS.advance); // 1+9=10 < 17
    expect(ring.retreated).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/resolve-move.test.ts`
Expected: FAIL — `resolveMove` placeholder does nothing.

- [ ] **Step 3: Implement — replace the `resolveMove` placeholder**

```ts
function resolveMove(S: BattleState, att: BattleArmy, def: BattleArmy, o: OrderDef, die: number, ctx: any, eMoraleHit: number): OrderResult {
  if (o.sub !== 'move') return { eMoraleHit, log: ctx.log };
  const { cls, who, tgt, log, discBonus, ms, centerDmgBonus, statVal } = ctx;

  // Retreat: break off on a successful movement check.
  if (o.effect === 'retreat') {
    const need = (o.check ?? 11) + (att.encircled ? 6 : 0);
    const total = die + att.stats.movement;
    if (total >= need) { att.retreated = true; log.push({ text:`${who} disengage and pull back (${total}≥${need}).`, kind: cls }); }
    else log.push({ text:`${who} fail to break off (${total} < ${need}).`, kind: cls });
    return { eMoraleHit: 0, log };
  }

  const total = die + att.stats.movement;
  if (total < (o.check ?? 0)) { log.push({ text:`${who} fail ${o.name} (${total} < ${o.check}).`, kind: cls }); return { eMoraleHit: 0, log }; }

  let mult = o.mult ?? 0;
  let note = '';
  if (o.effect === 'flank' && controllerOf(S) === def.side) { mult *= 2.5; note = ' — flanking crit!'; }
  const dmg = mitigate(statVal * die * mult * discBonus * ms * (1 + centerDmgBonus) * BAL.DMG_SCALE, def, o);
  def.hp = Math.max(0, def.hp - dmg);
  if (o.effect === 'encircle') { def.encircled = true; def.encircleTurns = 2; eMoraleHit += 1.0; note += ' — enemy encircled.'; }
  if (o.effect === 'hitrun') { att.guardMult = 0.25; note += ' — strike and withdraw.'; }
  log.push({ text:`${who} execute ${o.name} for ${Math.round(dmg)}${note}`, kind: note.includes('crit') ? 'crit' : cls });
  return { eMoraleHit, log };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/resolve-move.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/battle/resolver.ts src/game/iterBelli/battle/__tests__/resolve-move.test.ts
git commit -m "feat(battle): resolveOrder — movement maneuvers + retreat"
```

---

### Task 9: `resolveCenter`, `applyMorale`, `checkEnd`

**Files:**
- Modify: `src/game/iterBelli/battle/resolver.ts`
- Test: `src/game/iterBelli/battle/__tests__/round-systems.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { resolveCenter, applyMorale, checkEnd } from '../resolver';
import { ORDERS, CENTERS } from '../orders';
import type { BattleArmy, BattleState } from '../types';
const mkArmy = (side:'you'|'enemy', over:Partial<BattleArmy>={}):BattleArmy => ({
  name:side, side, hp:10000, maxHp:10000, morale:10, discipline:6,
  stats:{charge:10,harass:8,push:16,siege:5,movement:9}, armorPct:0, armorName:'-',
  fortPct:0, fortName:null, ammo:32, maxAmmo:32,
  formation:{name:'',kind:'common',disc:2,trait:null,orders:[],desc:''},
  encircled:false, encircleTurns:0, drums:0, guardMult:1, defendedLast:false, retreated:false, strengthPct:100, ...over,
});
const mkState = (you:BattleArmy, enemy:BattleArmy, control=0):BattleState => ({
  you, enemy, round:0, control, center:CENTERS.plain, finished:false, victory:null, endMsg:'',
  lastDice:{you:null,enemy:null},
});

describe('round systems', () => {
  it('only push orders move the center, toward the stronger pusher', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    resolveCenter(s, ORDERS.advance, ORDERS.charge, 4, 4); // you push, enemy charges
    expect(s.control).toBeGreaterThan(0);
  });
  it('discipline resists morale loss; broken morale ends the battle', () => {
    const you=mkArmy('you',{discipline:0,morale:1}), enemy=mkArmy('enemy');
    const s=mkState(you,enemy);
    applyMorale(s, you, 10000, ORDERS.charge, 5); // big casualties + incoming
    expect(you.morale).toBeLessThan(1);
  });
  it('checkEnd: enemy morale 0 → victory', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy',{morale:0}); const s=mkState(you,enemy);
    checkEnd(s);
    expect(s.finished).toBe(true);
    expect(s.victory).toBe(true);
  });
  it('checkEnd is a no-op once finished (retreat already ended it)', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    s.finished=true; s.victory=false;
    checkEnd(s);
    expect(s.victory).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/round-systems.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement (append to `resolver.ts`)**

```ts
export function resolveCenter(S: BattleState, yO: OrderDef, eO: OrderDef, yDie: number, eDie: number): void {
  const yPush = yO.push ? (S.you.stats.push + yDie) * (yO.push / 14) : 0;
  const ePush = eO.push ? (S.enemy.stats.push + eDie) * (eO.push / 14) : 0;
  const delta = yPush - ePush;
  if (delta !== 0) S.control = clamp(S.control + delta * BAL.CENTER_MOVE, -100, 100);
}

export function applyMorale(S: BattleState, army: BattleArmy, hpBefore: number, ownO: OrderDef, incomingMoraleHit: number): void {
  const frac = (hpBefore - army.hp) / Math.max(hpBefore, 1);
  let casualty = frac * BAL.MORALE_K;
  if (ownO.defensive && ownO.protect) casualty *= (1 - ownO.protect);
  let loss = casualty + (incomingMoraleHit || 0);
  if (army.encircled) loss += 1.0;
  loss *= Math.max(0, 1 - army.discipline * BAL.MORALE_RESIST);
  loss = Math.max(0, loss);
  if (ownO.sMorale && ownO.sMorale < 0) loss += -ownO.sMorale;
  if (controllerOf(S) === army.side && S.center.moraleRegen) army.morale = clamp(army.morale + S.center.moraleRegen, 0, 10);
  army.morale = clamp(army.morale - loss, 0, 10);
}

export function checkEnd(S: BattleState): void {
  if (S.finished) return;
  const y = S.you, e = S.enemy;
  if (e.hp <= 0) { finish(S, true, `${e.name} is annihilated.`); return; }
  if (y.hp <= 0) { finish(S, false, 'Your legion is annihilated.'); return; }
  if (e.morale <= 0) {
    if (e.encircled) { e.hp = Math.round(e.hp * 0.05); finish(S, true, 'The enemy breaks while encircled — total annihilation.'); }
    else { e.hp = Math.round(e.hp * 0.4); finish(S, true, 'Enemy morale collapses — they flee.'); }
    return;
  }
  if (y.morale <= 0) {
    if (y.encircled) finish(S, false, 'Your line breaks while encircled — slaughter.');
    else finish(S, false, 'Your morale collapses — the legion routs.');
    return;
  }
  if (S.round >= BAL.MAX_ROUNDS) {
    const ys = y.hp / y.maxHp + y.morale / 10, es = e.hp / e.maxHp + e.morale / 10;
    finish(S, ys >= es, 'The battle grinds out — ' + (ys >= es ? 'you hold the field.' : 'the enemy holds the field.'));
  }
}

export function finish(S: BattleState, victory: boolean, msg: string): void {
  S.finished = true; S.victory = victory; S.endMsg = msg;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/round-systems.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/battle/resolver.ts src/game/iterBelli/battle/__tests__/round-systems.test.ts
git commit -m "feat(battle): center movement + morale + end conditions"
```

---

### Task 10: Enemy AI

**Files:**
- Create: `src/game/iterBelli/battle/enemy-ai.ts`
- Test: `src/game/iterBelli/battle/__tests__/enemy-ai.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { enemyChoose } from '../enemy-ai';
import { ORDERS, CENTERS, FORMATIONS } from '../orders';
import type { BattleArmy, BattleState } from '../types';
const mkArmy = (side:'you'|'enemy', over:Partial<BattleArmy>={}):BattleArmy => ({
  name:side, side, hp:10000, maxHp:10000, morale:10, discipline:6,
  stats:{charge:10,harass:8,push:16,siege:5,movement:9}, armorPct:0, armorName:'-',
  fortPct:0, fortName:null, ammo:32, maxAmmo:32,
  formation:FORMATIONS.battleLine,
  encircled:false, encircleTurns:0, drums:0, guardMult:1, defendedLast:false, retreated:false, strengthPct:100, ...over,
});
const mkState = (you:BattleArmy, enemy:BattleArmy, control=0):BattleState => ({
  you, enemy, round:0, control, center:CENTERS.plain, finished:false, victory:null, endMsg:'',
  lastDice:{you:null,enemy:null},
});

describe('enemyChoose', () => {
  it('only returns an order in its formation that passes the gates', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy'); const s=mkState(you,enemy);
    const k = enemyChoose(s);
    expect(enemy.formation.orders).toContain(k);
  });
  it('rallies when wavering', () => {
    const you=mkArmy('you'), enemy=mkArmy('enemy',{morale:2}); const s=mkState(you,enemy);
    expect(enemyChoose(s)).toBe('rally');
  });
  it('sieges an armored player when able', () => {
    const you=mkArmy('you',{armorPct:30}), enemy=mkArmy('enemy',{formation:FORMATIONS.testudo}); const s=mkState(you,enemy);
    expect(enemyChoose(s)).toBe('siege');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/enemy-ai.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import type { BattleState, OrderKey } from './types';
import { ORDERS } from './orders';
import { controllerOf, moraleMult } from './resolver';

export function enemyChoose(S: BattleState): OrderKey {
  const e = S.enemy, y = S.you;
  const ms = moraleMult(e.morale);
  const av = e.formation.orders.filter((k) => {
    const o = ORDERS[k];
    if (e.discipline < o.disc) return false;
    if (o.ammo && e.ammo < o.ammo) return false;
    if (ms < 1 && (o.reckless || o.disc >= 6) && !o.sMorale) return false;
    return true;
  });
  const has = (k: OrderKey) => av.includes(k);
  if (e.morale < 3 && has('lineRelief')) return 'lineRelief';
  if (e.morale < 2.5 && has('rally')) return 'rally';
  if ((y.encircled || y.morale < 3) && has('allOut')) return 'allOut';
  if ((y.encircled || y.morale < 3) && has('charge')) return 'charge';
  if (controllerOf(S) === 'you' && y.defendedLast && has('wedge')) return 'wedge';
  if (controllerOf(S) === 'you' && has('flank')) return 'flank';
  if (y.armorPct >= 20 && has('siege')) return 'siege';
  if (has('envelop') && !y.encircled && e.stats.movement + 4 >= (ORDERS.envelop.check ?? 99)) return 'envelop';
  if (S.control > 20 && has('advance')) return 'advance';
  if (S.control > 20 && has('holdLine')) return 'holdLine';
  const pref: OrderKey[] = ['charge','wedge','allOut','fireMissiles','skirmish','warCry','advance','holdLine','hitRun','drums','taunt','flank','rally'];
  for (const p of pref) if (has(p)) return p;
  return av[0] ?? 'rally';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/enemy-ai.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/game/iterBelli/battle/enemy-ai.ts src/game/iterBelli/battle/__tests__/enemy-ai.test.ts
git commit -m "feat(battle): enemy order AI"
```

---

### Task 11: Engine — builders + `playRound` orchestration

**Files:**
- Create: `src/game/iterBelli/battle/engine.ts`
- Test: `src/game/iterBelli/battle/__tests__/engine.test.ts`

`playRound` injects an `Rng` so dice are deterministic. It: rolls both dice sized by center tier, calls `enemyChoose`, resets guard, resolves center, resolves both orders, applies morale, ticks drums + encirclement, handles retreat end, then `checkEnd`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { makeBattleArmy, makeBattleState, playRound } from '../engine';
import { FORMATIONS, ENEMY_ARCHETYPES, CENTERS } from '../orders';
import type { Rng } from '../types';

const fixedRng = (val: number): Rng => ({ rollDie: () => val });

describe('playRound', () => {
  it('advances the round and produces a log', () => {
    const you = makeBattleArmy('you', { hp:10000, morale:10, discipline:6, stats:{charge:10,harass:8,push:16,siege:5,movement:9}, armorPct:20, armorName:'Iron', ammo:32, formation:FORMATIONS.battleLine });
    const enemy = makeBattleArmy('enemy', ENEMY_ARCHETYPES.carthage);
    const s = makeBattleState(you, enemy, CENTERS.plain);
    const log = playRound(s, 'charge', fixedRng(4));
    expect(s.round).toBe(1);
    expect(log.length).toBeGreaterThan(0);
  });
  it('a winning sequence eventually finishes with a verdict', () => {
    const you = makeBattleArmy('you', { hp:10000, morale:10, discipline:10, stats:{charge:30,harass:8,push:20,siege:5,movement:9}, armorPct:30, armorName:'Steel', ammo:32, formation:FORMATIONS.battleLine });
    const enemy = makeBattleArmy('enemy', ENEMY_ARCHETYPES.gauls);
    const s = makeBattleState(you, enemy, CENTERS.plain);
    let guard = 0;
    while (!s.finished && guard++ < 40) playRound(s, 'charge', fixedRng(6));
    expect(s.finished).toBe(true);
    expect(typeof s.victory).toBe('boolean');
  });
  it('a successful retreat ends the battle in defeat but saves troops', () => {
    const you = makeBattleArmy('you', { hp:10000, morale:10, discipline:6, stats:{charge:10,harass:8,push:16,siege:5,movement:9}, armorPct:20, armorName:'Iron', ammo:32, formation:FORMATIONS.battleLine });
    const enemy = makeBattleArmy('enemy', ENEMY_ARCHETYPES.carthage);
    const s = makeBattleState(you, enemy, CENTERS.plain);
    playRound(s, 'retreat', fixedRng(6)); // 6+9=15 ≥ 11
    expect(s.finished).toBe(true);
    expect(s.victory).toBe(false);
    expect(s.you.hp).toBeGreaterThan(7000); // most of the army saved
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/engine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import type { BattleArmy, BattleState, CenterDef, EnemyArchetype, OrderKey, Rng, RoundLogLine, Side } from './types';
import { ORDERS } from './orders';
import { BAL } from './balance';
import { resolveOrder, resolveCenter, applyMorale, checkEnd, finish, centerTier } from './resolver';
import { enemyChoose } from './enemy-ai';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

type ArmySeed = Partial<BattleArmy> & Pick<BattleArmy, 'hp' | 'morale' | 'discipline' | 'stats' | 'armorPct' | 'armorName' | 'ammo' | 'formation'> & { fortPct?: number; fortName?: string; name?: string };

export function makeBattleArmy(side: Side, seed: ArmySeed | EnemyArchetype): BattleArmy {
  const s = seed as any;
  return {
    name: s.name ?? (side === 'you' ? 'Your legion' : 'Enemy army'),
    side,
    hp: s.hp, maxHp: s.hp,
    morale: s.morale, discipline: s.disc ?? s.discipline,
    stats: { ...s.stats },
    armorPct: s.armorPct, armorName: s.armorName,
    fortPct: s.fortPct ?? 0, fortName: s.fortName ?? null,
    ammo: s.ammo, maxAmmo: s.ammo,
    formation: s.formation,
    encircled: false, encircleTurns: 0, drums: 0, guardMult: 1,
    defendedLast: false, retreated: false, strengthPct: 100,
  };
}

export function makeBattleState(you: BattleArmy, enemy: BattleArmy, center: CenterDef, control = 0): BattleState {
  return { you, enemy, round: 0, control, center, finished: false, victory: null, endMsg: '', lastDice: { you: null, enemy: null } };
}

export function playRound(S: BattleState, playerKey: OrderKey, rng: Rng): RoundLogLine[] {
  if (S.finished) return [];
  S.round++;
  S.you.guardMult = 1; S.enemy.guardMult = 1;
  const eKey = enemyChoose(S);
  const yO = ORDERS[playerKey], eO = ORDERS[eKey];
  const yTier = centerTier(S.control, 'you'), eTier = centerTier(S.control, 'enemy');
  const yFaces = 6 + yTier, eFaces = 6 + eTier;
  const yDie = rng.rollDie(yFaces), eDie = rng.rollDie(eFaces);
  S.lastDice = { you: { raw: yDie, faces: yFaces, bonus: yTier }, enemy: { raw: eDie, faces: eFaces, bonus: eTier } };

  const log: RoundLogLine[] = [{ text: `Round ${S.round} — You: ${yO.name} (d${yFaces}) · Enemy: ${eO.name} (d${eFaces})`, kind: 'head' }];
  const yHp = S.you.hp, eHp = S.enemy.hp;

  resolveCenter(S, yO, eO, yDie, eDie);
  const yRes = resolveOrder(S, S.you, S.enemy, yO, yDie, eO);
  const eRes = resolveOrder(S, S.enemy, S.you, eO, eDie, yO);
  log.push(...yRes.log, ...eRes.log);

  applyMorale(S, S.you, yHp, yO, eRes.eMoraleHit);
  applyMorale(S, S.enemy, eHp, eO, yRes.eMoraleHit);

  for (const a of [S.you, S.enemy]) {
    if (a.drums > 0) { a.morale = clamp(a.morale + 1.0 + a.discipline * 0.06, 0, 10); a.drums--; }
    if (a.encircled) { a.encircleTurns--; if (a.encircleTurns <= 0) a.encircled = false; }
  }

  S.you.defendedLast = !!yO.defensive; S.enemy.defendedLast = !!eO.defensive;

  if (S.you.retreated && !S.finished) {
    const loss = clamp(0.25 - S.you.discipline * 0.015, 0.08, 0.25);
    S.you.hp = Math.round(S.you.hp * (1 - loss));
    finish(S, false, `You withdraw — ${Math.round(loss * 100)}% lost covering the retreat.`);
    log.push({ text: S.endMsg, kind: 'out' });
  }

  checkEnd(S);
  if (S.finished && S.endMsg && !log.some((l) => l.kind === 'out')) log.push({ text: S.endMsg, kind: 'out' });
  return log;
}

/** Production RNG. Tests inject a deterministic one. */
export const realRng: Rng = { rollDie: (n) => 1 + Math.floor(Math.random() * n) };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/engine.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Run the whole suite + type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all suites pass; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/game/iterBelli/battle/engine.ts src/game/iterBelli/battle/__tests__/engine.test.ts
git commit -m "feat(battle): engine builders + playRound orchestration"
```

---

### Task 12: Balance regression guard (port the sim as a test)

Locks the validated balance so future tuning is intentional, not accidental.

**Files:**
- Test: `src/game/iterBelli/battle/__tests__/balance-regression.test.ts`

- [ ] **Step 1: Write the test (a seeded mini-sim using the engine)**

```ts
import { describe, it, expect } from 'vitest';
import { makeBattleArmy, makeBattleState, playRound } from '../engine';
import { FORMATIONS, ENEMY_ARCHETYPES, CENTERS } from '../orders';
import type { OrderKey, Rng } from '../types';

// Deterministic LCG so the result is stable across runs.
function lcg(seed: number): Rng {
  let s = seed >>> 0;
  return { rollDie: (n) => { s = (s * 1664525 + 1013904223) >>> 0; return 1 + (s % n); } };
}
function greedyPlayer(s: any): OrderKey {
  const av = s.you.formation.orders.filter((k: OrderKey) => s.you.discipline >= 0);
  // simple: prefer charge, else first available offensive order
  for (const p of ['charge','advance','skirmish','rally'] as OrderKey[]) if (av.includes(p)) return p;
  return av[0];
}

describe('balance regression', () => {
  it('Battle Line vs Carthage at disc 6 stays a competitive matchup (not a blowout)', () => {
    let wins = 0; const N = 400;
    for (let i = 0; i < N; i++) {
      const rng = lcg(1000 + i);
      const you = makeBattleArmy('you', { hp:10000, morale:10, discipline:6, stats:{charge:10,harass:8,push:16,siege:5,movement:9}, armorPct:20, armorName:'Iron', ammo:32, formation:FORMATIONS.battleLine });
      const enemy = makeBattleArmy('enemy', ENEMY_ARCHETYPES.carthage);
      const s = makeBattleState(you, enemy, CENTERS.hill);
      let guard = 0;
      while (!s.finished && guard++ < 30) playRound(s, greedyPlayer(s), rng);
      if (s.victory) wins++;
    }
    const rate = wins / N;
    expect(rate).toBeGreaterThan(0.25);
    expect(rate).toBeLessThan(0.75);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/game/iterBelli/battle/__tests__/balance-regression.test.ts`
Expected: PASS (win rate inside 25–75%). If it fails wildly, the engine diverged from the tuned prototype — investigate before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/game/iterBelli/battle/__tests__/balance-regression.test.ts
git commit -m "test(battle): balance regression guard"
```

---

## Phase 2 (next plan, not this thread)

After this engine lands and is green, the follow-up plan wires it to the game:
- **`BattleModal.tsx` rewrite**: pre-battle deployment screen (formation pick, gated by discipline + legate) + the round-loop UI, driven by a `@preact/signals` wrapper around `playRound`/`makeBattleState` (mirrors the existing `iterBelliBattle` signal pattern).
- **`BattleCanvas.tsx`**: port the validated Canvas renderer from `battle-rework.html` (terrain, squads, standards, projectiles, particles, screen-shake, floating casualties). Presentation-only — reads battle state, never mutates combat math.
- **Wire-in**: replace `beginBattle`/`playerChoosesStance`/`concludeBattle` in `iter-belli-combat.ts` usage; preserve `applyBattleOutcome(victory, survivors, finalMorale)` write-back.
- **Threads B/C/D** (separate specs/plans): real roster-summed power stats + `strengthFrac` + discipline 0–10 migration; ammunition + armor-tier economy + save migration; legate→formation + enemy archetypes in scenarios.

---

## Self-review notes

- **Spec coverage:** §2 combat model → Tasks 5–9, 11; §2.5 morale → Task 9; §3 content → Tasks 3–4; §4 balance → Tasks 3, 12; enemy AI → Task 10. Power-stat roster summation (§2.2) and campaign wiring (§5) are explicitly **deferred to Phase 2 / Threads B–D** — Thread A uses fixed stats by design.
- **Type consistency:** `BattleArmy`/`BattleState`/`OrderDef` defined once in Task 2 and reused verbatim in every test helper and resolver signature; `controllerOf`/`moraleMult` exported from `resolver.ts` and imported by `enemy-ai.ts`/`engine.ts`.
- **No placeholders:** the `chargeAndMove`/`resolveMove` stubs in Tasks 6–7 are intentional incremental scaffolding, each replaced with real code in the very next task (7, 8) and covered by tests.
