# Art brief — the Rift Gates and the Ink Deeps (Umbral underside)

Reference: Terraria (tiles, caves, mirror/shimmer liquids, hallowed-vs-corruption palette shifts). Everything
below is drawn in code today (procedural pixel art on the 2 px art grid; `play/engine/tile-art.ts`,
`engine.ts drawShade`, `shared/art/pixel-icons.ts`). Real art replaces it through `scripts/import-assets.py`
and `artFor()` — never hand-write an `assets/` path. Style guide: `docs/art/style-guide.md` (outline never
black, lit top-left, one-pixel shine).

## Palette (Umbral underside; propose for style guide §5.3)
ink violet-black `#120a1e` `#1a1030` `#08060c` · slate `#1e1828` `#3a2e4c` · gloam `#16121e` `#2e2640` ·
lift `#6a4adf` `#a48bff` · glass `#c8b8ff` `#e8d8ff` · brazier warm `#ffd8a0`.
Gate colours: Umbral `#a48bff`, Luminous `#ffe9a8`, Celestial `#5fb6ff`, Verdant `#7fd5a3`.

## W7a tiles (16×16 art px, 4 variants each, edge masks as the Delve tiles)
1. `ink-slate`, 2. `gloam-slate`, 3. `inkstone-vein` (nuggets that look like wet ink), 4. `nightglass-vein`
(dark glass that catches only cold light), 5. `ink-seep` (weeping wall), 6. `drift-shale` (rock with a faint
"double exposure" offset — it reads as unsure of where it is), 7. `ink-mirror` (glossy ceiling, a highlight
band), 8. `rift-frame` (ancient carved stone, a seam of the realm colour), 9. `rift-splinter` (frame chip).

## Placed / animated
- **Rift Gate opening** (2×3 cells), four colourways; idle shimmer 4 frames; a "settling" variant (static,
  dim, slow pulse) for the three closed realms.
- **Gloam brazier**: unlit and lit (3-frame flame), guttering frame.
- **Ink liquid**: surface lip, body, 2-frame shimmer; the **tide** band (a translucent rising sheet).

## Creatures (sprite sheets, the Keeper's scale at 0.5 in delves)
- **Shadeling** (~10×26 art px): wisp of dark, two spark eyes; states: drift, lunge wind-up, **frozen**
  (stone-grey, cracked, perfectly still), dissolve.
- **The Gloam Warden** (~20×52): the same family, taller, a hood of ink, eyes that flare on wind-up; frozen
  state reads clearly as "lit = vulnerable".

## Icons (I1, 16×16)
`rift-splinter`, `umbral-sigil`, `inkstone`, `nightglass`, `veil-lantern` (pixel-icons.ts stand-ins exist).

## Backdrop (W8 far/near pair)
Ink Deeps far: black-violet strata with faint mirror glints; near: hanging ink drips.
