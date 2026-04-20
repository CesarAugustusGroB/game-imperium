# Lessons Learned

Rules for Claude to avoid repeating past mistakes.

---

## Spawned-agent worktree base is not the parent branch
**Date**: 2026-04-20
**Mistake**: Spawned an implementation agent with `isolation: "worktree"` off `feat/ui-overhaul`, but the harness created the worktree off `main` (a much older commit line that didn't yet track `src/ui/design-tokens.css`). The agent, finding no tokens file, created one "fresh" — effectively destroying 70 lines of existing tokens when the result was copied back.
**Rule**: When spawning a worktree agent, the agent's view of the tree may be based on a different (usually older) branch than the one you are on. Before trusting an agent's "file didn't exist, so I created it" report, verify the file's state in the **main checkout** — `git ls-tree <current-branch> -- <path>` is authoritative. If the file is tracked there but the agent reports it missing, reconcile by merging/appending in the main checkout instead of trusting the worktree output.

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
