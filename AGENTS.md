# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the application code. Key areas are `src/battle/` for combat systems, `src/game/` for state and progression, `src/ui/` for Preact screens/components, `src/data/` and `src/config/` for game content, and `src/assets/` for raster assets processed by `vite-imagetools`. Static files that are served as-is live in `public/` (`public/data/`, `public/textures/`, `public/asset/`, `public/audio/`). Utility scripts are in `tools/`, and longer-form design notes live in `docs/`.

For generated UI icons and small game assets, follow `docs/icon-art-direction.md`.

## Build, Test, and Development Commands
Use `npm run dev` to start the Vite dev server. Use `npm run build` to run `tsc` and produce a production bundle in `dist/`. Use `npx tsc --noEmit` for a fast type-check pass when you want validation without building. Asset helpers include `python tools/generate-test-textures.py` to rebuild derived textures and `npx tsx tools/mcp-server.ts` to run the local MCP map server.

## Coding Style & Naming Conventions
This repo uses TypeScript with ES modules and Preact. Follow the existing style: 2-space indentation, semicolons, single quotes, and small focused modules. Use `PascalCase` for Preact components (`TitleScreen.tsx`), `camelCase` for functions and variables, and `kebab-case` for branch slugs. Keep new assets in `src/assets/` when they should be optimized by the build; use `public/` only for files that must remain unchanged.

## Testing Guidelines
There is no dedicated automated test suite configured yet. At minimum, run `npm run build` and `npx tsc --noEmit` before opening a PR. For renderer, battle, or map changes, also verify the feature manually in `npm run dev`. If you add tests later, place them beside the feature or under a clear `tests/` directory using `*.test.ts` or `*.spec.ts`.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit pattern seen in history, for example `feat(iuniores): per-season generation from province population (S25-02)` or `fix(ui): adjust tooltip overflow`. Branches should follow `<type>/<task-id>-<slug>` such as `feat/S25-02-iuniores-province-generation`. Target PRs at `develop`, include a short behavior summary, reference the task or issue, and attach screenshots or clips for UI changes.

## Workflow Notes
This repository follows Gitflow: feature branches branch from `develop`, and releases merge to `main`. If the user asks for a `FIX:` workflow, create a `fix/*` branch from the active feature branch and merge it back only after explicit verification.
