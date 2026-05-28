# Iter Belli — Unified supplies (one economy) — Design

## Context & goal

Supplies exist on **both** sides of the embark boundary but are disconnected:

- **Hub:** `preparedArmy.supplies` is a real, visible run resource — a stock (start
  `SUPPLIES_STARTING_STOCK = 28`, cap `SUPPLY_MAX_CARRY = 80`) bought with gold in the Exercitus
  tab (`buySupplies`, 2 supplies/gold) and shown in the Exercitus panel as `📦 28/80`.
- **Iter Belli:** `S.supplies` is a separate campaign scalar (`START.supplies = 12`, consumed
  `SUPPLY_UPKEEP_PER_TURN = 1`/turn over `timeRemaining = 12` turns; hunger crisis at ≤ 0).

Today the campaign **ignores** the Hub stock entirely — it always starts at the fixed `12`. So
buying supplies in the Hub has no effect on a campaign, and leftover campaign supplies vanish.

This feature makes supplies **one economy**: the campaign starts from the Hub army's supply
stock, consumes it on the Hub scale, and writes the remainder back on return — exactly the
`CampaignSeed` bridge pattern already used for gold/iuniores/discipline. It does **not** touch the
deprecated bellum/battle code; the Iter Belli logic module gains no run-state imports.

**Morale is explicitly out of scope.** The Hub "morale" (`army/morale.ts`) is a per-battle,
base-100 tier computed from spoke context that feeds the deprecated battle multipliers — there is
no persistent army-morale stock to carry between campaigns. So morale stays a campaign-ephemeral
0–10 scalar; only supplies are unified.

## Decisions (locked with the user)

- **Scope:** unify **supplies only** — one economy (seed from Hub stock → consume → write leftover
  back). Morale stays campaign-ephemeral.
- **Balance:** retune the campaign to the Hub scale by raising **only two constants** (per-turn
  upkeep and camp cost). Card supply deltas are **left unscaled** (they become tactical top-ups on
  top of the structural upkeep drain) — lower churn, lower risk; tunable later.

## Mechanics

### 1. Seed + write-back (the bridge)

- `CampaignSeed` gains `supplies: number`.
- `EmbarkCard.handleEmbark`: `supplies = preparedArmy.value?.supplies ?? SUPPLIES_STARTING_STOCK`
  (28 fallback when no army).
- `startIterBelliCampaign`: `S.supplies = Math.max(0, Math.floor(seed.supplies))`.
- `EndgameCard.returnToHub`: after the existing gold/iuniores write-back, set
  `preparedArmy.value = { ...army, supplies: clamp(s.supplies, 0, SUPPLY_MAX_CARRY) }`. Whatever
  the campaign consumed is lost; the remainder returns to the Hub, capped at 80. (The cohort-HP
  scaling block already rebuilds `preparedArmy.value`; the supplies write must be folded into that
  same reassignment so it is not clobbered — see Architecture.)

### 2. Retune to the Hub scale (two constants only)

The Hub stock (28–80) is ~2.3× the old campaign scale (12). To keep supplies a meaningful
constraint over ~12 turns, raise the structural drain:

- `SUPPLY_UPKEEP_PER_TURN`: `1 → 2` (−24 over a full campaign: a 28-stock army runs tight, an
  80-stock army runs comfortably).
- `CAMP_SUPPLY_COST`: `2 → 4`.
- `START.supplies` (the `freshState` default, used only when no seed is supplied): `12 → 28`, for
  coherence with the Hub scale.

**Card supply deltas are NOT changed.** The ~9 card supply numbers (+6/+14/+10/+12 resupplies;
−2/−3/−1/−8 costs/penalties, in `iter-belli-cards.ts`) stay as-is — tactical adjustments layered
on the upkeep budget. They remain tunable constants.

Net effect: buying supplies with gold in the Hub before embarking genuinely matters (more stock →
easier campaign → more leftover returned).

### 3. Fix the EmbarkCard supply warning

The current warning computes `suppliesNeeded = cohortCount * unresolvedNodes.length` — a bellum
**node** concept that Iter Belli does not use (Iter Belli has no nodes), so the warning is stale
and misleading. Replace it with one that reflects the unified model:

