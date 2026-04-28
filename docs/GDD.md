# Imperium — Game Design Document

> Extracted from source, April 2026. Single source of truth for the design of the Map2D/Imperium grand strategy roguelike.

---

## 1. Vision & Pillars

### 1.1 Elevator Pitch

**Imperium** is a roguelike grand strategy game set in a Roman-imperium fantasy. Players step into the sandals of one of four commanders — Augustus, Boudicca, Pope Innocent, or Marcus Crassus — and push through procedurally-generated 24-season campaigns, fighting hex-based tactical battles, governing provinces, recruiting cohorts, and managing the slow creep of **Doom** until the climactic Final Invasion.

### 1.2 Design Pillars

1. **Every decision is a trade-off.** Taxation raises gold but grows unrest. Marching an army costs supplies. A bigger run means more power but more Doom.
2. **Strategic scope with tactical teeth.** The strategic layer sets up the tactical layer. A well-governed province funds a better army; a clever field composition survives longer in the hex grid.
3. **Reroll, don't grind.** Roguelike structure — cohorts die, doctrines reshuffle, runs end. Meta-progression is narrow (advisor levels, unlocks), not a power creep.
4. **Historical flavor, systemic theming.** Republican Rome, Gallic confederations, Carthaginians, Hellenic hoplites — each faction has a distinct visual and mechanical identity.
5. **Commander as build identity.** Picking Augustus vs Crassus isn't cosmetic — it changes your starting resources, your active abilities, and the kind of events/doctrines you lean into.

### 1.3 Genre & References

- **Roguelike deckbuilder DNA:** Slay the Spire, Monster Train (run-level variance, doctrines as "starting deck")
- **Grand strategy DNA:** EU4, CK3 (province/terrain/unrest/economy layer)
- **Tactics DNA:** Battle Brothers, Total War (hex/grid combat with role-based compositions)

### 1.4 Target Platform & Tech

- **Browser-first**, WebGL2 + Canvas2D, TypeScript + Preact + Vite
- Zero heavyweight runtime deps; hand-rolled rendering and state
- **Today's date: 2026-04-23** • Repo created **2026-03-24** • One month of active development

---

## 2. Core Loop

```
┌─────────────────────────────────────────────────┐
│  Title → Commander Select → Hub                 │
│                               │                 │
│                               ▼                 │
│              ┌───────►  Node Map (Spoke)        │
│              │                │                 │
│              │                ├─► Battle        │
│              │                ├─► Rest          │
│              │                ├─► Event         │
│              │                └─► Boss          │
│              │                │                 │
│              │                ▼                 │
│              └──────── Season Tick              │
│                               │                 │
│                               ▼                 │
│                         Doom +1, Upkeep drain   │
│                               │                 │
│                               ▼                 │
│                    Season 24? ─── Final Invasion│
└─────────────────────────────────────────────────┘
```

**The 60-second loop:** pick a node → resolve it (tactical battle, heal, event choice) → spend supplies → maybe tick a season → return to node map.

**The 20-minute loop:** complete one spoke (11 nodes) → return to Hub → recruit, re-equip, train council → launch next spoke.

**The 2-hour loop:** 24 seasons → Final Invasion boss battle → victory or defeat → meta-progression (advisor levels persist).

---

## 3. Commanders & Factions

Four commander archetypes, each with a distinct faction color, starting stash, passive, strategic ability, and tactical ability.

| # | Commander | Faction | Culture | Passive | Strategic Ability | Tactical Ability | Start |
|---|-----------|---------|---------|---------|-------------------|------------------|-------|
| 1 | **Augustus** | Blue (Diplomatic) | Roman / Imperial | **Web of Alliances** — +1 allied unit per active alliance; Influence doesn't cost allies | **Manipulate** (2 Influence) — change a node outcome, redirect war, reveal paths | **Turncoat** (3 Influence, 1/battle) — convert one enemy unit at 50% HP | 2G / 0F / 2I / 0M |
| 2 | **Boudicca** | Red (Warlord) | Gaelic / Celtic | **Veteran Stacks** — +4% damage per battle won (soft cap 12, then +1% each); lose all after 3 battle-less spokes | **War Cry** (free) — all units start battle with zero cooldown | **Fury Charge** (2 Momentum, 1/battle) — all player units lunge 2 hexes + impact damage | 2G / 0F / 0I / 3M |
| 3 | **Pope Innocent** | Gold (Religious) | Roman / Papal | **Deus Vult** — +1 Faith at spoke start; bonus Faith from prayer/relic nodes | **Call Crusade** (3 Faith) — next 3 battles +30% damage, enemies drop relics | **Miracle** (2 Faith, unlimited) — fully heal one unit OR 2000 damage to one enemy | 3G / 2F / 0I / 0M |
| 4 | **Marcus Crassus** | Purple (Merchant) | Roman / Patrician | **War Profiteer** — +50% gold from all sources; better shop prices | **Golden Opportunity** (7 Gold) — unlock bonus trade spoke (big gold, raider magnet) | **Buy Reinforcements** (3G → 6G, max 2/battle) — deploy mercenary at 70% HP | 8G / 0F / 0I / 0M |

