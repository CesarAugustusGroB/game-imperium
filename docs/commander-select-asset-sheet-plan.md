# Commander Select Asset Sheet Prompt and Plan

## Goal

Create the asset sheet needed to rebuild the commander select screen in a Roman luxury strategy-game style: dark imperial hall, polished aged-gold UI, four large commander cards, gold ornaments, faction-colored iconography, and a dense lower information panel.

All readable text should remain DOM text in the game. Generated assets must not contain text, letters, labels, numbers, or UI copy.

## Primary Asset Sheet Prompt

Use the attached reference image for style and layout only. Create a clean isolated game UI asset sheet for a Roman imperial strategy game commander selection screen. Polished aged gold metal, beveled relief, warm highlights, dark bronze shadows in grooves, crisp readable silhouettes, luxury grand strategy interface, dark marble and smoky imperial ambience, transparent background, centered orthographic asset sheet composition, no text, no letters, no numbers, no labels, no scenery behind individual assets, no blur, no extra random objects.

Generate a single PNG asset sheet, 4096x4096, transparent background, 8x8 grid-friendly layout with 12% safe padding around every asset. Keep every asset separated with clear transparent space so it can be sliced.

Include these isolated assets:

1. Outer screen border pieces: top horizontal gold line segment, bottom horizontal gold line segment, left vertical line segment, right vertical line segment, four ornate Roman corner pieces with laurel detail.
2. Header ornaments: small imperial eagle crest, small laurel wreath crest, left and right laurel branch flourishes, thin divider lines with small diamond center cap.
3. Side banner assets: left and right dark crimson Roman hanging standards with gold eagle finial, gold SPQR-style wreath emblem shape but no letters, pole cap, bottom tassels, transparent edges.
4. Commander card UI: tall portrait-card gold frame base, selected card frame with brighter glow, hover frame, disabled/dim frame, bottom selected diamond marker, subtle black inner vignette overlay shape.
5. Carousel controls: circular left arrow button frame and circular right arrow button frame, gold rim, dark glass center, no arrow glyph baked in if possible; include separate simple gold chevron icons.
6. Archetype icons: warlord axe, religious cross, diplomat laurel/seal, merchant balance scales. Each icon should be round-medallion compatible, gold base with faction accent variants red, gold, blue, purple.
7. Ability icons: war cry starburst, fury charge impact, crusade standard, miracle ray, manipulation hand/seal, turncoat mask, golden opportunity coin, buy reinforcements helmet.
8. Unit and improvement icons: berserker axe, oppidum stronghold, templar cavalry helm, grand cathedral, praetorian shield, imperial forum temple, mercenary sword, patrician villa.
9. Victory path icons: domination laurel, raiding skull, cultural temple, religious sun/cross, diplomatic clasped hands/seal, economic coins/crown.
10. Lower panel UI: large dark glass information panel with gold border, vertical divider line, section heading underline, small circular icon medallion, secondary ghost button frame, large gold primary CTA button frame, small crown icon.
11. Ambient overlays: subtle golden dust spark strip, black-to-transparent bottom vignette strip, warm edge glow strip, all transparent PNG elements.

Style constraints:

- Roman imperial, premium strategy game, not cartoon, not flat vector.
- Gold must read as aged metal, not yellow plastic.
- Card and panel frames must be straight-edged with small-radius corners, not soft rounded app UI.
- Icons must remain readable at 32px, 48px, and 64px.
- Portrait card frames should allow separate character portraits behind them.
- Avoid baked-in text, fake letters, fake UI labels, watermarks, signatures, or background scenes inside the asset sheet.

Output requirements:

- PNG, transparent background.
- 4096x4096.
- Separate assets with clear alpha gutters.
- No compression artifacts.
- No shadows that bleed into neighboring assets.

## Optional Separate Portrait Prompt

Use this only if the current commander portraits are replaced rather than reused.

Use the attached reference image for style only. Create four separate commander portrait card artworks for a Roman fantasy grand strategy game. Dramatic painterly realism, cinematic dark-gold lighting, luxury historical strategy game art, 5:7 vertical portrait composition, no text, no logos, no UI frame, no border, no letters, no watermark.

Create these four portraits as separate PNGs:

- Celtic warlord queen, red faction, fierce battle shout, fur cloak, torc, axe or spear, burning battlefield atmosphere.
- Roman papal religious commander, gold faction, elderly pope-like statesman, white and gold robes, cathedral light, solemn blessing gesture.
- Roman imperial diplomat, blue faction, young Augustus-like statesman, laurel crown, polished armor, purple cloak, forum and sunset atmosphere.
- Roman patrician merchant, purple faction, older wealthy Roman, ornate armor and red cloak, coins and trade-city glow, calculating expression.

