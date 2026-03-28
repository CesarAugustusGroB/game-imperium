# Plan: S2-10 — Implement spoke completion (summary screen, return to hub)

## Task
When the last node is resolved, show a summary modal with spoke stats (nodes resolved, battles won, cumulative resource gains from `spokeGains`) and a completion bonus. "Return to Hub" clears spoke state and navigates back.

## Approach
Replace the existing "Spoke Complete!" text + button in `NodeMapScreen` with a `NodeModal` showing summary stats. Apply completion bonus via `grantSpokeResource` before showing the modal. On "Return to Hub": increment `completedSpokes`, call `completeSpoke()`, navigate to hub.

## Steps
1. In `NodeMapScreen`:
   a. Add `showSpokeCompleteModal` signal
   b. When `spokeComplete` is true and modal not yet shown, apply completion bonus and show modal
   c. Replace "Spoke Complete!" block with `NodeModal` showing:
      - Title: spoke label + "Complete!"
      - Stats: nodes resolved, battles won
      - Resource gains from `spokeGains` (including bonus)
      - "Return to Hub" button
   d. "Return to Hub" calls existing `handleSpokeComplete()`

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/ui/NodeMapScreen.tsx` | modify | Replace placeholder completion with summary modal |

## Out of scope
- Procedural spoke generation (Sprint 6)
- Threat level escalation