**Resources:** G = Gold, F = Faith, I = Influence, M = Momentum.

> **Design intent:** each commander is a different answer to the core question "how do I survive 24 seasons of Doom?" — Augustus buys allies, Boudicca snowballs combat, Innocent banks faith, Crassus hires his way out.

---

## 4. Run Structure — Seasons, Spokes, Doom

### 4.1 Seasons & the Doom Clock

- **Max seasons:** 24. **Final Invasion** triggers at S24.
- **Threat** ticks +1 per season tick and scales enemy strength: `multiplier = 1 + threat × 0.05`.
- **Doom upkeep** (gold drain per season tick):
  - Threat ≥ 75: **3 gold**
  - Threat ≥ 50: **2 gold**
  - Threat ≥ 25: **1 gold**
- **Seasonal upkeep (base):** 2 gold + 1 faith. Attacking posture adds +1 gold and +1 momentum. Doctrines reduce upkeep multiplicatively.

### 4.2 Spokes & Nodes

- **Spoke length:** 11 nodes per spoke.
- **Spoke duration:** 1–4 in-game seasons (set at generation).
- **Nodes per season:** `ceil(11 / duration)`.
- **Node types:** `battle`, `rest`, `event`, `boss`.
- **Season ticking:** advances when `resolvedCount / nodesPerSeason` crosses an integer.

### 4.3 Army Supplies (FT-SUP)

- **Supplies:** 2 per 1 gold converted. Start of run: 10 stock. Max carry: 40.
- Every node advance calls `consumeTraversal()`:
  - `need = cohortCount`
  - `have >= need` → consume, clear penalty, instant morale recovery.
  - `have < need` → **each cohort takes 20% max HP damage**, cohorts at 0 HP removed, morale penalty +8 (capped at 40), deficit streak +1.

> Supplies are the hard brake on "just run through the spoke." Big armies are fragile on long spokes without refills.

### 4.4 Faction Alignment (White / Red / Gold)

Hidden alignment tracked from event choices. Biases node generation in later spokes. (Visible color flavor; mechanical gates planned.)

### 4.5 Final Invasion

Climactic boss battle at S24. Win → victory run. Lose → defeat run. Meta-progression (advisor XP) persists across runs.

---

## 5. Tactical Battle — Hex Combat

### 5.1 Grid & Geometry

- **Axial hex coords** (q, r); hex size 40 px.
- **Grid:** 20 columns × 14 rows (configurable).
- **Victory mode:** Capture (default). **Victory condition:** cohesion break (faction HP < 30% starting total) OR total wipe.

### 5.2 Combat Math

| Parameter | Value |
|-----------|-------|
| Attacker roll | 1d6 |
| Defender roll | 1d6 − 1 |
| Hit condition | `attacker > defender` |
| Damage per hit | `roll × 500` |
| Dodge formula | `(defAGI − atkAGI) × 0.5`, capped at 30% |
| Double-strike | `atkAGI ≥ defAGI × 1.5` |
| Cohesion break | 30% of starting faction HP |

### 5.3 Unit Roles (Baseline Stats)

| Role | ATK | DEF | HP | AGI | Archetype |
|------|-----|-----|------|-----|-----------|
| **Vanguard** | 150 | 40 | 1080 | 40 | Frontline shock |
| **Guard** | 100 | 80 | 1200 | 30 | Defensive hold / flanker |
| **Reserve** | 130 | 50 | 840 | 70 | Mobile intercept |

Individual cohorts may override these stats (e.g., Principes is a vanguard but stronger than baseline).

### 5.4 Combat Effects & State

- **Pinning:** when hit, a unit is marked `pinnedBy = attacker`. Pinned units prioritize counter-attacks.
- **Engagement:** units enter `engaged` state on first combat. Greedy units hunt weak enemies once engaged.
- **Cooldowns:** base 1.4s between actions, 0.1s jitter (close to sync).
- **Move range:** 3 hexes per action. Move animation: 2.5 progress/sec (~0.4s per hop).

### 5.5 Battle AI — Zonal + Primitives

Football-style zonal AI (camp / vanguard / reserve) with composable movement primitives:

