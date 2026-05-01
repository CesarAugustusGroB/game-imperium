# Bellum Run Contract

Source task: S33-01

Bellum is the hex-map presentation of the same Imperium run, not a separate
demo loop. It must use the canonical 24-season clock, Doom pressure, upkeep,
province income, Final Invasion, and run-history flow that spoke runs already
use.

## Authoritative Decisions

### Clock

- Bellum uses `globalSeason` and `MAX_SEASONS` from
  `src/game/core/game-state.ts`.
- `MAX_SEASONS` remains `SEASON.max` from `src/config/game-config.ts`; no
  separate four-season Bellum cap should be introduced.
- The Bellum HUD should show the canonical clock, for example
  `globalSeason/MAX_SEASONS`, not the current placeholder `I/IV`.
- A Bellum season tick must apply the same game effects as
  `tickSeason()` in `src/game/progression/spoke.ts`: upkeep payment,
  doctrine upkeep reduction, threat increase, `globalSeason` advance, and
  province income collection.
- S33 implementation should extract the shared tick body from `tickSeason()`
  into a spoke-agnostic helper, then call it from both spoke progression and
  Bellum movement. Bellum should not create fake spoke completion just to move
  the clock.

### Bellum Movement To Season Ticks

- Movement points are the local action budget inside one global season.
- Hex path movement spends movement points by terrain cost.
- When movement points are exhausted, or the player explicitly ends the season
  after S33 adds that control, Bellum performs one canonical season tick and
  refreshes movement points for the next season.
- Bellum movement may resolve encounters before the season tick, but it must
  not bypass the clock forever. A player who keeps marching must eventually pay
  upkeep, raise Doom/threat, collect province income, and progress toward the
  Final Invasion.

### Final Invasion Trigger

- After every canonical Bellum season tick, check
  `globalSeason.value >= MAX_SEASONS`.
- Reaching the cap does not complete the run by itself.
- Once the cap is reached, Bellum enters a Final Invasion pending state:
  normal movement and non-final encounters stop being the primary objective,
  and the next forced battle must be a boss/final-invasion encounter.
- The final battle must enter BattleV2 through the same progression bridge as
  spoke battles so `computeIsFinalBattle()` sets `isFinalBattle.value` and
  final boss scaling applies.
- A final-invasion battle launched from Bellum is still a Bellum battle for
  navigation purposes, but it must not route back to the Bellum tab after the
  battle outcome.

### Victory

- Bellum victory is only awarded after winning the Final Invasion battle.
- The battle exit path should route to `victory`.
- Run history must use the same stats shape as spoke runs:
  `recordRunComplete(commander.id, commander.name, 'victory', battlesWon.value,
  globalSeason.value, provinces.value.length)`.
- The preferred implementation is to route through `EndScreen`, which already
  records completed runs with this shape, rather than adding a second recorder.

### Defeat

Bellum defeat routes to `defeat` and records run completion with the same stats
shape as spoke defeat. Defeat can be triggered by:

- losing the Final Invasion battle;
- morale collapse after Bellum movement, event, or battle fallout leaves
  `campaignState.morale <= 0`;
- starvation collapse, defined as a required Bellum traversal/season supply
  payment that cannot be paid and leaves the army unable to continue;
- army wipe, defined as no deployable player cohorts remaining in
  `preparedArmy` after movement attrition or battle HP write-back.

S33 follow-up tasks should centralize these checks in a Bellum run-status helper
instead of scattering `navigateTo('defeat')` calls across UI handlers.

### `completedSpokes`

- Bellum should not increment `completedSpokes` for ordinary hex progress.
- `completedSpokes` remains the count of completed generated spokes. It should
  only change when a real spoke is completed through the Consilium/spoke loop.
- Bellum progress is represented by the canonical run stats that already matter
  to scoring and saves: `globalSeason`, `battlesWon`, conquered province count,
  and campaign-map travel history (`visitHistory.length` / visited hexes).
- If a future score or UI needs a Bellum-specific progress number, add an
  explicit campaign progress stat instead of overloading `completedSpokes`.
- Enemy scaling for Bellum should rely on `globalSeason`, `threatLevel`, boss
  status, and final-invasion scaling. Do not inflate `completedSpokes` just to
  make the enemy generator harder.

## Implementation Notes For S33

- S33-02 should spend and refresh `movementPoints` around the canonical season
  tick contract above.
- S33-03 should reconcile Bellum `campaignState.supplies`/`morale` with the
  prepared army's existing supply and morale systems instead of keeping a fully
  separate resource loop.
- S33-04 should replace the `I/IV` HUD placeholder with the canonical
  `globalSeason/MAX_SEASONS` display and Doom/threat feedback.
- S33-05 should make Bellum battle launch distinguish normal hex battles from
  Final Invasion battles so final outcomes route to EndScreen, not Forum.
- S33-06 and later reward/completion tasks must preserve this contract: no
  silent win at the season cap, no fake spoke completion for hex movement, and
  no second run-history writer.
