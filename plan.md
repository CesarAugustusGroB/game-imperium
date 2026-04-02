# Plan: Final Boss Battle-Readiness Scaling (S9-01)

## Task
Add a `battlesWon` signal that tracks how many battles the player has won during a run,
and incorporate it into the final boss difficulty formula so aggressive spoke play
meaningfully reduces boss difficulty. Also add a late-threat factor so dragging out
seasons past 15 makes the boss harder.

## Approach
Three-file change: add the signal to `game-state.ts`, increment it in `main.tsx` on
victory, update the `bossMultiplier` formula in `src/battle/index.ts`. Sequential —
each step builds on the previous one.

## Steps
1. Add `battlesWon = signal(0)` to `game-state.ts`, zero it in `startNewRun()` and `resetRun()`
2. Export `battlesWon` and import it in `main.tsx`; increment on battle victory
3. Import `battlesWon` and `threatLevel` in `src/battle/index.ts`; update `bossMultiplier`

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/game-state.ts` | Add `battlesWon` signal; reset in `resetRun()`; zero in `startNewRun()` | New state |
| `src/main.tsx` | Import `battlesWon`; increment on `lastBattleResult === 'victory'` | Increment site |
| `src/battle/index.ts` | Import `battlesWon`; update `bossMultiplier` formula | Core formula |

## Design decisions
- **Pattern**: Extend existing signal pattern (same as `veteranStacks`, `completedSpokes`)
- **Formula**: `1.5 + provinces*0.05 - alliances*0.05 - battlesWon*0.03 + max(0, threatLevel-15)*0.02`
  - 10 battles won → -0.30 multiplier reduction (significant reward for aggression)
  - Threat 20 → +0.10 (5 levels × 0.02 — punishes passive season drain)
  - Still clamped 1.3–2.5
- **DRY**: Increment site co-located with `veteranStacks` increment (same condition)

## Test plan
- Happy path: win 10 battles → bossMultiplier 0.30 lower than zero-battle run
- Edge: 0 battles → formula unaffected (battlesWon=0 → no change)
- Edge: threat 24 → +0.18 addition from threat factor (9 levels above 15 × 0.02)
- Edge: clamp still holds — heavy province run + no battles doesn't exceed 2.5

## Risks
| Risk | Mitigation |
|------|------------|
| `battlesWon` not reset between runs | Zeroed in both `startNewRun()` and `resetRun()` |
| Import loop (battle/index.ts ← game-state.ts) | Already imports `allianceCount`, `veteranStacks` — safe |

## Out of scope
- Displaying `battlesWon` on EndScreen (S9-06 covers scoring rework)
- Any changes to non-final battle scaling
