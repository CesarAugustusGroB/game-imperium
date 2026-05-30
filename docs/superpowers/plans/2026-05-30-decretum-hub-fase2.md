# Decretum Hub-Cast (Fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player cast Decreta from the Hub (Decreta tab) for Hub-level effects — instantaneous (resources / heal army / recruit) or continuous (waive upkeep for N seasons) — consuming the scroll on cast. Decreta never enter the Iter Belli campaign.

**Architecture:** A new pure-ish Hub module (`decretum-hub.ts`) maps each Decretum's existing battle effect to a small live set of Hub effects (`toHubEffect`), gates casting (faction-lock + has-hub-effect + affordable), applies the effect (instant directly; continuous pushed to an `activeDecretumEffects` signal), and removes the scroll. The season tick waives upkeep while a `waive-upkeep` effect is active and decrements/expires active effects. The Decreta tab gains a "Cast" button and an active-effects list. This is a Hub-only feature — nothing in `src/game/iterBelli/*` is touched.

**Tech Stack:** TypeScript, Preact, `@preact/signals`. No test runner — verification is `npx tsx tools/verify-*.ts` + `npx tsc --noEmit` + manual Chrome check.

**Conventions:** Run all commands from the worktree root `C:\Users\Henrich von Kleist\workspace\Map2D\.claude\worktrees\experimentation`. Commit style: Conventional Commits, scope `decretum`. Project enables `noUnusedLocals`/`noUnusedParameters` — no unused imports/params.

---

## File Structure

- **Create** `src/game/items/decretum-hub.ts` — `HubDecretumEffect`/`ActiveDecretumEffect` types, `activeDecretumEffects` signal, `RECRUIT_IUNIORES_PER_UNIT`, `toHubEffect`, `isCastableAtHub`, `describeHubEffect`, `isUpkeepWaived`, `tickActiveDecretumEffects`, `castDecretumAtHub`. Hub-only; imports run-domain stores (NOT the campaign module).
- **Create** `tools/verify-decretum-hub.ts` — verification script, built across Tasks 1–3.
- **Modify** `src/game/progression/season-tick.ts` — waive upkeep while active; tick active effects each season.
- **Modify** `src/ui/screens/forum/tabs/DecretaTab.tsx` — "Cast" button + active-effects list + updated hint.

---

## Task 1: Hub effect mapping + active-effect primitives

**Files:**
- Create: `src/game/items/decretum-hub.ts`
- Create: `tools/verify-decretum-hub.ts`

- [ ] **Step 1: Write the failing verification script**

Create `tools/verify-decretum-hub.ts`:

