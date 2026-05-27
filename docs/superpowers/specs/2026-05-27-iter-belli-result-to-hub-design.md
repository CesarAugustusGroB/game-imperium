# Iter Belli — Result → Hub progression — Design

## Context & goal

When an Iter Belli campaign ends, `returnToHub()` (in `EndgameCard.tsx`) currently feeds only
four things back to the run: campaign `gold` (incl. the victory bonus), `iuniores`,
`completedSpokes++` on victory, and surviving-soldier-scaled cohort HP. The run carries a much
richer progression model that the campaign result never touches: `battlesWon` (used to scale the
final boss), `globalSeason` (the season clock toward `MAX_SEASONS`), `spokesSinceLastBattle`, and
the province system (`conquerProvince` / `claimTerritory`).

This feature makes a campaign result **mean something** on the Hub by:
1. Wiring the campaign outcome to the progression signals that already exist but are ignored.
2. Granting a **conquered province** on victory, whose identity derives from the campaign's
   spoke theme.

It extends the proven `CampaignSeed` bridge (same pattern used for gold/iuniores/discipline):
the campaign captures what it needs at embark and the write-back lives in the UI layer
(`EmbarkCard` seeds, `EndgameCard.returnToHub` applies). It does **not** touch the deprecated
bellum/battle code; the Iter Belli logic module stays free of run-state imports.

## Decisions (locked with the user)

- **Scope:** connect existing progression signals **+ province conquest on victory**. Defeat
  consequences are explicitly **out of scope** (no new penalties).
- **Province identity:** **terrain** derived from the **spoke theme**; **name** picked at random
  from a flat pool of Roman/provincial place-names (not Hispania-specific, not terrain-keyed —
  the names are just flavor), and not the spoke's flavor label.
- **Province income:** **fixed** per-spoke value (not performance-scaled), for predictable
  balancing.

## Mechanics

### 1. Wire existing progression signals (in `returnToHub`)

| Signal | Today | New behavior |
|---|---|---|
| `completedSpokes` | `++` on victory | unchanged |
| `gold` / `iuniores` / cohort HP | written back | unchanged |
| `battlesWon` | never incremented | **`++` on victory** (campaign victory ⇒ the decisive battle was won; feeds final-boss scaling) |
| `globalSeason` | untouched | **`+= spokeDuration`** clamped to `MAX_SEASONS`, on **both** outcomes (time passes regardless) |
| `spokesSinceLastBattle` | untouched | **`= 0` on victory** (the campaign culminated in a battle) |

`threatLevel` (run-level threat) is intentionally **left untouched** — changing it crosses into
defeat-consequence territory, which is out of scope.

`spokeDuration` is the spoke's `duration` (1–4 seasons), captured into the campaign at embark
(see §3) so `returnToHub` is self-contained and does not depend on `plannedSpoke` still being
valid at return time.

### 2. Province conquest on victory

On victory only, `returnToHub` calls:

```ts
conquerProvince(name, PROVINCE_REWARD, 1, { terrain });
```

- **terrain** ← derived from the spoke theme (captured at embark, §3). `conquerProvince` already
  auto-claims a free map territory via `claimTerritory`, so the province appears painted on the
  map and in the Provinciae list.
- **name** ← `pickConquestName(takenNames)`: a random unused name from a flat Roman/provincial
  name pool; if all are taken, append a roman-numeral suffix (e.g. `Gades II`).
- **gains** = `PROVINCE_REWARD` (fixed), passed with **`duration: 1`** so the per-spoke income
  equals the fixed value exactly (no scaling). `conquerProvince`'s `duration` param is *only* an
  income divisor, so `1` yields `baseIncome == gains`.

Defeat (whether at the decisive battle or via early failure: army < 1000 or morale collapse)
grants **no** province and does not bump `completedSpokes`.

### 3. Seed theme + duration at embark

Extend the `CampaignSeed` bridge so the campaign carries what `returnToHub` needs:

- `EmbarkCard.handleEmbark` maps `plannedSpoke.value?.theme` → `TerrainType` via `THEME_TERRAIN`
  (default `'plains'`), reads `plannedSpoke.value?.duration ?? 1`, and passes both in the seed.
- `IterBelliState` gains `spokeTerrain: string` (a plain tag — keeps the pure module decoupled
  from `TerrainType`) and `spokeDuration: number`. `freshState` defaults `'plains'` / `1`;
  `startIterBelliCampaign` copies them; `resetIterBelli` restores defaults.
