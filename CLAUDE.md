# Grand Strategy Map 2D

WebGL2 grand strategy map renderer (EU4/CK3 style) with dice-based combat and AI armies.

## Tech Stack
- Raw WebGL2 + custom GLSL uber-shader (5-layer compositing)
- Vite + TypeScript
- No runtime dependencies

## Commands
- `npm run dev` — start dev server (http://localhost:5173/)
- `npm run build` — production build
- `npx tsc --noEmit` — type check
- `python tools/generate-test-textures.py` — regenerate support textures from terrain_map.png
- `npx tsx tools/mcp-server.ts` — start MCP server for map operations

## Project Structure
- `src/renderer/` — WebGL2 context, shader compilation, texture loading, quad, renderer
- `src/shaders/` — GLSL shaders (map.vert, map.frag, lighting.glsl, borders.glsl, common.glsl)
- `src/camera/` — Pan/zoom camera with smooth interpolation
- `src/game/` — Game state, province registry, army manager (combat + AI), province picker
- `src/ui/` — HTML tooltip overlay, debug panel
- `public/textures/` — terrain_map.png (source of truth), id-map.png, heightmap.png, normalmap.png, borders.png
- `public/data/` — provinces.json, nations.json, topology.json
- `tools/` — Python texture generator, MCP server

## Key Architecture
- terrain_map.png is the source of truth — all other textures derive from it at matching dimensions
- Province indexing: RGB color encodes index directly (R*65536 + G*256 + B)
- Province color LUT: 1D data texture bridging CPU game state to GPU
- Click detection: offscreen FBO readback on ID map
- Textures use UNPACK_FLIP_Y_WEBGL — topology UVs store V from top, army renderer flips V
- Combat: d6 dice rolls every 1.5s, defender gets +1, damage = roll * 500

## Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

## FIX: Workflow
When the user's message starts with `FIX:`:
1. **Branch** — create `fix/<current-feat-slug>` from the current feature branch (e.g., `fix/sprint-1` from `feat/sprint-1`)
2. **Spawn agent team** — delegate all described issues to parallel agents; implement all fixes on the fix branch
3. **Verify prompt** — when done, tell the user what was fixed and ask them to verify; await their approval
4. **Merge** — only after explicit user approval, merge `fix/*` back into the originating `feat/*` branch and delete the fix branch

## Agent Model Policy
- When implementing a plan (plan mode approved → execution), use **Sonnet 4.6** agents for the implementation work
- Same applies to `/dev-task` Phase 5 (Implement): spawn Sonnet 4.6 agents for coding
- Opus stays in the driver seat for planning, review, and coordination

## Conventions
- Branch naming: `<type>/<task-id>-<short-slug>` (e.g. `feat/42-add-diplomacy`)
- Commit style: Conventional Commits
- Gitflow: feature branches from `develop`, PRs target `develop`, releases merge to `main`

## Notion Board
- **Board**: https://www.notion.so/0fa1bf712e0e44faaf0f31c680cd0bde?v=9a8dc5aa86f445578315dcd2da97bd64