- **Forward march** (push into enemy territory)
- **Greedy hunt** (attack weakest once engaged)
- **Pinned intercept** (counter-attack pinner)
- **Range kite** (archers hold distance, up to 3 hexes)
- **Berserker charge** (high-ATK units charge headlong)

### 5.6 Morale Tiers (S24)

Morale is an **army-level stat** computed pre-battle and snapshotted onto every spawned unit (does not change mid-battle). Base 100.

| Tier | Range | Damage × | Defense × |
|------|-------|---------:|----------:|
| **Broken** | < 60 | 0.75 | 1.15 |
| **Shaken** | 60–89 | 0.90 | 1.05 |
| **Steady** | 90–110 | 1.00 | 1.00 |
| **Resolute** | 111–140 | 1.10 | 0.95 |
| **Inspired** | ≥ 141 | 1.20 | 0.90 |

**Morale contributors:** legate traits (`morale-bonus` effect), supply deficit penalty (−8 per deficit, cap −40), council advisors (planned), home-soil (planned).

### 5.7 VFX & Juice

- Death anim 2.5s • shake 0.5s on hit • flash 0.35s on impact • lunge 0.4s.
- Screen shake: 0.3s, 4 px intensity.
- Particles: 12 on death, 5 on hit, 8 on ability. Gravity 80 px/s², base speed 60 px/s.

---

## 6. Strategic Army — Cohorts & Legates

### 6.1 Roman Cohort Catalog (Player Pool)

| Name | Role | ATK | DEF | HP | AGI | Cost | Rarity | Notes |
|------|------|----:|----:|----:|----:|-----:|--------|-------|
| Militia | Vanguard | 100 | 30 | 800 | 35 | 20 | Common | Servian civic levy |
| Hastati | Vanguard | 140 | 40 | 1000 | 40 | 40 | Common | Young front-line spearmen |
| Velites | Vanguard | 130 | 25 | 700 | 90 | 30 | Uncommon | Light skirmishers, high AGI |
| Principes | Vanguard | 170 | 55 | 1150 | 45 | 80 | Rare | Veteran heavy infantry |
| Equites | Guard | 160 | 50 | 900 | 80 | 90 | Rare | Mobile cavalry flanker |
| Cretan Archer | Vanguard | 120 | 20 | 700 | 85 | 70 | Rare | Ranged, arrows up to 3 hexes |
| Triarii | Reserve | 130 | 90 | 1300 | 25 | 100 | Super-Rare | Iron wall of last resort |

> **Triarii design note:** Triarii are the wealth tier, not the age tier — signaled through gilded hoplite-grade kit, not grey-bearded senescence. (See `soldiers/style-guide.json`.)

### 6.2 Gallic Confederation Pool (Enemy Roster)

Moved out of the ally pool in recent commits — enemy-only, used in campaign battles and the **QuickBattle: Rome vs Gaul** scenario.

| Name | Role | ATK | DEF | HP | AGI | Rarity | Flavor |
|------|------|----:|----:|----:|----:|--------|--------|
| Clansmen | Vanguard | 105 | 30 | 820 | 45 | Common | Teuta levy, Taranis wheel motif |
| Warband | Vanguard | 135 | 25 | 870 | 55 | Common | Woad-painted, La Tène swords |
| Neitos Javelineers | Vanguard | 125 | 20 | 680 | 95 | Uncommon | War-champions, sheaf-of-gaesum |
| Gaesatae | Vanguard | 195 | 20 | 960 | 70 | Rare | Naked Telamon berserkers |
| Noble Horse | Guard | 165 | 55 | 950 | 85 | Rare | Marcacoi mounted nobility |
| Vergobret | Reserve | 155 | 75 | 1250 | 50 | Super-Rare | Elected war-king |

### 6.3 Broader Enemy Catalog

Non-Gallic enemy types for procedural battles: Carthaginian (Punic Citizen-Soldier), Persian (Immortal), Norse (Raider), Hellenic (Spartan Hoplite, Athenian Elite Hoplite), Macedonian (Hetairoi), plus generic Barbarian tiers.

### 6.4 Legates (Named Commanders)

- **Hire cost:** 80 gold.
- Each legate carries trait IDs that provide:
  - Morale bonuses (summed at pre-battle computation)
  - Stat bonuses
  - Lieutenant presets
  - Random rally chances

Boudicca can promote veteran stacks into legates (unique mechanic).

### 6.5 Cohort Recruitment Costs (Summary)

Velites 30 • Hastati 40 • Cretan Archer 70 • Principes 80 • Equites 90 • Triarii 100.

---

## 7. Provinces & Economy

### 7.1 Map

- **48 provinces** over medieval Europe (historical-flavor), **26 nations**.
- Province picking via offscreen FBO readback — RGB encodes province ID as `R×65536 + G×256 + B`.