```typescript
/**
 * Verifies Hub-cast Decreta (Fase 2): effect mapping, castability gate, active
 * continuous effects, cast application, and season-tick upkeep waive.
 * Run: npx tsx tools/verify-decretum-hub.ts
 */
import {
  toHubEffect, isCastableAtHub, describeHubEffect, isUpkeepWaived,
  tickActiveDecretumEffects, activeDecretumEffects, RECRUIT_IUNIORES_PER_UNIT,
} from '../src/game/items/decretum-hub';
import type { Decretum, DecretumEffect } from '../src/game/items/decretum';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

const mk = (effect: DecretumEffect, color = 'white'): Decretum =>
  ({ id: 'd', name: 'D', description: '', color, rarity: 'common', effect } as unknown as Decretum);

// --- toHubEffect mapping ---
const grant = toHubEffect(mk({ type: 'resource-gain', resource: 'gold', amount: 5 }));
check('gold resource-gain → grant', grant?.kind === 'grant' && grant.resource === 'gold' && grant.amount === 5);
check('iuniores resource-gain → grant', toHubEffect(mk({ type: 'resource-gain', resource: 'iuniores', amount: 7 }))?.kind === 'grant');
check('influence resource-gain → null (deprecated)', toHubEffect(mk({ type: 'resource-gain', resource: 'influence', amount: 3 })) === null);
const heal = toHubEffect(mk({ type: 'heal', amount: 0.3, target: 'all' }));
check('heal → heal-army with fraction', heal?.kind === 'heal-army' && heal.fraction === 0.3 && heal.target === 'all');
const recruit = toHubEffect(mk({ type: 'spawn', unitRole: 'vanguard', count: 2 }));
check('spawn → recruit (count×K)', recruit?.kind === 'recruit' && recruit.iuniores === 2 * RECRUIT_IUNIORES_PER_UNIT);
const waive = toHubEffect(mk({ type: 'upkeep-reduction', seasons: 2 }));
check('upkeep-reduction → waive-upkeep', waive?.kind === 'waive-upkeep' && waive.seasons === 2);
check('buff → null (inert)', toHubEffect(mk({ type: 'buff', stat: 'atk', multiplier: 0.5, duration: 'battle' })) === null);
check('damage → null (inert)', toHubEffect(mk({ type: 'damage', amount: 100, target: 'area' })) === null);
check('reveal → null (inert)', toHubEffect(mk({ type: 'reveal', target: 'enemies', count: 99 })) === null);
check('prevent-death → null (inert)', toHubEffect(mk({ type: 'prevent-death', count: 1 })) === null);

// --- describeHubEffect ---
check('describe grant', describeHubEffect({ kind: 'grant', resource: 'gold', amount: 5 }).includes('5'));
check('describe waive', describeHubEffect({ kind: 'waive-upkeep', seasons: 2 }).toLowerCase().includes('upkeep'));

// --- isCastableAtHub ---
const redGold = mk({ type: 'resource-gain', resource: 'gold', amount: 5 }, 'red');
check('null faction → not castable', !isCastableAtHub(redGold, null));
check('red scroll, red commander → castable', isCastableAtHub(redGold, 'red'));
check('red scroll, blue commander → not castable (faction-lock)', !isCastableAtHub(redGold, 'blue'));
check('white commander casts any color', isCastableAtHub(redGold, 'white'));
check('inert effect → not castable', !isCastableAtHub(mk({ type: 'buff', stat: 'atk', multiplier: 0.5, duration: 'battle' }, 'white'), 'white'));

// --- isUpkeepWaived + tickActiveDecretumEffects ---
activeDecretumEffects.value = [];
check('no actives → not waived', !isUpkeepWaived());
activeDecretumEffects.value = [{ decretumId: 'x', name: 'X', effect: { kind: 'waive-upkeep', seasons: 2 }, remainingSeasons: 2 }];
check('waive active → waived', isUpkeepWaived());
tickActiveDecretumEffects();
check('tick decrements remaining', activeDecretumEffects.value[0]?.remainingSeasons === 1);
tickActiveDecretumEffects();
check('tick to 0 → expired/removed', activeDecretumEffects.value.length === 0);
check('after expiry → not waived', !isUpkeepWaived());

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-decretum-hub.ts`
Expected: FAIL — module `../src/game/items/decretum-hub` does not exist.

- [ ] **Step 3: Create the Hub module (mapping + primitives)**

Create `src/game/items/decretum-hub.ts`:

