# Iter Belli — Consilium-driven mission + modifiers (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the seated Consilium shape each Iter Belli campaign — the first-seated advisor's color sets a campaign mission (a checkable success condition gating a gold bonus on victory), and the other seated advisors' passives apply as starting-stat modifiers.

**Architecture:** A new pure data/bridge module (`src/data/iter-belli-consilium.ts`) maps `councilSlots` → `{ missionId, supplies, gold, threat, morale }`. The embark bridge folds those deltas into the `CampaignSeed`; the campaign engine only stores `missionId`. The endgame bridge evaluates the mission condition and grants the bonus. No bellum/battle edits; the Iter Belli logic module imports no council types.

**Tech Stack:** TypeScript, Preact `@preact/signals`, Vite. Verification: standalone `tools/verify-*.ts` via `npx tsx` (tools/ is NOT type-checked — tsconfig `include` is `["src"]`) + `npx tsc --noEmit` + browser. PowerShell shell — chain with `;` not `&&`. Never `git commit -a/-am` (the tree has pre-existing unrelated changes); always targeted `git add`.

---

### Task 1: Consilium → campaign bridge module (missions + modifier mapping)

**Files:**
- Create: `src/data/iter-belli-consilium.ts`
- Test: `tools/verify-iter-belli-consilium.ts`

- [ ] **Step 1: Write the failing verification script**

Create `tools/verify-iter-belli-consilium.ts`:

```ts
/**
 * Verifies Consilium mission + modifier bridge (Task 1) + seed round-trip (Task 2).
 * Run: npx tsx tools/verify-iter-belli-consilium.ts
 */
import { MISSIONS, getMissionById, passiveModifier, computeConsiliumSetup } from '../src/data/iter-belli-consilium';
import type { IterBelliState } from '../src/game/iterBelli/iter-belli-types';
import type { Advisor } from '../src/game/council/advisor';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

// --- Missions ---
check('5 missions', Object.keys(MISSIONS).length === 5);
check('distinct mission ids', new Set(Object.values(MISSIONS).map((m) => m.id)).size === 5);
check('red → asalto', MISSIONS.red.id === 'asalto');
check('purple → botin', MISSIONS.purple.id === 'botin');
check('getMissionById round-trip', getMissionById('pax')?.id === 'pax');
check('getMissionById null', getMissionById(null) === null);
check('getMissionById unknown', getMissionById('zzz') === null);

// --- Mission conditions (crafted final states) ---
const base = { turnNum: 5, threat: 3, morale: 8, gold: 200, soldiers: 1000, initialSoldiers: 1000 } as IterBelliState;
check('pax true at threat 4', MISSIONS.blue.condition({ ...base, threat: 4 }));
check('pax false at threat 5', !MISSIONS.blue.condition({ ...base, threat: 5 }));
check('legion true at 60%', MISSIONS.white.condition({ ...base, soldiers: 600, initialSoldiers: 1000 }));
check('legion false below 60%', !MISSIONS.white.condition({ ...base, soldiers: 599, initialSoldiers: 1000 }));
check('asalto true at 8 days', MISSIONS.red.condition({ ...base, turnNum: 8 }));
check('asalto false at 9 days', !MISSIONS.red.condition({ ...base, turnNum: 9 }));
check('botin true at 120 gold', MISSIONS.purple.condition({ ...base, gold: 120 }));
check('cruzada false at morale 5', !MISSIONS.gold.condition({ ...base, morale: 5 }));

// --- passiveModifier ---
check('upkeep 20% → +5 supplies', passiveModifier({ type: 'upkeep-reduction', percent: 20 }).supplies === 5);
check('threat-reduction 2 → 2', passiveModifier({ type: 'threat-reduction', amount: 2 }).threat === 2);
check('gold resource 3 → +3 gold', passiveModifier({ type: 'resource-per-spoke', resource: 'gold', amount: 3 }).gold === 3);
check('momentum resource → 0 gold', passiveModifier({ type: 'resource-per-spoke', resource: 'momentum', amount: 3 }).gold === 0);
check('loot 25% → +5 gold', passiveModifier({ type: 'loot-bonus', percent: 25 }).gold === 5);
check('shop 10% → +2 gold', passiveModifier({ type: 'shop-discount', percent: 10 }).gold === 2);
check('heal 200 → +2 morale', passiveModifier({ type: 'heal-between-nodes', amount: 200 }).morale === 2);
check('extra-event-choices → 0 supplies', passiveModifier({ type: 'extra-event-choices', count: 2 }).supplies === 0);

// --- computeConsiliumSetup ---
const mk = (color: string, passive: unknown): Advisor =>
  ({ color, currentTier: 1, tiers: [{ passive }] } as unknown as Advisor);

const empty = computeConsiliumSetup([null, null, null]);
check('empty → null mission', empty.missionId === null);
check('empty → zero deltas', empty.supplies === 0 && empty.gold === 0 && empty.threat === 0 && empty.morale === 0);

const c1 = computeConsiliumSetup([
  mk('red', { type: 'loot-bonus', percent: 25 }),
  mk('blue', { type: 'threat-reduction', amount: 2 }),
  mk('gold', { type: 'upkeep-reduction', percent: 20 }),
]);
check('first slot sets mission', c1.missionId === 'asalto');
check('first slot loot NOT counted', c1.gold === 0);
check('other slots sum threat', c1.threat === 2);
check('other slots sum supplies', c1.supplies === 5);

// --- Seed round-trip (added in Task 2) ---

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-iter-belli-consilium.ts`
Expected: FAIL — `Cannot find module '../src/data/iter-belli-consilium'`.

