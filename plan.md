# Plan: S2-06 — Implement Rest node (modal: heal army, gain resources)

## Task
When the player clicks a rest node on the spoke, show a modal overlay granting +1 of each resource (with faction 2x multiplier). The modal is a reusable `NodeModal` component for S2-07 events too.

## Approach
Create a generic `NodeModal` component (dark backdrop, centered panel, title + children + close). In `NodeMapScreen`, replace the rest-node auto-resolve with a signal-driven modal that calls `addResource` for each type, displays the gains, then resolves the node on "Continue".

## Steps
1. Create `src/ui/NodeModal.tsx` — reusable modal overlay with title, children, onClose
2. In `NodeMapScreen`:
   a. Add a `showRestModal` signal
   b. On rest node click → set `showRestModal.value = true` (instead of auto-advancing)
   c. Compute gained amounts using `addResource` return values
   d. Show `NodeModal` with title "Your Army Rests", body with gained resources, "Continue" button
   e. "Continue" → `advanceNode()`, close modal

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/ui/NodeModal.tsx` | create | Reusable modal overlay for rest and event nodes |
| `src/ui/NodeMapScreen.tsx` | modify | Wire rest node click to show rest modal |

## Design decisions
- **Pattern**: Same signal-driven modal as `showRetreatConfirm` — proven pattern in this codebase
- **DRY**: `NodeModal` extracted as reusable so S2-07 events don't duplicate the overlay

## Test plan
- Happy paths: click rest node → modal appears → resources granted → "Continue" resolves node
- Edge cases: faction 2x multiplier shows correct doubled amount for primary resource

## Out of scope
- Event node modals (S2-07)
- Army HP healing (no persistent HP yet — conceptual only)
