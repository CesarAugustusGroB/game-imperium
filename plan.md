# Plan: S2-08 — Build PostBattleScreen

## Task
After each battle, show a results screen with a VICTORY/DEFEAT/DRAW banner and let the player pick one reward before returning to the node map. On defeat, rewards are reduced.

## Approach
Create `PostBattleScreen.tsx` following the same screen component pattern. Read `lastBattleResult` for the banner. Offer 4 reward buttons (pick 1). On pick: apply reward via `addResource`, resolve the battle node via `advanceNode`, navigate to `'node-map'`. Wire into App.tsx switch.

## Steps
1. Create `src/ui/PostBattleScreen.tsx`:
   - Read `lastBattleResult`, `selectedCommander` signals
   - Banner: VICTORY (gold), DEFEAT (red), DRAW (grey)
   - 4 reward buttons: Heal Army (conceptual), Bonus Gold, Bonus Momentum, Bonus Faith
   - Victory amounts: Gold +3, Momentum +2, Faith +1; Defeat: all +1
   - On pick: `addResource`, `advanceNode`, `navigateTo('node-map')`
   - Disable buttons after first pick (signal-driven)
2. Add `PostBattleScreen` to App.tsx `ScreenContent` switch for `'post-battle'`
3. Ensure `showResourceBar` is true for `'post-battle'` (already is — only excluded for title/commander-select/battle)

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/ui/PostBattleScreen.tsx` | create | Post-battle results and reward screen |
| `src/ui/App.tsx` | modify | Add import + switch case for 'post-battle' |

## Out of scope
- Army HP healing mechanics (conceptual only in Sprint 2)
- Battle difficulty scaling
