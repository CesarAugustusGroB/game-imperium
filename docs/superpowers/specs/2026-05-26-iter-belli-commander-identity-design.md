# Iter Belli — Commander Identity (discipline + signature card) — Design

## Context & goal

Earlier work stripped faith/influence/momentum from the commanders, leaving them
near-generic. The Iter Belli campaign currently starts **every** commander at the flat
`START.discipline = 4`, so the choice of commander has no mechanical effect on a campaign.

This feature gives each commander a distinct identity in Iter Belli by:
1. Setting a **per-archetype starting discipline** (which gates the battle stances available).
2. Letting the attached **Legate shift discipline by ±1** (read-only — no battle-code edits).
3. Granting each commander a **signature operation card** that recurs only in their campaigns.

It extends the proven `CampaignSeed` bridge (the same pattern used for gold/iuniores) and the
existing card-pool/`requires` system. It does **not** modify the deprecated bellum/battle code
or the legate/trait definitions — the entire discipline concept stays inside `src/game/iterBelli/`.

## Decisions (locked with the user)

- **Scope:** discipline **and** a signature card per commander (4 new cards).
- **Discipline by archetype:** Warlord **2** · Religious **3** · Merchant **4** · Diplomat **5**.
- **Legate modifier:** net **±1**, derived from the legate's existing trait ids; lives in the Iter Belli module (reads `traitIds` strings, never edits legate/battle code).

## Mechanics

### 1. Starting discipline by archetype
`DISCIPLINE_BY_ARCHETYPE: Record<Archetype, number> = { Warlord: 2, Religious: 3, Merchant: 4, Diplomat: 5 }`
where `Archetype = 'Religious' | 'Warlord' | 'Diplomat' | 'Merchant'`.

Stance gating (unchanged, for reference): disc 1 → Frontal/Retirada desordenada; 2 → +Línea
pesada/Hostigamiento; 3 → +Retirada ordenada/Reserva táctica; 4 → +Envolvimiento/Resistencia
obstinada; 5 → +Falsa retirada/Doble línea. So Boudicca (II) fights with few, blunt options;
Augustus (V) has the full repertoire.

### 2. Legate ±1
`LEGATE_DISCIPLINE_TRAIT_MOD: Record<string, number>` keyed by **existing** legate trait ids:
- **+1** (command/order): `disciplined`, `cautious`, `tactician`, `stoic`
- **−1** (reckless/chaotic): `aggressive`, `rallying`
- neutral (omitted → 0): `veteran`, `swift`, `charismatic`, `inspiring`

`legateMod = clamp(Σ mods over legate.traitIds, -1, +1)` — so the legate shifts discipline by at
most one step regardless of trait count.
`finalDiscipline = clamp(DISCIPLINE_BY_ARCHETYPE[archetype] + legateMod, 1, 5)`.

The trait ids are read as plain strings from `preparedLegate.value?.traitIds`; the map lives in
`iter-belli-balance.ts`. No import of `legate-traits.ts` / `LegateEffect`; no battle-code edits.
If a referenced trait id ever disappears it simply contributes 0 (acceptable for v1).

### 3. Signature card per commander
One archetype-gated operation card each, `locations: ['*']` so it recurs in the pool **only** for
that commander. Gating uses a new `archetype` field on `CardContext` via `requires`. All effects
reuse existing `CardEffects`/`CardCost` fields — no new effect keys.

| Commander (archetype) | id | name | category | cost | effects |
|---|---|---|---|---|---|
| Boudicca (Warlord) | `firma_furia_gala` | Furia gala | Coerción | `{ time: 1 }` | `{ morale: 2, threat: 1 }` |
| Pope Innocent (Religious) | `firma_te_deum` | Te Deum | Diplomacia | `{ time: 1 }` | `{ morale: 2.5 }` |
| Marcus Crassus (Merchant) | `firma_mercenarios` | Mercenarios de Craso | Postura | `{ time: 1, gold: 40 }` | `{ soldiers: 600 }` (requires gold ≥ 40) |
| Augustus (Diplomat) | `firma_tratado` | Tratado romano | Diplomacia | `{ time: 1 }` | `{ threat: -3 }` |