Each portrait should leave safe space at top for DOM culture/archetype text and at bottom for DOM quote overlay. Do not add any readable text.

## Target Asset Manifest

Suggested destination: `public/asset/ui/commander-select/`

```text
border_corner_tl.png
border_corner_tr.png
border_corner_bl.png
border_corner_br.png
border_line_h.png
border_line_v.png
header_eagle.png
header_laurel.png
header_flourish_left.png
header_flourish_right.png
side_banner_left.png
side_banner_right.png
card_frame_base.png
card_frame_selected.png
card_frame_hover.png
card_inner_vignette.png
selected_diamond.png
carousel_button.png
chevron_left.png
chevron_right.png
panel_frame_large.png
panel_divider_v.png
section_underline.png
button_primary_gold.png
button_secondary_dark.png
icon_archetype_warlord.png
icon_archetype_religious.png
icon_archetype_diplomat.png
icon_archetype_merchant.png
icon_ability_war_cry.png
icon_ability_fury_charge.png
icon_ability_call_crusade.png
icon_ability_miracle.png
icon_ability_manipulate.png
icon_ability_turncoat.png
icon_ability_golden_opportunity.png
icon_ability_buy_reinforcements.png
icon_unit_berserker.png
icon_unit_oppidum.png
icon_unit_templar.png
icon_unit_cathedral.png
icon_unit_praetorian.png
icon_unit_forum.png
icon_unit_mercenary.png
icon_unit_villa.png
icon_victory_domination.png
icon_victory_raiding.png
icon_victory_cultural.png
icon_victory_religious.png
icon_victory_diplomatic.png
icon_victory_economic.png
icon_crown.png
dust_strip.png
bottom_vignette.png
edge_glow.png
```

## Implementation Plan

1. Generate the sheet

Use the primary prompt with the reference screen attached. If the sheet comes back with fake letters on banners or buttons, regenerate with stronger `no text, no letters, no symbols that resemble text`.

2. Slice and normalize

Slice the sheet into the manifest above. Keep UI pieces in `public/asset/ui/commander-select/` because these should remain exact PNGs. Export transparent PNGs, trim empty edges, and keep a small internal safe padding so glows do not clip.

3. Reuse existing commander data

Keep using `src/data/commanders.ts` for names, cultures, quotes, abilities, unique units, victory paths, colors, and portrait paths. Do not bake any of that into images.

4. Replace card chrome first

In `src/ui/screens/CommanderSelectScreen.tsx`, replace CSS-drawn card borders with image-backed frames:

- base frame for all cards
- selected frame overlay for the active card
- hover frame on pointer hover
- `selected_diamond.png` under the active card
- `card_inner_vignette.png` over the portrait for text readability

5. Replace icon placeholders

Replace inline SVG and emoji placeholders with PNG icons from the manifest:

- archetype icon in card and lower summary
- ability icons in strategic cards
- unit/improvement icons
- victory path icons
- crown icon on CTA

6. Build the screen chrome

Add the outer border, header eagle/laurel/flourishes, side banners, carousel round buttons, and lower panel frame as decorative images. Keep them `aria-hidden`.

7. Preserve responsive behavior

Desktop should match the reference density: four cards visible, lower panel spans most width. Mobile should collapse to one focused card plus horizontal/arrow navigation and a scrollable details panel using the global gold scrollbar.

8. Add verification

Add a lightweight source smoke test that checks:

- commander select imports or references the new asset directory
- no fake text images are used for headings or labels
- four commanders still render from `COMMANDERS`
- the begin flow still calls `startNewRun`

Then run:

```powershell
npx tsx tests/commander-select-ui.spec.ts
npx tsc --noEmit
npm run build
```

9. Visual QA

Use Chromium screenshots for:

- desktop: `1470x900`
- wide desktop: `1680x946`
- mobile: `390x844`

Check card selection glow, readable lower panel, no overlapping text, side banners not blocking content, and all icons readable at small size.

## Notes

- The current screen already has the right data structure and flow. The work is mostly visual replacement and responsive polish.
- Keep the main background consistent with the title-screen Roman background unless a dedicated commander hall background is generated.
- Text stays DOM for localization, accessibility, crispness, and easier balancing.
