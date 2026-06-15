# Map2D — Game Context for LLMs

> A self-contained brief describing this project's concept, systems, code layout, and current work. Drop this into another LLM's context to get it up to speed without having to read the whole repo.

---

## 1. Elevator Pitch

**Map2D** is a TypeScript roguelike grand strategy game combining:

- **Strategic layer** — province governance, army recruitment, council advisors, run-level meta-progression
- **Tactical layer** — semi-real-time hex-based combat with cooldown-driven AI and player-triggered abilities (Decretums)
- **Roguelike meta** — seasonal "spokes" of battle/rest/event nodes, escalating **Doom** threat, permadeath of cohorts, Final Invasion at season 24

Players pick one of four commanders (**Augustus**, **Boudicca**, **Leo**, **Crassus**), each with distinct faction flavor, and push through procedurally-generated runs until they either beat the Final Invasion or lose.

Theme is medieval/classical European with Roman-imperium framing (see `Roman_Imperium_Game_Systems.pptx` in the repo root).

---

## 2. Tech Stack

| Layer       | Choice                                                           |
| ----------- | ---------------------------------------------------------------- |
| UI          | **Preact** + **@preact/signals** (reactive cross-module state)   |
| Language    | **TypeScript** (strict)                                          |
| Bundler     | **Vite**                                                         |
| Map render  | **WebGL2** + custom GLSL uber-shader (5-layer compositing)       |
| Battle render | **Canvas2D** (hex grid, sprite cache, FPS counter)             |
| Deps        | Zero runtime deps beyond Preact/Signals/lucide-preact            |
| Tooling     | `tsx` for MCP server, Python for texture generation              |

### Commands

```bash
npm run dev           # http://localhost:5173/
npm run build         # type-check + bundle
npx tsc --noEmit      # type check only
npx tsx tools/mcp-server.ts   # MCP server for map ops
python tools/generate-test-textures.py   # regen derived textures
```

---

## 3. Core Architecture

### Rendering pipeline
- **Strategic map (WebGL2)**: 5-layer uber-shader composites terrain, ID map, heightmap, normal map, borders. Province picking uses offscreen FBO readback — a single pixel's RGB encodes the province index as `R*65536 + G*256 + B`.
- **Battle (Canvas2D)**: hex grid with cached per-faction/role sprites (vanguard, guard, reserve). Runs independently of the Preact tree; `BattleScreenV2.tsx` is a Preact overlay on top of the canvas for HP bars, ability bar, cooldowns.

### State
- Global signals (`src/game/core/game-state.ts`): `selectedCommander`, `globalSeason`, `veteranStacks`, `provinces`, etc.
- Modular signal stores per domain: battle, doctrines, provinces, progression, council.
- `BattleMode` (`src/battle/index.ts`) orchestrates the canvas outside the Preact tree via `enter/update/render/exit`.

### Source-of-truth rule for textures
`public/textures/terrain_map.png` is canonical; all other map textures are generated at matching dimensions.

---

## 4. Game Systems

### 4.1 Run structure
- **Seasons / spokes**: each season generates an 11-node DAG (battles, rests, events). Player picks a path.
- **Doom**: `globalSeason` drives difficulty scaling. Doom upkeep drains gold each season (`SEASON.doomUpkeep` in `src/config/game-config.ts`).
- **Final Invasion**: climactic boss battle at season 24.
- **Factions**: Hidden White/Red/Gold alignment tracked from player choices; biases node types in later spokes.

### 4.2 Army & combat
- **Cohorts** (strategic units): name, terrain affinity, unit type, stats (ATK/DEF/HP/AGI), upkeep.
- **Legates** (named commanders): passive trait bonuses; hired from a pool. Boudicca can promote veteran stacks into legates.
- **Enemy scaling**: armies generated per node via seed + threat level (`src/game/army/enemy-army-generator.ts`).
- **Cohort → BattleUnit** translation: `src/game/army/cohort-to-battle-unit.ts` maps strategic cohorts into tactical units at battle start.

### 4.3 Tactical battle (hex grid)

Semi-real-time, no turns. Configurable 12–24 hexes per side.

- **Phases**: `fighting → victory | draw` (triggered by morale break or full-wipe).
- **Unit roles**: Vanguard (advance), Guard (hold line), Reserve (rear hold).
- **AI**: each unit has `actionCooldown`; when it hits ≤0 the AI ticks. `src/battle/battle-ai.ts` is a football-style zonal AI using composable movement primitives from `src/battle/movements.ts` (forward, greedy, pickWeakest, handlePinned).
- **Combat math**: attacker rolls d6, defender rolls d6 − 1; hit if attacker > defender. Damage = roll × 500. Dodge scales with Agility.
- **Pinning**: hit unit is marked `pinned by` attacker; pinned units prioritize counter-attacking their pinner.
- **Greedy mode** (current branch, Spartan/Persian theme): units enter `engaged` state on first combat; greedy units actively hunt weak enemies.