```typescript
/**
 * Decretum Hub-cast (Fase 2). Maps a Decretum's (battle-era) effect to a small
 * live set of Hub effects, gates casting, and tracks continuous effects that
 * tick on the season clock. Hub-only — the Iter Belli campaign module never
 * imports this. Types + the active-effects signal live here (the store imports
 * nothing from this module, so there is no import cycle).
 */
import { signal } from '@preact/signals';
import type { Faction, ResourceType } from '../core/commander';
import { canAfford } from '../core/resources';
import type { Decretum } from './decretum';
import { isDecretumCastable } from './decretum';

/** Iuniores granted per spawned unit when a `spawn` decretum is cast at the Hub. */
export const RECRUIT_IUNIORES_PER_UNIT = 250;

/** A Hub effect derived from a Decretum. Only these kinds are "live" at the Hub. */
export type HubDecretumEffect =
  | { kind: 'grant'; resource: ResourceType; amount: number }          // instant
  | { kind: 'heal-army'; fraction: number; target: 'all' | 'single' }  // instant
  | { kind: 'recruit'; iuniores: number }                              // instant
  | { kind: 'waive-upkeep'; seasons: number };                         // continuous

/** A continuous Hub effect currently active, with seasons remaining. */
export interface ActiveDecretumEffect {
  decretumId: string;
  name: string;
  effect: HubDecretumEffect;
  remainingSeasons: number;
}

/** Continuous Hub effects in flight (e.g. upkeep waivers). */
export const activeDecretumEffects = signal<ActiveDecretumEffect[]>([]);

/**
 * Translate a Decretum's effect into its Hub effect, or null if the scroll has
 * no Hub meaning (deprecated-resource grants, battle-only effects) → inert.
 */
export function toHubEffect(d: Decretum): HubDecretumEffect | null {
  const e = d.effect;
  switch (e.type) {
    case 'resource-gain':
      return e.resource === 'gold' || e.resource === 'iuniores'
        ? { kind: 'grant', resource: e.resource, amount: e.amount }
        : null;
    case 'heal':
      return { kind: 'heal-army', fraction: e.amount, target: e.target };
    case 'spawn':
      return { kind: 'recruit', iuniores: e.count * RECRUIT_IUNIORES_PER_UNIT };
    case 'upkeep-reduction':
      return { kind: 'waive-upkeep', seasons: e.seasons };
    default:
      return null;
  }
}

/** Castable at the Hub: a commander of a matching faction, a live Hub effect, and affordable castCost. */
export function isCastableAtHub(d: Decretum, faction: Faction | null): boolean {
  if (faction === null) return false;
  if (!isDecretumCastable(d, faction)) return false;
  if (toHubEffect(d) === null) return false;
  if (d.castCost) {
    for (const [res, amt] of Object.entries(d.castCost) as [ResourceType, number][]) {
      if (amt > 0 && !canAfford(res, amt)) return false;
    }
  }
  return true;
}

/** Human-readable summary of a Hub effect (Spanish, for the Decreta tab). */
export function describeHubEffect(effect: HubDecretumEffect): string {
  switch (effect.kind) {
    case 'grant':
      return `+${effect.amount} ${effect.resource === 'gold' ? 'oro' : 'iuniores'}`;
    case 'heal-army':
      return `Sana al ejército ${Math.round(effect.fraction * 100)}%`;
    case 'recruit':
      return `Recluta +${effect.iuniores} iuniores`;
    case 'waive-upkeep':
      return `Sin upkeep por ${effect.seasons} ${effect.seasons === 1 ? 'temporada' : 'temporadas'}`;
  }
}

/** True while any continuous waive-upkeep effect is active. */
export function isUpkeepWaived(): boolean {
  return activeDecretumEffects.value.some((a) => a.effect.kind === 'waive-upkeep');
}

/** Advance active continuous effects one season; drop those that hit zero. */
export function tickActiveDecretumEffects(): void {
  activeDecretumEffects.value = activeDecretumEffects.value
    .map((a) => ({ ...a, remainingSeasons: a.remainingSeasons - 1 }))
    .filter((a) => a.remainingSeasons > 0);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx tools/verify-decretum-hub.ts`
Expected: PASS — all checks ✓, "All checks passed."

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 6: Commit**

```bash
git add src/game/items/decretum-hub.ts tools/verify-decretum-hub.ts
git commit -m "feat(decretum): Hub effect mapping + active continuous-effect primitives"
```

---

## Task 2: Cast a Decretum at the Hub

**Files:**
- Modify: `src/game/items/decretum-hub.ts`
- Test: `tools/verify-decretum-hub.ts` (append)

- [ ] **Step 1: Append failing checks to the verify script**

In `tools/verify-decretum-hub.ts`, add imports:

```typescript
import { castDecretumAtHub } from '../src/game/items/decretum-hub';
import { decretumHand } from '../src/game/items/decretum-store';
import { selectedCommander } from '../src/game/core/game-state';
import { getResource } from '../src/game/core/resources';
import { preparedArmy } from '../src/game/progression/strategic-store';
import type { ArmyData } from '../src/types/index';
import type { Commander } from '../src/game/core/commander';
```

Then add before the final `if (failures > 0)` block:

