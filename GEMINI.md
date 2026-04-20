# Map2D: Grand Strategy & Tactical Battle Engine

A high-performance WebGL2 grand strategy map renderer (EU4/CK3 style) coupled with a hex-based tactical combat system. The project features a custom GLSL uber-shader pipeline, AI-driven armies, and a deep roguelike progression system.

## Project Overview

- **Map Engine:** Custom WebGL2 renderer with 5-layer compositing (terrain, IDs, height, normals, borders). Uses offscreen FBO readbacks for pixel-perfect province interaction.
- **Battle System:** Semi-real-time hex-based tactical combat. Units act on individual cooldowns with automated AI and player-triggered abilities (Decretums).
- **Game Logic:** Roguelike "run" structure with multiple commanders (Augustus, Boudicca, Innocent, Crassus), resource management, and escalating "Doom" (Seasons) mechanics.
- **State Management:** Powered by `@preact/signals` for reactive UI and decoupled game state.

## Tech Stack

- **Framework:** Preact (with Signals)
- **Language:** TypeScript
- **Build Tool:** Vite
- **Graphics:** WebGL2 + Custom GLSL
- **Plugins:** `vite-plugin-glsl`

## Key Commands

- `npm run dev` - Starts the development server at http://localhost:5173/
- `npm run build` - Production build (type-checks and bundles via Vite)
- `npm run preview` - Previews the production build locally
- `npx tsc --noEmit` - Runs the TypeScript compiler for type checking
- `python tools/generate-test-textures.py` - Regenerates derived map textures (normal, height, etc.) from `terrain_map.png`
- `npx tsx tools/mcp-server.ts` - Starts the Model Context Protocol server for map/province operations

## Project Structure

- `src/renderer/` - Core WebGL2 lifecycle (context, shaders, texture management).
- `src/shaders/` - GLSL source code for map rendering and lighting.
- `src/battle/` - Tactical combat engine (state, AI, hex math, renderer).
- `src/game/` - Meta-progression, province management, and commander logic.
- `src/ui/` - Preact components, screens, and design tokens.
- `public/data/` - Static definitions for provinces, nations, and map topology.
- `public/textures/` - Source and derived map textures.

## Development Conventions

- **State Management:** Prefer `@preact/signals` over standard Preact/React state for cross-module reactivity.
- **Map Interaction:** Use the RGB color lookup pattern (R*65536 + G*256 + B) for province indexing and ID map interactions.
- **Textures:** All map-related textures must match the dimensions of `terrain_map.png`.
- **Commits:** Follow [Conventional Commits](https://www.conventionalcommits.org/).
- **Error Handling:** Update `tasks/lessons.md` after correcting recurring bugs or architectural mistakes.
- **Workflow:** Use the `FIX:` prefix for bug-fix branches and `/sprint-polish` for end-of-cycle refinements as described in `CLAUDE.md`.

## Implementation Notes

- **FBO Readback:** Province picking is handled by reading a single pixel from an ID-encoded framebuffer.
- **Combat Math:** Base damage is `dice_roll * 500`. Scaling is applied based on threat levels and commander bonuses.
- **Doom System:** The `globalSeason` signal drives game difficulty, peaking at the Final Invasion after 24 seasons.