`requires` for each: `({ archetype, state }) => archetype === '<Archetype>'` (Crassus also `&& state.gold >= 40`).
Suggested `weight: 3`, `expiry: 5`. Numbers are tunable balance constants.

## Architecture & components

Self-contained in the Iter Belli module + the embark bridge. Files:

- **`src/game/iterBelli/iter-belli-types.ts`**
  - New `export type Archetype = 'Religious' | 'Warlord' | 'Diplomat' | 'Merchant'` (local — avoids importing Commander into the logic module).
  - `IterBelliState` gains `archetype: Archetype | null`.
  - `CardContext` gains `archetype: Archetype | null`.
- **`src/game/iterBelli/iter-belli-balance.ts`**
  - `DISCIPLINE_BY_ARCHETYPE`, `LEGATE_DISCIPLINE_TRAIT_MOD`, and signature-card tuning constants (Crassus gold/soldiers, etc.).
- **`src/game/iterBelli/iter-belli-state.ts`**
  - `freshState`: `archetype: null` (discipline keeps `START.discipline` as fallback).
  - `CampaignSeed` gains `discipline: number` and `archetype: Archetype | null`.
  - `startIterBelliCampaign`: `S.discipline = clamp(seed.discipline, 1, 5)`; `S.archetype = seed.archetype`.
  - `ctx()` returns `{ state: S, loc, archetype: S.archetype }`.
- **`src/data/iter-belli-cards.ts`** — the 4 signature cards (archetype-gated), importing tuning constants.
- **`src/ui/screens/forum/panels/EmbarkCard.tsx`** — compute `discipline` (archetype base + legate mod) and `archetype` from `selectedCommander` + `preparedLegate`, pass both in the seed. (Imports `selectedCommander` from game-state and `preparedLegate` from strategic-store; both are hub stores.)
- **(display, optional polish)** the discipline chip tooltip in `CampaignResourceBar.tsx` may note the commander/legate source; not required for correctness.

### Data flow
`EmbarkCard` (selectedCommander.archetype → base; preparedLegate.traitIds → ±1 mod) →
`startIterBelliCampaign({ …, discipline, archetype })` → `S.discipline`/`S.archetype` →
`ctx()` exposes `archetype` → signature cards' `requires` gate on it → pool shows the right
commander's card; discipline gates stances in the final battle (existing logic, unchanged).

## Verification
- Extend `tools/verify-iter-belli-reinforcements.ts` (or a new `tools/verify-iter-belli-commander.ts`) with:
  - `DISCIPLINE_BY_ARCHETYPE` covers all four archetypes with values 2/3/4/5.
  - legate mod: a `disciplined` legate → +1; `aggressive` → −1; both → 0; null legate → 0; net clamped to ±1; final clamped 1–5 (e.g. Diplomat 5 + disciplined stays 5; Warlord 2 − aggressive = 1).
  - each signature card exists, is archetype-gated (requires true for its archetype, false for another), and its effects/cost match the table.
  - `startIterBelliCampaign` applies seed discipline + archetype; `resetIterBelli` clears archetype to null.
- `npx tsc --noEmit` → 0.
- Browser: pick each commander → embark → discipline chip shows II/III/IV/V; with a `disciplined`/`aggressive` legate the value shifts by one; the commander's signature card appears in the pool and applies its effect; other commanders' signature cards never appear.

## Out of scope / notes
- No edits to `legate-traits.ts`, `LegateEffect`, or any battle code (respects "bellum/battles deprecated"). The legate→discipline map references trait ids by string only.
- Signature **stances** (vs cards) were considered; cards chosen because they reuse the pool system with zero battle-engine changes.
- Mid-campaign persistence remains out of scope (Iter Belli state stays ephemeral).
