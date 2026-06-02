# Advisor Effects — Spoke Refactor + Fake-Resource Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire dead "spoke" terminology (label the truth: bonuses apply once at embark), delete dead aggregator/doctrine wiring, and redesign the five "fake-resource" advisors (Siege Master, Scholar, Pontifex, Zealot, Consul) to distinct thematic effects on real campaign-seed levers.

**Architecture:** Advisor passives flow `getCurrentPassive` → `passiveModifier` → `computeConsiliumSetup` → `EmbarkCard.handleEmbark` → `startIterBelliCampaign` seed. We add four new `AdvisorPassive` variants and three new `ConsiliumSetup` seed levers (`enemyWeaken`, `extraDays`, `soldiers`), wire them through the bridge and seed, then re-point the five advisors. Doctrine `resource-per-spoke` (dead) is converted to a real `embark-bonus { stat:'gold' }`. All "spoke"/"per spoke"/"between nodes" user-facing strings become embark/season-truthful.

**Tech Stack:** TypeScript (strict, `noUnusedLocals`), Preact, `@preact/signals`. No unit-test runner — verification via `npx tsx tools/verify-*.ts` + `npx tsc --noEmit` + `npx vite build`.

Spec: `docs/superpowers/specs/2026-06-02-advisor-effects-spoke-refactor-design.md`.

---

## File Structure / touch map

- `src/game/council/advisor.ts` — Task 1 (4 new passive variants)
- `src/data/iter-belli-consilium.ts` — Task 1 (ConsiliumSetup + passiveModifier + sums)
- `src/game/iterBelli/iter-belli-state.ts` — Task 1 (CampaignSeed fields + apply)
- `src/ui/screens/forum/panels/EmbarkCard.tsx` — Task 1 (wire soldiers/enemyWeaken/extraDays) + Task 3 (embark.gold)
- `src/ui/screens/forum/tabs/ConsiliumTab.tsx` — Task 1 (new-type describe/split cases) + Task 4 (relabel existing cases)
- `src/data/advisor-data.ts` — Task 2 (redesign 5) + Task 4 (relabel others)
- `src/game/items/doctrine.ts`, `src/game/items/doctrine-store.ts`, `src/data/doctrine-data.ts`, `src/ui/components/DoctrineRenderer.tsx` — Task 3 (doctrine embark-gold conversion)
- `src/game/council/council-store.ts` — Task 3 (delete 3 dead aggregators) + Task 4 (comments)
- `src/ui/screens/ProvinceScreen.tsx` — Task 4 (relabel)
- `tools/verify-advisor-effects.ts` — Task 5 (new verifier)

---

## Task 1: New passive types + bridge + seed wiring

**Files:** `advisor.ts`, `iter-belli-consilium.ts`, `iter-belli-state.ts`, `EmbarkCard.tsx`, `ConsiliumTab.tsx`

- [ ] **Step 1: Add four variants to `AdvisorPassive`** (`src/game/council/advisor.ts`)

Find:
```ts
  | { type: 'threat-reduction'; amount: number }
  | { type: 'loot-bonus'; percent: number };
```
Replace with:
```ts
  | { type: 'threat-reduction'; amount: number }
  | { type: 'loot-bonus'; percent: number }
  | { type: 'enemy-weaken'; amount: number }
  | { type: 'campaign-time'; days: number }
  | { type: 'morale-bonus'; amount: number }
  | { type: 'soldiers-bonus'; amount: number };
```

- [ ] **Step 2: Extend the consilium bridge** (`src/data/iter-belli-consilium.ts`)