```typescript
// --- castDecretumAtHub ---
selectedCommander.value = { faction: 'white' } as unknown as Commander; // white casts any color
activeDecretumEffects.value = [];

// grant: gold
decretumHand.value = [mk({ type: 'resource-gain', resource: 'gold', amount: 5 }, 'red')];
const goldBefore = getResource('gold');
check('cast grant returns true', castDecretumAtHub('d') === true);
check('grant added gold', getResource('gold') === goldBefore + 5);
check('grant removed scroll from hand', decretumHand.value.length === 0);

// recruit
decretumHand.value = [mk({ type: 'spawn', unitRole: 'guard', count: 3 }, 'white')];
const iunBefore = getResource('iuniores');
castDecretumAtHub('d');
check('recruit added iuniores (3×K)', getResource('iuniores') === iunBefore + 3 * RECRUIT_IUNIORES_PER_UNIT);

// heal-army (all): cohort at 500/1000 → +30% of 1000 = 800
preparedArmy.value = { cohorts: [{ currentHp: 500, stats: { hp: 1000 } }], size: 1000 } as unknown as ArmyData;
decretumHand.value = [mk({ type: 'heal', amount: 0.3, target: 'all' }, 'white')];
castDecretumAtHub('d');
check('heal-army healed cohort by fraction', (preparedArmy.value!.cohorts[0].currentHp ?? 0) === 800);

// waive-upkeep → pushed to actives, scroll consumed
activeDecretumEffects.value = [];
decretumHand.value = [mk({ type: 'upkeep-reduction', seasons: 2 }, 'white')];
castDecretumAtHub('d');
check('waive cast pushed active effect', activeDecretumEffects.value.length === 1 && activeDecretumEffects.value[0].remainingSeasons === 2);
check('waive cast removed scroll', decretumHand.value.length === 0);

// faction-lock: blue commander cannot cast a red scroll
selectedCommander.value = { faction: 'blue' } as unknown as Commander;
decretumHand.value = [mk({ type: 'resource-gain', resource: 'gold', amount: 5 }, 'red')];
check('faction-locked cast returns false', castDecretumAtHub('d') === false);
check('faction-locked cast left scroll in hand', decretumHand.value.length === 1);

// inert: a buff scroll is not castable at hub
selectedCommander.value = { faction: 'white' } as unknown as Commander;
decretumHand.value = [mk({ type: 'buff', stat: 'atk', multiplier: 0.5, duration: 'battle' }, 'white')];
check('inert cast returns false', castDecretumAtHub('d') === false);
check('inert cast left scroll in hand', decretumHand.value.length === 1);

// cleanup
decretumHand.value = [];
activeDecretumEffects.value = [];
preparedArmy.value = null;
selectedCommander.value = null;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-decretum-hub.ts`
Expected: FAIL — `castDecretumAtHub` is not exported.

- [ ] **Step 3: Implement `castDecretumAtHub` + helpers**

In `src/game/items/decretum-hub.ts`, add these imports to the existing import block (merge; project has `noUnusedLocals`):

```typescript
import { canAfford, addResource, spendResource } from '../core/resources';
import { selectedCommander } from '../core/game-state';
import { preparedArmy } from '../progression/strategic-store';
import type { Cohort } from '../army/cohort';
import { decretumHand, removeDecretum } from './decretum-store';
```

(`canAfford` is already imported in Task 1 — extend that line to add `addResource, spendResource` rather than duplicating.)

Then append at the end of the file:

