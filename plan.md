# Plan: S6-06 — Implement Governor Hiring + Trait Effects

## Task
Players need to hire governors from a pool and assign them to provinces. Each governor has a faction color, 3-tier progression with escalating hire costs, and traits that modify province economics (income bonuses, expense reductions, unrest suppression, investment discounts, garrison strength, population growth). This task adds the governor store, hiring/dismissal logic, trait effect calculations, and the hiring UI in the ProvinceScreen.

## Approach
Create `governor-store.ts` following the council-store pattern (pool signal + management functions). Extend `province.ts` helper functions to apply governor trait effects. Upgrade the existing governor slot in ProvinceScreen from read-only to interactive (hire picker + dismiss button). Governor tiers are fixed at hire time — tier upgrades are a future extension.

## Steps
1. **Create governor-store.ts** — `governorPool` signal (all 5 governors available at run start), `hireGovernor(governorId, provinceId, tier)` that pays cost and assigns, `dismissGovernor(provinceId)` that returns governor to pool, `getAssignedGovernorWithTier(provinceId)` lookup. Reset in game-state.ts.
2. **Apply governor trait effects** — update `getProvinceIncome()`, `getProvinceExpenses()`, `getUnrestModifier()` in `province.ts` to accept optional governor+tier and factor in `income-bonus`, `expense-reduction`, `unrest-reduction` traits. Add `getInvestmentDiscount()` helper for `investment-discount` trait.
3. **Wire governor effects into province-store** — `buildInvestment()` applies investment-discount from governor when calculating cost.
4. **Upgrade ProvinceScreen governor slot** — replace read-only slot with interactive: "Hire" button opens inline governor picker (list of available governors with cost + traits), "Dismiss" button returns governor to pool. Show active governor tier + trait summary.
5. **Wire reset into game-state.ts** — add `resetGovernorStore()` to `startNewRun()` and `resetRun()`.

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/governor-store.ts` | create | Governor pool, hire/dismiss/assign functions |
| `src/game/province.ts` | modify | Trait effects in income/expenses/unrest helpers |
| `src/game/province-store.ts` | modify | Investment discount from governor |
| `src/game/game-state.ts` | modify | Wire resetGovernorStore |
| `src/ui/ProvinceScreen.tsx` | modify | Interactive governor slot with hire picker |

## Design decisions
- **Pool model**: All 5 governors available at run start. Hiring removes from pool, dismissing returns. One governor per province, each governor assigned to at most one province.
- **Tier at hire**: Player chooses tier when hiring (tier 1/2/3 with escalating costs). No post-hire upgrades in this task.
- **Trait application**: Governor traits are percentage-based modifiers applied after investment effects. `income-bonus` multiplies specific resource income, `expense-reduction` reduces gold upkeep, `unrest-reduction` is a flat modifier. `investment-discount` reduces build costs. `garrison-strength` and `population-growth` are stored but gameplay effects deferred to S6-08/S6-10.
- **Stored state**: `governorAssignments` maps provinceId -> { governorId, tier }. Separate from Province.governorId to keep governor tier state.

## Test plan
- Happy paths: Hire governor at tier 1, verify cost paid and assignment shown. Dismiss governor, verify returned to pool.
- Edge cases: Hire at tier 3 (expensive), dismiss and re-hire to different province, all governors assigned (pool empty)
- Error paths: Can't afford → hire button disabled

## Risks
| Risk | Mitigation |
|------|------------|
| Trait percentages may over/under-tune economy | All values in data, easy to adjust |
| Governor slot UI gets crowded with picker | Inline collapsible picker, same pattern as council |

## Out of scope
- Post-hire tier upgrades (future enhancement)
- garrison-strength and population-growth gameplay effects (S6-08, S6-10)
- Governor-specific events or dialogue
