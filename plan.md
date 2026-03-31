# Plan: S5-08 — Implement advisor leveling (XP on spoke completion + tier-up notification)

## Task
Move XP grants from spoke start to spoke completion, so advisors earn experience for finishing spokes rather than starting them. Show a tier-up notification banner at the Hub when any advisor levels up.

## Approach
1. Remove the XP-grant loop from `startSpokeFromCouncil()` in council-store.ts.
2. In `handleReturnToHub()` in NodeMapScreen.tsx, loop over seated advisors, call `grantAdvisorXp()`, collect tier-up results.
3. Store tier-up advisor names in a module-level signal; display a brief banner in HubScreen when that signal is non-empty.

## Steps
1. Remove XP grant from `startSpokeFromCouncil()` (council-store.ts lines 333-338)
2. Add XP grant + tier-up collection in `handleReturnToHub()` (NodeMapScreen.tsx ~line 523)
3. Export a `tierUpNotices` signal from council-store.ts (array of advisor names)
4. In HubScreen, import `tierUpNotices` and render a dismissible banner when non-empty

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/council-store.ts` | remove XP at start, add tierUpNotices signal | correctness + notification source |
| `src/ui/NodeMapScreen.tsx` | grant XP at handleReturnToHub, populate tierUpNotices | spoke completion trigger |
| `src/ui/HubScreen.tsx` | show tier-up banner if tierUpNotices non-empty | user feedback |

## Design decisions
- **module-level signal in council-store**: keeps notification state co-located with advisor data; HubScreen just reads it
- **clear on dismiss**: user clicks a close button or banner auto-clears on next navigate-to-hub

## Test plan
- Complete a spoke → advisors gain XP, Hub shows tier-up banner if threshold crossed
- No banner if no tier-up (XP gained but no threshold crossed)
- Banner dismisses on click

## Out of scope
- XP for partial spoke completion (only full completion)