```typescript
/** Heal the prepared army's cohorts by `fraction` of max HP (all, or the most-damaged one). */
function healPreparedArmy(fraction: number, target: 'all' | 'single'): void {
  const army = preparedArmy.value;
  if (!army || army.cohorts.length === 0) return;
  const heal = (c: Cohort): Cohort => {
    const max = c.stats.hp;
    const cur = c.currentHp ?? max;
    return { ...c, currentHp: Math.min(max, cur + Math.round(fraction * max)) };
  };
  let cohorts: Cohort[];
  if (target === 'all') {
    cohorts = army.cohorts.map(heal);
  } else {
    let idx = -1;
    let worstGap = -1;
    army.cohorts.forEach((c, i) => {
      const gap = c.stats.hp - (c.currentHp ?? c.stats.hp);
      if (gap > worstGap) { worstGap = gap; idx = i; }
    });
    cohorts = army.cohorts.map((c, i) => (i === idx ? heal(c) : c));
  }
  preparedArmy.value = { ...army, cohorts };
}

/** Apply a resolved Hub effect (instant directly; continuous pushed to actives). */
function applyHubEffect(effect: HubDecretumEffect, scroll: Decretum): void {
  switch (effect.kind) {
    case 'grant':
      addResource(effect.resource, effect.amount);
      break;
    case 'recruit':
      addResource('iuniores', effect.iuniores);
      break;
    case 'heal-army':
      healPreparedArmy(effect.fraction, effect.target);
      break;
    case 'waive-upkeep':
      activeDecretumEffects.value = [
        ...activeDecretumEffects.value,
        { decretumId: scroll.id, name: scroll.name, effect, remainingSeasons: effect.seasons },
      ];
      break;
  }
}

/**
 * Cast a Decretum from the Hub: validates castability, pays castCost, applies the
 * Hub effect, and removes the scroll from hand. Returns false if not castable.
 */
export function castDecretumAtHub(id: string): boolean {
  const scroll = decretumHand.value.find((d) => d.id === id);
  if (!scroll) return false;
  const faction = selectedCommander.value?.faction ?? null;
  if (!isCastableAtHub(scroll, faction)) return false;
  const effect = toHubEffect(scroll);
  if (!effect) return false;
  if (scroll.castCost) {
    for (const [res, amt] of Object.entries(scroll.castCost) as [ResourceType, number][]) {
      if (amt > 0) spendResource(res, amt);
    }
  }
  applyHubEffect(effect, scroll);
  removeDecretum(id);
  return true;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx tools/verify-decretum-hub.ts`
Expected: PASS — all checks ✓.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 6: Commit**

```bash
git add src/game/items/decretum-hub.ts tools/verify-decretum-hub.ts
git commit -m "feat(decretum): cast a decretum at the Hub (instant + continuous)"
```

---

## Task 3: Season-tick upkeep waive + active-effect decrement

**Files:**
- Modify: `src/game/progression/season-tick.ts`
- Test: `tools/verify-decretum-hub.ts` (append)

- [ ] **Step 1: Append failing checks to the verify script**

In `tools/verify-decretum-hub.ts`, add imports:

```typescript
import { runSeasonTick } from '../src/game/progression/season-tick';
import { addResource as addRes } from '../src/game/core/resources';
```

Then add before the final `if (failures > 0)` block:

```typescript
// --- season-tick upkeep waive ---
// Control: defending posture, no provinces → only gold upkeep (BASE_UPKEEP gold:2) moves gold.
activeDecretumEffects.value = [];
addRes('gold', 100);
const ctrlBefore = getResource('gold');
runSeasonTick('defending', 1);
check('no waive → gold upkeep charged (−2)', getResource('gold') === ctrlBefore - 2);

// With an active waive-upkeep, no upkeep is charged this season.
activeDecretumEffects.value = [{ decretumId: 'x', name: 'X', effect: { kind: 'waive-upkeep', seasons: 2 }, remainingSeasons: 2 }];
const waiveBefore = getResource('gold');
runSeasonTick('defending', 1);
check('waive active → no gold upkeep', getResource('gold') === waiveBefore);
check('season tick decremented the active effect', activeDecretumEffects.value[0]?.remainingSeasons === 1);

// Second tick expires it; a third tick charges upkeep again.
runSeasonTick('defending', 1);
check('waive expired after its seasons', activeDecretumEffects.value.length === 0);
const afterExpiry = getResource('gold');
runSeasonTick('defending', 1);
check('upkeep charged again after expiry (−2)', getResource('gold') === afterExpiry - 2);

activeDecretumEffects.value = [];
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-decretum-hub.ts`
Expected: FAIL — season tick still charges upkeep when a waive is active (and does not decrement actives).

- [ ] **Step 3: Wire waive + tick into `runSeasonTick`**

In `src/game/progression/season-tick.ts`, add the import:

```typescript
import { isUpkeepWaived, tickActiveDecretumEffects } from '../items/decretum-hub';
```

Replace the `reductionMultiplier` line:

```typescript
  const reductionMultiplier = Math.max(0, 1 - reductionPercent / 100);
```

with:

```typescript
  // A Decretum waive-upkeep zeroes upkeep this season; otherwise doctrine reduction applies.
  const reductionMultiplier = isUpkeepWaived() ? 0 : Math.max(0, 1 - reductionPercent / 100);
```

Then, right after `globalSeason.value += 1;`, add:

