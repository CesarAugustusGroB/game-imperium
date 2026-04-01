# Plan: S6-08 — Implement Unrest System (rebellion risk, suppression)

## Task
Provinces accumulate unrest each season. Investments (Castrum, Pantheon, Insula) and governors with unrest-reduction traits counteract it. At high unrest (80+) a rebellion triggers, destroying a random investment. Expense shortfall increases unrest. Insula T2/T3 provide suppression thresholds. This creates economic pressure: neglecting provinces leads to losing investments.

## Approach
Add unrest tick logic to `collectProvinceIncome()` — since it already runs per season and iterates provinces. Add `tickProvinceUnrest()` that applies base growth + modifiers, handles expense shortfall penalty, checks rebellion threshold with suppression rules, and triggers rebellion consequences. Extend `ProvinceIncomeResult` with unrest data.

## Steps
1. Add `BASE_UNREST_GROWTH` constant and `tickProvinceUnrest()` to province-store — applies unrest changes, checks rebellion, returns results.
2. Integrate unrest tick into `collectProvinceIncome()` — update province unrest values, report rebellions.
3. Extend `ProvinceIncomeResult` with unrest/rebellion data.
4. Show rebellion warnings in season tick modal (NodeMapScreen).

## Design decisions
- Base unrest growth: +5/season (constant pressure)
- Expense shortfall penalty: +10 unrest
- Rebellion threshold: 80 unrest
- Rebellion consequence: lose a random investment (meaningful economic loss)
- Insula T2: no rebellion below 50 unrest. Insula T3: no rebellion below 70 unrest.
- Unrest clamped to 0-100.

## Out of scope
- Rebellion as a separate event/battle encounter
- Province loss (province removed entirely)