### 7.2 Terrain Types & Modifiers

| Terrain | Growth | PWG | Faith | Momentum | Garrison | Exclusive Buildings |
|---------|:-----:|:---:|:-----:|:--------:|:--------:|---------------------|
| Farmland | +2 | 0 | 0 | 0 | 0 | Granary, Villa |
| Hills | 0 | +1 | 0 | 0 | 0 | Mine, Forge |
| Coast | 0 | +1 | 0 | 0 | 0 | Port, Fishery |
| Forest | 0 | 0 | +1 | 0 | 0 | Sacred Grove, Lumber Camp |
| Plains | 0 | 0 | 0 | +1 | 0 | Training Ground, Stables |
| Mountains | −1 | 0 | 0 | 0 | +2 | Watchtower, Mountain Pass |
| Marsh | −1 | 0 | +1 | 0 | 0 | Oracle Shrine, Reed Harvest |
| Desert | −2 | +2 | 0 | 0 | 0 | Oasis Market, Caravan Post |

**Universal buildings** (any terrain): Castrum, Basilica, Pantheon, Market, Aqueduct, Insula, Granary, Gardens.

### 7.3 Trade Goods (12)

| Good | Gold/Season | Growth | Faith | Momentum | PWG | Special | Terrains |
|------|:-----------:|:------:|:-----:|:--------:|:---:|---------|----------|
| Grain | 0 | 5 | 0 | 0 | 0 | — | Farmland |
| Iron | 1 | 0 | 0 | 1 | 0 | Enables Forge | Hills |
| Silk | 3 | 0 | 0 | 0 | 2 | — | Coast, Desert |
| Marble | 1 | 0 | 0 | 0 | 0 | 15% build discount | Hills |
| Wine | 1 | 0 | 0 | 0 | 0 | −5 unrest | Farmland |
| Timber | 1 | 0 | 0 | 0 | 0 | 10% build discount | Forest |
| Fish | 1 | 1 | 0 | 0 | 0 | — | Coast |
| Horses | 0 | 0 | 0 | 1 | 0 | Cavalry bonus | Plains |
| Gold Ore | 4 | 0 | 0 | 0 | 2 | — | Hills, Desert |
| Incense | 0 | 0 | 2 | 0 | 0 | — | Forest, Marsh |
| Salt | 2 | 1 | 0 | 0 | 1 | — | Coast, Marsh |
| Olives | 1 | 1 | 0 | 0 | 0 | — | Farmland, Coast |

### 7.4 Wealth, Tax, Unrest

**Taxation** (combined upper + lower tax level 2–10):

| Combined Tax | Rate (fraction of wealth) |
|-------------:|--------------------------:|
| 2 (Min/Min) | 3% |
| 5 | 9% |
| 7 | 15% |
| 10 (Opp/Opp) | 25% |

**Per-season unrest delta by tax level:**

| Level | Unrest |
|-------|-------:|
| Minimal | −3 (lower) / −2 (upper) |
| Low | −1 / 0 |
| Normal | 0 |
| High | +3 |
| Oppressive | +8 |

**Unrest system:**
- Natural decay: −2/season.
- Acceleration above 60: `+0.25 × (unrest − 60)`.
- Rebellion threshold: **80** (Insula T2 raises to 90, T3 to 101 = immune).
- **1st rebellion:** destroy 1–2 buildings, −1 pop, unrest→40, +4 devastation, +2 rubble.
- **2nd:** destroy 2 buildings, −2 pop, unrest→40, +4 devastation, +2 rubble.
- **3rd (Ruined):** pop floor 1, unrest→40, +8 devastation, +8 rubble, wealth→0.

**Wealth generation:**
- Base PWG: 2/season.
- Building PWG (Market/Port/Oasis): T1 2 / T2 3 / T3 4. Caravan Post: T1 3 / T2 4 / T3 5.
- Terrain base wealth: Coast 35, Farmland 30, Hills 25, Plains/Forest 20, Desert/Mountains/Marsh 10.
- Trade-good first-conquest bonus: Gold Ore 20, Silk 15, Salt 10, Iron/Marble/Incense 8, Wine 6, Horses/Fish/Olives 5, Grain/Timber 3.
- Devastation drain: −2/season.

### 7.5 Food Economy

- **Base subsistence:** 3/season.
- **Terrain food:** Farmland 3 • Plains 2 • Coast/Forest/Hills/Marsh 1 • Mountains/Desert 0.
- **Tax food penalty:** Minimal 0% • Low 10% • Normal 20% • High 35% • Oppressive 55%.
- **Marketplace mitigation:** T1 15% • T2 25% • T3 35% (multiplicative reduction).
- **Famine:** +10 unrest/season (soft, timer 1–2), +25 (hard, timer 3+). Granary T3 delays hard phase by +1 season.