```typescript
  globalSeason.value += 1;

  // Advance/expire continuous Decretum effects once per season.
  tickActiveDecretumEffects();
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx tools/verify-decretum-hub.ts`
Expected: PASS — all checks ✓, "All checks passed."

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 6: Commit**

```bash
git add src/game/progression/season-tick.ts tools/verify-decretum-hub.ts
git commit -m "feat(decretum): season tick waives upkeep + expires active effects"
```

---

## Task 4: Decreta tab — Cast button + active-effects list

**Files:**
- Modify: `src/ui/screens/forum/tabs/DecretaTab.tsx`

- [ ] **Step 1: Add imports + a cast handler**

In `DecretaTab.tsx`, add to the imports:

```typescript
import { castDecretumAtHub, isCastableAtHub, toHubEffect, describeHubEffect, activeDecretumEffects } from '../../../../game/items/decretum-hub';
```

(The file already imports `decretumHand, maxHandSize, sellDecretum` from decretum-store, `isDecretumCastable, DECRETUM_SELL_PRICE` from decretum, `selectedCommander`, `playSfx`, etc.)

In the `DecretaTab` component body (after `function handleSell`), add:

```typescript
  function handleCast(id: string) {
    if (castDecretumAtHub(id)) {
      playSfx('ui_equip');
      if (selectedId.value === id) selectedId.value = null;
    }
  }
```

- [ ] **Step 2: Show active continuous effects above the hand grid**

In `DecretaTab.tsx`, inside the LEFT `OrnatePanel` (the Hand panel), right after the `<SectionHeader title="Hand" ... />` element and before the `{hand.length === 0 ? (...)}` block, add:

```tsx
          {activeDecretumEffects.value.length > 0 && (
            <div style={{
              margin: '0 0 10px', padding: '8px 12px',
              background: 'rgba(122, 168, 106, 0.10)',
              border: '1px solid rgba(122, 168, 106, 0.35)',
              borderRadius: 2,
              fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic',
              fontSize: 11, color: 'var(--imp-text-mid)',
            }}>
              {activeDecretumEffects.value.map((a) => (
                <div key={a.decretumId}>
                  ◆ {a.name} — {describeHubEffect(a.effect)} · {a.remainingSeasons} {a.remainingSeasons === 1 ? 'temporada' : 'temporadas'}
                </div>
              ))}
            </div>
          )}
```

- [ ] **Step 3: Pass cast props into `DecretumDetail` and update the "Cast in battle" eyebrow**

In `DecretaTab.tsx`, change the `<SectionHeader>` `right` text from `Cast in battle` to `Cast at hub`:

```tsx
            }}>
              Cast at hub
            </span>}
```

Update the `<DecretumDetail ... />` call to pass a cast handler + castability:

```tsx
            <DecretumDetail
              d={current}
              castable={faction !== null && isDecretumCastable(current, faction)}
              hubCastable={isCastableAtHub(current, faction)}
              accent={accent}
              onSell={() => handleSell(current.id)}
              onCast={() => handleCast(current.id)}
            />
```

- [ ] **Step 4: Add the Cast button to `DecretumDetail`**

In `DecretaTab.tsx`, update the `DecretumDetailProps` interface:

```typescript
interface DecretumDetailProps {
  d: Decretum;
  castable: boolean;
  hubCastable: boolean;
  accent: string;
  onSell: () => void;
  onCast: () => void;
}
```

Update the function signature: `function DecretumDetail({ d, castable, hubCastable, accent, onSell, onCast }: DecretumDetailProps) {` and inside it, after `const sellPrice = DECRETUM_SELL_PRICE[d.rarity];`, add:

```typescript
  const hubEffect = toHubEffect(d);
```

Replace the existing cast-hint `<div>` (the one reading "Scrolls are cast during battle from the decretum bar — this panel is a reference only.") with:

```tsx
        <div style={{
          padding: '10px 12px',
          background: 'rgba(20, 18, 32, 0.6)',
          border: '1px solid rgba(212, 168, 67, 0.15)',
          borderRadius: 2,
          fontFamily: 'var(--imp-font-serif)',
          fontStyle: 'italic', fontSize: 11,
          color: 'var(--imp-text-lo)',
          lineHeight: 1.4,
        }}>
          {hubEffect
            ? `Al lanzar en el Hub: ${describeHubEffect(hubEffect)}.`
            : 'Sin efecto de Hub — este pergamino no puede lanzarse aquí.'}
        </div>
```

