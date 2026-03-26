# Lessons Learned

Rules for Claude to avoid repeating past mistakes.

---

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
