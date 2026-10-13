# The Croupier's Reels (pixel art)

Pixel scale, sizes, outline and shading, palettes, animation and the sidecar are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Image generators do not make clean pixel art or consistent frames: use the **design prompt** for the look, then draw or clean the frames on the art-pixel grid (style guide §14), keeping the cell, pivot and export factor exact.

The Reels stand in the Umbral town (Nocturne Archive) between the Gambler and the Exchange, run by the Croupier (`docs/handoff/reels.md`). Until this art lands, the symbols are drawn procedurally on a 16×16 grid (`src/app/shared/reels/reel-sprites.ts`) and the stall shows the Eclipse rune painting. Not yet in `commissions.csv`: add the two rows when the brief is approved.

## `umbral-reels-cabinet` — The Reels (stall)

| | |
|---|---|
| Save as | `Assets/Sprites/Props/12-umbral-reels-cabinet.png` + sidecar `Assets/Sprites/Props/12-umbral-reels-cabinet.json` |
| Spec | Stall (pixel art) - 64x68 art px per frame, sheet 256x68 art px, export x8 nearest-neighbour = 2048x544 px (512x544 per frame), transparent background |
| On screen | 260 px tall in town; 4 px per art px |
| Cell | 64x68 art px = 512x544 authored; pivot (256, 544) authored = art (32, 68) |
| Priority | P2 |
| Used in | Umbral town: The Reels (`/play?at=reels`) |
| Shows today | the Eclipse rune painting on a generic stall |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 512, "h": 544}, "pivot": {"x": 256, "y": 544}, "actions": [{"name": "ambient", "frames": 4, "fps": 6, "loop": true}]}` |

**Actions** - one sheet row per action

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 6 | yes | the three reel windows flicker faintly; the lever knob catches the moon; frame 1 doubles as the still |

**Design prompt**

```text
a tall obsidian cabinet carved like an archive shelf, three narrow reel windows across its face showing pixel symbols (a cinder ore lump, an ash rune tablet, an eclipse disc), a silver-ringed lever on the right side with an amethyst knob, a cracked moon-mirror crest on top, small brass coin tray at the base. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0, a little gold #b8901e #E8D44D on the coin tray only. one frame on a 64x68 art-pixel cell, seen from the front at the side-scroller's eye level, standing on a ground line at the cell bottom with a 1-2 art px contact shadow at most 35% opacity. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 2048x544 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, numbers, dollar signs, real casino branding, playing-card suits, cherries, sevens, bells, watermark, signature, background, scenery, copied or traced sprites from any existing game
```

## `reels-symbols` — the six reel symbols (I1 icon sheet)

| | |
|---|---|
| Save as | `Assets/Sprites/UI/reels-symbols.png` + sidecar `Assets/Sprites/UI/reels-symbols.json` |
| Spec | I1 icons (pixel art) - 32x32 art px per icon, sheet 192x32 art px (six icons in a row), export x8 nearest-neighbour = 1536x256 px, transparent background |
| On screen | 56-72 px in the reel window (whole multiples of the art grid), 32 px in the Details pay table |
| Order | `cinder` Cinder Ore · `ash` Ash rune · `ember` Ember rune · `maw` Rivet Maw · `heart` Infernal Heartstone · `eclipse` Eclipse (the scatter, the top symbol) |
| Priority | P2 |
| Used in | the Reels window and pay table |
| Shows today | procedural 16×16 sprites (`reel-sprites.ts`) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "icons": ["cinder", "ash", "ember", "maw", "heart", "eclipse"]}` |

Each icon must read at 56 px and be told apart by silhouette alone (lump, tablet, tablet with a flame mark, round iron head, faceted heart gem, ringed disc): the two rune tablets differ by their carved mark and its colour (pale ash grey vs ember orange). The Eclipse is the only symbol with a gold-and-amethyst ring, so a scatter is never mistaken for a line symbol.

**Design prompt**

```text
six game item icons in a row on 32x32 art-pixel cells: a lump of dark basalt ore with glowing orange ember flecks; a grey stone rune tablet with a pale carved stroke rune; the same tablet with an orange flame-shaped rune; the round riveted iron head of a small mechanical creature with a toothed mouth and two red eyes; a faceted red-orange heart-shaped gemstone with a hot core; a black eclipse disc inside a gold ring with an amethyst corona. Infernal palette for the first five (iron black, basalt grey, ember orange #e8752a), Umbral amethyst #7b4fc0 #A855F7 #c9a0ff and gold #E8D44D for the eclipse. hand-placed pixel art icons, every pixel on the art-pixel grid, a 1-pixel coloured outline (never pure black, floor #140a1f), light from the upper left, 3 to 4 hue-shifted tones per material plus one highlight, no anti-aliasing, no dithering; transparent background; export with nearest-neighbour x8 to 1536x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, painterly texture, photorealism, 3D render, vector art, mixed pixel sizes, text, letters, numbers, dollar signs, cherries, sevens, bells, bars, playing-card suits, real casino iconography, watermark, background, copied or traced sprites from any existing game
```
