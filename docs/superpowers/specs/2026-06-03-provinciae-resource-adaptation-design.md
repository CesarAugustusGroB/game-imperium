# Provinciae — Adapt to the Live Resource Economy + Wire the Income Tick

**Date:** 2026-06-03
**Status:** Approved design, pending implementation plan

## Problem

The Provinciae (province) system still runs on the **deprecated** resources `faith` (⭐),
`influence` (👑), and `momentum` (🔥). The live player economy is `gold` (💰) and
`iuniores` (🛡️) only. Buildings, province features, governors, trade goods, and terrain
all produce/charge deprecated resources, and the UI displays them.

Worse: an audit found that `collectProvinceIncome` (the per-season income tick) **has zero
callers** — its trigger was purged with the legacy season-tick. So provinces currently
generate **nothing** (gold or otherwise). Adapting the resource data alone would be honest
but the economy still wouldn't run.

## Decisions (from the user)

1. **Deprecated income → thematic remap:** `momentum → iuniores` (military buildings/
   features grant recruits); `faith → gold` and `influence → gold` (religious/political/
   economic grant coin).
2. **Deprecated costs → gold:** every `faith`/`influence`/`momentum` amount in a
   `buildCost`/`upgradeCost`/governor hire cost folds into the gold cost (keep the price
   gate, in live currency).
3. **Wire the income tick:** make `collectProvinceIncome` actually run, so provinces pay
   out gold/iuniores per elapsed season.

## Non-Goals

- Do NOT remove `faith`/`influence`/`momentum` from `ResourceType`/`Resources` — they stay
  `@deprecated` in the type (removing them is broad churn across commander/meta-save and
  unrelated to provinces). Provinces simply stop referencing them.
- Do NOT touch the **food** system. Food is a province-local growth stat (not a spendable
  `ResourceType`); it feeds population growth → `iuniores` yield and famine/slot mechanics.
  It stays exactly as-is.
- No governor *redesign* beyond the resource remap (see the redundancy note below).

## Scope — three blocks

### Block A — Data remap (income + costs)

**Building definitions** (`src/game/province/province.ts` `INVESTMENT_DATA`):
- `incomeBonus`: `momentum: N` → `iuniores: N`; `faith: N`/`influence: N` → fold into
  `gold: (existing gold) + N`.
- `buildCost`/`upgradeCost`: `momentum/faith/influence: N` → fold into `gold: (existing
  gold) + N`. (Result: all build costs are gold-only.)

**Province features** (`src/data/province-features.ts`): change the `ProvinceFeature`
schema — drop `faithPerSeason`/`influencePerSeason`/`momentumPerSeason`, add
`iunioresPerSeason?: number`. For each feature, fold `faithPerSeason + influencePerSeason`
into `goldPerSeason`, and map `momentumPerSeason` → `iunioresPerSeason`.

**Governors** (`src/data/governor-data.ts`):
- Hire costs: `momentum/faith/influence` folded into gold.
- Income-bonus traits: Pontifex (`faith` income-bonus) and Senator (`influence`
  income-bonus) → `gold` income-bonus. (See redundancy note.)

**Trade goods** (`src/data/trade-goods.ts`): `flatFaith` → fold into the flat gold yield;
`flatMomentum` → a new `flatIuniores` field. Update the `TradeGoodData` interface
(drop `flatFaith`/`flatMomentum`, add `flatIuniores`).

**Terrain** (`src/data/terrain-data.ts`): `faithBonus`/`momentumBonus` are **display-only
orphans** (never wired into income). Remove these fields and their tooltip rows.

### Block B — Income calculation + tick wiring

**`getProvinceIncome` / `getProvinceExpenses`** (`province.ts`): produce only `gold` and
`iuniores` after the data remap. Drop the faith/influence/momentum accumulation branches.

**`collectProvinceIncome`** (`province-store.ts`): after the data remap it should
`addResource` only `gold` and `iuniores`. Remove the `nonGold`/deprecated handling and the
deprecated trade-good additions; replace with the gold/iuniores equivalents.

**Wire the tick:** call `collectProvinceIncome` from the Hub-return path
(`returnToHub` in `src/ui/screens/iterbelli/EndgameCard.tsx`), once per elapsed season —
i.e. loop `spokeDuration` times (the campaign's season count) right where `globalSeason`
advances. This makes provinces pay out for the seasons spent on campaign and advances the
per-province ticks (wealth growth, famine, unrest, population) `spokeDuration` times.
(Exact call shape — whether `collectProvinceIncome()` is one season per call or takes a
count — confirmed during planning by reading the function.)

### Block C — UI honesty (`src/ui/screens/ProvinceScreen.tsx`)

- Remove the reactive force-reads of `faith`/`influence`/`momentum`
  (`getResource('faith'|'influence'|'momentum')`); add `iuniores` if needed.
- Income ledger: the "non-gold" section now shows **iuniores** (from military buildings/
  features) instead of faith/influence/momentum. Keep gold + iuniores rows; drop the
  deprecated rows.
- Building tooltips / cost chips: now gold-only (after Block A) — naturally clean.
- Feature tooltips: show `+N gold/season` and `+N iuniores/season` (drop faith/influence/
  momentum rows).
- Terrain tooltip: drop the faith/momentum bonus rows (Block A removed the fields).

## Redundancy note (accepted)

After the remap, Procurator, Pontifex, and Senator all become **gold income-bonus**
governors (their faith/influence amplification has no source left, so it folds to gold).
This is an accepted consequence of "faith/influence → gold". A later pass could
differentiate them (e.g. give the military-leaning governor an `iuniores` income-bonus),
but that is a governor redesign, out of scope here. The plan will note it.

## Risks / edge cases

- **Balance:** folding momentum costs into gold makes some buildings modestly cheaper to
  gate (gold is more plentiful); `iuniores` income from military buildings/features is new
  spending pressure. Values stay in the data files and are tunable.
- **Tick double-run:** ensure `collectProvinceIncome` is wired in exactly one place
  (Hub return) and not also on conquest/seed, to avoid double income. Confirm in planning.
- **First run:** on the very first campaign return, provinces pay for `spokeDuration`
  seasons — expected.

## Testing

- `npx tsc --noEmit` clean; `npx vite build` succeeds.
- `tools/verify-province-resources.ts` (NEW): assert no building `incomeBonus`/`buildCost`,
  no feature, no governor, no trade good references a deprecated resource
  (faith/influence/momentum); assert `getProvinceIncome` for a sample province returns only
  `gold`/`iuniores`; assert a hand-built province with a momentum→iuniores building yields
  iuniores.
- Manual: start run → embark → finish a campaign → return to Hub → confirm gold and
  iuniores increased from provinces; open Provinciae → no ⭐/👑/🔥 anywhere; building costs
  gold-only; income ledger shows gold + iuniores.