- [ ] **Step 3: Create the bridge module**

Create `src/data/iter-belli-consilium.ts`:

```ts
/**
 * Iter Belli — Consilium → campaign bridge (Phase 1: mission + modifiers).
 * Pure data + helpers. The first-seated advisor's color picks a mission; the
 * other seated advisors' passives sum into starting-stat modifiers. Consumed by
 * the embark/endgame UI bridge — the Iter Belli logic module never imports this.
 */
import type { Advisor, AdvisorPassive } from '../game/council/advisor';
import { getCurrentPassive } from '../game/council/advisor';
import type { Faction } from '../game/core/commander';
import type { IterBelliState } from '../game/iterBelli/iter-belli-types';

export interface MissionDef {
  id: string;
  title: string;
  /** Short human-readable success condition, shown in the UI. */
  conditionDesc: string;
  /** Checked against the final campaign state; bonus granted on victory when true. */
  condition: (s: IterBelliState) => boolean;
  bonusGold: number;
}

/** Main mission by the first-seated advisor's color. Tunable. */
export const MISSIONS: Record<Faction, MissionDef> = {
  red: { id: 'asalto', title: 'Asalto', conditionDesc: 'Vence en ≤ 8 días',
    condition: (s) => s.turnNum <= 8, bonusGold: 50 },
  blue: { id: 'pax', title: 'Pax Romana', conditionDesc: 'Amenaza final ≤ 4',
    condition: (s) => s.threat <= 4, bonusGold: 50 },
  gold: { id: 'cruzada', title: 'Cruzada', conditionDesc: 'Moral final ≥ 6',
    condition: (s) => s.morale >= 6, bonusGold: 50 },
  purple: { id: 'botin', title: 'Botín', conditionDesc: 'Oro final ≥ 120',
    condition: (s) => s.gold >= 120, bonusGold: 80 },
  white: { id: 'legion', title: 'Legión Intacta', conditionDesc: 'Conserva ≥ 60% de soldados',
    condition: (s) => s.initialSoldiers > 0 && s.soldiers >= 0.6 * s.initialSoldiers, bonusGold: 50 },
};

const MISSION_BY_ID: Record<string, MissionDef> =
  Object.fromEntries(Object.values(MISSIONS).map((m) => [m.id, m]));

/** Look up a mission by id; null for null/unknown. */
export function getMissionById(id: string | null): MissionDef | null {
  return id == null ? null : (MISSION_BY_ID[id] ?? null);
}

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

/** Map one advisor passive to its starting-stat deltas (all zero if unmapped). */
export function passiveModifier(passive: AdvisorPassive): SeedDeltas {
  const z: SeedDeltas = { supplies: 0, gold: 0, threat: 0, morale: 0 };
  switch (passive.type) {
    case 'upkeep-reduction':
      return { ...z, supplies: Math.round((passive.percent / 100) * 24) };
    case 'threat-reduction':
      return { ...z, threat: passive.amount };
    case 'loot-bonus':
    case 'shop-discount':
      return { ...z, gold: Math.round(passive.percent / 5) };
    case 'heal-between-nodes':
      return { ...z, morale: Math.round(passive.amount / 100) };
    case 'resource-per-spoke':
      return passive.resource === 'gold' ? { ...z, gold: passive.amount } : z;
    default:
      return z; // extra-event-choices and anything else: no campaign effect
  }
}

/**
 * Resolve the seated council into a campaign setup: the first occupied slot
 * sets the mission (by color, no modifier); every other occupied slot sums its
 * passive modifier.
 */
export function computeConsiliumSetup(slots: (Advisor | null)[]): ConsiliumSetup {
  const setup: ConsiliumSetup = { missionId: null, supplies: 0, gold: 0, threat: 0, morale: 0 };
  let firstSeen = false;
  for (const advisor of slots) {
    if (!advisor) continue;
    if (!firstSeen) {
      firstSeen = true;
      setup.missionId = MISSIONS[advisor.color].id;
      continue; // first seat sets the mission only
    }
    const mod = passiveModifier(getCurrentPassive(advisor));
    setup.supplies += mod.supplies;
    setup.gold += mod.gold;
    setup.threat += mod.threat;
    setup.morale += mod.morale;
  }
  return setup;
}
```