### 7.6 Settlement Tiers (by Max Pop)

| Max Pop | Label | Building Slots |
|:-------:|-------|:--------------:|
| 2 | Settlement | 1 |
| 4 | Village | 2 |
| 6 | Town | 3 |
| 8 | City | 4 |
| 10 | Major City | 5 |
| ∞ | Metropolis | 6 |

### 7.7 Province Features (Landmarks)

**25 total features**, 8–12 randomly assigned per run. Each grants some combination of flat resource/season, unrest delta, beautiness (immigration), build-cost discount, wealth growth, or special effects (extra event choice, cavalry bonus, famine immunity).

**Categories:**
- **Geographic (7):** Nile Delta, Fertile Crescent, Volcanic Soil, Thermopylae Pass, Natural Harbour, Sacred Mountain Spring, Great River Ford.
- **Religious/Mythic (7):** Oracle of Delphi, Mount Olympus, Eleusinian Mysteries, Druidic Stones, Temple of Vesta, Isle of the Dead, Sacred Grove of Diana.
- **Historical (6):** Library of Alexandria, Monument of Romulus & Remus, Forum of Augustus, Carthaginian Ruins, Appian Way, Colosseum.
- **Economic (5+):** Silver Mines of Laurion, Phoenician Trade Hub, Amber Road, …

---

## 8. Meta Systems

### 8.1 Doctrines — Run-Start Passives

**18 doctrines** across 5 colors, each with 3 upgradeable tiers. Selected at run start; define "archetype" of the build.

**Red (Military, 5):** Sword (+5→15% damage), Iron (+10→30% armor), Blood (heal per kill), Lex Militaris (free vanguards), Vis Bellica (armor + heal + damage).

**Blue (Diplomatic, 5):** Diplomacy (+Influence/spoke), Court (+event choices), Alliances (+allied units), Pax Romana (Influence + discount), Foedus Aeternum (allies + gold).

**Gold (Religious, 4):** Faith (+Faith/spoke), Miracles (heal at battle start), Pantheon (revive once), Divina Providentia (combined).

**Purple (Economic, 4):** Trade (+gold income), Infrastructure (−upkeep), Market (−shop prices), Annona (combined).

**White (Populist, 5):** People (+HP), Militia (free guards), Resilience (HP + heal), Virtus Populi (HP + reserves), Concordia (heal + event choices).

> **Full tier tables** in Appendix A — too long for the body.

### 8.2 Decretums — Active Battle Abilities

**30 decretums** across 5 colors (6 per color). Consumed in battle or on the node map. Rarity: common / rare / legendary.

**Examples:**
- **Red — Mars** (legendary, 2M): +60% ATK this battle.
- **Blue — Legatus** (legendary, 1I): force favorable event + convert 1 enemy next battle.
- **Gold — Oracle** (legendary, 1F): prevent next death this battle.
- **Purple — Cursus** (legendary): +10 gold + 50% investment discount next.
- **White — Triumphus** (legendary, 2F): prevent next 2 deaths + 50% AGI.

> **Full decretum table** in Appendix B.

### 8.3 Council — Advisors

**15 advisors** (3 per color). Pick **1 per run**. Each has 3 tiers (leveling persists across runs via meta-progression). Advisor XP: tier 2 at 5, tier 3 at 12.

Each advisor carries a **spoke template** — it biases node generation (battle/rest/event/boss counts, duration range, attacking vs defending posture).

**Examples:**
- **Centurion Varro** (Red, T1): +10% loot; attacking spoke, heavy on battles.
- **Legate Aemilia** (Blue, T1): +1 event choice; defending spoke, heavy on events.
- **Healer Cornelia** (Gold, T1): +100 HP heal between nodes; defending, heavy on rest.
- **Merchant Decimus** (Purple, T1): +2 Gold/spoke; defending, balanced.
- **Tribune Publius** (White, T1): +10% loot; defending, balanced.

> **Full advisor table** in Appendix C.

---

## 9. Soldier Sprites & Art Identity

### 9.1 Rarity Ladder

| Rarity | Foil | Border | Pose | Drop Weight | Aurum Cost |
|--------|------|--------|------|:-----------:|:----------:|
| **Common** | none | plain grey | static bust | 60% | 1 |
| **Uncommon** | silver highlights | thin gold | confident | 25% | 3 |
| **Rare** | silver hologram | double gold + leaf | 3/4 angle | 10% | 7 |
| **Super-Rare** | rainbow hologram | ornate laurel + rosettes | mid-action low-angle | 4% | 15 |
| **Secret-Rare** | prismatic | gemmed ornate + runes | iconic silhouette | 0.9% | 40 |
| **Leader** | gold-leaf | no ring (full-bleed) | commanding hero | 0.1% | 100 |