Find the `ConsiliumSetup` interface:
```ts
export interface ConsiliumSetup {
  missionId: string | null;
  /** Bonus to starting supplies. */
  supplies: number;
  /** Bonus to starting gold. */
  gold: number;
  /** Amount to REDUCE starting threat by. */
  threat: number;
  /** Bonus to starting morale. */
  morale: number;
}

type SeedDeltas = Pick<ConsiliumSetup, 'supplies' | 'gold' | 'threat' | 'morale'>;
```
Replace with:
```ts
export interface ConsiliumSetup {
  missionId: string | null;
  /** Bonus to starting supplies. */
  supplies: number;
  /** Bonus to starting gold. */
  gold: number;
  /** Amount to REDUCE starting threat by. */
  threat: number;
  /** Bonus to starting morale. */
  morale: number;
  /** Erosion of the final enemy army (each point ≈ −7% effectives). */
  enemyWeaken: number;
  /** Extra campaign days added to the starting clock. */
  extraDays: number;
  /** Bonus to starting soldiers. */
  soldiers: number;
}

type SeedDeltas = Pick<ConsiliumSetup, 'supplies' | 'gold' | 'threat' | 'morale' | 'enemyWeaken' | 'extraDays' | 'soldiers'>;
```

Find `passiveModifier` and replace the whole function with (adds the 4 cases + extends `z`):
```ts
/** Map one advisor passive to its starting-stat deltas (all zero if unmapped). */
export function passiveModifier(passive: AdvisorPassive): SeedDeltas {
  const z: SeedDeltas = { supplies: 0, gold: 0, threat: 0, morale: 0, enemyWeaken: 0, extraDays: 0, soldiers: 0 };
  switch (passive.type) {
    case 'upkeep-reduction':
      return { ...z, supplies: Math.round((passive.percent / 100) * UPKEEP_BUDGET) };
    case 'threat-reduction':
      return { ...z, threat: passive.amount };
    case 'loot-bonus':
      return { ...z, gold: Math.round(passive.percent / 5) };
    case 'heal-between-nodes':
      return { ...z, morale: Math.round(passive.amount / 100) };
    case 'resource-per-spoke':
      // Deprecated resources (faith/influence/momentum) fold into gold.
      return { ...z, gold: passive.amount };
    case 'extra-event-choices':
      return { ...z, gold: passive.count * EVENT_CHOICE_GOLD };
    case 'enemy-weaken':
      return { ...z, enemyWeaken: passive.amount };
    case 'campaign-time':
      return { ...z, extraDays: passive.days };
    case 'morale-bonus':
      return { ...z, morale: passive.amount };
    case 'soldiers-bonus':
      return { ...z, soldiers: passive.amount };
    default:
      // shop-discount no longer seeds gold — it now applies as a real Hub discount.
      return z;
  }
}
```

Find the `computeConsiliumSetup` body — the init line and the sum block — and update both. Replace:
```ts
  const setup: ConsiliumSetup = { missionId: null, supplies: 0, gold: 0, threat: 0, morale: 0 };
```
with:
```ts
  const setup: ConsiliumSetup = { missionId: null, supplies: 0, gold: 0, threat: 0, morale: 0, enemyWeaken: 0, extraDays: 0, soldiers: 0 };
```
And replace:
```ts
    const mod = passiveModifier(getCurrentPassive(advisor));
    setup.supplies += mod.supplies;
    setup.gold += mod.gold;
    setup.threat += mod.threat;
    setup.morale += mod.morale;
  }
```
with:
```ts
    const mod = passiveModifier(getCurrentPassive(advisor));
    setup.supplies += mod.supplies;
    setup.gold += mod.gold;
    setup.threat += mod.threat;
    setup.morale += mod.morale;
    setup.enemyWeaken += mod.enemyWeaken;
    setup.extraDays += mod.extraDays;
    setup.soldiers += mod.soldiers;
  }
```

- [ ] **Step 3: Add seed fields + apply them** (`src/game/iterBelli/iter-belli-state.ts`)

In the `CampaignSeed` interface, find:
```ts
  /** Override starting morale (Consilium modifier); omitted → START.morale. */
  startMorale?: number;
```
Add after it:
```ts
  /** Erode the final enemy army (seeds IterBelliState.enemyWeaken); omitted → 0. */
  enemyWeaken?: number;
  /** Extra campaign days added to the starting clock; omitted → none. */
  extraDays?: number;
```

In `startIterBelliCampaign`, find:
```ts
  if (seed.supplies != null) S.supplies = Math.max(0, Math.floor(seed.supplies));
```
Add after it:
```ts
  if (seed.enemyWeaken != null) S.enemyWeaken = Math.max(0, Math.floor(seed.enemyWeaken));
  if (seed.extraDays) S.timeRemaining += Math.floor(seed.extraDays);
```

