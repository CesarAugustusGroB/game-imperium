# Plan: S2-05 — Implement Battle node (transition to Canvas hex battle, return on end)

## Task
When the player clicks a battle/boss node on the spoke, transition into the existing Canvas hex battle. On battle end, capture the result (victory/defeat/draw) in a signal and route back to the appropriate screen (post-battle for in-spoke runs, title for Quick Battle).

## Approach
Minimal wiring — add a `lastBattleResult` signal, expose `BattleMode.state` as readonly, and update the exit callback to read battle outcome and route conditionally. No new UI components; this is pure plumbing between the node map click and the battle system.

## Steps
1. Add `lastBattleResult` signal (`'victory' | 'defeat' | 'draw' | null`) to `src/game/spoke.ts`
2. Change `BattleMode.state` from `private` to `readonly` in `src/battle/index.ts`
3. Update the `BattleMode` exit callback in `src/main.tsx`:
   - Read `battleMode.state.phase` and `battleMode.state.winner`
   - Map: winner === 'blue' → 'victory', winner === 'red' → 'defeat', else 'draw'
   - If `currentSpoke.value !== null` → `navigateTo('post-battle')`
   - Else (Quick Battle) → `navigateTo('title')`
   - Set `lastBattleResult.value` accordingly

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/spoke.ts` | modify | Add `lastBattleResult` signal |
| `src/battle/index.ts` | modify | Change `state` from `private` to `readonly` |
| `src/main.tsx` | modify | Wire exit callback to read battle result and route conditionally |

## Design decisions
- **Pattern**: Same signal-based reactive pattern used throughout (`currentSpoke`, `currentNodeIndex`)
- **SOLID notes**: Single Responsibility — spoke.ts owns spoke state including battle result; main.tsx owns the wiring between battle and routing
- **DRY notes**: No duplication; reuses existing `navigateTo()` and `currentSpoke` checks

## Test plan
- Happy paths: battle node click → battle starts → victory → lastBattleResult = 'victory' → navigates to post-battle
- Edge cases: Quick Battle (no spoke) → navigates to title; draw result; ESC exit
- Error paths: N/A (no new external inputs)

## Risks
| Risk | Mitigation |
|------|------------|
| `BattleMode.state` gets replaced in `enter()` — reading stale ref | Read `battleMode.state` inside the exit callback (closure captures `this`) |

## Out of scope
- PostBattleScreen UI (S2-08)
- Boss difficulty scaling (Sprint 3)
- Commander faction wired to battle sides (S3-01)
- Node advancement after battle (handled by PostBattleScreen S2-08)