**One-hero-lever-per-tier** rule: de-escalate composition at SR and Leader to avoid Pokémon SIR muddiness.

### 9.2 Cultural Mask Motifs (Mandatory)

Every sprite MUST carry at least one visible cultural motif.

| Family | Gods | Default Motif |
|--------|------|---------------|
| Roman | Mars, Jupiter, Minerva, Victoria | Mars-face helm visor + Jupiter eagle shield |
| Hellenic | Athena, Ares, Nike, Zeus | Gorgoneion helm or Owl-of-Athena |
| Persian | Ahura Mazda, Mithra, Anahita | Faravahar on tiara |
| Germanic | Cernunnos (Celtic), Taranis, Odin (Norse) | Cernunnos stag-horns / Taranis wheel / Odin raven-wings |
| East-Asian | Hachiman, Bishamonten | menpō oni-mask + kuwagata horns |
| Indian | Hanuman, Indra, Garuda | Hanuman forehead + Garuda banner |
| Carthaginian | Tanit, Baal-Hammon, Melqart | Sign-of-Tanit pendant + eight-point star shield |
| Egyptian | Horus, Anubis, Ra | Horus falcon helm + Eye-of-Horus shield |

### 9.3 House Style

- **Outline:** `#0B0B0B`
- **Grid background:** `#2B2B2B`
- **Gold border (thin):** `#C9A24A`
- **Gold border (ornate):** `#E6C86B`
- **Foil hologram tint:** `#9FD6FF`

---

## 10. Screens & Navigation

Preact-routed via signals (`currentScreen`, `navigateTo`).

| Screen ID | Purpose | Notes |
|-----------|---------|-------|
| `title` | Game start, meta-stats, gold-dust atmosphere | |
| `commander-select` | Pick one of 4 commanders | |
| `hub` | Run HQ: recruit, hire, council, provinces, **Forum Shell** | Forum masthead + sidebar + 6 domain tabs |
| `node-map` | Spoke node selection + supplies HUD | FT-SUP integration |
| `battleV2` | Preact overlay on Canvas2D battle | HP bars, ability bar, cooldowns |
| `post-battle` | Summary, loot | |
| `province` | Buildings, governor, features, tax, unrest | Largest screen |
| `council` | Advisor selection / leveling | |
| `doctrine` | Run-start passives (drag-and-drop slots) | |
| `army-recruitment` | Hire cohorts | |
| `legate-hiring` | Hire named commanders | |
| `quick-battle` | Rome vs Gaul scenario (standalone) | Recent (S0593933) |
| `victory` / `defeat` / `end-screen` | Run end | |

### 10.1 Forum Shell (S22+)

The Hub is built around a Roman-forum aesthetic:

- **Masthead** — commander portrait, resources, season/Doom clock.
- **Sidebar** — navigation to the 6 domain tabs.
- **Tabs:** Overview • Provinciae • Consilium (council) • Exercitus (army) • Doctrinae • Decreta.
- **Motifs:** SVG primitives (Laurel, LaurelWreath, Corners, MosaicBand) live in `src/ui/components/motifs/`.

---

## 11. Recent Work & Active Direction

| Area | Status | Commits |
|------|--------|---------|
| **Army supplies (FT-SUP)** | Merged | c2981d1, ec5df00, cfcc437, 0a175f0 |
| **Morale system (S24)** | Merged | 640949a, 1f12e66, bfa409e, cc53398 |
| **Gallic faction** | Merged | 0593933, 73f928d, 830ec2f |
| **Menu overhaul + QuickBattle** | Merged | 0593933 |
| **Music system** | Merged | 0593933 |
| **Polybian formations + whenEngaged AI** | Merged | 3112336 |
| **Decretum creation** | WIP | 6f3559c |
| **Roman roster / spoke-battle UI parity** | Merged | d62be63 |

### 11.1 Open Design Questions

- **Faction alignment gates** — hidden White/Red/Gold is tracked but not yet biasing node generation in later spokes.
- **Final Invasion tuning** — S24 boss exists but balance pass pending.
- **Legate traits at scale** — morale-bonus is the only effect wired; stat bonuses, lieutenant presets, random rally are stubs.
- **Advisor progression** — XP thresholds defined (5 / 12) but the cross-run persistence path is unverified.

---

## Appendix A — Full Doctrine Table

### Red (Military)

