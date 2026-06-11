# Icon Art Direction

This project uses a single visual canon for generated UI icons and small game assets.

## Canon

Use premium Roman game UI icons: circular embossed medallions with raised antique-gold rims, beveled edges, bronze shadows, warm gold highlights, and consistent top-left lighting. Icons must remain readable at 14-40 px and sit on transparent backgrounds.

Colored details should be solid enamel inlays inside the medallion. The enamel must look smooth, opaque, continuous, and polished. Keep texture on metallic gold/bronze relief only, not inside the colored fields.

Preferred restrained Roman palette:

- Antique gold and bronze for rims, bevels, and raised relief.
- Muted imperial red.
- Deep lapis blue.
- Oxidized teal.
- Dark olive.
- Ivory.
- Warm copper.

Avoid bright saturated SVG-like colors, neon accents, flat line-art, cartoon styling, modern symbols, text, numbers, labels, noisy pigment, dotted texture, halftone, grain, speckles, grunge, scratched color fields, and drop shadows outside the transparent icon area.

## Generation Workflow

When creating icons or UI assets, use ChatGPT Image Tool first. Generate source images larger than final usage, then slice or downsample into the repo asset format.

For icon sheets, prefer 1024x1024 or 1536x1536 sprite sheets with equal cells, generous padding, transparent background, no labels, and no frame around the full sheet.

Runtime UI icon PNGs should be exported as 768x768 RGBA files. This is the 2K desktop standard: large enough for crisp rendering on high-resolution monitors while the actual displayed size remains controlled by `src/ui/components/icon-system.ts`.

## Reusable Prompt Core

```text
Generate a 1024x1024 image. Create a clean 3x3 sprite sheet of Roman-themed game UI icons, transparent background, no text, no labels, no frame around the full sheet. Each icon must be centered in its own equal square cell with generous padding, designed to be sliced later into individual icons.

Visual canon: premium Roman game UI icons. Each icon is a circular embossed medallion with a raised antique-gold rim, beveled edges, bronze shadows, warm gold highlights, consistent top-left lighting, crisp silhouette, high readability at 14-40 px, transparent outside the medallion.

Important color style: use solid enamel inlays for the colored areas. The colored ink/enamel must look smooth, opaque, continuous, and polished, with no speckling, no dotted texture, no broken pigment, no halftone, no grain, no noisy mottling, no paint chips, and no scattered highlights inside the color fields. Keep texture only on the metallic gold/bronze rim and raised relief, not inside the colored enamel.

Use restrained Roman colors: muted imperial red, deep lapis blue, oxidized teal, dark olive, ivory, and warm copper accents. Colors must be rich but controlled, not neon. The icons should keep depth through bevels, rim shadows, relief, and material lighting.

Style requirements: all icons must feel like the same artist, same medallion size, same bevel thickness, same lighting, same material, same detail density. Use bold simple silhouettes inside the medallions, not thin line art. Avoid cartoon style, realistic painted portraits, modern symbols, bright green, bright blue, bright orange, blood, text, numbers, labels, UI background, drop shadows outside the transparent icon area, dotted pigment, speckles, grunge, noise, stippling, and scratched color fields.
```

## Combat Stat Sheet Reference

For the nine combat stats, use this 3x3 order:

1. `stat-attack`: Roman gladius sword angled diagonally over a small laurel notch, gold blade with a smooth solid muted crimson enamel backing.
2. `stat-defense`: Roman scutum shield front-facing, strong rectangular oval silhouette, smooth deep red shield face with gold rim and raised boss.
3. `stat-hp`: Roman military standard / eagle aquila with a small protective wreath, ivory eagle and gold standard with smooth teal enamel backing, representing endurance and life, not a heart.
4. `stat-movement`: Roman caliga sandal with a small wing motif, warm copper sandal and smooth muted olive enamel backing, distinct from agility.
5. `stat-agility`: Curved feathered wing attached to a small circular clasp, pale ivory feathers with smooth lapis blue enamel backing.
6. `stat-charge`: Forward-pointing cavalry lance with a compact horse-head crest behind it, gold lance with a smooth crimson pennant and bronze horse crest, fully contained inside the medallion.
7. `stat-harass`: Two small javelins / pila crossing over a darting arc, bronze javelins with smooth muted teal enamel arc.
8. `stat-push`: Scutum shield ramming forward with a subtle impact chevron, smooth dark red shield face with gold rim and clean copper impact chevron.
9. `stat-siege`: Roman ballista or siege ram head in simplified relief, dark bronze machine with gold highlights and smooth slate-blue enamel backing.