- [ ] **Step 4: Wire the new levers into embark** (`src/ui/screens/forum/panels/EmbarkCard.tsx`)

In `handleEmbark`, find:
```ts
    startIterBelliCampaign({
      soldiers: soldiers + embark.soldiers,
      gold: getResource('gold') + consilium.gold,
      iuniores: getResource('iuniores'),
      discipline: discipline + embark.discipline,
      archetype, spokeTerrain, spokeDuration,
      supplies: supplies + embark.supplies,
      missionId: consilium.missionId ?? undefined,
      startThreat: START.threat - consilium.threat,
      startMorale: START.morale + consilium.morale + embark.morale,
      quests: secondaryQuests,
      doctrineModifiers,
    });
```
Replace with (adds `consilium.soldiers`, `enemyWeaken`, `extraDays`):
```ts
    startIterBelliCampaign({
      soldiers: soldiers + embark.soldiers + consilium.soldiers,
      gold: getResource('gold') + consilium.gold,
      iuniores: getResource('iuniores'),
      discipline: discipline + embark.discipline,
      archetype, spokeTerrain, spokeDuration,
      supplies: supplies + embark.supplies,
      missionId: consilium.missionId ?? undefined,
      startThreat: START.threat - consilium.threat,
      startMorale: START.morale + consilium.morale + embark.morale,
      enemyWeaken: consilium.enemyWeaken,
      extraDays: consilium.extraDays,
      quests: secondaryQuests,
      doctrineModifiers,
    });
```

- [ ] **Step 5: Add UI cases for the new passives** (`src/ui/screens/forum/tabs/ConsiliumTab.tsx`)

In `describePassive`, find:
```ts
    case 'resource-per-spoke':  return `+${p.amount} oro por spoke · +oro al embarcar`;
    case 'extra-event-choices': return `+${p.count * 5} oro por spoke`;
  }
}
```
Replace with (adds the 4 cases; leaves the existing two strings for Task 4 to relabel):
```ts
    case 'resource-per-spoke':  return `+${p.amount} oro por spoke · +oro al embarcar`;
    case 'extra-event-choices': return `+${p.count * 5} oro por spoke`;
    case 'enemy-weaken':        return `−${p.amount * 7}% al ejército enemigo final · al embarcar`;
    case 'campaign-time':       return `+${p.days} ${p.days === 1 ? 'día' : 'días'} de campaña · al embarcar`;
    case 'morale-bonus':        return `+${p.amount} moral · al embarcar`;
    case 'soldiers-bonus':      return `+${p.amount} soldados · al embarcar`;
  }
}
```

In `splitPassiveDescription`, find:
```ts
    case 'loot-bonus':
      return { value: `+${passive.percent}%`, label: 'Gold Income' };
    default: {
```
Replace with (insert the 4 cases before `default`):
```ts
    case 'loot-bonus':
      return { value: `+${passive.percent}%`, label: 'Gold Income' };
    case 'enemy-weaken':
      return { value: `-${passive.amount * 7}%`, label: 'Final Enemy' };
    case 'campaign-time':
      return { value: `+${passive.days}`, label: passive.days === 1 ? 'Campaign Day' : 'Campaign Days' };
    case 'morale-bonus':
      return { value: `+${passive.amount}`, label: 'Morale at Embark' };
    case 'soldiers-bonus':
      return { value: `+${passive.amount}`, label: 'Soldiers at Embark' };
    default: {
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. (The `describePassive` switch is now exhaustive over all 11 variants; `passiveModifier` and `splitPassiveDescription` handle the new ones.)

- [ ] **Step 7: Commit**

```bash
git add src/game/council/advisor.ts src/data/iter-belli-consilium.ts src/game/iterBelli/iter-belli-state.ts src/ui/screens/forum/panels/EmbarkCard.tsx src/ui/screens/forum/tabs/ConsiliumTab.tsx
git commit -m "feat(consilium): add enemy-weaken/campaign-time/morale/soldiers advisor levers"
```
(End the commit message with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`)

---

## Task 2: Redesign the five fake-resource advisors