| Doctrine | L1 | L2 | L3 |
|----------|----|----|----|
| Sword | +5% dmg | +10% dmg | +15% dmg |
| Iron | +10% armor | +20% armor | +30% armor |
| Blood | Heal 50 HP/kill (2M, 2G) | Heal 100 HP/kill (5M, 3G) | Heal 200 HP/kill + 5% dmg |
| Lex Militaris | 1 free vanguard (3M) | 2 free vanguards (6M) | 3 free vanguards |
| Vis Bellica | +5% armor, heal 50/kill (4M, 2G) | +10% armor, heal 100/kill (7M, 4G) | +15% armor, heal 150/kill + 5% dmg |

### Blue (Diplomatic)

| Doctrine | L1 | L2 | L3 |
|----------|----|----|----|
| Diplomacy | +1 Inf/spoke (3I) | +2 Inf/spoke (6I) | +3 Inf/spoke |
| Court | +1 event choice (4I) | +2 choices (8I) | +3 choices |
| Alliances | +1 allied unit (3I, 2G) | +2 allied units (6I, 4G) | +3 allied units |
| Pax Romana | +1 Inf/spoke, 5% disc (4I) | +2 Inf/spoke, 10% disc (8I) | +3 Inf/spoke, 15% disc |
| Foedus Aeternum | +1 ally, +15% gold (5I, 3G) | +2 allies, +25% gold (9I, 5G) | +3 allies, +40% gold |

### Gold (Religious)

| Doctrine | L1 | L2 | L3 |
|----------|----|----|----|
| Faith | +1 Faith/spoke (3F) | +2 Faith/spoke (6F) | +3 Faith/spoke |
| Miracles | Heal all 200 HP at start (4F) | Heal all 400 HP (8F) | Heal all to 60% HP |
| Pantheon | Revive once at 10% HP (3F, 3G) | Revive at 20% HP (7F, 5G) | Revive at 30% HP |
| Divina Providentia | +1 Faith/spoke, revive 10% (5F) | +2 Faith/spoke, revive 20% (9F) | +3 Faith/spoke, revive 30% |

### Purple (Economic)

| Doctrine | L1 | L2 | L3 |
|----------|----|----|----|
| Trade | +15% gold income (4G) | +30% gold income (8G) | +50% gold income |
| Infrastructure | Upkeep −10% (3G) | Upkeep −20% (7G) | Upkeep −30% |
| Market | Shop −10% (3G) | Shop −20% (6G) | Shop −30% |
| Annona | +15% gold, upkeep −10% (5G) | +30% gold, upkeep −20% (9G) | +50% gold, upkeep −30% |

### White (Populist)

| Doctrine | L1 | L2 | L3 |
|----------|----|----|----|
| People | +10% max HP (3G) | +20% max HP (6G) | +30% max HP |
| Militia | 1 free guard (4G) | 2 free guards (8G) | 3 free guards |
| Resilience | +5% HP, heal 100 (3G, 2M) | +10% HP, heal 200 (6G, 4M) | +15% HP, heal 400 |
| Virtus Populi | +10% HP, 1 free reserve (4G) | +20% HP, 2 free reserves (8G) | +30% HP, 3 free reserves |
| Concordia | Heal 300 at start, +1 choice (4G, 2M) | Heal 500, +2 choices (7G, 4M) | Heal to 40%, +2 choices |

---

## Appendix B — Full Decretum Table

### Red
| Decretum | Effect | Rarity |
|----------|--------|--------|
| Forge | +20% DEF this battle | Common |
| Gladius | +15% ATK this battle | Common |
| Vanguard | Spawn 1 elite vanguard | Common |
| Legion | Spawn 2 militia vanguards | Rare |
| Testudo | +40% DEF this battle | Rare |
| Mars | +60% ATK this battle (2M) | Legendary |

### Blue
| Decretum | Effect | Rarity |
|----------|--------|--------|
| Senate | +3 Influence now | Common |
| Spy | Reveal all enemies | Common |
| Foedus | +2 Influence now | Common |
| Explorator | Reveal all enemy units | Common |
| Tribune | Force favorable event | Rare |
| Legatus | Force event + convert 1 enemy (1I) | Legendary |

### Gold
| Decretum | Effect | Rarity |
|----------|--------|--------|
| Healing | Heal all 30% | Common |
| Pontifex | Fully heal 1 unit | Common |
| Pietas | +3 Momentum now | Common |
| Augur | Reveal next 2 nodes | Rare |
| Haruspex | Reveal next 3 nodes | Rare |
| Oracle | Prevent next death (1F) | Legendary |

### Purple
| Decretum | Effect | Rarity |
|----------|--------|--------|
| Tax | +3 Gold now | Common |
| Supply | −upkeep for 1 season | Common |
| Aerarium | +4 Gold now | Common |
| Merchant | +5 Gold now | Rare |
| Annona | −upkeep for 2 seasons | Rare |
| Cursus | +10 Gold + 50% invest discount | Legendary |

