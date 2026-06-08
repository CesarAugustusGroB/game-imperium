# Iter Belli — Thread C (slice 2): Armor Ladder + Fortification + Hub Ammo Stock

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Checkbox steps.

**Goal:** Give the Hub army an upgradeable armor tier (Copper→Steel, a gold sink in Exercitus) and a buyable ammunition stock, wire both plus the player's `fortified` entrenchment into the decisive battle, and persist them.

**Architecture:** Pure ladder logic in a new `arsenal.ts` (testable); thin signal-backed store actions mirror `buySupplies`. `ArmyData` gains `armorMaterial` + `ammunition` (optional, persisted via `normalizeArmySnapshot`). Battle seeds armor material + a Camp-tier fort bonus when `cs.fortified`. The campaign harass budget is seeded from the army's ammo stock at embark.

**Tech Stack:** TypeScript (strict), Vitest, Preact signals.

**Decisions (user-approved):** armor starts **Copper**, full ladder Copper(5%)→Bronze(12%)→Iron(20%)→Steel(30%), gold upgrades 60/120/220; `cs.fortified` → player `fortPct = FORTS.camp` (10%); enemy fortification stays archetype-driven.

**Tuning:** `AMMO_STARTING_STOCK=24`, `AMMO_MAX_CARRY=60`, `AMMO_PER_GOLD=1`. `ARMOR_UPGRADE_GOLD = {copper:60, bronze:120, iron:220, steel:null}`.

**Codex note:** touches `ExercitusTab.tsx` + `EmbarkCard.tsx` (codex-active). Edits are additive and localized to minimize merge conflicts.

---

### Task 1: Arsenal ladder (pure) + types + config