Then add a "Cast" button before the "Sell" button inside the `<div style={{ display: 'flex', gap: 8 }}>` row:

```tsx
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCast}
            disabled={!hubCastable}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: hubCastable ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)` : 'rgba(80, 70, 50, 0.4)',
              border: 'none', borderRadius: 2,
              color: hubCastable ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
              fontSize: 11, fontWeight: 700,
              letterSpacing: 2, textTransform: 'uppercase',
              fontFamily: 'var(--imp-font-display)',
              cursor: hubCastable ? 'pointer' : 'not-allowed',
            }}
          >
            Lanzar
          </button>
          <button
            onClick={onSell}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: 'transparent',
              border: '1px solid rgba(194, 74, 58, 0.55)',
              borderRadius: 2,
              color: '#c24a3a',
              fontSize: 11, fontWeight: 700,
              letterSpacing: 2, textTransform: 'uppercase',
              fontFamily: 'var(--imp-font-display)',
              cursor: 'pointer',
            }}
          >
            Sell · {sellPrice}⚜
          </button>
        </div>
```

(Keep the surrounding `<div style={{ marginTop: 'auto', ... }}>` wrapper; only the hint `<div>` and the button-row `<div>` change.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors). `castable` is still used by the InfoBox "Castable" row; `hubCastable` gates the new button.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/forum/tabs/DecretaTab.tsx
git commit -m "feat(decretum): Decreta tab cast button + active-effects list"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the decretum-hub verification**

Run: `npx tsx tools/verify-decretum-hub.ts`
Expected: PASS — "All checks passed."

- [ ] **Step 2: Run prior verifications (regression)**

Run each; each must print "All checks passed.":
- `npx tsx tools/verify-iter-belli-doctrines.ts`
- `npx tsx tools/verify-iter-belli-quests.ts`
- `npx tsx tools/verify-iter-belli-consilium.ts`

- [ ] **Step 3: Full type-check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 4: Manual Chrome check**

The Map2D dev server runs on `http://localhost:5188/` (confirm the page title is "IMPERIUM"; if not running: `npx vite --port 5188 --strictPort` from the worktree).

1. Get a castable Decretum into the hand (e.g. a gold/heal/supply scroll matching the commander's faction).
2. Open Forum → Decreta tab. Confirm the eyebrow reads "Cast at hub" and the detail shows "Al lanzar en el Hub: …" for a live scroll (or "Sin efecto de Hub" for an inert one).
3. Click "Lanzar" on a live scroll → confirm the boon applies (gold/iuniores rise, or the prepared army heals) and the scroll leaves the hand.
4. Cast a `supply`/`annona` (upkeep-reduction) scroll → confirm it appears in the active-effects list with remaining seasons, and that advancing a season decrements it.

Report what you observed. Do not claim success without seeing the behavior.

- [ ] **Step 5: Final note**

No commit needed (verification only). If any check fails, return to the owning task, fix, and re-run.

---

## Self-Review notes (for the implementer)

- **Type consistency:** `HubDecretumEffect` kinds (`grant`/`heal-army`/`recruit`/`waive-upkeep`) are identical across `toHubEffect`, `describeHubEffect`, `applyHubEffect`, and the UI. `toHubEffect` returns `null` for every inert case.
- **Decoupling:** this is Hub-only — no `src/game/iterBelli/*` import. No import cycle: `decretum-hub.ts` imports from `decretum-store`/`resources`/`strategic-store`/`game-state`/`cohort`/`decretum`, none of which import `decretum-hub` except `season-tick.ts` (one direction).
- **Season-tick once-per-season:** the decrement sits next to `globalSeason.value += 1`, so it runs exactly once per season advance; the waive zeroes upkeep via `reductionMultiplier = 0`.
- **heal uses fraction of max HP** (verified: decretum heal amounts are 0.3/0.2/0.25/1.0) and does not change `size` (which is sum of max HP, untouched by healing currentHp).
- **YAGNI:** no `shop-discount` kind (no live decretum uses `investment-discount` as a primary effect); `extraEffects` are not processed this phase.