### White
| Decretum | Effect | Rarity |
|----------|--------|--------|
| Mob | Spawn 3 weak militia guards | Common |
| Plebs | Spawn 2 militia guards | Common |
| Bread | Heal all 20% | Rare |
| Frumentum | Heal all 25% | Rare |
| Riot | 1500 area damage, friendly fire (1M) | Legendary |
| Triumphus | Prevent next 2 deaths + 50% AGI (2F) | Legendary |

---

## Appendix C — Full Advisor Table

### Red (Military)
| Advisor | T1 | T2 | T3 | Spoke Template |
|---------|----|----|----|----------------|
| Centurion Varro | +10% loot | +18% loot | +25% loot | Battle-heavy, 1–3 seasons, attacking |
| Siege Master Titus | +1 Mom/spoke | +2 Mom/spoke | +3 Mom/spoke | Battle+boss, 1–4 seasons, attacking |
| Raider Brennus | +15% loot | +22% loot | +30% loot | Max-battle, 1 season, attacking |

### Blue (Diplomatic)
| Advisor | T1 | T2 | T3 | Spoke Template |
|---------|----|----|----|----------------|
| Legate Aemilia | +1 event choice | +2 choices | +3 choices | Event-heavy, 2–4 seasons, defending |
| Scholar Ptolemy | +1 Inf/spoke | +2 Inf/spoke | +3 Inf/spoke | Rest+event, 2–4 seasons, defending |
| Spymaster Cassia | Threat −1/spoke | Threat −2/spoke | Threat −3/spoke | Balanced, 1–3 seasons, defending |

### Gold (Religious)
| Advisor | T1 | T2 | T3 | Spoke Template |
|---------|----|----|----|----------------|
| Pontifex Lucius | +1 Faith/spoke | +2 Faith/spoke | +3 Faith/spoke | Event-heavy, 2–4 seasons, defending |
| Healer Cornelia | +100 HP between nodes | +200 HP | +300 HP | Rest-heavy, 2–4 seasons, defending |
| Zealot Marcus | +2 Faith/spoke | +3 Faith/spoke | +4 Faith/spoke | Battle+event, 1–3 seasons, attacking |

### Purple (Economic)
| Advisor | T1 | T2 | T3 | Spoke Template |
|---------|----|----|----|----------------|
| Merchant Decimus | +2 Gold/spoke | +3 Gold/spoke | +5 Gold/spoke | Event-heavy, 2–4 seasons, defending |
| Quartermaster Livia | Upkeep −10% | −20% | −30% | Balanced, 2–4 seasons, defending |
| Smuggler Gaius | Shop −10% | −18% | −25% | Event-heavy, 1–3 seasons, attacking |

### White (Populist)
| Advisor | T1 | T2 | T3 | Spoke Template |
|---------|----|----|----|----------------|
| Tribune Publius | +10% loot | +18% loot | +25% loot | Balanced, 2–4 seasons, defending |
| Veteran Flavia | +50 HP between nodes | +100 HP | +150 HP | Rest-heavy, 1–3 seasons, defending |
| Consul Servius | +1 Inf/spoke | +2 Inf/spoke | +3 Inf/spoke | Balanced, 2–4 seasons, defending |

---

## Appendix D — Key Asset Paths

| Path | Purpose |
|------|---------|
| `public/textures/terrain_map.png` | Canonical province map (source of truth) |
| `public/textures/id-map.png` | RGB-encoded province IDs for picking |
| `public/textures/heightmap.png`, `normalmap.png`, `borders.png` | Derived map textures |
| `public/asset/soldiers/style-guide.json` | Sprite taxonomy & prompting rules |
| `public/asset/soldiers/soldiers.json` | Sprite catalog |
| `public/asset/characters/` | Commander portraits (5:7) |
| `public/asset/buildings/` | Building icons per terrain |
| `public/data/provinces.json` | 48 provinces |
| `public/data/nations.json` | 26 nations |
| `public/data/topology.json` | Province adjacency graph |
| `src/config/game-config.ts` | All tunable constants |
| `src/data/commanders.ts` | Commander definitions |
| `src/data/cohort-data.ts`, `enemy-cohort-data.ts` | Cohort catalogs |
| `src/data/doctrine-data.ts`, `decretum-data.ts`, `advisor-data.ts` | Meta systems |
| `src/data/terrain-data.ts`, `trade-goods.ts`, `province-features.ts` | Economy data |
| `src/data/events.ts` | Event catalog |

---

*End of GDD. Paste directly into Notion — all tables, headings, and code blocks convert cleanly on drag-and-drop or Cmd+V.*
