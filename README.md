# Imperium — Map2D

A browser-based grand-strategy roguelike set in a Roman-imperium fantasy. You play one of four commanders — Augustus, Boudicca, Pope Innocent, or Marcus Crassus — pushing through a procedurally generated 24-season campaign: traversing a node map, fighting battles, governing provinces, recruiting cohorts, managing resources and supplies, and holding back the rising **Doom** clock until a climactic Final Invasion.

The strategic layer is a WebGL2 province-map renderer (EU4/CK3 style) with a custom GLSL uber-shader; the tactical layer is a hex-based battle engine. Both run hand-rolled with no heavyweight runtime dependencies. See [`docs/GDD.md`](docs/GDD.md) for the full game design.

## Features

- **Four commanders / factions**, each with its own faction color, starting resources, passive, and strategic + tactical abilities (e.g. Augustus' Web of Alliances, Boudicca's Veteran Stacks / Fury Charge, Pope Innocent's Deus Vult / Miracle, Crassus' War Profiteer).
- **Roguelike run structure** — up to 24 seasons, spokes of 11 nodes (`battle` / `rest` / `event` / `boss`), a rising Threat/Doom clock that scales enemy strength and gold upkeep, ending in a Final Invasion.
- **Resource & economy layer** — Gold, Faith, Influence, Momentum; seasonal upkeep; army supplies that drain on traversal and punish oversized armies on long spokes.
- **WebGL2 strategic map** — custom GLSL uber-shader (multi-layer compositing) over a `terrain_map.png` source-of-truth, province indexing by RGB color, offscreen FBO readback for click detection, and a color LUT bridging CPU game state to the GPU.
- **Hex-based tactical battles** — a `BattleEngine` facade over a data world and pure systems (grid, units, combat, animation), with a layered PixiJS renderer (background, grid, units, projectiles, particles, targeting, overlays, etc.), deployment zones, abilities, and an effect registry (abilities / decreta / doctrines / legate traits).
- **Strategic systems** — provinces (governors, features, unrest/economy), council/advisors, doctrines and decreta, events and faction events, campaign map generation, hex pathfinding/scouting, and meta-progression saves.
- **Cinematic UI** — Preact screens (Title, Commander Select, Hub, Node Map, Battle, Post-Battle, Victory/Defeat, the Imperium "Forum" shell with domain tabs), hand-rolled canvas particle effects, music/SFX, and a Roman-themed motif/design-token system.

## Tech Stack

- **TypeScript** + **Preact 10** (`@preact/signals`), bundled with **Vite 8**.
- **Raw WebGL2** + custom GLSL shaders for the strategic map renderer.
- **PixiJS 8** for the tactical battle renderer.
- **@floating-ui/dom** (tooltips/popovers), **class-variance-authority** + **clsx** (variants), **lucide-preact** (icons).
- **vite-imagetools** for build-time AVIF/WebP/srcset generation of raster assets.
- **@modelcontextprotocol/sdk** + **tsx** for the MCP tooling/scripts under `tools/`.

## Getting Started

### Prerequisites

- Node.js (v20+ recommended for Vite 8).
- Python 3 (only for the texture-generation tool).

### Install & run

```bash
npm install
npm run dev        # Vite dev server (default http://localhost:5173)
```

### Other scripts

```bash
npm run build      # tsc then vite build
npm run preview    # serve the production build
npx tsc --noEmit   # type check
python tools/generate-test-textures.py   # regenerate support textures
npx tsx tools/mcp-server.ts              # start the MCP server for map operations
```

The `tools/verify-*.ts` scripts are headless verification harnesses for individual systems (run with `npx tsx tools/<name>.ts`).

## Project Structure

```
.
├── index.html
├── package.json
├── vite.config.ts
├── docs/
│   ├── GDD.md                      # full game design document (source of truth)
│   ├── bellum-run-contract.md
│   ├── soldier-stats.md
│   └── gallic-soldier-prompts.md
├── public/
│   ├── textures/                   # terrain_map.png + derived maps, battleground textures
│   ├── data/                       # provinces.json, nations.json, topology.json
│   ├── asset/                      # portraits, soldier sprites, UI, audio
│   └── audio/
├── src/
│   ├── main.tsx
│   ├── assets/                     # raster assets processed by vite-imagetools
│   ├── battle/                     # hex tactical engine
│   │   ├── core/                   # BattleEngine (facade) + BattleWorld (data)
│   │   ├── systems/                # grid / units / combat / animation
│   │   ├── render/                 # layered PixiJS renderer + layers/
│   │   ├── effects/                # ability / decretum / doctrine / legate effects
│   │   ├── movements/              # movement profiles, primitives, resolver
│   │   ├── legacy/                 # legacy cohort mapping / spawn config
│   │   └── hex.ts, battle-*.ts, deployment.ts, casualties.ts, ...
│   ├── game/                       # strategic layer
│   │   ├── army/                   # cohorts, legates, morale, supplies, replenishment
│   │   ├── campaign/               # node map, seasons, encounters, hex battle/pathfinding
│   │   ├── core/                   # game-state, commander, resources, meta-save
│   │   ├── council/                # advisors / council store
│   │   ├── items/                  # decreta + doctrines
│   │   ├── province/               # provinces, governors, features
│   │   ├── progression/            # spokes, season tick, strategic store
│   │   └── pixi/                   # PixiJS hex-map view (campaign)
│   ├── data/                       # commanders, advisors, doctrines, decreta, events, terrain, trade
│   ├── ui/                         # Preact screens + components
│   │   ├── screens/                # Title, CommanderSelect, Hub, Battle, PostBattle, ...
│   │   │   └── forum/              # Imperium Forum shell + domain tabs
│   │   ├── components/             # shared UI (motifs, spoke, bellum, ...)
│   │   └── sound/                  # music / sfx
│   ├── config/                     # game-config
│   └── types/
└── tools/                          # Python texture generator, MCP server, verify-*.ts harnesses
```
