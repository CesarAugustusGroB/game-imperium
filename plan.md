# Plan: S3-04 — Implement Miracle (Pope Innocent): spend 2 Faith, heal or smite

## Task
Replace the placeholder `onAbilityExecute` in `ability-ui.ts` with real Miracle logic. Click friendly unit → heal to full HP (golden flash). Click enemy unit → deal 2000 damage (golden smite). Costs 2 Faith per use, unlimited uses per battle if you can afford it.

## Approach
The ability UI and targeting mode already work from S3-03. Only need to replace the `console.log` placeholder with actual game logic. Use existing `BattleState` methods for damage/death and `floatingTexts` for combat text.

## Steps
1. In `ability-ui.ts`, replace the placeholder `onAbilityExecute` callback:
   - Get unit at target hex via `state.getUnitAt(targetHex)`
   - If no unit → do nothing, refund (don't deduct cost)
   - If friendly unit (faction === 'blue') → set `currentHp = stats.hp` (full heal), add golden flash + floating text "HEALED!"
   - If enemy unit → deal 2000 damage, add golden flash + shake + floating text "SMITE!", check death
   - Deduct 2 Faith only on successful target (not on empty hex)
2. Add golden flash support: set `flashTimer` on target unit (existing mechanic) + push floating text

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/battle/ability-ui.ts` | modify | Replace placeholder with Miracle execution logic |

## Out of scope
- Other commander abilities (S3-05 to S3-07)
- Custom golden flash color in renderer (reuses existing flash, S3 polish can add gold tint later)
