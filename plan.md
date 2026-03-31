# Plan: S4-11 — Wire Doctrine passive effects into battle + spoke start

## Task
Wire equipped Doctrine passive effects into the battle system and spoke progression so that Doctrine buffs (stat modifiers, resource grants, unit spawns, revive, etc.) are automatically applied at the correct game moments. Battle-start effects are partially wired; spoke-start, node-resolve, revive, and income-modifier effects are missing.

## Approach
Extend the existing inline effect-application pattern rather than adding a monolithic `applyDoctrineEffects` function (which would create a circular game→battle dependency). Add typed helpers in `doctrine-store.ts` for querying effects, then wire consumers at each context point. This follows the existing codebase pattern where each subsystem pulls doctrine data as needed.

## Steps
1. **Add revive fields to BattleUnit** — `reviveThreshold?: number` and `hasRevived?: boolean` in `battle-types.ts`
2. **Add revive initialization at battle-start** — In `index.ts` enter(), read `revive` effects and set `reviveThreshold` + `hasRevived = false` on all blue units
3. **Integrate revive in death check** — In `battle-state.ts` performStrike(), before marking `isDying`, check if the unit has a revive threshold and hasn't revived yet; if so, set HP to threshold% and mark `hasRevived = true`
4. **Wire spoke-start effects** — In `spoke.ts` startSpoke(), call `getActiveEffects()` and apply `resource-per-spoke` (via `grantSpokeResource`) and `ally-units` effects (store ally count for next battle)
5. **Wire extra-event-choices** — In `NodeMapScreen.tsx`, when opening an event, query `getActiveEffects()` for `extra-event-choices` effects and increase the number of visible choices
6. **Wire income-modifier** — In `resources.ts` addResource(), apply doctrine income-modifier multipliers (similar to warProfiler pattern), using a module-level getter to avoid circular deps
7. **Add typed effect helpers** — In `doctrine-store.ts`, add `getReviveThreshold()`, `getExtraEventChoices()`, `getIncomeModifiers()` convenience helpers
8. **TypeScript check** — Run `npx tsc --noEmit`

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| src/battle/battle-types.ts | modify | Add reviveThreshold + hasRevived to BattleUnit |
| src/battle/battle-state.ts | modify | Revive logic in performStrike death check; set revive fields in addUnit |
| src/battle/index.ts | modify | Add revive effect setup in battle-start doctrine block |
| src/game/spoke.ts | modify | Apply resource-per-spoke + ally-units at spoke start |
| src/game/resources.ts | modify | Apply income-modifier from doctrines to addResource |
| src/game/doctrine-store.ts | modify | Add typed effect query helpers |
| src/ui/NodeMapScreen.tsx | modify | Extra event choices from doctrine effects |

## Design decisions
- **No monolithic applyDoctrineEffects()**: Avoids game→battle circular dependency; each subsystem pulls what it needs
- **Revive as unit fields**: Matches existing BattleUnit pattern (flags like isDying, pinnedBy)
- **Income modifier via callback**: Uses same pattern as warProfiler (module-level state pushed from game-state) to avoid circular deps
- **Effect stacking**: Loop-based application ensures multiple effects of same type compound naturally

## Test plan
- Happy paths: equip stat-modifier doctrine → see changed unit stats; equip resource-per-spoke → see resources granted at spoke start; equip revive doctrine → unit revives once on death
- Edge cases: two stat-modifier doctrines stacking; revive fires only once per unit per battle; no equipped doctrines → no errors
- Error paths: empty doctrine slots → skip gracefully

## Risks
| Risk | Mitigation |
|------|------------|
| income-modifier stacking with warProfiler | Apply doctrine modifier after warProfiler, document order |
| Revive triggering in Decretum area-damage | Same death-check path, revive applies uniformly |
| Extra-event-choices when event has fewer total choices | Only show up to available choices, extra-choices increases the pool sampled from |

## Out of scope
- `shop-discount`: No shop system exists yet
- `upkeep-reduction`: No upkeep system exists yet
- `heal-on-kill`: Requires per-kill hook in combat loop (separate task)
- Creating a formal `applyDoctrineEffects(context, payload)` function (would create circular dep)
