# Lessons Learned

Rules for Claude to avoid repeating past mistakes.

---

## Cancellation flag goes at the earliest cleanup-relevant point, not the end
**Date**: 2026-04-29
**Mistake**: When chaining multiple awaits in a Pixi `useEffect` (S31-01: `app.init()` → `loadHexAssets()` → mount view), the natural draft was to set `initialised = true` only at the very end of the chain. That leaves a window where init resolved but assets haven't yet, the component unmounts, the cleanup fires `if (initialised) app.destroy(true)` — and `initialised` is still false. The Application leaks.
**Rule**: For any async setup chain where cleanup gates teardown on a "ready" flag, set the flag immediately after the resource that flag protects is created, not after the entire chain finishes. Each phase's cleanup-relevant flag must flip in the `.then()` of the phase that creates the resource.
**How to apply**: When reviewing a multi-step `useEffect`, walk down the chain and ask: "if cancel fires here, what got created above that needs destroying?" Every such resource needs a flag flipped before its `await` returns.

---

## TS `erasableSyntaxOnly` blocks parameter properties
**Date**: 2026-04-29
**Mistake**: In S30-06's `HexTileView` I used the constructor parameter-property shorthand (`constructor(public tile: HexTile, private size: number, ...)`). `tsc --noEmit` immediately failed with `TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.` Parameter properties require runtime emit — the compiler can't erase them — and this project has `erasableSyntaxOnly` set in `tsconfig`.
**Rule**: Don't use TypeScript-specific runtime syntax in `.ts` files in this repo: no `public/private/protected` parameter properties on constructors, no enums, no `namespace`, no `import =` / `export =`. Declare class fields explicitly (`public foo: T;` then assign in the constructor body) and prefer `const` unions over enums.
**How to apply**: When writing or porting class code (especially Pixi `Container` subclasses or anything copy-pasted from external guides), default to explicit field declarations + constructor-body assignment. If you ever see TS1294 / TS1295 / TS1206, the fix is to switch to erasable-only syntax — don't toggle the tsconfig flag off.

---

## Campaign map visual hierarchy
**Date**: 2026-04-28
**Mistake**: First Bellum node-map pass overused red glows, boxed labels, and equal-weight UI regions, making the screen read like an alarm/debug overlay instead of a painted campaign map.
**Rule**: On campaign maps, reserve full red for active danger/selected destinations, keep routes as muted parchment/gold threads, render labels as terrain text or painted plaques, make the current army position visually distinct from selection, and keep legends compact.

## "Keep existing X" means only X, not everything
**Date**: 2026-04-20
**Mistake**: During S22 (Imperium Forum port), the user said "Provinciae should keep our current UI, just integrate as a tab." I generalized that to mean every lift-and-shift was acceptable, and applied the same OrnateFrame-strip pattern to Consilium (S22-05) and Exercitus (S22-06) instead of porting them to the new Forum design. The user had to stop me: "THE ONLY ONE THAT HAVE TO KEEP ITS WAY WAS THE PROVINCIAE!!"
**Rule**: When the user makes a specific exception (e.g. "keep Provinciae as-is"), treat it as scoped to that item only. The default for everything else in that sprint remains the sprint's stated goal (here: port to the new design). Don't extrapolate exceptions across siblings without asking.
**How to apply**: Before generalizing a pattern across multiple tasks in a sprint, re-check the sprint's goal statement. If the pattern being applied conflicts with the goal, stop and confirm per task.