**Files:** `src/data/advisor-data.ts`

Preserve each advisor's existing `spokeTemplate` (durationRange/posture) verbatim — only the `passive` + `description` change.

- [ ] **Step 1: Siege Master → `enemy-weaken`**

Find the `ADVISOR_SIEGE_MASTER` `tiers` array and replace its three tier objects' `description`+`passive` so they read:
```ts
    { description: 'Erodes the final enemy by 7% at embark.',
      passive: { type: 'enemy-weaken', amount: 1 },
      spokeTemplate: { durationRange: [1, 3], posture: 'attacking' } },
    { description: 'Erodes the final enemy by 14% at embark.',
      passive: { type: 'enemy-weaken', amount: 2 },
      spokeTemplate: { durationRange: [2, 3], posture: 'attacking' } },
    { description: 'Erodes the final enemy by 21% at embark.',
      passive: { type: 'enemy-weaken', amount: 3 },
      spokeTemplate: { durationRange: [2, 4], posture: 'attacking' } },
```

- [ ] **Step 2: Scholar → `campaign-time`**

Replace `ADVISOR_SCHOLAR` tiers:
```ts
    { description: '+1 campaign day at embark.',
      passive: { type: 'campaign-time', days: 1 },
      spokeTemplate: { durationRange: [2, 3], posture: 'defending' } },
    { description: '+2 campaign days at embark.',
      passive: { type: 'campaign-time', days: 2 },
      spokeTemplate: { durationRange: [2, 3], posture: 'defending' } },
    { description: '+3 campaign days at embark.',
      passive: { type: 'campaign-time', days: 3 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
```

- [ ] **Step 3: Pontifex → `morale-bonus`**

Replace `ADVISOR_PONTIFEX` tiers:
```ts
    { description: '+1 morale at embark.',
      passive: { type: 'morale-bonus', amount: 1 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
    { description: '+2 morale at embark.',
      passive: { type: 'morale-bonus', amount: 2 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
    { description: '+3 morale at embark.',
      passive: { type: 'morale-bonus', amount: 3 },
      spokeTemplate: { durationRange: [3, 4], posture: 'defending' } },
```

- [ ] **Step 4: Zealot → `soldiers-bonus`**

Replace `ADVISOR_ZEALOT` tiers:
```ts
    { description: '+250 soldiers at embark.',
      passive: { type: 'soldiers-bonus', amount: 250 },
      spokeTemplate: { durationRange: [1, 2], posture: 'attacking' } },
    { description: '+450 soldiers at embark.',
      passive: { type: 'soldiers-bonus', amount: 450 },
      spokeTemplate: { durationRange: [1, 2], posture: 'attacking' } },
    { description: '+700 soldiers at embark.',
      passive: { type: 'soldiers-bonus', amount: 700 },
      spokeTemplate: { durationRange: [1, 3], posture: 'attacking' } },
```

- [ ] **Step 5: Consul → `threat-reduction`**

Replace `ADVISOR_CONSUL` tiers:
```ts
    { description: '−1 starting threat at embark.',
      passive: { type: 'threat-reduction', amount: 1 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
    { description: '−2 starting threat at embark.',
      passive: { type: 'threat-reduction', amount: 2 },
      spokeTemplate: { durationRange: [2, 4], posture: 'defending' } },
    { description: '−3 starting threat at embark.',
      passive: { type: 'threat-reduction', amount: 3 },
      spokeTemplate: { durationRange: [3, 4], posture: 'defending' } },
```

- [ ] **Step 6: Type-check + sanity grep**

Run: `npx tsc --noEmit` — expect PASS.
Run (PowerShell ok, or use Grep tool): confirm none of the five still use a deprecated resource — grep `resource-per-spoke` in `advisor-data.ts` should now only match `ADVISOR_MERCHANT` (gold).

- [ ] **Step 7: Commit**
```bash
git add src/data/advisor-data.ts
git commit -m "feat(advisor): redesign Siege/Scholar/Pontifex/Zealot/Consul to real embark levers"
```
(Co-Authored-By trailer.)

---

## Task 3: Doctrine embark-gold conversion + dead-aggregator cleanup

