# Plan: Tactical battle animations — attack shake, damage cracks, crack+fade death

## Task
Add three visual feedback layers to hex tactical combat: (1) attack lunge + defender shake/flash, (2) accumulating damage cracks (grietas) drawn over unit sprites, (3) crack+fade death sequence. All pure Canvas 2D, non-blocking.

## Approach
Add animation state fields to `BattleUnit` (shake timer, damage ratio, death progress, crack seed). The renderer reads these fields to apply visual offsets, overlays, and alpha. `resolveCombat()` triggers animation state instead of immediately deleting dead units. `updateAnimations()` ticks all effect timers and removes units only after death animation completes.

## Steps
1. Add animation fields to `BattleUnit`: `startingStrength`, `shakeTimer`, `flashTimer`, `isDying`, `deathProgress`, `crackSeed`
2. Update `addUnit()` and `placeStartingUnits()` to initialize new fields
3. Update `resolveCombat()` to set shake/flash on damaged units, set `isDying` instead of deleting dead units
4. Update `updateAnimations()` to tick shake, flash, and death timers; remove dead units when `deathProgress >= 1`
5. Update `drawUnit()` in renderer: apply shake offset, white flash overlay, crack lines based on damage ratio, death fade
6. Add `drawCracks()` helper: seeded jagged lines radiating from center, count based on damage ratio
7. Skip dying units in AI and combat adjacency checks
8. Type-check and build

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/battle/battle-state.ts` | modify | Animation state fields, deferred death, combat triggers effects |
| `src/battle/battle-renderer.ts` | modify | Shake offset, flash overlay, crack drawing, death fade |
| `src/battle/battle-ai.ts` | modify | Skip dying units |
