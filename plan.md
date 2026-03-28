# Plan: S2-07 — Implement Event node (modal with choices, 5 hardcoded events)

## Task
Narrative choice nodes — when the player clicks an event node, show a modal with a scenario description and 2-3 choice buttons. Each choice has resource effects (gains via `addResource`, costs via `spendResource`). Unaffordable choices are greyed out.

## Approach
Create `src/data/events.ts` with typed event data (5 events). In `NodeMapScreen`, wire the event node click to open a `NodeModal` populated from the event data. Choice buttons show colored resource effects; clicking one applies effects and advances the node.

## Steps
1. Create `src/data/events.ts` — `GameEvent` and `EventChoice` types, 5 hardcoded events
2. In `NodeMapScreen`:
   a. Add `showEventModal` signal and `activeEvent` signal
   b. On event node click → pick event (by node position for determinism), set signals
   c. Render `NodeModal` with event title, description, choice buttons
   d. Each choice button shows resource effects (green for gain, red for cost)
   e. Grey out unaffordable choices (use `canAfford`)
   f. On choice click → apply effects → `advanceNode()` → close modal

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/data/events.ts` | create | Event type definitions and 5 starter events |
| `src/ui/NodeMapScreen.tsx` | modify | Wire event node click to event modal with choices |

## Design decisions
- **Pattern**: Reuses `NodeModal` from S2-06; event data is pure data (easy to extend in Sprint 7)
- **DRY**: Choice effect rendering shares RESOURCE_INFO colors/icons with rest modal

## Out of scope
- Procedural event generation (Sprint 7)
- Persistent event consequences beyond immediate resource effects