- [ ] **Step 4: Run it to verify the Task-1 checks pass**

Run: `npx tsx tools/verify-iter-belli-consilium.ts`
Expected: PASS — all Task-1 checks `✓`, ends with `All checks passed.`

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/data/iter-belli-consilium.ts tools/verify-iter-belli-consilium.ts
git commit -m "feat(iterbelli): consilium->campaign bridge (missions + modifier mapping)"
```

---

### Task 2: Seed missionId + starting-stat overrides through the bridge

**Files:**
- Modify: `src/game/iterBelli/iter-belli-types.ts` (`IterBelliState`)
- Modify: `src/game/iterBelli/iter-belli-state.ts` (`CampaignSeed`, `freshState`, `startIterBelliCampaign`)
- Test: `tools/verify-iter-belli-consilium.ts` (extend)

- [ ] **Step 1: Add the seed round-trip checks (failing)**

In `tools/verify-iter-belli-consilium.ts`, add this import at the TOP with the others:

```ts
import { startIterBelliCampaign, resetIterBelli, iterBelliState } from '../src/game/iterBelli/iter-belli-state';
```

Then replace the `// --- Seed round-trip (added in Task 2) ---` line with:

```ts
// --- Seed round-trip ---
const seedBase = { soldiers: 1000, gold: 0, iuniores: 0, discipline: 4, archetype: null, spokeTerrain: 'plains', spokeDuration: 1 };
startIterBelliCampaign({ ...seedBase, missionId: 'pax', startThreat: 0, startMorale: 10 });
check('seed applies missionId', iterBelliState.value.missionId === 'pax');
check('seed applies startThreat', iterBelliState.value.threat === 0);
check('seed applies startMorale', iterBelliState.value.morale === 10);
startIterBelliCampaign({ ...seedBase });
check('omitted missionId → null', iterBelliState.value.missionId === null);
resetIterBelli();
check('reset clears missionId', iterBelliState.value.missionId === null);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx tools/verify-iter-belli-consilium.ts`
Expected: FAIL — `seed applies missionId` prints `✗` (state has no `missionId` yet → `undefined !== 'pax'`).