**Files:** Create `src/game/progression/arsenal.ts`; modify `src/types/index.ts`, `src/config/game-config.ts`. Test: `src/game/progression/__tests__/arsenal.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { ARMOR_LADDER, nextArmorTier, armorUpgradeCost } from '../arsenal';

describe('arsenal armor ladder', () => {
  it('climbs copper→bronze→iron→steel then stops', () => {
    expect(ARMOR_LADDER).toEqual(['copper', 'bronze', 'iron', 'steel']);
    expect(nextArmorTier('copper')).toBe('bronze');
    expect(nextArmorTier('iron')).toBe('steel');
    expect(nextArmorTier('steel')).toBeNull();
  });
  it('upgrade cost escalates and is null at the top', () => {
    expect(armorUpgradeCost('copper')).toBe(60);
    expect(armorUpgradeCost('bronze')).toBe(120);
    expect(armorUpgradeCost('iron')).toBe(220);
    expect(armorUpgradeCost('steel')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Type.** In `src/types/index.ts`, just above `export interface ArmyData {`, add:
```ts
export type ArmorMaterial = 'copper' | 'bronze' | 'iron' | 'steel';
```
and inside `ArmyData` (after `supplies: number;`) add:
```ts
  /** Upgradeable armor tier (Exercitus gold sink). Omitted → 'copper'. */
  armorMaterial?: ArmorMaterial;
  /** Battle harass budget carried from the Hub. Omitted → AMMO_STARTING_STOCK. */
  ammunition?: number;
```

- [ ] **Step 4: Config.** In `src/config/game-config.ts`, after the supplies block, add:
```ts
/** Starting ammunition stock for a freshly composed army. */
export const AMMO_STARTING_STOCK = 24;
/** Cap on ammunition an army can carry into a campaign. */
export const AMMO_MAX_CARRY = 60;
/** Ammunition received per 1 gold spent in the Exercitus tab. */
export const AMMO_PER_GOLD = 1;
```

- [ ] **Step 5: Create `src/game/progression/arsenal.ts`:**
```ts
import type { ArmorMaterial } from '../../types/index';

/** Armor tiers in ascending protection order. */
export const ARMOR_LADDER: readonly ArmorMaterial[] = ['copper', 'bronze', 'iron', 'steel'] as const;

/** Gold to upgrade FROM each tier to the next; null = already at the top. */
export const ARMOR_UPGRADE_GOLD: Record<ArmorMaterial, number | null> = {
  copper: 60, bronze: 120, iron: 220, steel: null,
};

/** The next tier up, or null if already at the top. */
export function nextArmorTier(material: ArmorMaterial): ArmorMaterial | null {
  const i = ARMOR_LADDER.indexOf(material);
  return i >= 0 && i < ARMOR_LADDER.length - 1 ? ARMOR_LADDER[i + 1] : null;
}

/** Gold cost to upgrade from `material` to the next tier, or null at the top. */
export function armorUpgradeCost(material: ArmorMaterial): number | null {
  return ARMOR_UPGRADE_GOLD[material];
}
```

- [ ] **Step 6: Run — expect PASS** + `npx tsc --noEmit`.

- [ ] **Step 7: Commit** — `feat(army): armor ladder + ammo config (Thread C s2)`.

---

### Task 2: Store actions — seed, upgradeArmor, buyAmmunition

**Files:** Modify `src/game/progression/strategic-store.ts`. (Signal-backed glue — verified by tsc/build; pure logic already covered in Task 1.)

- [ ] **Step 1: Imports.** Add:
```ts
import { nextArmorTier, armorUpgradeCost } from './arsenal';
import { AMMO_STARTING_STOCK, AMMO_MAX_CARRY, AMMO_PER_GOLD } from '../../config/game-config';
```

- [ ] **Step 2: Seed the shell.** In `ensurePreparedArmy`, add to the `shell` literal: `armorMaterial: 'copper', ammunition: AMMO_STARTING_STOCK,`.

- [ ] **Step 3: Add the actions** (next to `buySupplies`):
```ts
/** Upgrade the prepared army's armor one tier with gold. False if at top or unaffordable. */
export function upgradeArmor(): boolean {
  const army = ensurePreparedArmy();
  const current = army.armorMaterial ?? 'copper';
  const next = nextArmorTier(current);
  const base = armorUpgradeCost(current);
  if (!next || base == null) return false;
  const cost = discountedGold(base);
  if (!canAfford('gold', cost)) return false;
  if (!spendResource('gold', cost)) return false;
  preparedArmy.value = { ...army, armorMaterial: next };
  return true;
}

/** Buy `qty` ammunition with gold (clamped to the carry cap). */
export function buyAmmunition(qty: number): boolean {
  if (qty <= 0) return false;
  const army = ensurePreparedArmy();
  const current = army.ammunition ?? AMMO_STARTING_STOCK;
  const room = AMMO_MAX_CARRY - current;
  if (room <= 0) return false;
  const buyable = Math.min(qty, room);
  const cost = discountedGold(Math.ceil(buyable / AMMO_PER_GOLD));
  if (!canAfford('gold', cost)) return false;
  if (!spendResource('gold', cost)) return false;
  preparedArmy.value = { ...army, ammunition: current + buyable };
  return true;
}
```

- [ ] **Step 4:** `npx tsc --noEmit` clean (confirms `discountedGold`/`canAfford`/`spendResource` are in scope — they back `buySupplies`).

- [ ] **Step 5: Commit** — `feat(army): upgradeArmor + buyAmmunition store actions (Thread C s2)`.

---

### Task 3: Exercitus "Arsenal" card UI

**Files:** Modify `src/ui/screens/forum/tabs/ExercitusTab.tsx`. (Presentational — tsc/build gate.)

- [ ] **Step 1: Imports.** Add `upgradeArmor, buyAmmunition` to the `strategic-store` import; add `import { nextArmorTier, armorUpgradeCost } from '../../../../game/progression/arsenal';`; add `AMMO_MAX_CARRY` (and `AMMO_PER_GOLD` if shown) to the game-config import.

- [ ] **Step 2: Derive state** (near the supplies block):
```ts
  const armorMaterial = army?.armorMaterial ?? 'copper';
  const ARMOR_PCT: Record<string, number> = { copper: 5, bronze: 12, iron: 20, steel: 30 };
  const nextArmor = nextArmorTier(armorMaterial);
  const armorCost = armorUpgradeCost(armorMaterial);
  const canUpgradeArmor = nextArmor != null && armorCost != null && currentGold >= armorCost;
  const currentAmmo = army?.ammunition ?? 0;
  const ammoAtCap = currentAmmo >= AMMO_MAX_CARRY;
  const ammoBuyable = Math.min(currentGold, AMMO_MAX_CARRY - currentAmmo);
  function handleUpgradeArmor() { if (upgradeArmor()) playSfx('ui_equip'); }
  function handleBuyAmmo(qty: number) { if (buyAmmunition(qty)) playSfx('ui_equip'); }
```

- [ ] **Step 3: Add a BentoCard** after the Supplies `BentoCard` (use `index={3}` and bump the Recruit card to `index={4}`), titled **Arsenal**, showing:
  - Armor row: current tier name + mitigation %, an **Upgrade** button (`→ {nextArmor} ({cost}g)`, disabled when `!canUpgradeArmor`; show "Max tier" when `nextArmor == null`).
  - Ammunition row: `{currentAmmo} / {AMMO_MAX_CARRY}` with `+10` and `Max` buy buttons (disabled when `ammoAtCap` / unaffordable), mirroring the Supplies quick-buy styling.

  Follow the existing Supplies card's styles/markup for visual consistency (BentoCard + SectionHeader + the gold-gradient buttons). Keep copy English (the game's UI language).

- [ ] **Step 4:** `npx tsc --noEmit` clean; `npm run build` succeeds.

- [ ] **Step 5: Commit** — `feat(forum): Exercitus Arsenal card — armor upgrade + ammo buy (Thread C s2)`.

---

### Task 4: Persist armor + ammo in meta-save

**Files:** Modify `src/game/core/meta-save.ts`. Test: `src/game/core/__tests__/army-arsenal-save.test.ts` (create).

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { normalizeArmySnapshot } from '../meta-save';

const base = { cohorts: [], supplies: 10 } as any;

describe('normalizeArmySnapshot persists arsenal fields', () => {
  it('keeps a valid armor tier + ammo', () => {
    const out = normalizeArmySnapshot({ ...base, armorMaterial: 'steel', ammunition: 40 })!;
    expect(out.armorMaterial).toBe('steel');
    expect(out.ammunition).toBe(40);
  });
  it('defaults a missing/invalid armor tier to copper and clamps ammo ≥ 0', () => {
    const out = normalizeArmySnapshot({ ...base, armorMaterial: 'mithril', ammunition: -5 })!;
    expect(out.armorMaterial).toBe('copper');
    expect(out.ammunition).toBe(0);
  });
  it('leaves ammo undefined when absent (uses runtime default later)', () => {
    const out = normalizeArmySnapshot({ ...base })!;
    expect(out.ammunition).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.** In `meta-save.ts`:
  - `import { ARMOR_LADDER } from '../progression/arsenal';`
  - `import { AMMO_MAX_CARRY } from '../../config/game-config';`
  - In the `normalizeArmySnapshot` return literal, add:
```ts
    armorMaterial: ARMOR_LADDER.includes(army.armorMaterial as never)
      ? army.armorMaterial
      : 'copper',
    ammunition: army.ammunition === undefined
      ? undefined
      : clamp(asFiniteNumber(army.ammunition, 0), 0, AMMO_MAX_CARRY),
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit** — `feat(save): persist army armor tier + ammunition (Thread C s2)`.

---

### Task 5: Wire armor material + entrenchment into the battle

**Files:** Modify `src/game/iterBelli/battle/adapter.ts`, `src/ui/screens/iterbelli/BattleModal.tsx`. Test: extend `adapter.test.ts`.

- [ ] **Step 1: Failing adapter tests** (in the `army builders` describe):
```ts
  it('player seed maps the armor material to mitigation %', () => {
    const seed = buildPlayerSeed(
      { soldiers: 5000, initialSoldiers: 10000, morale: 7, discipline: 3 } as any,
      roster, null, undefined, { material: 'steel' },
    );
    expect(seed.armorPct).toBe(30);
    expect(seed.armorName).toBe('Steel');
  });
  it('entrenchment grants a Camp-tier fort bonus', () => {
    const plain = buildPlayerSeed({ soldiers: 1, initialSoldiers: 1, morale: 5, discipline: 0 } as any, roster, null);
    expect(plain.fortPct).toBe(0);
    const dug = buildPlayerSeed({ soldiers: 1, initialSoldiers: 1, morale: 5, discipline: 0 } as any, roster, null, undefined, null, undefined, true);
    expect(dug.fortPct).toBe(10);
    expect(dug.fortName).toBe('Camp');
  });
```

- [ ] **Step 2: Run — expect FAIL** (`fortPct` not on PlayerSeed; 7th param ignored).

- [ ] **Step 3: adapter.ts.**
  - `import { ARMORS, FORTS } from './balance';` (add `FORTS`).
  - In `PlayerSeed`, add `fortPct: number; fortName: string | null;`.
  - Change `buildPlayerSeed`'s signature to append a final param `fortified = false`.
  - In the return object, add:
```ts
    fortPct: fortified ? FORTS.camp : 0,
    fortName: fortified ? 'Camp' : null,
```

- [ ] **Step 4: BattleModal.tsx.** Read `const army = preparedArmy.value;` (already in scope as `roster = preparedArmy.value?.cohorts`). Add near the snap:
```ts
    const armor = { material: (preparedArmy.value?.armorMaterial ?? 'copper') } as const;
    const fortified = cs.fortified === true;
```
  Then change both `buildPlayerSeed` calls:
  - `const seed0 = buildPlayerSeed(snap, roster, legate, undefined, armor, undefined, fortified);`
  - `playerSeedFor: (f) => buildPlayerSeed(snap, roster, legate, FORMATIONS[f], armor, undefined, fortified),`

- [ ] **Step 5: Run — expect PASS** (`adapter.test.ts`) + `npx tsc --noEmit`.

- [ ] **Step 6: Commit** — `feat(battle): seed armor tier + entrenchment fort bonus (Thread C s2)`.

---

### Task 6: Seed the campaign harass budget from the Hub ammo stock

**Files:** Modify `src/ui/screens/forum/panels/EmbarkCard.tsx`. (tsc gate.)

- [ ] **Step 1:** In the `startIterBelliCampaign({ ... })` seed object, add `ammunition: army?.ammunition,` (next to `supplies`). When the army has a stock it seeds the campaign; when undefined, `startIterBelliCampaign` falls back to `START.ammunition`.

- [ ] **Step 2:** `npx tsc --noEmit` clean.

- [ ] **Step 3: Commit** — `feat(iter-belli): seed campaign ammunition from Hub army stock (Thread C s2)`.

---

### Task 7: Full verification

- [ ] `npx tsc --noEmit` — no errors.
- [ ] `npx vitest run` — all green (arsenal, adapter, save suites + existing).
- [ ] `npm run build` — succeeds.
- [ ] Manual note (user): Exercitus shows an Arsenal card — upgrade Copper→Steel and buy ammo with gold; both persist across save/load; the decisive battle reflects the chosen armor %, and fortifying on the march grants a Camp fort bonus.

## Self-Review

- **Coverage:** armor ladder + gold sink (Tasks 1–3), persistence (Task 4), battle wiring incl. fortification (Task 5), Hub→campaign ammo seed (Task 6). Pure ladder logic is unit-tested; signal/UI glue is tsc/build-gated (consistent with the store having no existing unit tests).
- **Type consistency:** `ArmorMaterial` defined once in `types/index`; `ARMOR_LADDER`/`nextArmorTier`/`armorUpgradeCost` in `arsenal.ts`; `AMMO_*` in game-config. `PlayerSeed` gains `fortPct`/`fortName` (consumed by `makeBattleArmy`'s existing `s.fortPct ?? 0`). `buildPlayerSeed` param order: `(snap, roster, legate, formation?, armor?, ammunition?, fortified?)`.
- **Scope:** no enemy-fort changes (already archetype-driven); no new battle order; ammo teeth landed in slice 1.
