# Plan: S6-03 — Build Province creation (conquered spoke becomes province)

## Task
When a player completes a spoke (all nodes resolved, returns to hub), the spoke should become a Province. Need a province store (signals), creation trigger in the spoke-completion flow, and reset on run end.

## Approach
1. Create `src/game/province-store.ts` with a `provinces` signal and management functions.
2. Wire province creation into `handleReturnToHub()` in NodeMapScreen.tsx — the spoke's label becomes the province name, spokeGains become baseIncome.
3. Add `resetProvinceStore()` to both `startNewRun()` and `resetRun()` in game-state.ts.

## Steps
1. Create `province-store.ts` — `provinces` signal, `addProvince()`, `resetProvinceStore()`
2. In `handleReturnToHub()` — call `createProvince(spoke.label)` with spokeGains as baseIncome, add to store
3. Wire `resetProvinceStore()` into game-state.ts `startNewRun()` and `resetRun()`
4. Type-check

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/province-store.ts` | create | Province signals + management |
| `src/ui/NodeMapScreen.tsx` | modify | Trigger province creation in handleReturnToHub |
| `src/game/game-state.ts` | modify | Wire resetProvinceStore into start/reset |

## Design decisions
- **baseIncome from spokeGains**: the resources earned during the spoke become the province's recurring income — makes spoke performance meaningful
- **Scale spokeGains down**: raw spokeGains are one-time totals; divide by spoke duration to get per-spoke income rate
- **unrest starts at 20**: newly conquered territory has some initial unrest (from createProvince defaults)

## Test plan
- `npx tsc --noEmit` passes
- Complete a spoke → province appears in store with spoke label as name
- Start new run → provinces reset to empty

## Out of scope
- Province list UI in HubScreen (separate task)
- Governor assignment UI
- Investment building UI