- [ ] **Step 3: Add `missionId` to `IterBelliState`**

In `src/game/iterBelli/iter-belli-types.ts`, inside `interface IterBelliState`, immediately after the `spokeDuration: number;` field, add:

```ts
  /** Active campaign mission id (from the first-seated advisor's color); null if none. */
  missionId: string | null;
```

- [ ] **Step 4: Add the seed fields + apply them**

In `src/game/iterBelli/iter-belli-state.ts`:

(a) Extend `CampaignSeed` — after the `spokeDuration: number;` line add:

```ts
  /** Campaign mission id (Consilium-derived); omitted → no mission. */
  missionId?: string;
  /** Override starting threat (Consilium modifier); omitted → START.threat. */
  startThreat?: number;
  /** Override starting morale (Consilium modifier); omitted → START.morale. */
  startMorale?: number;
```

(b) In `freshState()`, after the `spokeDuration: 1,` line add:

```ts
    missionId: null,
```

(c) In `startIterBelliCampaign`, after the line `S.spokeDuration = Math.max(1, Math.floor(seed.spokeDuration));` add:

```ts
  S.missionId = seed.missionId ?? null;
  if (seed.startThreat != null) S.threat = clamp(seed.startThreat, B.THREAT_MIN, B.THREAT_MAX);
  if (seed.startMorale != null) S.morale = clamp(seed.startMorale, B.MORALE_MIN, B.MORALE_MAX);
```

(`clamp` is the module-local helper; `B` is the `import * as B from './iter-belli-balance'` namespace, which exports `THREAT_MIN`/`THREAT_MAX`/`MORALE_MIN`/`MORALE_MAX`.)

- [ ] **Step 5: Run it to verify it passes**

