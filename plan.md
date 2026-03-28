# Plan: S2-02 — Define Spoke type and spoke signals

## Task
Add the Spoke container interface and reactive Preact signals to `src/game/spoke.ts`. These drive the NodeMapScreen (S2-04) and all node resolution flows.

## Approach
Extend `src/game/spoke.ts` — keep spoke types and spoke state together. Import `signal` from `@preact/signals` (same pattern as `game-state.ts`). No deps on `game-state.ts` or `screens.ts`.

## Steps
1. Add `Spoke` interface: `{ nodes: SpokeNode[], label: string, completed: boolean }`
2. Add `currentSpoke` signal: `Signal<Spoke | null>`, initialized to null
3. Add `currentNodeIndex` signal: `Signal<number>`, initialized to 0
4. Add `getCurrentNode()` helper
5. Add `resetSpoke()` function

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/spoke.ts` | modify | Add Spoke interface, signals, helpers |

## Out of scope
- Spoke generator (S2-03), spoke gains tracking (S2-09)