**Files:** `doctrine.ts`, `doctrine-data.ts`, `DoctrineRenderer.tsx`, `doctrine-store.ts`, `EmbarkCard.tsx`, `council-store.ts`

- [ ] **Step 1: Convert doctrine data effects** (`src/data/doctrine-data.ts`)

There are 18 occurrences of `{ type: 'resource-per-spoke', resource: 'gold', amount: N }`. Replace EVERY occurrence of the substring:
```
{ type: 'resource-per-spoke', resource: 'gold', amount:
```
with:
```
{ type: 'embark-bonus', stat: 'gold', amount:
```
(The `amount: N }` tail is unchanged.) Then update the `description` strings on those lines: replace every `gold per spoke` with `gold at campaign start`. Verify with a grep that `resource-per-spoke` and `per spoke` no longer appear in `doctrine-data.ts`.

- [ ] **Step 2: Update the `DoctrineEffect` union** (`src/game/items/doctrine.ts`)

Find:
```ts
  | { type: 'stat-modifier'; stat: 'damage' | 'armor' | 'maxHp'; multiplier: number }
  | { type: 'resource-per-spoke'; resource: ResourceType; amount: number }
  | { type: 'heal-on-kill'; amount: number }
```
Replace with (drops the dead variant):
```ts
  | { type: 'stat-modifier'; stat: 'damage' | 'armor' | 'maxHp'; multiplier: number }
  | { type: 'heal-on-kill'; amount: number }
```
Find:
```ts
  | { type: 'embark-bonus'; stat: 'soldiers' | 'morale' | 'supplies' | 'discipline'; amount: number };
```
Replace with (adds `gold`):
```ts
  | { type: 'embark-bonus'; stat: 'soldiers' | 'morale' | 'supplies' | 'discipline' | 'gold'; amount: number };
```
Note: `ResourceType` may now be unused in this file — if `npx tsc --noEmit` flags it, remove `ResourceType` from the import on line 1 (keep `Faction`).

- [ ] **Step 3: Remove the dead renderer cases** (`src/ui/components/DoctrineRenderer.tsx`)

In `formatEffectDescription`, delete:
```ts
    case 'resource-per-spoke':
      return `+${effect.amount} ${RESOURCE_LABELS[effect.resource]} / spoke`;
```
In `formatDoctrineEffect`, delete:
```ts
    case 'resource-per-spoke':
      return `+${effect.amount} ${RESOURCE_LABELS[effect.resource]} per spoke`;
```
Add an `embark-bonus` case to whichever of the two switches lacks one (so the gold-at-embark effect renders). In `formatDoctrineEffect`, if there is no `embark-bonus` case, add before its `default`:
```ts
    case 'embark-bonus':
      return `+${effect.amount} ${effect.stat} at campaign start`;
```
(`formatEffectDescription` already has an `embark-bonus` case at line ~110 — leave it.)

- [ ] **Step 4: Grant embark gold** (`src/game/items/doctrine-store.ts`)

Find `getEmbarkBonus` and replace it with (adds `gold`):
```ts
/** Aggregate embark-army bonus (per stat) from equipped doctrines. */
export function getEmbarkBonus(): { soldiers: number; morale: number; supplies: number; discipline: number; gold: number } {
  const out = { soldiers: 0, morale: 0, supplies: 0, discipline: 0, gold: 0 };
  for (const e of getActiveEffects()) {
    if (e.type === 'embark-bonus') out[e.stat] += e.amount;
  }
  return out;
}
```

- [ ] **Step 5: Apply embark gold at embark** (`src/ui/screens/forum/panels/EmbarkCard.tsx`)

In `handleEmbark`, find:
```ts
      gold: getResource('gold') + consilium.gold,
```
Replace with:
```ts
      gold: getResource('gold') + consilium.gold + embark.gold,
```

- [ ] **Step 6: Delete the three dead aggregators** (`src/game/council/council-store.ts`)

Delete these three exported functions in full (they have zero call-sites): `advisorUpkeepReduction` (`/** Sum of upkeep-reduction … */` block), `advisorThreatReduction` (`/** Sum of threat-reduction … */` block), and `advisorSpokeGrants` (`/** Per-spoke grants … */` block). Keep `advisorShopDiscount` and `advisorIncomeBonus`.

