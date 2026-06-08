# Iter Belli — Thread D: Enemy Identity (archetypeKey + archetype rebalance)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Checkbox steps.

**Goal:** Make each scenario declare its enemy archetype (`archetypeKey`), and rebalance the archetypes so the decisive battle is a fair climax that rewards preparation.

**Architecture:** `ScenarioEnemy` gains a typed `archetypeKey` resolved against `ENEMY_ARCHETYPES`. Carthage (the only shipping fight, Saguntum) is retuned from a swingy cuneus charge-bomb to a steadier combined-arms host. Iberians (unused, but broken at a 100% free win) get teeth so they're ready for future scenarios.

**Tech Stack:** TypeScript (strict), Vitest. Tuning validated with a throwaway `tools/_d-sim.ts` probe (deleted at the end).

**Decisions (user-approved):** decisive-battle target = "Clímax justo — preparation wins". Measured with the faithful real-battle matchup (player ~8000 hp vs scenario enemy ~7000 hp, since `buildEnemyArchetype` overrides archetype hp): old Carthage ≈ 8% typical / 27% prepared (brutal); new Carthage ≈ **30% typical / 54% prepared** (weak/attrited still loses, elite ≈ 95%+ — the engine's stat-compounding makes the tails steep, which is acceptable). Fix the broken Iberians; leave Gauls (~52%) and Garrison (siege-gated by design).

**Final archetype values:**
- **Carthage** — `battleLine`, hp 10000, disc 6, `{charge:11, harass:9, push:13, siege:5, movement:11}`, Iron (20%), ammo 26, fort 15 'Camp'. Combined-arms, disciplined, entrenched (was cuneus charge15 — too swingy).
- **Iberians** — `openOrder`, hp 10000, disc 6, `{charge:14, harass:16, push:12, siege:3, movement:16}`, Bronze (12%), ammo 42, fort 0. Fierce chargers + tireless skirmishers (was copper disc5 charge8 — a free win).

---

### Task 1: Rebalance Carthage + Iberians archetypes

**Files:** Modify `src/game/iterBelli/battle/orders.ts:66-79`. Test: `src/game/iterBelli/battle/__tests__/archetype-balance.test.ts` (create).

- [ ] **Step 1: Failing test** — lock the new stat lines + a structural fairness check.

```ts
import { describe, it, expect } from 'vitest';
import { ENEMY_ARCHETYPES } from '../orders';

describe('rebalanced archetypes', () => {
  it('Carthage is a steady combined-arms host (not a cuneus charge-bomb)', () => {
    const c = ENEMY_ARCHETYPES.carthage;
    expect(c.formation).toBe('battleLine');
    expect(c.stats.charge).toBe(11);
    expect(c.stats.push).toBe(13);
    expect(c.disc).toBe(6);
    expect(c.armorName).toBe('Iron');
    expect(c.fortPct).toBe(15);
  });
  it('Iberians have teeth (no longer a free win)', () => {
    const i = ENEMY_ARCHETYPES.iberians;
    expect(i.stats.charge).toBeGreaterThanOrEqual(12);
    expect(i.armorName).toBe('Bronze');
    expect(i.disc).toBe(6);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Edit `orders.ts`.** Replace the `carthage` and `iberians` entries:

```ts
  carthage:  { name:'Carthaginian Host', formation:'battleLine', hp:10000, morale:10, disc:6,
    stats:{charge:11,harass:9,push:13,siege:5,movement:11}, armorPct:ARMORS.iron, armorName:'Iron', ammo:26, fortPct:15, fortName:'Camp',
    desc:'Hannibal’s combined-arms host — disciplined, mobile, well-supplied, dug in.' },
```
```ts
  iberians:  { name:'Iberian Caetrati', formation:'openOrder', hp:10000, morale:10, disc:6,
    stats:{charge:14,harass:16,push:12,siege:3,movement:16}, armorPct:ARMORS.bronze, armorName:'Bronze', ammo:42, fortPct:0,
    desc:'Fierce chargers and tireless skirmishers — fast, relentless, lightly armored.' },
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Confirm the balance-regression suite still holds** (`npx vitest run src/game/iterBelli/battle/__tests__/balance-regression.test.ts`) — the Carthage `< 50` invariant and the mirror/discipline invariants stay green.

- [ ] **Step 6: Commit** — `balance(battle): retune Carthage (fair climax) + arm Iberians (Thread D)`.

---

### Task 2: Wire `archetypeKey` onto the scenario enemy

**Files:** Modify `src/game/iterBelli/iter-belli-types.ts` (ScenarioEnemy), `src/data/iter-belli-scenario-saguntum.ts`, `src/ui/screens/iterbelli/BattleModal.tsx:36`. Test: `src/data/__tests__/scenario-archetype.test.ts` (create).

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { SAGUNTUM } from '../iter-belli-scenario-saguntum';
import { ENEMY_ARCHETYPES } from '../../game/iterBelli/battle/orders';

describe('scenario enemy archetype', () => {
  it('Saguntum points at the Carthage archetype', () => {
    expect(SAGUNTUM.enemy.archetypeKey).toBe('carthage');
    expect(ENEMY_ARCHETYPES[SAGUNTUM.enemy.archetypeKey]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`archetypeKey` not on the type / not set).

- [ ] **Step 3: Type.** In `iter-belli-types.ts`, add to `ScenarioEnemy` (after `discipline: number;`):
```ts
  /** Key into ENEMY_ARCHETYPES for the decisive battle (drives the new battle engine). */
  archetypeKey: string;
```

- [ ] **Step 4: Author it.** In `iter-belli-scenario-saguntum.ts`, add `archetypeKey: 'carthage',` to the `enemy` object.

- [ ] **Step 5: Consume it cleanly.** In `BattleModal.tsx`, replace the cast
  `const enemyKey = (scenario.enemy as { archetypeKey?: string }).archetypeKey ?? 'carthage';`
  with `const enemyKey = scenario.enemy.archetypeKey;`

- [ ] **Step 6: Run — expect PASS** + `npx tsc --noEmit` (any other `CampaignScenario` literal must now set `archetypeKey` — there is only SAGUNTUM).

- [ ] **Step 7: Commit** — `feat(iter-belli): scenario enemies declare their battle archetypeKey (Thread D)`.

---

### Task 3: Full verification + cleanup

- [ ] Delete the throwaway probe: `tools/_d-sim.ts`.
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npx vitest run` — all green.
- [ ] `npm run build` — succeeds.

## Self-Review

- **Coverage:** archetypeKey wired + typed (Task 2); Carthage retuned to a fair climax and Iberians armed (Task 1). Gauls/Garrison untouched (already balanced / siege-gated by design).
- **Honesty:** the engine's stat-compounding makes the win-rate tails steep — an elite min-maxed army wins ~95%+ and a weak/attrited one loses regardless of archetype tuning. The achievable, meaningful knob (prepared ≈ 54%) is centered on the user's target; tails are documented, not hidden.
- **Tests:** archetype values are data-locked; the existing balance-regression invariants (mirror ~50%, discipline monotonic, Carthage not a free win) remain the mechanical guard.
