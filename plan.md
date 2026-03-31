# Plan: S4-12 — Implement off-color selling (Spoils to Gold at Hub)

## Task
Add a "Merchant" section to the Hub screen where players can sell off-color Decretum (spoils) and Doctrines for gold. The sell stores and renderer components already exist — this is purely a UI wiring task.

## Approach
Extend HubScreen with a collapsible Merchant panel. Reuse existing DecretumCard and a simple doctrine card for display. Filter items using isDecretumCastable / isDoctrineEquippable to show only off-color ones. Use existing sellDecretum / sellDoctrine store functions for the actual selling.

## Steps
1. Add imports to HubScreen: decretumHand, doctrineCollection, sell functions, castability/equippability checks, renderers, sell price helpers
2. Add a Merchant section below the existing buttons showing:
   - Header with total estimated gold value
   - "Scrolls" subsection: off-color Decretum with sell buttons via DecretumCard
   - "Doctrines" subsection: off-color Doctrines with sell buttons
   - "Sell All Spoils" batch button (scrolls + doctrines)
3. Show empty state "Nothing to sell" when no off-color items exist
4. Add gold flash notification on sell (brief floating text)
5. TypeScript check

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| src/ui/HubScreen.tsx | modify | Add Merchant section with sell UI |

## Design decisions
- **Single file change**: All logic lives in HubScreen — no new files needed
- **Reuse DecretumCard**: Already has SELL tag and onSell callback
- **Inline doctrine cards**: Simpler than DoctrineSlot for a sell-only context

## Test plan
- Happy paths: off-color scroll appears in Merchant, selling adds gold, item disappears
- Edge cases: empty merchant (no off-color items), sell all with mixed items
- Error paths: none expected — store functions handle missing IDs gracefully

## Risks
| Risk | Mitigation |
|------|------------|
| None significant | Stores are tested, renderers exist |

## Out of scope
- Confirmation dialog for high-value batch sells (polish for later)
- Merchant during battle (Hub is not accessible during battle)