- [ ] **Step 7: Type-check + build + grep**

Run: `npx tsc --noEmit` — expect PASS (fix the `ResourceType` import in `doctrine.ts` if flagged, per Step 2).
Run: `npx vite build` — expect success.
Grep `resource-per-spoke` across `src/` — expect matches ONLY in the advisor union (`advisor.ts`), `advisor-data.ts` (Merchant), `iter-belli-consilium.ts` (passiveModifier case), `council-store.ts` (advisorIncomeBonus is unrelated), and `ConsiliumTab.tsx` — i.e. the ADVISOR passive, never the doctrine effect.
Grep `advisorSpokeGrants|advisorUpkeepReduction|advisorThreatReduction` — expect zero matches.

- [ ] **Step 8: Commit**
```bash
git add src/game/items/doctrine.ts src/data/doctrine-data.ts src/ui/components/DoctrineRenderer.tsx src/game/items/doctrine-store.ts src/ui/screens/forum/panels/EmbarkCard.tsx src/game/council/council-store.ts
git commit -m "refactor(doctrine): convert dead resource-per-spoke to embark gold; drop dead aggregators"
```
(Co-Authored-By trailer.)

---

## Task 4: Truthful relabel of remaining stale strings (no behavior change)

**Files:** `ConsiliumTab.tsx`, `advisor-data.ts`, `ProvinceScreen.tsx`, `council-store.ts`

- [ ] **Step 1: Relabel existing `describePassive` / `splitPassiveDescription` cases** (`src/ui/screens/forum/tabs/ConsiliumTab.tsx`)

In `describePassive`, apply these exact replacements:
- `` `−${p.percent}% upkeep de temporada · +suministros al embarcar` `` → `` `+suministros al embarcar (≈${p.percent}% del upkeep de campaña)` ``
- `` `−${p.amount} amenaza/temporada · −amenaza al embarcar` `` → `` `−${p.amount} amenaza inicial · al embarcar` ``
- `` `+${p.amount} oro por spoke · +oro al embarcar` `` → `` `+${p.amount} oro al embarcar` ``
- `` `+${p.count * 5} oro por spoke` `` → `` `+${p.count * 5} oro al embarcar` ``

In `splitPassiveDescription`, apply:
- `label: \`${capitalizeResource(res)} Each Spoke\`` → `label: 'Gold at Embark'` (the `res` line above it is now unused — replace the whole `resource-per-spoke` case body with `return { value: \`+${passive.amount}\`, label: 'Gold at Embark' };` and delete the now-unused `res`/comment lines).
- `label: 'Upkeep Relief'` → `label: 'Starting Supplies'`
- `label: 'Gold Each Spoke'` (extra-event-choices) → `label: 'Gold at Embark'`
- `label: 'Enemy Threat'` (threat-reduction) → `label: 'Starting Threat'`

Also update the stale comment in the `resource-per-spoke` split case region ("matches advisorSpokeGrants / passiveModifier") — `advisorSpokeGrants` no longer exists; just remove that clause. After this, the `capitalizeResource` helper (defined ~line 1110) is no longer referenced anywhere — if `npx tsc --noEmit` flags it as unused, delete the `capitalizeResource` function too.

- [ ] **Step 2: Relabel the non-redesigned advisors' descriptions** (`src/data/advisor-data.ts`)

