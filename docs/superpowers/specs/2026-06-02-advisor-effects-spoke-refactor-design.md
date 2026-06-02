# Advisor Effects — Retire "Spoke", Tell the Truth, Redesign Fake-Resource Advisors

**Date:** 2026-06-02
**Status:** Approved design, pending implementation plan

## Problem

The legacy "spoke" progression system and its per-spoke "season-tick" were purged, but
the advisor (Consilium) effect layer still speaks in spokes. The Consilium "SEATED
BONUSES" panel shows labels like "+5 GOLD EACH SPOKE" / "-1 ENEMY THREAT" that are
factually wrong: after the purge those bonuses are applied **once, at embark**, folded
into the Iter Belli campaign's starting seed — not per spoke, not even per season.

An investigation (see the code-explorer report in the task history) found three classes
of rot:

1. **Stale labels** — user-visible "spoke" / "per spoke" / "Each Spoke" / "between nodes"
   strings across the Consilium UI, advisor/doctrine data descriptions, the doctrine
   renderer, and the province screen.
2. **Dead code** — three exported-but-never-called aggregators in `council-store.ts`
   (`advisorSpokeGrants`, `advisorUpkeepReduction`, `advisorThreatReduction`), and
   doctrine `resource-per-spoke` effects that flow into no live code path.
3. **Fake resources** — five advisors (Siege Master, Scholar, Pontifex, Zealot, Consul)
   advertise `Momentum`/`Faith`/`Influence` per spoke, but those resources are
   `@deprecated` and the player actually just receives **gold** (the `passiveModifier`
   bridge folds all deprecated resources to gold). So five distinct advisors collapse to
   "secretly give gold."

## Decisions (from the user)

- **Cadence:** label the truth — bonuses are **one-shot at embark / campaign start**. Do
  NOT reintroduce a per-season recurrent grant. (Option "Etiquetar la verdad".)
- **Fake-resource advisors:** **redesign** them — give each a distinct, thematic effect on
  a real campaign-seed lever instead of disguised gold. (Option "Rediseñar esos efectos".)

## Scope — three blocks