- `returnToHub` reads `iterBelliState.value.spokeTerrain` / `.spokeDuration`.

## Architecture & components

Self-contained: a new data/helper file + the embark/endgame bridge + a small seed extension.

- **`src/data/iter-belli-conquest.ts`** (new) — the conquest data + pure helper, kept out of the
  UI so it is reviewable and unit-checkable:
  - `THEME_TERRAIN: Record<string, TerrainType>` =
    `{ woodland:'forest', highlands:'mountains', marshland:'marsh', coastal:'coast', mixed:'plains' }`.
  - `CONQUEST_NAMES: string[]` — a flat pool of evocative Roman/provincial place-names (e.g.
    *Numantia, Gades, Tarraco, Corduba, Ilerda, Osca, Bilbilis, Carthago Nova, Saguntum,
    Emporiae, Carteia, Italica, …*). Not terrain-keyed; names are pure flavor and can be
    expanded freely.
  - `PROVINCE_REWARD: Record<ResourceType, number>` = fixed gains, e.g.
    `{ gold: 5, iuniores: 2, faith: 0, influence: 0, momentum: 0 }` (gold + iuniores only; the
    deprecated resources stay 0). **Tunable.**
  - `pickConquestName(taken: Set<string>): string` — returns a random name from `CONQUEST_NAMES`
    not in `taken`; if all are taken, appends a roman-numeral suffix (`<name> II/III/…`).
- **`src/game/iterBelli/iter-belli-types.ts`** — `CampaignSeed` + `IterBelliState` gain
  `spokeTerrain: string` and `spokeDuration: number`.
- **`src/game/iterBelli/iter-belli-state.ts`** — `freshState` defaults; `startIterBelliCampaign`
  copies seed fields; `resetIterBelli` restores defaults. (No new run-state imports.)
- **`src/ui/screens/forum/panels/EmbarkCard.tsx`** — map theme → terrain, read duration, add both
  to the seed.
- **`src/ui/screens/iterbelli/EndgameCard.tsx`** — `returnToHub`: add the signal wiring (§1) and
  the victory-only `conquerProvince` call (§2). Imports `battlesWon`, `globalSeason`,
  `MAX_SEASONS`, `spokesSinceLastBattle` from `game-state`; `conquerProvince` + `provinces` from
  `province-store`; the conquest data/helper from `iter-belli-conquest`.

### Data flow

`EmbarkCard` (spoke.theme → terrain via `THEME_TERRAIN`; spoke.duration) →
`startIterBelliCampaign({ …, spokeTerrain, spokeDuration })` → `IterBelliState` →
campaign plays out → `EndgameCard.returnToHub` reads `spokeTerrain`/`spokeDuration` →
applies signal wiring + (on victory) `conquerProvince(pickConquestName(taken),
PROVINCE_REWARD, 1, { terrain })` → province painted + listed; `navigateTo('hub')`.

## Verification

New `tools/verify-iter-belli-result-to-hub.ts` (run with `npx tsx`):
- `THEME_TERRAIN` maps all five spoke themes to valid `TerrainType`s; unknown/undefined → `plains`.
- `pickConquestName`: returns a name from `CONQUEST_NAMES` not in `taken`; when several are taken,
  the result is still unused; when all are taken, returns a numeral-suffixed unique name.
- `PROVINCE_REWARD` is gold+iuniores only (deprecated resources 0).
- Seed round-trip: `startIterBelliCampaign` applies `spokeTerrain`/`spokeDuration`;
  `resetIterBelli` restores defaults (`'plains'` / `1`).
- (returnToHub logic is exercised in the browser, since it touches Preact signals + province
  store; the script covers the pure pieces.)

Plus:
- `npx tsc --noEmit` → 0.
- Browser: pick a commander → embark → win the campaign → a new Hispanian province (terrain
  matching the spoke theme) appears in Provinciae and on the map; the Overview "Turn"
  (`completedSpokes`) increments; embark again and confirm a *different* toponym is granted.
  Lose a campaign → no new province, `completedSpokes` unchanged, but the season clock advanced.

## Out of scope / notes
- No `threatLevel` changes and no defeat penalties (locked: defeat consequences excluded).
- No edits to bellum/battle/campaign code; the Iter Belli logic module gains no run-state imports.
- `conquerProvince` auto-claims a free territory; if the map has none free, the province is still
  created with income (acceptable edge — same infra used at run start).
- Province income is fixed (`duration: 1` divisor); the spoke's `duration` is used only for the
  `globalSeason` advance.