Key files:
- `src/battle/index.ts` — mode orchestrator
- `src/battle/battle-state.ts` — unit registry, phase, combat resolution
- `src/battle/battle-ai.ts` — zonal AI
- `src/battle/movements.ts` — composable movement primitives
- `src/battle/hex.ts` — axial/offset hex math
- `src/battle/battle-zones.ts` — camp/reserve/vanguard zone bounds
- `src/battle/battle-config.ts` — tunable constants (cooldowns, role stats)
- `src/battle/battle-signals.ts` — signals bridging canvas state → Preact overlay

### 4.4 Province & economy
- **Province**: terrain (Farmland/Plains/Hills/Mountains/Coastland/Forest), population, unrest, wealth, tax level.
- **Buildings**: terrain-gated, produce resources (food, gold, timber, pottery, marble, wine).
- **Governors**: named, traited, paid from province income.
- **Features** (landmarks): awarded on conquest; grant population growth, food, gold, unrest reduction.
- **Unrest / rebellion**: scales with taxation and events; rebels at threshold.
- **Food economy**: deficit causes population loss + unrest spike.

### 4.5 Meta systems
- **Advisors (Council)**: Minister, Economist, General, Mystic. Passive bonuses; level up across runs.
- **Doctrines**: run-start passives (e.g. +10% ATK per 2 cohorts, revive at 40% HP).
- **Decretums**: active battle abilities (Miracle, Fury Charge, Turncoat, Buy Reinforcements, Crusade War). Cost Momentum/Gold/Faith.

---

## 5. Data Models

### `public/data/provinces.json`
```jsonc
{
  "provinces": [
    {
      "index": 1,              // unique ID; also encoded into RGB
      "color": [0, 0, 1],      // R,G,B for ID map
      "name": "Ile-de-France",
      "terrain": "Farmland",
      "owner": "france",       // nation id
      "population": 250000     // thousands
    }
  ]
}
```

### `public/data/nations.json`
```jsonc
{
  "nations": [
    { "id": "france", "name": "France", "color": [30, 50, 180], "capital": 1 }
  ]
}
```

### `public/data/topology.json`
Province adjacency graph used for strategic-layer movement/planning.

---

## 6. Screens & Navigation

Routing via Preact signals (`currentScreen`, `navigateTo`) in `src/ui/screens/App.tsx`.

| Screen ID           | Component                   | Purpose                                      |
| ------------------- | --------------------------- | -------------------------------------------- |
| `title`             | TitleScreen                 | Game start, meta-progression stats           |
| `commander-select`  | CommanderSelectScreen       | Pick one of four commanders                  |
| `hub`               | HubScreen                   | Run HQ: recruit, hire, council, provinces    |
| `node-map`          | NodeMapScreen               | Spoke node selection                         |
| `battleV2`          | BattleScreenV2              | Preact overlay on battle canvas              |
| `post-battle`       | PostBattleScreen            | Battle summary, loot                         |
| `province`          | ProvinceScreen              | Buildings, governor, features, unrest        |
| `council`           | CouncilScreen               | Advisor selection & leveling                 |
| `doctrine`          | DoctrineScreen              | Run-start passives                           |
| `army-recruitment`  | ArmyRecruitmentScreen       | Hire cohorts                                 |
| `legate-hiring`     | LegateHiringScreen          | Hire named commanders                        |
| `victory` / `defeat`| Victory/DefeatScreen        | Run end states                               |

---

## 7. File Layout (high level)

