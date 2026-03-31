# Plan: S6-02 — Define Governor type (name, traits, color affinity, hire cost)

## Task
Define the Governor type system for province management. Governors are assignable to provinces (via `governorId` already on Province), have color affinity (Faction), tiered traits, and per-tier hire costs. Follows the Advisor/Doctrine pattern of discriminated unions + fixed 3-tier tuples.

## Approach
Single file `src/game/governor.ts` containing all types, helpers, and a starter data set of ~6 governors (one per faction + one white universal). Mirrors `advisor.ts` structure exactly. No store or UI — those are separate tasks.

## Steps
1. Create `src/game/governor.ts` with GovernorTrait union, GovernorTier, Governor interface, helpers
2. Create `src/data/governor-data.ts` with ~6 starter governor definitions
3. Type-check with `npx tsc --noEmit`

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/governor.ts` | create | Type definitions + helpers |
| `src/data/governor-data.ts` | create | Starter governor data |

## Design decisions
- **GovernorTrait as discriminated union**: matches DoctrineEffect pattern, allows multiple traits per tier
- **hireCost on GovernorTier**: cost scales with tier (like Doctrine upgradeCost)
- **color: Faction**: uses standard `isColorMatch()` rule (unlike advisors which are unrestricted)
- **No XP/leveling on Governor**: Governors don't level — they're hired at their tier. Keeps them distinct from Advisors.

## Test plan
- `npx tsc --noEmit` passes with zero errors

## Out of scope
- Governor store (hire/assign/remove signals) — separate task
- Governor UI (province screen, hire modal) — separate task