- `recommended = SUPPLY_UPKEEP_PER_TURN * START.timeRemaining` (the full-campaign upkeep budget,
  currently 2 × 12 = 24 — self-adjusting if the constants change).
- `supplyWarning = canEmbark && (preparedArmy.value?.supplies ?? 0) < recommended`.
- Message: e.g. `Supplies: {have}/{recommended} — buy more in Exercitus or the campaign may starve`.

## Architecture & components

All changes confined to the Iter Belli module + the embark/endgame bridge. No bellum/battle/
campaign edits; no new run-state imports in `src/game/iterBelli/`.

- **`src/game/iterBelli/iter-belli-balance.ts`** — bump `SUPPLY_UPKEEP_PER_TURN` (1→2),
  `CAMP_SUPPLY_COST` (2→4), `START.supplies` (12→28).
- **`src/game/iterBelli/iter-belli-state.ts`** — `CampaignSeed` gains `supplies: number`;
  `startIterBelliCampaign` sets `S.supplies = Math.max(0, Math.floor(seed.supplies))`.
  (`freshState`/`resetIterBelli` already initialise `supplies` from `START.supplies`, which now
  defaults to 28 — no extra edit.)
- **`src/ui/screens/forum/panels/EmbarkCard.tsx`** — add `supplies` to the seed
  (`preparedArmy.value?.supplies ?? SUPPLIES_STARTING_STOCK`); replace the node-based supply
  warning with the upkeep-budget warning. Imports `SUPPLIES_STARTING_STOCK` from
  `config/game-config` and `SUPPLY_UPKEEP_PER_TURN` + `START` from `iter-belli-balance`.
- **`src/ui/screens/iterbelli/EndgameCard.tsx`** — in `returnToHub`, fold the supplies write-back
  into the existing `preparedArmy.value = { ...army, ... }` reassignment so cohort-scaling and the
  supplies write happen in one update: `supplies: Math.max(0, Math.min(SUPPLY_MAX_CARRY, s.supplies))`.
  Imports `SUPPLY_MAX_CARRY` from `config/game-config`. (When `army` is null — no prepared army —
  there is nothing to write back, matching today's cohort-scaling guard.)

### Data flow

`EmbarkCard` (preparedArmy.supplies) → `startIterBelliCampaign({ …, supplies })` → `S.supplies`
→ campaign consumes it (upkeep 2/turn, camp 4, card deltas) → `EndgameCard.returnToHub` writes
`clamp(S.supplies, 0, 80)` back onto `preparedArmy.supplies` → visible again in the Exercitus
panel. One stock, round-tripped.

## Verification

New `tools/verify-iter-belli-supplies.ts` (run with `npx tsx`):
- Retuned constants: `SUPPLY_UPKEEP_PER_TURN === 2`, `CAMP_SUPPLY_COST === 4`, `START.supplies === 28`.
- Seed applies: `startIterBelliCampaign({ …, supplies: 50 })` → `iterBelliState.value.supplies === 50`.
- Seed sanitises: negative/fractional seed → floored, `≥ 0`.
- `resetIterBelli` restores `supplies` to the `START.supplies` default (28).
- (The write-back clamp and the EmbarkCard warning touch Preact signals + the province/army
  stores, so they are verified in the browser; the script covers the pure seed + constants.)

Plus:
- `npx tsc --noEmit` → 0.
- Browser: Exercitus → buy supplies (watch `📦 N/80` rise) → embark → the Iter Belli supply chip
  shows that stock (not 12) → play/camp and watch it drain on the new scale → finish → back at the
  Hub the Exercitus panel shows the leftover (not the original stock). With low Hub supplies, the
  embark card shows the new upkeep-budget warning.

## Out of scope / notes
- Morale unification (no persistent Hub morale stock; would require touching `army/morale.ts`
  which feeds deprecated battles).
- Card supply deltas are intentionally left on the old numbers (tactical top-ups); rescaling them
  ×2 was considered and declined for churn/risk.
- No upper cap on supplies *during* the campaign (resupply cards may push it past 80); the 80 cap
  applies only on write-back, matching the Hub carry cap.
- The `buySupplies` flow, `SUPPLIES_PER_GOLD`, and the Exercitus panel are unchanged.