Apply these description-string replacements (passives unchanged):
- `ADVISOR_SPYMASTER`: `'Threat reduced by 1 per spoke.'` → `'−1 starting threat at embark.'`; `'…by 2 per spoke.'` → `'−2 starting threat at embark.'`; `'…by 3 per spoke.'` → `'−3 starting threat at embark.'`
- `ADVISOR_MERCHANT`: `'+2 Gold per spoke.'` → `'+2 gold at embark.'`; `'+3 Gold per spoke.'` → `'+3 gold at embark.'`; `'+5 Gold per spoke.'` → `'+5 gold at embark.'`
- `ADVISOR_DIPLOMAT`: `'+1 extra event choice.'` → `'+5 gold at embark.'`; `'+2 extra event choices.'` → `'+10 gold at embark.'`; `'+3 extra event choices.'` → `'+15 gold at embark.'`
- `ADVISOR_HEALER`: `'Heal 100 HP between nodes.'` → `'+1 morale at embark.'`; `'Heal 200 HP between nodes.'` → `'+2 morale at embark.'`; `'Heal 300 HP between nodes.'` → `'+3 morale at embark.'`
- `ADVISOR_VETERAN`: `'Heal 50 HP between nodes.'` → `'+1 morale at embark.'`; `'Heal 100 HP between nodes.'` → `'+1 morale at embark.'`; `'Heal 150 HP between nodes.'` → `'+2 morale at embark.'`
- `ADVISOR_QUARTERMASTER`: `'Upkeep reduced by 10%.'` → `'+supplies at embark (10% of campaign upkeep).'`; `'…by 20%.'` → `'+supplies at embark (20% of campaign upkeep).'`; `'…by 30%.'` → `'+supplies at embark (30% of campaign upkeep).'`

(Centurion/Raider/Tribune "loot from battles", and Smuggler "shop discount" contain no "spoke"/"node" — leave them.)

- [ ] **Step 3: Relabel ProvinceScreen** (`src/ui/screens/ProvinceScreen.tsx`)

- Line ~669: `… per spoke` → `… per season`
- Line ~675: `{unrestChange} unrest per spoke` → `{unrestChange} unrest per season`
- Lines ~1692–1697: replace `/spoke` with `/season` in each `rows.push(...)` label (`Gold/spoke`→`Gold/season`, `Food/spoke`→`Food/season`, `Faith/spoke`→`Faith/season`, `Influence/spoke`→`Influence/season`, `Momentum/spoke`→`Momentum/season`, `Unrest/spoke`→`Unrest/season`).
- Line ~2437: `Complete spokes to conquer provinces.` → `Complete campaigns to conquer provinces.`

- [ ] **Step 4: Fix stale comments** (`src/game/council/council-store.ts`)

- `// Selling bypasses spoke-gain tracking — use addResource directly` → `// Selling adds gold directly (no income-modifier tracking)`
- In the `plannedCampaignDuration` doc-comment, `the spoke-free\n * replacement for generateSpokeFromCouncil's duration block.` → `derived from seated advisors' campaign-duration templates.` (keep the rest of the comment coherent).

- [ ] **Step 5: Type-check + build**

Run: `npx tsc --noEmit` — expect PASS.
Run: `npx vite build` — expect success.
Grep `per spoke|Each Spoke|por spoke|/spoke|between nodes` across `src/` — expect ZERO matches (the deliberately-kept `spokeTerrain`/`spokeDuration`/`spokeTemplate`/`SpokeTemplate`/`Posture` identifiers are NOT these strings and remain).

- [ ] **Step 6: Commit**
```bash
git add src/ui/screens/forum/tabs/ConsiliumTab.tsx src/data/advisor-data.ts src/ui/screens/ProvinceScreen.tsx src/game/council/council-store.ts
git commit -m "refactor(ui): relabel stale spoke/node strings to embark/season truth"
```
(Co-Authored-By trailer.)

---

## Task 5: Verifier + final checks

**Files:** `tools/verify-advisor-effects.ts` (new)

- [ ] **Step 1: Write the verifier**