Run: `npx tsx tools/verify-iter-belli-consilium.ts`
Expected: PASS — all checks (Task 1 + 5 seed checks) `✓`, ends with `All checks passed.`

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0 (the new state field is set by `freshState`; the seed fields are optional, so `EmbarkCard`'s existing call still compiles).

- [ ] **Step 7: Commit**

```bash
git add src/game/iterBelli/iter-belli-types.ts src/game/iterBelli/iter-belli-state.ts tools/verify-iter-belli-consilium.ts
git commit -m "feat(iterbelli): seed campaign mission + starting-stat overrides"
```

---

### Task 3: Apply Consilium setup at embark + display it

**Files:**
- Modify: `src/ui/screens/forum/panels/EmbarkCard.tsx`

- [ ] **Step 1: Add the imports**

In `src/ui/screens/forum/panels/EmbarkCard.tsx`:

(a) The first import line currently is:
```ts
import { plannedSpoke } from '../../../../game/council/council-store';
```
Change it to also import `councilSlots`:
```ts
import { plannedSpoke, councilSlots } from '../../../../game/council/council-store';
```

(b) After the existing `import { themeToTerrain } from '../../../../data/iter-belli-conquest';` line, add:
```ts
import { computeConsiliumSetup, getMissionById } from '../../../../data/iter-belli-consilium';
```

- [ ] **Step 2: Compute the Consilium setup in the component body**

In `EmbarkCard(...)`, just after the line `const army = preparedArmy.value;` add:

```ts
  const consilium = computeConsiliumSetup(councilSlots.value);
  const mission = getMissionById(consilium.missionId);
  const modSummary = [
    consilium.supplies ? `+${consilium.supplies} suministros` : null,
    consilium.threat ? `−${consilium.threat} amenaza` : null,
    consilium.gold ? `+${consilium.gold} oro` : null,
    consilium.morale ? `+${consilium.morale} moral` : null,
  ].filter(Boolean).join(' · ');
```

- [ ] **Step 3: Fold the setup into the seed**

In `handleEmbark()`, the current supplies line + seed call are:

```ts
    const supplies = army?.supplies ?? SUPPLIES_STARTING_STOCK;
    startIterBelliCampaign({ soldiers, gold: getResource('gold'), iuniores: getResource('iuniores'), discipline, archetype, spokeTerrain, spokeDuration, supplies });
```

Replace them with:

```ts
    const supplies = (army?.supplies ?? SUPPLIES_STARTING_STOCK) + consilium.supplies;
    startIterBelliCampaign({
      soldiers,
      gold: getResource('gold') + consilium.gold,
      iuniores: getResource('iuniores'),
      discipline, archetype, spokeTerrain, spokeDuration, supplies,
      missionId: consilium.missionId,
      startThreat: START.threat - consilium.threat,
      startMorale: START.morale + consilium.morale,
    });
```

(`consilium` is in component scope and captured by this closure. `START` is already imported in this file.)

- [ ] **Step 4: Render the mission + modifier block**

In the returned JSX, find the supply-warning marker line `{/* ── Supply warning ── */}`. Immediately BEFORE it, insert:

```tsx
      {/* ── Consilium: mission + modifiers ── */}
      {(mission || modSummary) && (
        <div style={{
          marginBottom: 10, padding: '8px 12px',
          background: 'rgba(212, 168, 67, 0.08)',
          border: '1px solid rgba(212, 168, 67, 0.35)',
          borderRadius: 2,
        }}>
          {mission && (
            <div style={{ fontFamily: 'var(--imp-font-display)', fontSize: 12, letterSpacing: 1, color: 'var(--imp-gold-hi)' }}>
              ⚜ Misión: {mission.title} <span style={{ color: 'var(--imp-text-lo)', letterSpacing: 0 }}>— {mission.conditionDesc} (+{mission.bonusGold}⚜)</span>
            </div>
          )}
          {modSummary && (
            <div style={{ fontSize: 10, color: 'var(--imp-text-lo)', fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic', marginTop: mission ? 4 : 0 }}>
              Consilium: {modSummary}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/forum/panels/EmbarkCard.tsx
git commit -m "feat(iterbelli): apply consilium mission+modifiers at embark and display them"
```

---

### Task 4: Show the active mission during the campaign

**Files:**
- Modify: `src/ui/screens/iterbelli/IterBelliScreen.tsx`

- [ ] **Step 1: Import the mission lookup**

In `src/ui/screens/iterbelli/IterBelliScreen.tsx`, add (with the other imports near the top — alongside the existing `import { POOL_TARGET_SIZE, ... } from '../../../game/iterBelli/iter-belli-balance';` line):

```ts
import { getMissionById } from '../../../data/iter-belli-consilium';
```

- [ ] **Step 2: Render the mission in the campaign header**

In `IterBelliScreen()`, the header currently is:

```tsx
      <header class="ib-head">
        <div class="eyebrow">Iter Belli · Campaña en Hispania</div>
        <h1>MARCHA DE GUERRA</h1>
        <div class="sub">Lleva a tus legiones de la frontera a Sagunto antes del invierno.</div>
      </header>
```

Replace it with (look up the mission from the already-available `s`):

```tsx
      <header class="ib-head">
        <div class="eyebrow">Iter Belli · Campaña en Hispania</div>
        <h1>MARCHA DE GUERRA</h1>
        <div class="sub">Lleva a tus legiones de la frontera a Sagunto antes del invierno.</div>
        {(() => {
          const mission = getMissionById(s.missionId);
          return mission ? (
            <div style={{ marginTop: 6, fontFamily: 'var(--imp-font-display)', fontSize: 13, letterSpacing: 1, color: 'var(--imp-gold)' }}>
              ⚜ Misión: {mission.title} <span style={{ color: 'var(--imp-text-lo)', letterSpacing: 0 }}>— {mission.conditionDesc}</span>
            </div>
          ) : null;
        })()}
      </header>
```

(`s` is `iterBelliState.value`, already declared at the top of the component.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/iterbelli/IterBelliScreen.tsx
git commit -m "feat(iterbelli): show active mission in campaign header"
```

---

### Task 5: Evaluate the mission at endgame + grant the bonus

**Files:**
- Modify: `src/ui/screens/iterbelli/EndgameCard.tsx`

- [ ] **Step 1: Add the import**

In `src/ui/screens/iterbelli/EndgameCard.tsx`, after the existing `import { pickConquestName, PROVINCE_REWARD } from '../../../data/iter-belli-conquest';` line add:

```ts
import { getMissionById } from '../../../data/iter-belli-consilium';
```

- [ ] **Step 2: Add the mission bonus to the gold write-back**

In `returnToHub()`, the lines currently are:

```ts
  const s = iterBelliState.value;
  const outcome = s.outcome;

  gold.value = s.gold;
  iuniores.value = s.iuniores;
```

Replace them with:

```ts
  const s = iterBelliState.value;
  const outcome = s.outcome;

  // Consilium mission: on victory, a met condition grants a gold bonus.
  const mission = getMissionById(s.missionId);
  const missionAccomplished = !!(outcome?.victory && mission && mission.condition(s));
  gold.value = s.gold + (mission && missionAccomplished ? mission.bonusGold : 0);
  iuniores.value = s.iuniores;
```

- [ ] **Step 3: Show the mission result in the endgame stats**

In `EndgameCard()`, after the line `const { victory } = outcome;` add:

```ts
  const mission = getMissionById(s.missionId);
  const missionMet = !!(victory && mission && mission.condition(s));
```

Then in the `<div class="ib-end-stats">` block, after the "Amenaza final" row (`<div><span>Amenaza final</span>...</div>`), add:

```tsx
          {mission && (
            <div>
              <span>Misión · {mission.title}</span>
              <strong style={{ color: missionMet ? 'var(--imp-gold-hi)' : 'var(--imp-text-lo)' }}>
                {missionMet ? `cumplida +${mission.bonusGold}⚜` : 'no cumplida'}
              </strong>
            </div>
          )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Re-run the verification script (regression)**

Run: `npx tsx tools/verify-iter-belli-consilium.ts`
Expected: PASS — `All checks passed.`

- [ ] **Step 6: Manual browser check** (controller performs this; implementer stops at the commit)

1. New Game → commander → Hub. Seat a **red** advisor in the first Consilium slot (and e.g. a quartermaster/`upkeep-reduction` advisor in another slot).
2. Overview → Embark card shows "⚜ Misión: Asalto — Vence en ≤ 8 días (+50⚜)" and a "Consilium: …" modifier line.
3. Embark → campaign starting supplies/threat/morale reflect the modifiers; the campaign header shows the mission.
4. Win meeting the condition → endgame shows "Misión · Asalto: cumplida +50⚜"; back at the Hub gold includes the bonus.

- [ ] **Step 7: Commit**

```bash
git add src/ui/screens/iterbelli/EndgameCard.tsx
git commit -m "feat(iterbelli): evaluate consilium mission at endgame and grant bonus"
```

---

## Notes for the implementer

- Do NOT touch bellum / node-map / battle code, `src/game/campaign/*`, `army/morale.ts`, advisor data, or the council store (read-only access to `councilSlots`). The Iter Belli logic module (`src/game/iterBelli/`) must gain only the `missionId` field — no `Advisor`/council imports there.
- Secondary side-events (Phase 2) are out of scope — do NOT implement them.
- The mission `bonusGold` numbers and the `passiveModifier` magnitudes are tunable balance constants in `src/data/iter-belli-consilium.ts` — keep them there.
- There are pre-existing, unrelated uncommitted changes in the working tree (TitleScreen.tsx, globals.css, ProvinceScreen.tsx, ForumShell.tsx). Do NOT stage or commit them — always targeted `git add`, never `git commit -a`/`-am`.
- `tools/` is not type-checked by `tsc` (tsconfig `include` is `["src"]`); the verify script is validated only by running it with `npx tsx`.
