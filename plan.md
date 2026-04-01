# Plan: S6-07 — Implement Province income/expense cycle per season

## Task
Provinces should generate income and cost expenses each season tick. When a season boundary is crossed during a spoke, all existing provinces add their income (base + investments + governor bonuses) to the player's resources and deduct their expense cost in gold. This makes provinces a persistent economic engine across spokes.

## Approach
Add `collectProvinceIncome()` to province-store. Call it from `tickSeason()` in spoke.ts. Extend `SeasonTickResult` with province income/expense data. Display in the existing season tick modal.

## Steps
1. Add `collectProvinceIncome()` to province-store — iterates provinces, adds income via addResource(), deducts expenses via spendResource(). Returns income gained + expenses paid.
2. Extend `SeasonTickResult` in spoke.ts with province fields.
3. Call `collectProvinceIncome()` from `tickSeason()`.
4. Display province income/expenses in the season tick modal in NodeMapScreen.tsx.

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/province-store.ts` | modify | Add collectProvinceIncome() |
| `src/game/spoke.ts` | modify | Extend SeasonTickResult, call collectProvinceIncome |
| `src/ui/NodeMapScreen.tsx` | modify | Show province income in season modal |

## Out of scope
- Unrest changes per season (S6-08)
- Province population growth
