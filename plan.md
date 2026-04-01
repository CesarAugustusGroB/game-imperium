# Plan: S6-10 — Wire Province bonuses into spoke and battle

## Task
Investment tier 2/3 special bonuses are described in text but not wired into gameplay. This task connects them: Castrum free units in battle, Basilica extra event choices, Pantheon revive, Market exchange rate bonus, Aqueduct income +10%.

## Approach
Create `getProvinceEffects()` in province-store that scans all provinces for special investment bonuses and returns DoctrineEffect-compatible objects. Wire these into the existing effect consumption points (battle start, event choices, exchange rates, income calculation).

## Steps
1. Add `getProvinceEffects()` to province-store — returns DoctrineEffect[] from investment specials
2. Wire into battle: add province effects alongside doctrine effects at battle start
3. Wire into events: add province extra-event-choices to getExtraEventChoices()
4. Wire exchange rate bonus: Market T3 improves exchange rates
5. Wire Aqueduct T3 income +10%: apply in collectProvinceIncome()

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/province-store.ts` | modify | Add getProvinceEffects() |
| `src/game/doctrine-store.ts` | modify | getExtraEventChoices() includes province bonus |
| `src/battle/index.ts` | modify | Apply province effects at battle start |
| `src/game/resources.ts` | modify | Exchange rate bonus from Market T3 |

## Out of scope
- Aqueduct population cap effect (no population growth system yet)
- Province-specific battles (all bonuses are empire-wide aggregates)
