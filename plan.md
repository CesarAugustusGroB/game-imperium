# Plan: S6-01 — Define Province type

## Task
Define the TypeScript Province type for the empire meta-layer. Conquered spokes become Provinces with a Ledger (Population, Income, Unrest, Expenses) and 5-color Investments.

## Approach
Create `src/game/province.ts` with the type definitions, constants, and pure helper functions. No signals or store yet — those come in later S6 tasks.

## Steps
1. Define `InvestmentType` (6 investment structures across 5 colors)
2. Define `Investment` interface (type + level 1-3)
3. Define `Province` interface (id, name, population, income, unrest, expenses, investments, governorId)
4. Export `INVESTMENT_DATA` — name, color, description, per-level effects
5. Export `getProvinceIncome(province)` — sums base income + investment bonuses
6. Export `getProvinceExpenses(province)` — base upkeep + investment costs
7. Export `getUnrestModifier(province)` — net unrest per spoke from investments
8. Export `createProvince(name)` — factory with sensible defaults

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/province.ts` | create | Province type + helpers |

## Design decisions
- **InvestmentType** uses 5 colors: castrum (red), basilica (blue), pantheon (gold), market (purple), insula (white), aqueduct (purple)
- **Income** typed as `Partial<Record<ResourceType, number>>` — provinces don't need to produce every resource
- **Expenses** is always gold — simplest model
- **No signals** — this task is types+logic only; the store/UI comes in S6-02+

## Out of scope
- Province store / signals
- Governor type (separate S6 task)
- UI
