# Plan: S3-03 — Build commander ability UI (bottom bar, costs, click to activate)

## Task
Add a DOM overlay ability bar at the bottom of the battle screen showing the selected commander's tactical ability with resource cost. Click to enter targeting mode, click a unit/hex to apply, ESC to cancel. Grey out when can't afford or on cooldown.

## Approach
Vanilla DOM (not Preact — `#app-root` is hidden during battle). Create `src/battle/ability-ui.ts` that manages an `#ability-bar` div inside `#battle-screen`. Add targeting mode state to `BattleState`. Intercept clicks in `BattleInput` when targeting is active.

## Steps
1. **Add `#ability-bar` markup + CSS** to `index.html` — fixed bottom-center bar inside `#battle-screen`
2. **Add targeting state** to `src/battle/battle-state.ts`:
   - `targetingAbility: string | null` (ability id or null)
   - `setTargeting(id: string | null)` method
   - `abilityCooldowns: Map<string, boolean>` for once-per-battle tracking
3. **Create `src/battle/ability-ui.ts`**:
   - `initAbilityBar(state: BattleState)` — populate bar from `selectedCommander.value.tacticalAbility`
   - `updateAbilityBar(state)` — refresh enabled/disabled state (called each frame from render loop)
   - `destroyAbilityBar()` — cleanup on battle exit
   - Click handler: check `canAfford` → enter targeting mode → update button visual to "targeting" state
4. **Add targeting mode to `BattleInput`**:
   - In `onClick`: if `state.targetingAbility !== null`, intercept click → resolve to hex/unit → fire ability callback → clear targeting
   - In `onKeydown`: ESC cancels targeting before deselect/exit
5. **Wire in `src/battle/index.ts`**:
   - `enter()`: call `initAbilityBar(state)`
   - `exit()`: call `destroyAbilityBar()`
   - `render()`: call `updateAbilityBar(state)` (or in main loop)
6. **Ability execution placeholder**: S3-04 through S3-07 implement actual effects. For now, `executeAbility(state, abilityId, targetHex)` logs and deducts cost.

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `index.html` | Add `#ability-bar` div + CSS | DOM structure for ability bar |
| `src/battle/battle-state.ts` | Add targeting state + cooldown tracking | State management |
| `src/battle/ability-ui.ts` | Create | Ability bar rendering + click handlers |
| `src/battle/battle-input.ts` | Add targeting intercept in onClick/onKeydown | Click redirection |
| `src/battle/index.ts` | Init/destroy ability UI on enter/exit | Lifecycle |

## Design decisions
- **Vanilla DOM, not Preact** — battle screen hides `#app-root`, so Preact components can't render here without a second root. Vanilla DOM matches the existing `#battle-hud` and `#btn-coords` pattern.
- **Targeting state on BattleState** — keeps it accessible to both ability-ui.ts and battle-input.ts without circular deps
- **Placeholder execution** — S3-04+ plug in real effects. This task only builds the UI shell + targeting flow.

## Out of scope
- Actual ability effects (Miracle, Fury Charge, Turncoat, Buy Reinforcements — S3-04 to S3-07)
- Strategic abilities (node-map level, not battle)
- Event card abilities
