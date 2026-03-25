# Plan: Armies in tactical battle may move the same as the ones in the strategic map

## Task
Tactical battle units currently move only 1 hex at a time (click adjacent hex). Strategic map armies have multi-step pathfinding with queued movement — click a distant province and the army walks the full path automatically. This feature brings that same movement model to tactical battles: click any reachable hex and the unit pathfinds + walks through each hex along the route with smooth animation.

## Approach
Mirror the strategic `ArmyData.path[]` queue pattern onto `BattleUnit`. Add a `path: Hex[]` queue, a `findPath()` BFS function, and update the animation loop to advance through the path one hex at a time. The input handler changes from "only adjacent hexes" to "any reachable hex within movement range" using right-click for move (like strategic map). Keep left-click for select/attack.

## Steps
1. Add `path: Hex[]` field to `BattleUnit` interface
2. Add `findPath(from, to): Hex[]|null` BFS method to `BattleState` (reuse existing `findStepToward` logic but return full path)
3. Add `moveUnitAlongPath(unitId, target)` method that sets the full path queue and starts walking
4. Update `updateAnimations()` to advance through the path queue when a hop completes (like strategic `update()` does with `army.path.shift()`)
5. Update `getMovementRange()` to return all hexes reachable within `MOVE_RANGE` (BFS flood-fill, not just neighbors)
6. Update `BattleInput` — right-click moves to any valid hex in range, left-click selects/attacks
7. Update `BattleRenderer` to draw the planned path (dashed line like strategic map)
8. Update battle AI to use multi-hex pathfinding with `moveUnitAlongPath()`

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/battle/battle-state.ts` | modify | Add `path` to BattleUnit, add `findPath()`, `moveUnitAlongPath()`, `getReachableHexes()`, update `updateAnimations()` to consume path queue |
| `src/battle/battle-input.ts` | modify | Right-click to move to distant hex in range, left-click for select/attack |
| `src/battle/battle-renderer.ts` | modify | Draw planned path visualization (dashed line through hex centers) |
| `src/battle/battle-ai.ts` | modify | Use `moveUnitAlongPath()` for multi-hex moves toward enemy |

## Design decisions
- **Pattern**: Mirror strategic army's `path[]` queue + `progress` interpolation — proven pattern already in codebase
- **Movement range**: `MOVE_RANGE = 3` hexes per action to keep tactical feel (strategic armies have unlimited range, but tactical should be bounded)
- **Input**: Right-click = move (matches strategic map convention), left-click = select/attack
- **Path blocking**: Units block pathfinding (can't walk through occupied hexes)
- **Animation**: Reuse existing `prevHex`/`moveProgress`/`easeOutCubic` — each hop animates individually, queue advances on completion

## Test plan
- Happy paths: select unit, right-click distant hex within range, unit walks full path with smooth per-hop animation
- Edge cases: click hex beyond range (no move), click occupied hex (no move), path blocked by units
- Error paths: no valid path, click outside grid

## Risks
| Risk | Mitigation |
|------|------------|
| Movement range too large trivializes tactics | Default to 3 hexes, easy to tune |
| Path animation conflicts with AI turn | AI runs per-round; animations are just visual interpolation |

## Out of scope
- Terrain/movement cost per hex type
- Turn-based movement points system
- Fog of war / visibility range
