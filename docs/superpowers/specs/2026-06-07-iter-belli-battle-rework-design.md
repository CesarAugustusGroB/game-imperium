# Iter Belli — Battle Rework Design Spec

**Status:** Design approved (validated via interactive prototype + 4k-battle balance sim).
**Date:** 2026-06-07
**Scope:** Replace the Iter Belli decisive-battle engine (stance/discipline) with a
formation→orders system driven by additive unit power-stats, dynamic morale, and an
organic web of subsystem trade-offs — plus a procedural 2D Canvas battle renderer.
**Prototype:** `docs/superpowers/mockups/battle-rework.html` (playable) ·
`docs/superpowers/mockups/_balance-sim.mjs` (headless balance harness).

---

## 1. Goal & motivation

The current decisive battle (`src/game/iterBelli/iter-belli-combat.ts`) is a
discipline-gated **stance** engine. Meanwhile units carry a flat 1000 HP + five
**power stats** (charge/harass/push/siege/movement) that the combat engine *never
reads* (`unit-types.ts`: "they are unit identity/ficha for now; only hp feeds the
soldiers pool"). This rework closes that gap and makes the march genuinely matter
in the battle.

The shift: **discipline→stances** becomes **discipline→formations→orders**, the dice
are kept, and the power stats become the additive base of combat.

---

## 2. Core combat model

### 2.1 Two-level gate
- **Discipline (0–10)**, legate base **2**. Does three things:
  1. unlocks **formations** (each formation has a discipline requirement),
  2. gates the **complex orders** inside a formation (per-order discipline req),
  3. grants a flat **damage bonus +5%/point**.
- **Legate** carries the army's formation pool: **common** formations (every legate)
  + **unique** formations unlocked by the legate's **traits**. No legate → commons only.
- **Pre-battle:** the player picks ONE formation from the available pool (gated by
  discipline + legate trait). It is **fixed for the whole battle** = the army's identity.
- The chosen formation defines the **order set** available each round.

### 2.2 Additive power stats (the central fix)
The army's five power stats are **summed across the cohort roster**, then **scaled by
the army's current strength fraction** on arrival:

```
strengthFrac   = clamp(state.soldiers / state.initialSoldiers, 0, 1)
HP (battle)    = state.soldiers                      // the pool itself
mass stats     = Σ(roster stat) × strengthFrac       // charge, harass, push, siege
movement       = Σ(roster movement)                  // NOT scaled — maneuver is not mass
```
Rationale (concern #1): a battered army is weaker on **two** axes (less HP *and* less
punch), but keeps its ability to maneuver/flee. The march (hunger, skirmishes,
ambushes that drain `soldiers`) now drives both HP and offensive power into the battle.

Power stats feed combat two ways:
1. **Base effectiveness** of each order (damage ≈ keyStat × die × …).
2. **Skill checks** (movement orders): `die + movement ≥ threshold`.

### 2.3 The dice (kept) + tiered center
- You and the enemy each roll a base **d6**.
- A **central point** is contested. A position bar (−100…+100) moves **only via push
  orders**. Control is tiered: each tier **grows the die by one face** (d6→d7→d8→d9,
  cap +3). The die size is set by control earned in *prior* rounds (no same-round
  feedback loop). *Legate-alterable later (hook in `centerTier`).*
- The center also grants a **type bonus** by terrain (see 2.6) to whoever holds it —
  but holding the center **exposes you to flanking crits** (double-edged).

### 2.4 The five subsystems (organic trade-offs, NOT a counter-matrix)
| Subsystem | Mechanic | Risk / counter |
|---|---|---|
| 🛡 **Push** | Moves/holds the **center** (grows your die) + deals damage. Safe. | Exposes you to **flank** crits. |
| 🪨 **Harass** | Safe ranged damage; **consumes ammunition**. | Cedes the center (no push); blunted by **armor**. |
| 🐎 **Charge** | **Impact + recoil**, risk/reward on the die. Big burst + morale shock. | A **braced** defensive line (Hold the Line) amplifies recoil (×1.8) and halves impact (×0.6); a low roll leaves you exposed. |
| 🏹 **Siege** | **Pierces armor AND fortification.** | Weak vs light mobile troops. |
| 👣 **Movement** | Skill-check maneuvers: **envelop** (temp encirclement), **flank** (crit vs center-holder), **hit & run** (damage + evasion), **retreat**. | Fails below threshold (round lost). |

Counters emerge from **context**, not a matrix: armor↔siege, brace↔charge, push steals
the center from a harasser, flank punishes the center-holder, movement answers a turtle.

### 2.5 Dynamic morale (two-way; 0–10)
- **Inherited** from the campaign at battle start; **written back** when the battle ends
  (concern #2). `applyBattleOutcome(victory, survivors, finalMorale)` already exists.
- Morale moves **up and down** each round. Each order carries `selfMorale` / `enemyMorale`.
- **Loss this round** = `(casualtyFraction × MORALE_K + incomingMoraleHits + encircle)`
  × `(1 − discipline × MORALE_RESIST)`, plus un-resisted self-cost of reckless orders.
  Defensive (brace) reduces casualty-morale; the **Camp** center regenerates it.
- Morale **affects damage live**: Steady (>6) full · Shaken (3–6) −dmg, bold orders
  locked · Wavering (1–3) heavy penalty · **Broken (0) → rout = battle ends**.
- **Two win paths:** break the enemy's morale (the common, historical outcome) or
  annihilate the HP pool (rare; mainly via encirclement). Morale-dominant is intended
  (concern #9). HP matters as a morale buffer + the survivor count returned to the Hub.

### 2.6 Center types ← terrain (concern #6)
The center type derives from `state.spokeTerrain`, not random:
`plains→Open Plain (+25% charge to holder)` · `hills→Hill (+15% dmg)` ·
`river→River Ford (−25% enemy charge)` · `settlement→Camp (+0.8 morale/round)` ·
`forest→Hill` (fallback). Mapping table: `TERRAIN_CENTER`.

### 2.7 Defensive variables (concern #5)
- **Armor** = an army-wide **upgradeable tier** (Material): Copper 5% / Bronze 12% /
  Iron 20% / Steel 30%. Reduces physical damage (charge/push/harass). **Siege pierces it.**
  Upgraded in the Hub with gold + gated by events. Lives on `preparedArmy`.
- **Fortification** = the **defender's** field defense (tiers: Camp 10% → Palisade 20% →
  Wall 35% → Fortress 50%). Reduces non-siege damage. **Siege pierces it.** In the
  decisive battle the enemy defends → enemy fortification (from scenario).
- **Ammunition** = a new **campaign resource** like `supplies` (seeded at embark from
  Hub stock, gold-buyable in Exercitus, consumed by harass, written back, save-migrated).

### 2.8 Retreat (concern #10)
A universal **Retreat** order = movement check `die + movement ≥ 11` (**+6 if
encircled**). Success → battle ends as defeat but the army is saved; losses scale with
discipline (ordered ~10% → rout ~25%). Failure → caught, the enemy strikes the rear.
**Mobility is your life insurance** — a fast army escapes, a slow/ringed one cannot.

---

## 3. Content

### 3.1 Formations (3 common + 3 unique)
| Formation | Disc | Source | Orders |
|---|---|---|---|
| **Battle Line** | 2 | common | Advance · Charge · Skirmish · Hold the Line · Rally |
| **Open Order** | 2 | common | Skirmish · Fire Missiles · Hit & Run · Flank · Charge · Rally |
| **Shield Wall** | 3 | common | Hold the Line · War Cry · War Drums · Taunt · Advance · Rally |
| **Triplex Acies** | 6 | trait *Roman Veteran* | Advance · Charge · Hold the Line · Line Relief · Envelopment · Rally |
| **Testudo** | 5 | trait *Engineer* (`antiMissile`) | Hold the Line · Advance · Siege Assault · Rally |
| **Cuneus (Wedge)** | 5 | trait *Shock* | Charge · Wedge · All-Out Charge · Flank · Advance · Rally |

### 3.2 Order catalog (final, tuned values from the sim)
Fields: subsystem · key stat · dmg mult · disc req · morale (self/enemy) · cost · check · special.

| Order | Sub | Stat | Mult | Disc | sM | eM | Notes |
|---|---|---|---|---|---|---|---|
| Advance | push | push | 0.55 | 2 | — | — | push 22 (moves center) |
| Hold the Line | push | push | 0.30 | 2 | — | — | defensive, `protect 0.38`, push 14 |
| Charge | charge | charge | 1.05 | 2 | — | 1.0 | impact+recoil, +0.6 shock on a landing hit |
| Skirmish | harass | harass | 0.85 | 2 | — | 0.4 | ammo 9 |
| Siege Assault | siege | siege | 1.45 | 4 | — | 0.7 | `pierce` (armor+fort) |
| Envelopment | move | movement | 1.1 | 6 | — | 1.0 | check 12 → encircle (2 rounds) |
| Flank | move | movement | 0.7 | 5 | — | — | check 9 → ×2.5 crit vs center-holder |
| War Drums | moral | — | — | 3 | sustained | — | sets drums (3 rounds) |
| Taunt | moral | — | — | 3 | — | 1.0 | |
| Rally | moral | — | — | 2 | +2.6 | — | |
| War Cry | push | push | 0.35 | 3 | +0.5 | 0.85 | push 16 |
| Fire Missiles | harass | harass | 0.8 | 4 | — | 1.4 | ammo 14 (terror) |
| Hit & Run | move | movement | 0.65 | 4 | — | 0.5 | check 9 → evasion (incoming ×0.25) |
| Wedge (Caput Porci) | charge | charge | 1.35 | 5 | — | 1.5 | `pierceBrace`, on hit seizes center |
| All-Out Charge | charge | charge | 2.2 | 6 | −3 | 2.5 | reckless, recoil ×1.5 |
| Line Relief | moral | — | — | 6 | +1.5 | — | refresh: incoming ×0.5 this round |
| Retreat | move | movement | — | 1 | — | — | check 11 (+6 encircled), ends battle |

### 3.3 Enemy archetypes (concern #4)
Enemy = **authored archetype** (aggregate army profile), referenced + parameterized by
the scenario (baseSoldiers/threat). Each teaches a counter:
- **Carthaginian Host** — Cuneus, Bronze, entrenched, high charge+movement → brace + watch flank.
- **Gallic Warband** — Open Order, Copper, no fort, furious charge, low disc → hold the wall.
- **Iberian Caetrati** — Open Order, Copper, skirmish+mobility → close fast / take center.
- **Fortified Garrison** — Shield Wall, Steel, fort 35% → **siege required**.

Enemy stats scale by its own strength (`enemyWeaken`, symmetric with §2.2).

---

## 4. Balance (validated)

Tunables in a single `BAL` block (prototype-verified at ~50% parity, 7–13 rounds,
strong discipline gradient):

```
DMG_SCALE 17 · RECOIL_SCALE 26 · CENTER_MOVE 0.55 · START_MORALE 10
MORALE_K 10 · MORALE_RESIST 0.05 · DISC_DMG 0.05 · MAX_ROUNDS 14
```

Sim results (player AI vs enemy AI, 4k battles, disc6 parity):
`Battle Line 45% · Open Order 45% · Shield Wall 59% · Triplex 49% · Testudo 39% · Cuneus 35%`;
discipline sweep `disc2 26% → disc6 46% → disc10 88%`.
Cap stalemate is decided by combined HP+morale shape (kills turtle-to-cap).

**Caveats (concern #8):** the sim is AI-vs-AI with a single fixed army; a human picks
orders better (likely wins more), and formation viability swings with real army
composition. Treat these numbers as a starting point — re-tune in playtest.
Cuneus/Testudo sitting low is *correct* for a push/armor army: formation should match
composition. **The discipline-progression pace must let the player reach roughly the
enemy's discipline by the decisive battle**, or elite formations + the damage bonus
become unreachable.

---

## 5. Data-model changes (real code)

### 5.1 `iter-belli-balance.ts`
- `DISCIPLINE_MIN 1→0`, `DISCIPLINE_MAX 5→10`, `START.discipline 4→2`.
- `DISCIPLINE_BY_ARCHETYPE` → additive bonuses on the new scale (e.g. Warlord +1,
  Religious +2, Merchant +3, Diplomat +4).
- `LEGATE_DISCIPLINE_TRAIT_MOD` net clamp ±1 → ±2.
- `ENEMY_DISCIPLINE 5→6`.
- `ROMAN[]` extend to indices 0–10 (`['—','I',…,'X']`).
- New `BAL`-style battle constants block (§4).
- New armor tiers + fortification tiers + ammo constants.

### 5.2 `iter-belli-types.ts`
- Replace `StanceName`/`StanceDef`/`DoctrineName` battle vocabulary with
  `FormationKey`/`OrderKey`/`OrderDef`/`FormationDef`/`CenterDef`.
- `ScenarioEnemy` gains: `stats` (5 power stats), `armorTier`, `formation`, `ammo`,
  `fortification`; or a referenced `EnemyArchetype`.
- `IterBelliState` gains `ammunition: number` (clamped ≥0).
- `BattleArmy`/`BattleState` reshaped to the new model (formation, orders, center,
  armor, fort, ammo, strengthFrac, encircleTurns, guardMult, drums).

### 5.3 `iter-belli-state.ts`
- `computeStartingDiscipline` clamp 0–10; recompose base 2 + archetype bonus + traits.
- `applyChange` auto-follows new clamps; add `ammunition` case.
- Seed `ammunition` in `startIterBelliCampaign` (from `CampaignSeed.ammunition`).
- `beginBattle` already feeds `state.morale` + `state.soldiers`; add power-stat sum
  (from `preparedArmy` roster) × `strengthFrac`, armor tier, formation, ammo.

### 5.4 Cohort / Hub
- `preparedArmy` gains `armorTier: { material }` (concern #5); Exercitus UI upgrade
  track (gold sink + event gating).
- Legate trait → unique-formation mapping; legate-less default = commons only (concern #7).
- Power-stat summation helper over the cohort roster.

### 5.5 Combat engine + UI
- Rewrite `iter-belli-combat.ts` to the new resolver (full replacement).
- Rewrite `BattleModal.tsx`: pre-battle **deployment screen** (pick formation, gated by
  disc + legate) + the round loop UI + the **Canvas battle renderer** (§6).
- Preserve the write-back contract (`applyBattleOutcome`).
- `iter-belli-save.ts` / persistence: migrate saves for `ammunition` + discipline scale.

---

## 6. Procedural 2D battle renderer

Full spec authored separately ("ESPECIFICACIÓN TÉCNICA DEL MOTOR GRÁFICO
PROCEDIMENTAL 2D: ITER BELLI") and prototyped in `battle-rework.html`. Summary:
- HTML5 Canvas 2D, `requestAnimationFrame`, reactive resize, `time` accumulator.
- Dynamic **battle line** `width/2 + (control/100)·(width·0.25)`; squads at ±85px.
- Procedural terrain per center type (hill contours / ford Bézier+wave / camp palisade /
  windy plain); ambient motes.
- 5-soldier squads + swaying standard (Vexillum SPQR / rebel totem); procedural breathing
  (amplitude ×2.3 when morale<3); lunge/recoil/flash FSM.
- Projectile arc physics (arrows step 0.03 / rocks step 0.015, H 50/100), pinned
  projectiles (60% chance, fade), particle explosions (alpha = life/maxLife), floating
  casualty numbers.
- `triggerVisualEffects(side, orderKey)`: charge→lunge+dust+shake10, harass→arrow volley,
  fireMissiles→fire arrows+sparks, siege→rock+shake14, moral→rising gold/purple particles.
- Screen shake (translate + 0.9 decay), red flash (`shadowBlur`).
- Strict render pipeline order (clear→shake→terrain→ambient→pinned→anim→units→
  projectiles→particles→floats→labels).

The renderer is **presentation-only** — it reads battle state and is driven by the
resolver's per-round outcomes; it must not affect combat math.

---

## 7. Implementation threads (decomposition)

Build as separate threads (brainstorm→spec→plan→exec per the integration-threads cadence),
each its own commit set:

- **Thread A — Engine & UI core.** New types + resolver + deployment screen + round-loop
  BattleModal + Canvas renderer, using **fixed stats** (not yet roster-derived). Replaces
  the stance engine end to end. The decisive milestone.
- **Thread B — Real power stats.** Sum from the cohort roster + `strengthFrac` scaling
  (concern #1); discipline 0–10 migration + drill-card progression (concern #3).
- **Thread C — Economy.** Ammunition as a campaign resource + armor tier on `preparedArmy`
  + Exercitus upgrade UI + fortification (concern #5); save migration.
- **Thread D — Identity.** Legate→formation mapping + enemy archetypes wired into
  scenarios (concerns #4, #7).

---

## 8. Resolved concerns (decision log)

1. **Power stats absent in campaign** → scale mass stats + HP by `strengthFrac`; movement unscaled.
2. **Battle morale** → inherited from campaign + written back.
3. **Discipline 1–5** → migrate to 0–10; climb via drill cards; pace to reach enemy disc.
4. **Enemy profile** → authored archetype (aggregate stats + armor + formation + fort + ammo).
5. **Ammo/armor** → ammo = campaign resource like supplies; armor = upgradeable Hub tier.
6. **Center** → derived from `spokeTerrain`.
7. **Formations** → from the legate (common + trait-unique); no legate = commons only.
8. **Balance** → validated baseline; playtest-tune (sim caveats noted).
9. **Morale-dominant outcomes** → kept (historical); HP = buffer + survivors.
10. **Retreat** → movement-check escape valve (mobility = survival).

---

## 9. Out of scope (v1)

- Mid-battle formation switching (formation stays fixed per battle).
- Per-cohort positioning/AI on the canvas (squads are aggregate visuals).
- Enemy rosters derived from real cohort lists (archetypes are authored aggregates for v1).
- Legate-altered center-tier curves (hook left in `centerTier`).
- Multiplayer / non-decisive (skirmish) battles using this engine.
