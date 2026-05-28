# Iter Belli — Consilium-driven mission + modifiers (Phase 1) — Design

## Context & goal

The seated Consilium (3 advisor slots, `councilSlots = signal<(Advisor|null)[]>`) currently has
**no effect** on an Iter Belli campaign. This feature makes the council shape each campaign at
embark:

- The **first occupied slot** sets the campaign's **main mission** (by the advisor's `color`).
- The **other occupied slots** each contribute a **passive modifier** to the campaign starting
  stats (by the advisor's `passive` effect).

This is **Phase 1** of the user's larger "Consilium shapes the campaign" vision. **Out of scope
(deferred to a later thread):** secondary side-events/objectives injected mid-campaign from the
non-first slots. This spec covers mission + modifiers only.

It extends the proven `CampaignSeed` bridge (gold/iuniores/discipline/supplies). The council→campaign
mapping lives in a new pure data/bridge module; the Iter Belli **logic** module stays decoupled
(it only stores a `missionId` string and receives starting-stat deltas — no `Advisor` import). No
bellum/battle code is touched.

## Decisions (locked with the user)

- **Phase 1 = mission + modifiers.** Secondary events deferred.
- **Mapping:** main mission by the **color** of the first-seated advisor (red/blue/gold/purple/white
  → 5 missions; many advisors share a mission). Modifiers by each other-seated advisor's existing
  **`passive`** effect. No new per-advisor data authoring.
- **Modifiers apply at seed time** as starting-stat bonuses (keeps the campaign engine untouched —
  no per-turn modifier threading), consistent with the seed-bridge pattern.

## Mechanics

### 1. Main mission (first occupied slot → color → mission)

Five missions, one per advisor color. The campaign always ends in the Sagunto battle (win/lose
unchanged); the mission overlays a **success condition** checked at campaign end. On **victory**,
if the condition holds, a **bonus** is granted on top of the base reward (the Thread-6 conquest +
gold). Losing the battle = no reward (mission irrelevant). All conditions read the final
`IterBelliState`. Numbers are tunable balance constants.

| Color (slot-0) | Mission id | Title | Success condition (victory AND …) | Bonus |
|---|---|---|---|---|
| red (Military) | `asalto` | Asalto | `turnNum <= 8` (swift assault) | +50 gold |
| blue (Diplomatic) | `pax` | Pax Romana | `threat <= 4` | +50 gold |
| gold (Religious) | `cruzada` | Cruzada | `morale >= 6` | +50 gold |
| purple (Economic) | `botin` | Botín | `gold >= 120` | +80 gold |
| white (Populist) | `legion` | Legión Intacta | `soldiers >= 0.6 * initialSoldiers` | +50 gold |

If no slot is occupied (edge case), `missionId = null` → no mission shown, no bonus (base reward
only).

### 2. Modifiers (other occupied slots → passive → starting-stat deltas)

Each occupied slot **after the first** maps its active-tier `passive` (`advisor.tiers[currentTier-1].passive`)
to seed-stat deltas, summed across those slots:

| Passive `type` | Campaign seed effect |
|---|---|
| `upkeep-reduction` (percent P) | `+round(P/100 * UPKEEP_BUDGET)` starting supplies (`UPKEEP_BUDGET = SUPPLY_UPKEEP_PER_TURN * START.timeRemaining = 24`) |
| `threat-reduction` (amount A) | `−A` starting threat (clamped ≥ 0) |
| `resource-per-spoke` gold (amount A) | `+A` starting gold |
| `loot-bonus` (percent P) | `+round(P/5)` starting gold |
| `shop-discount` (percent P) | `+round(P/5)` starting gold (cheaper purchases ≈ more gold) |
| `heal-between-nodes` (amount A) | `+round(A/100)` starting morale (clamped ≤ 10) |
| `extra-event-choices`, `resource-per-spoke` non-gold (faith/influence/momentum) | no campaign effect (skipped gracefully) |

`loot-bonus`/`shop-discount` are seed-time gold proxies in Phase 1 (no per-turn threading);
flagged tunable. Deprecated-resource passives are intentionally inert.

### 3. Display

- **Embark card:** show the active mission (title + condition) and a one-line summary of the
  modifiers the council brings (e.g. "Consilium: +5 suministros, −2 amenaza, +4 oro").
- **Campaign header / resource bar:** show the active mission title + its condition so the player
  tracks it during the run.
- **Endgame card:** a line stating whether the mission was accomplished and the bonus granted.

## Architecture & components

The council→campaign mapping is a pure data/bridge module; the campaign logic module only stores
`missionId` and receives numeric seed deltas.

- **`src/data/iter-belli-consilium.ts`** (new) — the bridge data + pure helpers:
  - `MISSIONS: Record<AdvisorColor, MissionDef>` where
    `MissionDef = { id: string; title: string; conditionDesc: string; condition: (s: IterBelliState) => boolean; bonusGold: number }`.
    (Imports `IterBelliState` type-only from `iter-belli-types`, `AdvisorColor` type-only from
    `council/advisor`.)
  - `getMissionById(id: string | null): MissionDef | null`.
  - `PASSIVE_MODIFIER(passive): { supplies: number; gold: number; threat: number; morale: number }`
    — pure mapping of one passive to seed deltas (table above; unmapped → all zero).
  - `interface ConsiliumSetup { missionId: string | null; supplies: number; gold: number; threat: number; morale: number }`.
  - `computeConsiliumSetup(slots: (Advisor | null)[]): ConsiliumSetup` — first occupied slot →
    `missionId = MISSIONS[slot.color].id`; each *other* occupied slot → summed `PASSIVE_MODIFIER`
    deltas.
- **`src/game/iterBelli/iter-belli-types.ts`** — `IterBelliState` gains `missionId: string | null`.
- **`src/game/iterBelli/iter-belli-state.ts`** — `CampaignSeed` gains optional `missionId?: string`,
  `startThreat?: number`, `startMorale?: number`. `freshState`: `missionId: null`.
  `startIterBelliCampaign`: `S.missionId = seed.missionId ?? null`; if `startThreat`/`startMorale`
  provided, set `S.threat = clamp(startThreat, THREAT_MIN, THREAT_MAX)` /
  `S.morale = clamp(startMorale, MORALE_MIN, MORALE_MAX)`. (Gold/supplies deltas are folded into
  the existing `seed.gold`/`seed.supplies` by the caller.)
- **`src/ui/screens/forum/panels/EmbarkCard.tsx`** — call `computeConsiliumSetup(councilSlots.value)`;
  add `setup.gold`/`setup.supplies` to the seed's gold/supplies; pass `missionId`,
  `startThreat = START.threat - setup.threat`, `startMorale = START.morale + setup.morale`; render
  the mission + modifier summary.
- **`src/ui/screens/iterbelli/CampaignResourceBar.tsx`** (or a small `MissionBanner`) — show the
  active mission title + condition during the campaign (reads `getMissionById(s.missionId)`).
- **`src/ui/screens/iterbelli/EndgameCard.tsx`** — on victory, evaluate
  `getMissionById(s.missionId)?.condition(s)`; if met, add `bonusGold` to the gold write-back and
  show a "Misión cumplida (+N oro)" line; else "Misión fallida".

### Data flow

`EmbarkCard` (`computeConsiliumSetup(councilSlots)`) → seed (`missionId`, gold/supplies + deltas,
`startThreat`/`startMorale`) → `startIterBelliCampaign` → `IterBelliState.missionId` + adjusted
starting stats → campaign plays → `EndgameCard.returnToHub` evaluates the mission condition and
grants the bonus. The campaign engine never imports `Advisor`/council types.

## Verification

New `tools/verify-iter-belli-consilium.ts` (`npx tsx`):
- `MISSIONS` has all 5 colors with distinct ids; `getMissionById` round-trips and returns null for
  unknown/null.
- Each mission's `condition` returns true/false correctly on crafted final states (e.g. `pax` true
  at threat 4, false at 5; `legion` true at soldiers = 60% of initial, false below).
