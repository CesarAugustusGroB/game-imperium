# Plan: S2-09 — Wire resource gains (spoke tracking + faction audit)

## Task
Add a `spokeGains` tracking signal and `grantSpokeResource` wrapper so all spoke-level resource gains are accumulated for the summary screen (S2-10). Replace direct `addResource` calls with the wrapper.

## Approach
Add `spokeGains` signal and `grantSpokeResource()` to `spoke.ts`. It wraps `addResource`, passing through the return value while accumulating gains. Reset `spokeGains` in `startSpoke()`. Replace all 3 callsites (rest modal, event choices, post-battle rewards).

## Steps
1. In `src/game/spoke.ts`: add `spokeGains` signal, `grantSpokeResource()` wrapper, reset in `startSpoke()`
2. In `src/ui/NodeMapScreen.tsx`: replace `addResource` calls in rest modal and event handler with `grantSpokeResource`
3. In `src/ui/PostBattleScreen.tsx`: replace `addResource` with `grantSpokeResource`

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/spoke.ts` | modify | Add spokeGains signal + grantSpokeResource wrapper |
| `src/ui/NodeMapScreen.tsx` | modify | Use grantSpokeResource for rest/event gains |
| `src/ui/PostBattleScreen.tsx` | modify | Use grantSpokeResource for battle rewards |

## Out of scope
- Spoke completion summary screen (S2-10)
- Verifying 2x multiplier visually (already works via addResource)
