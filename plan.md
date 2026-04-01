# Plan: S6-04 — Build Province Management UI (Ledger + Investment Slots)

## Task
Players need a way to view their conquered provinces and invest in them. This screen is the economic heart of the empire meta-layer: a ledger showing all provinces with their stats (population, income, expenses, unrest), and an investment panel where players build/upgrade the 6 investment types (Castrum, Basilica, Pantheon, Market, Aqueduct, Insula). Governor assignment slot is shown but hiring logic is deferred to S6-06.

## Approach
Add a new `'provinces'` screen following the exact same pattern as CouncilScreen/DoctrineScreen: Preact functional component with signals, one-time CSS injection, inline styles with the established dark-panel + gold-accent theme. Extend `province-store.ts` with investment build/upgrade logic. Add investment build costs to `INVESTMENT_DATA` since they're currently missing.

Two-panel layout:
- **Left**: Province ledger (scrollable list of all provinces with key stats)
- **Right**: Detail panel for selected province (investment grid + governor slot)

This matches the Hub's two-column pattern and keeps information density manageable.

## Steps
1. **Add investment build costs** to `province.ts` — extend `InvestmentLevelEffect` with a `buildCost: ResourceCost` field and populate for all 6 investments x 3 levels.
2. **Add province-store functions** — `buildInvestment(provinceId, type)` and `assignGovernor(provinceId, governorId)` in `province-store.ts`.
3. **Register 'provinces' screen** — add to `ScreenName` union in `screens.ts`, add `VALID_SCREENS` + `REQUIRES_RUN`, wire in `App.tsx`.
4. **Build ProvinceScreen component** — new file `src/ui/ProvinceScreen.tsx` with:
   - Province ledger (left panel): scrollable list, each row shows name, pop, unrest bar, net income, expenses
   - Detail panel (right panel): selected province's 6 investment slots in a 2x3 grid, governor slot (read-only for now)
   - Build/upgrade buttons with cost display and affordability check
   - Empty state when no provinces exist
5. **Add "Manage Provinces" button to HubScreen** — in the right sidebar, a panel similar to Doctrines/Merchant with province count and navigate button.

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/province.ts` | modify | Add `buildCost` to InvestmentLevelEffect, populate costs |
| `src/game/province-store.ts` | modify | Add `buildInvestment()`, `assignGovernor()` |
| `src/ui/screens.ts` | modify | Add `'provinces'` to ScreenName union |
| `src/ui/App.tsx` | modify | Import + render ProvinceScreen |
| `src/ui/ProvinceScreen.tsx` | create | Main province management UI |
| `src/ui/HubScreen.tsx` | modify | Add Provinces panel with navigate button |

## Design decisions
- **Pattern**: Follows existing Screen pattern (ScreenName -> App switch -> component). No new abstractions.
- **State**: Selected province tracked via module-level signal in ProvinceScreen (same pattern as CouncilScreen's target slot).
- **Investment costs**: Gold-primary with faction-resource secondary at higher tiers. Tier 1 = 5g, Tier 2 = 10g + faction resource, Tier 3 = 20g + more faction resource. Balanced against 2g/spoke base income.
- **Immutable updates**: Province array updated via `provinces.value = [...provinces.value]` pattern for signal reactivity.

## Test plan
- Happy paths: Build investment in a province, upgrade to tier 2/3, verify resource deduction
- Edge cases: No provinces (empty state), all 6 investments built, can't afford (button disabled), province already has that investment type
- Error paths: N/A (UI guards via disabled states)

## Risks
| Risk | Mitigation |
|------|------------|
| Investment costs may need rebalancing | Costs defined as data, easy to tune later |
| Screen feels empty with 0-1 provinces early game | Empty state message + auto-select first province |

## Out of scope
- Governor hiring flow (S6-06)
- Province income/expense cycle per season (S6-07)
- Province map visualization (S6-09)
- Unrest mechanics (S6-08)