- `PASSIVE_MODIFIER`: `upkeep-reduction 20%` → +5 supplies; `threat-reduction 2` → threat 2;
  `resource-per-spoke gold 3` → +3 gold; `loot-bonus 25%` → +5 gold; `heal-between-nodes 200` →
  +2 morale; a deprecated `resource-per-spoke momentum` → all zero.
- `computeConsiliumSetup`: first occupied slot sets `missionId` from its color and contributes NO
  modifier; other slots sum their modifiers; all-null slots → `{ missionId: null, 0,0,0,0 }`.
- Seed round-trip: `startIterBelliCampaign({ …, missionId:'pax', startThreat:0, startMorale:10 })`
  → state has `missionId='pax'`, threat 0, morale 10; `resetIterBelli` → `missionId null`,
  threat/morale back to START.

Plus `npx tsc --noEmit` → 0, the other Iter Belli verify scripts still pass, and a browser check:
seat a red advisor first → embark shows "Asalto"; seat a quartermaster (upkeep-reduction) in
another slot → starting supplies higher than the bare Hub stock; win meeting the condition → endgame
shows the bonus and Hub gold reflects it.

## Out of scope / notes
- Secondary side-events/objectives from non-first slots (Phase 2).
- Per-turn modifier effects (e.g. true per-turn upkeep reduction, live shop discount) — Phase 1
  applies modifiers as seed-time starting-stat bonuses only.
- No edits to bellum/battle/campaign code, `army/morale.ts`, advisor data, or the council store
  (read-only access to `councilSlots`).
- The campaign logic module gains only a `missionId: string` field — no `Advisor`/council imports.