## Spawned-agent worktree base is not the parent branch
**Date**: 2026-04-20
**Mistake**: Spawned an implementation agent with `isolation: "worktree"` off `feat/ui-overhaul`, but the harness created the worktree off `main` (a much older commit line that didn't yet track `src/ui/design-tokens.css`). The agent, finding no tokens file, created one "fresh" — effectively destroying 70 lines of existing tokens when the result was copied back.
**Rule**: When spawning a worktree agent, the agent's view of the tree may be based on a different (usually older) branch than the one you are on. Before trusting an agent's "file didn't exist, so I created it" report, verify the file's state in the **main checkout** — `git ls-tree <current-branch> -- <path>` is authoritative. If the file is tracked there but the agent reports it missing, reconcile by merging/appending in the main checkout instead of trusting the worktree output.

## Worktree-isolated agent may still write to the parent checkout
**Date**: 2026-04-30
**Mistake**: Spawned an S31-02 agent with `isolation: "worktree"`. The worktree's base was an ancient commit that predated `src/game/campaign/`, so a `git diff` of the worktree against my branch showed -39k +9k lines of churn. I assumed the agent had hallucinated everything. In reality, the agent had written all four S31-02 files to the **parent checkout** (verified by `git status` in the parent — files staged/untracked exactly as planned), and the worktree was untouched.
**Why**: Agents use absolute paths from CLAUDE.md context, so they can resolve and write to `C:\Users\…\Map2D\src\…` directly even when run inside `.claude/worktrees/agent-XXX`. The worktree assignment doesn't sandbox file writes.
**How to apply**: After a worktree-isolated agent completes, verify by checking **both** locations: `git status` in the parent checkout AND `git -C <worktree-path> status`. If the worktree has zero changes but the parent has the expected files, the agent did its job — don't waste cycles cleaning up "broken" output.

## Agent briefs: "append only" must be enforced by reading first
**Date**: 2026-04-20
**Mistake**: Told an agent to "extend `design-tokens.css` — do not modify existing vars". The agent didn't find the file in its worktree (see lesson above) and silently created a fresh file with only the new block, reporting "created 50 lines". The wording "append new vars only" wasn't strong enough when the file appeared absent.
**Rule**: Any brief that says "append to file X" must also require the agent to Read X first, echo its existing byte count/line count, and confirm it's preserving that content before writing. If the file is absent in the agent's view, the agent must stop and escalate — not create a fresh one.

## Notion Page Content Formatting
**Date**: 2026-03-26
**Mistake**: Used `\n` escape sequences in Notion page content strings. Rendered as a wall of text instead of proper markdown with headings and line breaks.
**Rule**: Always use real newlines in Notion page content. Never use `\n` in the content string — Notion markdown needs actual line breaks between blocks (headings, paragraphs, lists).

## Notion Task Descriptions
**Date**: 2026-03-26
**Mistake**: Same `\n` issue in task page descriptions — all content collapsed into one unreadable paragraph.
**Rule**: When writing Notion page content via `replace_content` or `create-pages`, test that headings (`##`), lists (`-`), and paragraphs render as separate blocks.

## Skill Abstraction
**Date**: 2026-03-26
**Mistake**: First draft of `/notion` skill was hardcoded to a specific project (Map2D Tasks DB with hardcoded data source ID). User wanted it project-agnostic.
**Rule**: Skills that interact with Notion should ALWAYS read the DB URL from `CLAUDE.md` dynamically. Never hardcode Notion IDs in skills.

## Off-Faction Cost Balance
**Date**: 2026-03-26
**Mistake**: Set off-faction card/ability cost at 1.5x. Game design review found the Merchant could dominate all factions through cheap resource exchange.
**Rule**: Cross-faction costs should be 2x minimum to preserve faction identity. 1.5x is too cheap when one faction has higher income.

## Army Regeneration
**Date**: 2026-03-26
**Mistake**: Initially designed dead units to regenerate for free at the Hub — removing all consequence from losing battles.
**Rule**: In roguelite design, losses must have permanent cost. Dead units should require resources to replace, not auto-regenerate.

## Game Mechanic Naming
**Date**: 2026-03-26
**Mistake**: Boudicca's passive was called "Blood Momentum" — confused with the Momentum resource. Players would think spending Momentum removes their damage stacks.
**Rule**: Never name a passive buff after a spendable resource. Use distinct names (renamed to "Veteran Stacks").