Create `tools/verify-advisor-effects.ts`:
```ts
/**
 * Verifies the advisor-effect refactor:
 *  - passiveModifier maps each new passive type to the right SeedDeltas field
 *  - computeConsiliumSetup sums a hand-built council into the expected setup
 *  - no advisor still advertises a deprecated resource via resource-per-spoke
 * Run: npx tsx tools/verify-advisor-effects.ts
 */
import { passiveModifier, computeConsiliumSetup } from '../src/data/iter-belli-consilium';
import { STARTER_ADVISORS, ADVISOR_SIEGE_MASTER, ADVISOR_SCHOLAR, ADVISOR_ZEALOT, ADVISOR_CONSUL, ADVISOR_PONTIFEX } from '../src/data/advisor-data';
import { getCurrentPassive } from '../src/game/council/advisor';
import type { Advisor } from '../src/game/council/advisor';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (!cond) { console.error(`  ✗ ${label}`); failures++; } else { console.log(`  ✓ ${label}`); }
}

// passiveModifier mapping for the new types
check('enemy-weaken → enemyWeaken', passiveModifier({ type: 'enemy-weaken', amount: 3 }).enemyWeaken === 3);
check('campaign-time → extraDays', passiveModifier({ type: 'campaign-time', days: 2 }).extraDays === 2);
check('morale-bonus → morale', passiveModifier({ type: 'morale-bonus', amount: 2 }).morale === 2);
check('soldiers-bonus → soldiers', passiveModifier({ type: 'soldiers-bonus', amount: 450 }).soldiers === 450);
check('threat-reduction → threat', passiveModifier({ type: 'threat-reduction', amount: 2 }).threat === 2);

// No advisor advertises a deprecated resource via resource-per-spoke (gold/iuniores only).
const deprecated = ['faith', 'influence', 'momentum'];
const offenders = STARTER_ADVISORS.flatMap((a: Advisor) =>
  a.tiers.filter((t) => t.passive.type === 'resource-per-spoke'
    && deprecated.includes((t.passive as { resource: string }).resource)).map(() => a.id));
check('no advisor uses a deprecated resource-per-spoke', offenders.length === 0);

// computeConsiliumSetup: first seat = mission only; others sum.
// Build a council: [mission seat], Siege T1 (weaken 1), Zealot T1 (soldiers 250).
const t = <T extends Advisor>(a: T, tier: 1 | 2 | 3): T => ({ ...a, currentTier: tier });
const council = [t(ADVISOR_CONSUL, 1), t(ADVISOR_SIEGE_MASTER, 1), t(ADVISOR_ZEALOT, 1)];
const setup = computeConsiliumSetup(council);
check('first seat sets mission only (no threat from Consul)', setup.threat === 0 && setup.missionId !== null);
check('Siege T1 contributes enemyWeaken 1', setup.enemyWeaken === 1);
check('Zealot T1 contributes soldiers 250', setup.soldiers === 250);

// Scholar days + Pontifex morale flow through when not first-seated.
const council2 = [t(ADVISOR_CONSUL, 1), t(ADVISOR_SCHOLAR, 3), t(ADVISOR_PONTIFEX, 2)];
const setup2 = computeConsiliumSetup(council2);
check('Scholar T3 contributes extraDays 3', setup2.extraDays === 3);
check('Pontifex T2 contributes morale 2', setup2.morale === 2);

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
```

- [ ] **Step 2: Run it — expect PASS**

Run: `npx tsx tools/verify-advisor-effects.ts`
Expected: all `✓`, ending `All checks passed.` (exit 0). If a check fails, the data/bridge is wrong — fix it, do not weaken the assertion.

- [ ] **Step 3: Final type-check + build + persistence verifier (no regression)**

Run: `npx tsc --noEmit` — PASS.
Run: `npx vite build` — success.
Run: `npx tsx tools/verify-iter-belli-save.ts` — `All checks passed.` (the new seed fields don't break persistence).

- [ ] **Step 4: Commit**
```bash
git add tools/verify-advisor-effects.ts
git commit -m "test(consilium): verifier for redesigned advisor effects + bridge sums"
```
(Co-Authored-By trailer.)

---

## Self-Review Notes (resolved during planning)

- **Cross-union literal `resource-per-spoke`:** the advisor union keeps it (Merchant, gold); the doctrine union drops it. Task 3 only edits doctrine files; Task 1/2/4 only edit advisor files. The Step-7 grep in Task 3 guards against confusion.
- **Persistence:** `enemyWeaken` and `extraDays` only set INITIAL `IterBelliState.enemyWeaken`/`timeRemaining`, which are already serialized by `serializeIterBelli`'s explicit field list — no save-format change.
- **Two shared levers** (morale: Pontifex+Healer/Veteran; threat: Consul+Spymaster) are intentional and acceptable per the spec.
- **Balance** values (Zealot +700, Siege −21%) are isolated to `advisor-data.ts` and tunable.
