# The Croupier's other three games (pixel art)

Pixel scale, sizes, outline and shading, palettes, animation and the sidecar are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Image generators do not make clean pixel art or consistent frames: use the **design prompt** for the look, then draw or clean the frames on the art-pixel grid (style guide §14), keeping the cell, pivot and export factor exact.

Rune Drop, Seam Sweeper and Eclipse Ascent stand in a row in the Umbral town (Nocturne Archive) east of the Reels, run by the Croupier (`docs/handoff/casino.md`). Until this art lands the panels draw procedurally (SVG pins and rune, 16×16 seam cells, a 32×32 eclipse sky) and the stalls show existing paintings (`rune-of-hollow`, `cinder-ore`, `eclipse-fragment-capsule`). Not yet in `commissions.csv`: add the rows when the brief is approved.

Shared stall spec (all three): Stall (pixel art) - 48x68 art px per frame, sheet 192x68 art px (4 frames), export x8 nearest-neighbour = 1536x544 px (384x544 per frame), transparent background; on screen 260 px tall in town (4 px per art px); pivot (192, 544) authored = art (24, 68); sidecar `{"scale": 2, "pixelArt": true, "frame": {"w": 384, "h": 544}, "pivot": {"x": 192, "y": 544}, "actions": [{"name": "ambient", "frames": 4, "fps": 6, "loop": true}]}`. Priority P2. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0, gold #b8901e #E8D44D only where named.

Common negative (all briefs):

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, numbers, dollar signs, real casino branding, playing-card suits, cherries, sevens, bells, chips, watermark, signature, background, scenery, copied or traced sprites from any existing game
```

## `umbral-rune-drop-board` — Rune Drop (stall)

| | |
|---|---|
| Save as | `Assets/Sprites/Props/13-umbral-rune-drop-board.png` + sidecar `.json` |
| Used in | Umbral town: Rune Drop (`/play?at=rune-drop`) |
| Shows today | the Hollow rune painting on a generic stall |
| Ambient | a tiny rune tablet falls one pin per frame down the board and drops into a lit bin; frame 1 is the still (rune at the top) |

```text
a tall obsidian lectern-board carved like an archive page, a triangle of small silver Godforge pins (round 2-art-pixel studs) on its face, a row of narrow bins along the bottom edged in amethyst, the centre bins dull and the two outer bins rimmed in gold, a small grey rune tablet with a pale carved mark at the top of the pin triangle, a cracked moon-mirror crest on top. Umbral palette, gold only on the outer bin rims. one frame on a 48x68 art-pixel cell, front view at the side-scroller's eye level, standing on a ground line at the cell bottom with a 1-2 art px contact shadow at most 35% opacity. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, no anti-aliasing, no dithering; transparent background; export with nearest-neighbour x8 to 1536x544 px.
```

## `umbral-seam-sweeper-slab` — Seam Sweeper (stall)

| | |
|---|---|
| Save as | `Assets/Sprites/Props/14-umbral-seam-sweeper-slab.png` + sidecar `.json` |
| Used in | Umbral town: Seam Sweeper (`/play?at=seam-sweeper`) |
| Shows today | the Cinder Ore painting on a generic stall |
| Ambient | one cell of the slab cracks open to a gold ore glint, then reseals; frame 1 is the still (all cells closed) |

```text
a slab of dark basalt Delve seam standing upright in an obsidian frame like a specimen under glass, its face divided into a 5 by 5 grid of rough rock cells, one cell broken open showing a glinting gold-orange ore nugget, a thin glass pane with a moonlight highlight across the frame, a small pickaxe hung on the frame's side, a cracked moon-mirror crest on top. Umbral palette for the frame, basalt greys and ember orange #e8752a for the seam, gold only on the ore. one frame on a 48x68 art-pixel cell, front view at the side-scroller's eye level, standing on a ground line with a 1-2 art px contact shadow at most 35% opacity. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (never pure black, floor #140a1f), light from the upper left, 3 to 4 hue-shifted tones per material plus one highlight, no anti-aliasing, no dithering; transparent background; export with nearest-neighbour x8 to 1536x544 px.
```

Panel cells (I1 icon sheet, `Assets/Sprites/UI/seam-cells.png`, 16x16 art px per icon, sheet 64x16, x8 = 512x128 px; order `rock` · `ore` · `collapse` · `ore-faded`): closed rock, opened ore nugget, fallen rubble with ember cracks, a dim ore for the end-of-round reveal. Each must read at 48 px; the collapse must never look like ore (warm rubble, no gold).

## `umbral-eclipse-ascent-mirror` — Eclipse Ascent (stall)

| | |
|---|---|
| Save as | `Assets/Sprites/Props/15-umbral-eclipse-ascent-mirror.png` + sidecar `.json` |
| Used in | Umbral town: Eclipse Ascent (`/play?at=eclipse-ascent`) |
| Shows today | the Eclipse Fragment Capsule painting on a generic stall |
| Ambient | a dark moon disc slides one step further over a small gold sun disc each frame, the corona brightening; frame 1 is the still (moon just touching the sun) |

```text
a round fractured moon mirror on a tall obsidian stand, in its glass a small gold sun disc with a black moon disc sliding over it and a thin gold-and-amethyst corona around both, hairline cracks across the mirror, a short brass scale of tick marks down one side of the stand (no numbers), a cracked moon-mirror crest on top. Umbral palette, gold only on the sun and corona. one frame on a 48x68 art-pixel cell, front view at the side-scroller's eye level, standing on a ground line with a 1-2 art px contact shadow at most 35% opacity. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (never pure black, floor #140a1f), light from the upper left, 3 to 4 hue-shifted tones per material plus one highlight, no anti-aliasing, no dithering; transparent background; export with nearest-neighbour x8 to 1536x544 px.
```

Panel sky (`Assets/Sprites/UI/eclipse-ascent-sky.png`, 32x32 art px per frame, 8 frames from "moon far" to "moon centred", plus 1 "broken" frame; x8 = 2304x256 px): replaces the procedural SVG sky; the panel picks the frame by log-progress toward ×1,000.