```
Map2D/
├── index.html                       # hosts #app-root, #battle-canvas, #battle-screen
├── vite.config.ts, tsconfig.json, package.json
│
├── src/
│   ├── main.tsx                     # bootstrap: Preact mount + BattleMode + render loop
│   ├── types/                       # shared TS types
│   ├── utils/                       # helpers
│   │
│   ├── battle/                      # hex tactical combat (canvas + AI)
│   │   ├── index.ts                 # BattleMode orchestrator
│   │   ├── battle-state.ts          # unit registry, phases, combat
│   │   ├── battle-ai.ts             # zonal AI
│   │   ├── movements.ts             # composable movement primitives
│   │   ├── battle-renderer.ts       # Canvas2D draw + sprite cache
│   │   ├── battle-input.ts          # click/keyboard
│   │   ├── battle-zones.ts          # camp/reserve/vanguard zones
│   │   ├── hex.ts                   # axial hex math
│   │   ├── battle-config.ts         # tunable constants
│   │   ├── battle-signals.ts        # signals → Preact overlay
│   │   ├── battle-settings.ts       # graphics toggles
│   │   └── ability-ui.ts            # ability/decretum bar
│   │
│   ├── config/game-config.ts        # SEASON, PROVINCE_DEFAULTS, FOOD, tax scaling
│   │
│   ├── game/
│   │   ├── core/ (game-state, meta-save)
│   │   ├── army/ (cohort, legate, enemy-army-generator, cohort-to-battle-unit)
│   │   ├── province/ (province-store, building)
│   │   ├── progression/ (spoke, strategic-store)
│   │   ├── items/ (doctrine, decretum)
│   │   ├── council/ (advisor)
│   │   ├── events/
│   │   └── map/
│   │
│   ├── data/                        # static definitions
│   │   ├── commanders.ts            # Augustus, Boudicca, Leo (id 'innocent'), Crassus
│   │   ├── cohort-data.ts, enemy-cohort-data.ts
│   │   ├── doctrine-data.ts, decretum-data.ts
│   │   ├── advisor-data.ts
│   │   ├── terrain-data.ts, trade-goods.ts, province-features.ts
│   │   └── events.ts
│   │
│   └── ui/
│       ├── design-tokens.css, globals.css
│       ├── components/              # ResourceBar, NotificationFeed, ErrorBoundary, etc.
│       ├── screens/                 # see table above
│       ├── sound/ (music.ts, sfx.ts)
│       └── notifications/
│
├── public/
│   ├── data/ (provinces.json, nations.json, topology.json)
│   └── textures/ (terrain_map.png + derived id/height/normal/borders)
│
├── tools/
│   └── mcp-server.ts                # MCP for add_nation, add_province, etc.
│
├── tasks/lessons.md                 # running self-improvement notes
├── CLAUDE.md                        # Claude Code project rules
├── GEMINI.md                        # Gemini-oriented project overview
└── Roman_Imperium_Game_Systems.pptx # design deck
```

Rough scale: ~7k+ LOC TypeScript, ~100 files in `src/`.

---

## 8. Conventions

- **Branches**: `<type>/<task-id>-<short-slug>` (e.g. `feat/42-add-diplomacy`).
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/).
- **Gitflow**: feature branches off `develop`, PRs into `develop`, releases merge to `main`.
- **State**: prefer `@preact/signals` over local React/Preact state for anything cross-module.
- **Map textures**: all derived textures must match `terrain_map.png` dimensions.
- **Province indexing**: always the `R*65536 + G*256 + B` RGB encoding.
- **Lessons**: after any recurring correction, append a rule to `tasks/lessons.md`.

Special workflows defined in `CLAUDE.md`:
- `FIX:` message prefix → spawn fix branch off current feature branch, delegate fixes, verify, merge back.
- `/sprint-polish` → Opus scopes/triages sprint diff, Sonnet agents fix by domain in parallel, single squash commit, PR into `develop`.

---

## 9. Current Branch — `feat/battle-brainstorm`

Active exploration of:
- **Greedy AI behavior** (`battle-ai.ts`, `movements.ts`) — units hunt weak enemies once engaged.
- **Spartan vs Persian theme** (`battle-state.ts`) — blue vanguard-heavy vs red reserve-heavy compositions for AI tuning.
- **Performance + graphics settings** (`battle-settings.ts`, `battle-renderer.ts`) — toggles for shadows, ground cracks, particles, high-res sprites.
- **BattleScreenV2 overlay** (`BattleScreenV2.tsx`, `battle-signals.ts`) — new Preact layer over the canvas for HP bars, ability bar, cooldowns, replacing in-canvas HUD.
- **Screen transitions polish** (`main.tsx`, `App.tsx`, `TitleScreen.tsx`).

Modified files at time of writing:
`src/battle/battle-ai.ts`, `battle-renderer.ts`, `index.ts`, `movements.ts` (new),
`src/main.tsx`, `src/ui/screens/App.tsx`, plus new `src/ui/components/ErrorBoundary.tsx` and `src/ui/globals.css`.

---

## 10. Quick Reference for Another LLM

If you're an LLM being asked to help on this repo, remember:

1. **Strategic map** is WebGL2; **battle** is Canvas2D + Preact overlay. Don't confuse the two.
2. **Province IDs** are encoded into RGB — never pick provinces by coordinates, use the ID map.
3. **State** is signals-based; reaching into Preact component state for shared data is a smell.
4. **Combat math** is d6-based with `damage = roll * 500`, defender bonus, Agility-based dodge.
5. **Doom scaling** is driven by `globalSeason`; tuning numbers live in `src/config/game-config.ts`.
6. **Zero runtime deps** is a feature — don't reach for lodash/zustand/etc.
7. **Never run destructive git ops** or amend published commits without explicit permission.
8. **Update `tasks/lessons.md`** after recurring corrections; it's the project's long-term memory.
