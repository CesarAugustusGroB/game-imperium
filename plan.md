# Plan: S6-11 — Procedural spoke generator (Council-driven, preview + threat mutation)

## Task
The procedural spoke generator already exists (generateSpokeFromCouncil from S5) but the preview is unstable (re-randomized each render) and the actual spoke is identical to a fresh random roll with no connection to what was previewed. This task makes the preview deterministic (cached on advisor changes), makes embark use the cached plan with threat-based mutation (75% preserved, 25% randomized at base threat), and removes dead legacy code. Absorbs S6-13 scope.

## Approach
1. Add `plannedSpoke` signal to council-store — recomputed only when advisors change
2. Hub preview reads `plannedSpoke` (stable, no re-randomization)
3. `startSpokeFromCouncil()` clones the planned spoke and applies a chaos pass based on threatLevel
4. Remove dead `generateFixedSpoke()` and `startSpoke()` from spoke.ts

## Steps
1. **Add plannedSpoke signal** to council-store — computed by `regeneratePlannedSpoke()`, called from `seatAdvisor()` and `unseatAdvisor()`
2. **Update HubScreen** — read `plannedSpoke` instead of calling `generateSpokeFromCouncil()` each render
3. **Add `mutateSpoke()` chaos pass** — for each non-boss node, if `Math.random() < chaosPercent/100`, re-randomize node type. `chaosPercent = min(50, threatLevel * 5)`. Duration may shift ±1 at threat > 6.
4. **Update startSpokeFromCouncil()** — clone plannedSpoke, apply mutateSpoke(), set as currentSpoke
5. **Remove dead code** — delete `generateFixedSpoke()` and `startSpoke()` from spoke.ts

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/council-store.ts` | modify | plannedSpoke signal, mutateSpoke, updated startSpokeFromCouncil |
| `src/ui/HubScreen.tsx` | modify | Read plannedSpoke instead of calling generateSpokeFromCouncil() |
| `src/game/spoke.ts` | modify | Remove generateFixedSpoke + startSpoke dead code |

## Design decisions
- **Chaos formula**: `chaosPercent = min(50, threatLevel * 5)` — at threat 0: 0% chaos (exact match), threat 5: 25%, threat 10: 50% cap
- **Duration shift**: at threat > 6, ±1 season (random), clamped to 1-4
- **Boss node**: never mutated (always last, always boss)
- **Posture**: never mutated (council decision stands)

## Out of scope
- UI highlighting of mutated nodes (cosmetic, can be added later)
- Advisor-specific unique node types