### Block A — Truthful relabel (no behavior change)
Rename user-visible stale strings to reflect the real one-shot-at-embark behavior. No
mechanics change. Sites (exact lines to confirm at implementation):
- `src/ui/screens/forum/tabs/ConsiliumTab.tsx` — `describePassive` ("oro por spoke" →
  "oro al embarcar"; "amenaza/temporada", "upkeep de temporada" → embark-truthful) and
  `splitPassiveDescription` BonusCard labels ("…Each Spoke" → "…al Embarcar" / "at
  Campaign Start").
- `src/data/advisor-data.ts` — `AdvisorTier.description` strings ("per spoke",
  "between nodes") → embark-truthful, for ALL advisors (including Healer/Veteran/
  Quartermaster/Spymaster/Merchant/loot trio/Smuggler), so descriptions match reality.
- `src/ui/components/DoctrineRenderer.tsx` lines 89/124 ("/ spoke", "per spoke").
- `src/data/doctrine-data.ts` level descriptions ("+N gold per spoke.").
- `src/ui/screens/ProvinceScreen.tsx` per-spoke income/feature display strings.
- `src/game/council/council-store.ts` comments referencing spokes.

Internal field/type names that stay (deliberately kept, not user-facing):
`spokeTerrain`, `spokeDuration` (Iter Belli seed fields), `SpokeTemplate`/`spokeTemplate`/
`Posture` (advisor campaign-duration planning), `province.ts` spoke refs. These are
out of scope — renaming them is churn with no user benefit. (A follow-up could rename
`SpokeTemplate` → `CampaignTemplate`, but not here.)

### Block B — Dead-code cleanup
- Delete the three orphaned aggregators in `council-store.ts`: `advisorSpokeGrants`,
  `advisorUpkeepReduction`, `advisorThreatReduction` (exported, zero call-sites). Remove
  their now-dead imports/comments. Verify nothing references them (tsc + grep).
- Doctrine `resource-per-spoke` effects (in `doctrine-data.ts`) flow into no live path
  (`getEmbarkBonus` only reads `embark-bonus` effects). **Convert** them to
  `embark-bonus { stat: 'gold' }` so the gold is actually granted at embark and the label
  is true. (Keep the gold value; just change the effect type + label.)

### Block C — Redesign the five fake-resource advisors
Each loses its `resource-per-spoke` (deprecated-resource) passive and gains a distinct,
thematic effect on a real campaign-seed lever, applied at embark. Tiers I/II/III
(magnitudes tunable):

| Advisor | Theme | New passive | I / II / III | Seed lever |
|---|---|---|---|---|
| Siege Master | siege / break the foe | `enemy-weaken` | +1 / +2 / +3 | `IterBelliState.enemyWeaken` (each pt ≈ −7% final enemy) |
| Scholar | planning / logistics | `campaign-time` | +1 / +2 / +3 days | `IterBelliState.timeRemaining` |
| Pontifex | divine blessing | `morale-bonus` | +1 / +2 / +3 | starting `morale` |
| Zealot | fervor / volunteers | `soldiers-bonus` | +250 / +450 / +700 | starting `soldiers` |
| Consul | diplomacy / legitimacy | `threat-reduction` (reuse) | −1 / −2 / −3 | starting `threat` |

#### New `AdvisorPassive` variants (`src/game/council/advisor.ts`)
Add four variants (Consul reuses the existing `threat-reduction`):
```ts
| { type: 'enemy-weaken'; amount: number }
| { type: 'campaign-time'; days: number }
| { type: 'morale-bonus'; amount: number }
| { type: 'soldiers-bonus'; amount: number }
```

#### Bridge (`src/data/iter-belli-consilium.ts`)
- Extend `ConsiliumSetup` (and the `SeedDeltas` pick) with: `enemyWeaken`, `extraDays`,
  `soldiers`. (`morale` and `threat` already exist.)
- `passiveModifier` gains cases: `enemy-weaken → { enemyWeaken: amount }`,
  `campaign-time → { extraDays: days }`, `morale-bonus → { morale: amount }`,
  `soldiers-bonus → { soldiers: amount }`. (`threat-reduction` already returns
  `{ threat: amount }`.)
- `computeConsiliumSetup` sums the three new fields.

#### Campaign seed (`src/game/iterBelli/iter-belli-state.ts` + types)
Add to `CampaignSeed`: `enemyWeaken?: number` and `extraDays?: number`.
`startIterBelliCampaign` applies them: `if (seed.enemyWeaken != null) S.enemyWeaken =
Math.max(0, seed.enemyWeaken)`; `if (seed.extraDays) S.timeRemaining += seed.extraDays`.
(`soldiers` already a seed field — EmbarkCard adds `consilium.soldiers` to the sum.)

#### Embark wiring (`src/ui/screens/forum/panels/EmbarkCard.tsx`)
Add `consilium.soldiers` to the soldiers sum, and pass `enemyWeaken: consilium.enemyWeaken`
and `extraDays: consilium.extraDays` into `startIterBelliCampaign`. (`morale`/`threat`
already wired.)

#### UI labels (`src/ui/screens/forum/tabs/ConsiliumTab.tsx`)
Add `describePassive` + `splitPassiveDescription` cases for the four new types, with
embark-truthful Spanish labels (e.g. "Erosiona al enemigo final", "+N días de campaña",
"+Moral al embarcar", "+N soldados al embarcar"). The BonusCard `value`/`label` split
should read naturally (e.g. value "+3", label "Soldados al Embarcar").

#### Advisor data (`src/data/advisor-data.ts`)
Replace the five advisors' three-tier `passive` blocks with the new types/magnitudes and
rewrite their `description` strings to match.

## Non-Goals
- No per-season recurrent income (explicitly rejected).
- No rename of internal `Spoke*` field/type names (out of scope).
- No change to Healer/Veteran/Quartermaster/Spymaster/Merchant/loot/Smuggler MECHANICS
  (only their stale labels get fixed in Block A).
- No new resource types; `gold`/`iuniores` remain the only live resources.

## Risks / edge cases
- `enemyWeaken` and `extraDays` are new seed fields — ensure they round-trip through the
  campaign persistence layer (they are plain numbers on `IterBelliState`, already covered
  by `serializeIterBelli`'s explicit field list — `enemyWeaken`/`timeRemaining` are
  already serialized; the seed only sets initial values, so no save-format change).
- Balance: `+700` starting soldiers (Zealot T3) and `−21%` enemy (Siege T3) are
  meaningful; values are tunable and isolated to `advisor-data.ts`.
- Two advisors share the `morale` lever (Pontifex via `morale-bonus`, Healer/Veteran via
  `heal-between-nodes`) and two share `threat` (Consul + Spymaster). Acceptable redundancy
  — distinct advisor identities; player rarely seats overlapping pairs.

## Testing
- `npx tsc --noEmit` clean.
- A verifier `tools/verify-advisor-effects.ts`: for each new passive type, assert
  `passiveModifier` maps it to the expected `SeedDeltas` field; assert
  `computeConsiliumSetup` sums a hand-built seated council into the expected
  `{ supplies, gold, threat, morale, enemyWeaken, extraDays, soldiers }`; assert no
  advisor in `ADVISOR_*` still uses `resource-per-spoke` with a deprecated resource; grep
  assert the three dead aggregators are gone.
- Manual: seat each redesigned advisor, open SEATED BONUSES → labels read truthfully;
  embark → campaign seed reflects the bonus (e.g. Scholar adds days, Zealot adds
  soldiers, Siege shows enemy erosion in the battle log).
