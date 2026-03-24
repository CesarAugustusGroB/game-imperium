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

## Notion Board
- **Workspace**: https://www.notion.so/32d6c88ed4248195935cc01cdb6be666
- **Nations DB**: https://www.notion.so/6adaeab7c6b3496889c8a66792527e2a
- **Provinces DB**: https://www.notion.so/8044e1d8b8c341a6b6355cb190a6d906
- **Armies DB**: https://www.notion.so/f62cbf3e891842c894cd85f01928bdd0
- **Battle Log DB**: https://www.notion.so/bcdfa8a409cd4d8c8def13e02035caab
