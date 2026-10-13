# Town building and prop sets (pixel art)

Pixel scale, sizes, outline and shading, palettes, animation and the sidecar are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Image generators do not make clean pixel art or consistent frames: use the **design prompt** for the look, then draw or clean the frames on the art-pixel grid (style guide §14), keeping the cell, pivot and export factor exact.

Which building lives in which town follows `docs/roadmap/world-plan.md` ("Where each page lives"). Buildings and props **do** carry a baked 1-2 art px contact shadow (at most 35% opacity) because they never move; characters and creatures do not. They stand in front of the realm's W8 parallax set, so keep them a step more saturated and higher in contrast than its `near` layer.

## Infernal town — Basalt Seamworks

### `infernal-campfire` — Campfire

| | |
|---|---|
| Save as | `Assets/Sprites/Props/01-infernal-campfire.png` + sidecar `Assets/Sprites/Props/01-infernal-campfire.json` |
| Spec | W6 prop (pixel art) - 16x16 art px per frame, sheet 96x16 art px, export x8 nearest-neighbour = 768x128 px (128x128 per frame), transparent background |
| On screen | 60 px tall; 4 px per art px |
| Cell | 16x16 art px = 128x128 authored; pivot (64, 128) authored = art (8, 16) |
| Priority | P0 |
| Used in | Infernal town: camp rest point |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 128, "h": 128}, "pivot": {"x": 64, "y": 128}, "actions": [{"name": "ambient", "frames": 6, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a camp fire ring of basalt stones with crossed iron-black logs and a lively ember-orange flame. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 16x16 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 768x128 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `infernal-bench` — Bench

| | |
|---|---|
| Save as | `Assets/Sprites/Props/02-infernal-bench.png` + sidecar `Assets/Sprites/Props/02-infernal-bench.json` |
| Spec | W6 prop (pixel art) - 32x16 art px, export x8 nearest-neighbour = 256x128 px, transparent background |
| On screen | 50 x 120 px; 4 px per art px |
| Cell | 32x16 art px = 256x128 authored; pivot (128, 128) authored = art (16, 16) |
| Priority | P0 |
| Used in | Infernal town: camp seating |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 128}, "pivot": {"x": 128, "y": 128}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a low bench made of a riveted iron beam on two basalt blocks. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x16 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x128 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `infernal-crafting-bench` — Crafting Bench

| | |
|---|---|
| Save as | `Assets/Sprites/Props/03-infernal-crafting-bench.png` + sidecar `Assets/Sprites/Props/03-infernal-crafting-bench.json` |
| Spec | W6 prop (pixel art) - 40x28 art px, export x8 nearest-neighbour = 320x224 px, transparent background |
| On screen | 100 x 150 px; 4 px per art px |
| Cell | 40x28 art px = 320x224 authored; pivot (160, 224) authored = art (20, 28) |
| Priority | P0 |
| Used in | Infernal town: Crafting Bench station (crafting panel) |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 224}, "pivot": {"x": 160, "y": 224}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a sturdy crafting bench of dark rootwood and iron bands with a vice, small brass tools and a rune-etched mat. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 40x28 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 320x224 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `infernal-anvil` — Forge anvil

| | |
|---|---|
| Save as | `Assets/Sprites/Props/04-infernal-anvil.png` + sidecar `Assets/Sprites/Props/04-infernal-anvil.json` |
| Spec | W6 prop (pixel art) - 32x24 art px per frame, sheet 128x24 art px, export x8 nearest-neighbour = 1024x192 px (256x192 per frame), transparent background |
| On screen | 90 x 120 px; 4 px per art px |
| Cell | 32x24 art px = 256x192 authored; pivot (128, 192) authored = art (16, 24) |
| Priority | P0 |
| Used in | Infernal town: Seamworks forge station (repair / Basalt Edge) |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 192}, "pivot": {"x": 128, "y": 192}, "actions": [{"name": "ambient", "frames": 4, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a heavy basalt-and-iron anvil on a riveted stone block with a small furnace mouth glowing behind it, tongs and hammer on top; ambient loop = furnace glow pulse. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x24 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 4 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1024x192 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `infernal-waystone` — Waystone

| | |
|---|---|
| Save as | `Assets/Sprites/Props/05-infernal-waystone.png` + sidecar `Assets/Sprites/Props/05-infernal-waystone.json` |
| Spec | W6 prop (pixel art) - 24x56 art px per frame, sheet 144x56 art px, export x8 nearest-neighbour = 1152x448 px (192x448 per frame), transparent background |
| On screen | 220 px tall; 4 px per art px |
| Cell | 24x56 art px = 192x448 authored; pivot (96, 448) authored = art (12, 56) |
| Priority | P0 |
| Used in | Infernal town: Waystone travel panel |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 192, "h": 448}, "pivot": {"x": 96, "y": 448}, "actions": [{"name": "ambient", "frames": 6, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a standing waystone of ancient basalt masonry with a brass orbital ring circling it and five small realm sockets, the Infernal socket lit orange; ambient loop = ring turning, socket pulsing. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 24x56 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1152x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `infernal-rune-forge` — Rune Forge

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/01-infernal-rune-forge.png` + sidecar `Assets/Sprites/Buildings/01-infernal-rune-forge.json` |
| Spec | W5 building (pixel art) - 96x108 art px per frame, sheet 384x108 art px, export x8 nearest-neighbour = 3072x864 px (768x864 per frame), transparent background |
| On screen | 420 px tall; 4 px per art px |
| Cell | 96x108 art px = 768x864 authored; pivot (384, 864) authored = art (48, 108) |
| Priority | P1 |
| Used in | Infernal town: Rune Forge building (runes panel) |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 768, "h": 864}, "pivot": {"x": 384, "y": 864}, "actions": [{"name": "ambient", "frames": 4, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
the Rune Forge: a squat domed forge-house of basalt and iron with a great round furnace door shaped like an eclipse ring, ember light pouring out, chimneys venting violet sparks; ambient loop = door glow. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 96x108 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 4 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 3072x864 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `infernal-enchanting-table` — Enchanting Table

| | |
|---|---|
| Save as | `Assets/Sprites/Props/06-infernal-enchanting-table.png` + sidecar `Assets/Sprites/Props/06-infernal-enchanting-table.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 192x32 art px, export x8 nearest-neighbour = 1536x256 px (256x256 per frame), transparent background |
| On screen | 110 px tall; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 256) authored = art (16, 32) |
| Priority | P1 |
| Used in | Infernal town: Enchanting Table station |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 256}, "actions": [{"name": "ambient", "frames": 6, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
an enchanting table of carved obsidian with a floating lens and a hovering rune glyph above a basin of violet light; ambient loop = glyph bob. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1536x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `infernal-material-stall` — Material Vendor stall

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/02-infernal-material-stall.png` + sidecar `Assets/Sprites/Buildings/02-infernal-material-stall.json` |
| Spec | W5 building (pixel art) - 64x68 art px, export x8 nearest-neighbour = 512x544 px, transparent background |
| On screen | 260 px tall; 4 px per art px |
| Cell | 64x68 art px = 512x544 authored; pivot (256, 544) authored = art (32, 68) |
| Priority | P1 |
| Used in | Infernal town: Material Vendor |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 512, "h": 544}, "pivot": {"x": 256, "y": 544}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a vendor stall with an iron frame and a scorched canvas awning, crates of cinder ore and ember residue, a hanging scale. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 64x68 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x544 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `infernal-ore-deposit` — Cinder Ore deposit

| | |
|---|---|
| Save as | `Assets/Sprites/Props/07-infernal-ore-deposit.png` + sidecar `Assets/Sprites/Props/07-infernal-ore-deposit.json` |
| Spec | W6 prop (pixel art) - 32x24 art px, export x8 nearest-neighbour = 256x192 px, transparent background |
| On screen | 92 x 116 px; 4 px per art px |
| Cell | 32x24 art px = 256x192 authored; pivot (128, 192) authored = art (16, 24) |
| Priority | P1 |
| Used in | Infernal town: quest station: ore |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 192}, "pivot": {"x": 128, "y": 192}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a knee-high outcrop of iron-black ore split by live orange seams. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x24 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x192 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `infernal-eclipse-beacon` — Eclipse beacon

| | |
|---|---|
| Save as | `Assets/Sprites/Props/08-infernal-eclipse-beacon.png` + sidecar `Assets/Sprites/Props/08-infernal-eclipse-beacon.json` |
| Spec | W6 prop (pixel art) - 20x60 art px per frame, sheet 80x60 art px, export x8 nearest-neighbour = 640x480 px (160x480 per frame), transparent background |
| On screen | 240 px tall; 4 px per art px |
| Cell | 20x60 art px = 160x480 authored; pivot (80, 480) authored = art (10, 60) |
| Priority | P1 |
| Used in | Infernal town: quest station: beacon |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 160, "h": 480}, "pivot": {"x": 80, "y": 480}, "actions": [{"name": "ambient", "frames": 4, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a tall narrow beacon of carved obsidian on a four-point anchor base with an eclipse ring at the top holding a slow violet flame; ambient loop = flame. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 20x60 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 4 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 640x480 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `infernal-passage-arch` — Passage arch

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/03-infernal-passage-arch.png` + sidecar `Assets/Sprites/Buildings/03-infernal-passage-arch.json` |
| Spec | W5 building (pixel art) - 56x76 art px, export x8 nearest-neighbour = 448x608 px, transparent background |
| On screen | 300 px tall; 4 px per art px |
| Cell | 56x76 art px = 448x608 authored; pivot (224, 608) authored = art (28, 76) |
| Priority | P1 |
| Used in | Infernal town: quest station: passage |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 448, "h": 608}, "pivot": {"x": 224, "y": 608}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a free-standing iron-and-basalt archway leading onward, heavy rivets, ember sparks drifting through, the opening painted as dark depth. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 56x76 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 448x608 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `infernal-lantern-post` — Lantern post

| | |
|---|---|
| Save as | `Assets/Sprites/Props/09-infernal-lantern-post.png` + sidecar `Assets/Sprites/Props/09-infernal-lantern-post.json` |
| Spec | W6 prop (pixel art) - 12x48 art px per frame, sheet 48x48 art px, export x8 nearest-neighbour = 384x384 px (96x384 per frame), transparent background |
| On screen | 180 px tall; 4 px per art px |
| Cell | 12x48 art px = 96x384 authored; pivot (48, 384) authored = art (6, 48) |
| Priority | P2 |
| Used in | Infernal town: street dressing |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 96, "h": 384}, "pivot": {"x": 48, "y": 384}, "actions": [{"name": "ambient", "frames": 4, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
an iron lantern post with a caged ember lamp; ambient loop = flicker. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 12x48 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 4 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 384x384 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

## Luminous town — Heliograph Court

### `luminous-market-hall` — Market hall

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/04-luminous-market-hall.png` + sidecar `Assets/Sprites/Buildings/04-luminous-market-hall.json` |
| Spec | W5 building (pixel art) - 104x112 art px, export x8 nearest-neighbour = 832x896 px, transparent background |
| On screen | 440 px tall; 4 px per art px |
| Cell | 104x112 art px = 832x896 authored; pivot (416, 896) authored = art (52, 112) |
| Priority | P2 |
| Used in | Luminous town: Market (upgrades) |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 832, "h": 896}, "pivot": {"x": 416, "y": 896}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a sunlit-stone market hall with ivory columns, a gold-trimmed awning and dawn-prism windows. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 104x112 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 832x896 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `luminous-market-stall` — Market stall

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/05-luminous-market-stall.png` + sidecar `Assets/Sprites/Buildings/05-luminous-market-stall.json` |
| Spec | W5 building (pixel art) - 64x68 art px, export x8 nearest-neighbour = 512x544 px, transparent background |
| On screen | 260 px tall; 4 px per art px |
| Cell | 64x68 art px = 512x544 authored; pivot (256, 544) authored = art (32, 68) |
| Priority | P2 |
| Used in | Luminous town: Market shelves |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 512, "h": 544}, "pivot": {"x": 256, "y": 544}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a merchant stall with an ivory awning on brass poles, a counter of pale stone with small scales and wrapped wares. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 64x68 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x544 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `luminous-waystone` — Waystone

| | |
|---|---|
| Save as | `Assets/Sprites/Props/10-luminous-waystone.png` + sidecar `Assets/Sprites/Props/10-luminous-waystone.json` |
| Spec | W6 prop (pixel art) - 24x56 art px per frame, sheet 144x56 art px, export x8 nearest-neighbour = 1152x448 px (192x448 per frame), transparent background |
| On screen | 220 px tall; 4 px per art px |
| Cell | 24x56 art px = 192x448 authored; pivot (96, 448) authored = art (12, 56) |
| Priority | P2 |
| Used in | Luminous town: Waystone |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 192, "h": 448}, "pivot": {"x": 96, "y": 448}, "actions": [{"name": "ambient", "frames": 6, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
the standing waystone in sunlit stone with the Luminous socket lit gold. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 24x56 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1152x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `luminous-lamp-post` — Prism lamp post

| | |
|---|---|
| Save as | `Assets/Sprites/Props/11-luminous-lamp-post.png` + sidecar `Assets/Sprites/Props/11-luminous-lamp-post.json` |
| Spec | W6 prop (pixel art) - 12x48 art px per frame, sheet 48x48 art px, export x8 nearest-neighbour = 384x384 px (96x384 per frame), transparent background |
| On screen | 180 px tall; 4 px per art px |
| Cell | 12x48 art px = 96x384 authored; pivot (48, 384) authored = art (6, 48) |
| Priority | P2 |
| Used in | Luminous town: street dressing |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 96, "h": 384}, "pivot": {"x": 48, "y": 384}, "actions": [{"name": "ambient", "frames": 4, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a slender stone lamp post holding a dawn prism that glows warm gold. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 12x48 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 4 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 384x384 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `luminous-bench` — Bench

| | |
|---|---|
| Save as | `Assets/Sprites/Props/12-luminous-bench.png` + sidecar `Assets/Sprites/Props/12-luminous-bench.json` |
| Spec | W6 prop (pixel art) - 32x16 art px, export x8 nearest-neighbour = 256x128 px, transparent background |
| On screen | 50 x 120 px; 4 px per art px |
| Cell | 32x16 art px = 256x128 authored; pivot (128, 128) authored = art (16, 16) |
| Priority | P2 |
| Used in | Luminous town: seating |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 128}, "pivot": {"x": 128, "y": 128}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a pale stone bench with gold inlay. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x16 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x128 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

## Umbral town — Nocturne Archive

### `umbral-gamblers-den` — Gambler's den

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/06-umbral-gamblers-den.png` + sidecar `Assets/Sprites/Buildings/06-umbral-gamblers-den.json` |
| Spec | W5 building (pixel art) - 96x104 art px per frame, sheet 384x104 art px, export x8 nearest-neighbour = 3072x832 px (768x832 per frame), transparent background |
| On screen | 400 px tall; 4 px per art px |
| Cell | 96x104 art px = 768x832 authored; pivot (384, 832) authored = art (48, 104) |
| Priority | P2 |
| Used in | Umbral town: Gambler |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 768, "h": 832}, "pivot": {"x": 384, "y": 832}, "actions": [{"name": "ambient", "frames": 4, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a narrow obsidian building with a violet-lit doorway, a hanging sign of a closed box (no letters); ambient = door glow. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 96x104 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 4 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 3072x832 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `umbral-gamblers-table` — Gambler's table

| | |
|---|---|
| Save as | `Assets/Sprites/Props/13-umbral-gamblers-table.png` + sidecar `Assets/Sprites/Props/13-umbral-gamblers-table.json` |
| Spec | W6 prop (pixel art) - 52x32 art px per frame, sheet 312x32 art px, export x8 nearest-neighbour = 2496x256 px (416x256 per frame), transparent background |
| On screen | 110 x 200 px; 4 px per art px |
| Cell | 52x32 art px = 416x256 authored; pivot (208, 256) authored = art (26, 32) |
| Priority | P2 |
| Used in | Umbral town: Gambler altar |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 416, "h": 256}, "pivot": {"x": 208, "y": 256}, "actions": [{"name": "ambient", "frames": 6, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a round obsidian gambling table with an inlaid violet-lit wheel and sealed mystery boxes; ambient = wheel shimmer. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 52x32 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 2496x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `umbral-exchange-house` — Exchange house

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/07-umbral-exchange-house.png` + sidecar `Assets/Sprites/Buildings/07-umbral-exchange-house.json` |
| Spec | W5 building (pixel art) - 100x108 art px, export x8 nearest-neighbour = 800x864 px, transparent background |
| On screen | 420 px tall; 4 px per art px |
| Cell | 100x108 art px = 800x864 authored; pivot (400, 864) authored = art (50, 108) |
| Priority | P2 |
| Used in | Umbral town: Exchange |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 800, "h": 864}, "pivot": {"x": 400, "y": 864}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
an obsidian counting-house with moonlit windows, silver balance-scale emblem over the door. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 100x108 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 800x864 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `umbral-waystone` — Waystone

| | |
|---|---|
| Save as | `Assets/Sprites/Props/14-umbral-waystone.png` + sidecar `Assets/Sprites/Props/14-umbral-waystone.json` |
| Spec | W6 prop (pixel art) - 24x56 art px per frame, sheet 144x56 art px, export x8 nearest-neighbour = 1152x448 px (192x448 per frame), transparent background |
| On screen | 220 px tall; 4 px per art px |
| Cell | 24x56 art px = 192x448 authored; pivot (96, 448) authored = art (12, 56) |
| Priority | P2 |
| Used in | Umbral town: Waystone |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 192, "h": 448}, "pivot": {"x": 96, "y": 448}, "actions": [{"name": "ambient", "frames": 6, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
the standing waystone in obsidian with the Umbral socket lit violet. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 24x56 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1152x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `umbral-lantern` — Ink lantern post

| | |
|---|---|
| Save as | `Assets/Sprites/Props/15-umbral-lantern.png` + sidecar `Assets/Sprites/Props/15-umbral-lantern.json` |
| Spec | W6 prop (pixel art) - 12x48 art px per frame, sheet 48x48 art px, export x8 nearest-neighbour = 384x384 px (96x384 per frame), transparent background |
| On screen | 180 px tall; 4 px per art px |
| Cell | 12x48 art px = 96x384 authored; pivot (48, 384) authored = art (6, 48) |
| Priority | P2 |
| Used in | Umbral town: street dressing |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 96, "h": 384}, "pivot": {"x": 48, "y": 384}, "actions": [{"name": "ambient", "frames": 4, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a black iron post with a shuttered lantern giving thin violet light. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 12x48 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 4 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 384x384 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

## Celestial town — Meridian Orrery

### `celestial-observatory` — Observatory

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/08-celestial-observatory.png` + sidecar `Assets/Sprites/Buildings/08-celestial-observatory.json` |
| Spec | W5 building (pixel art) - 80x124 art px per frame, sheet 480x124 art px, export x8 nearest-neighbour = 3840x992 px (640x992 per frame), transparent background |
| On screen | 480 px tall; 4 px per art px |
| Cell | 80x124 art px = 640x992 authored; pivot (320, 992) authored = art (40, 124) |
| Priority | P2 |
| Used in | Celestial town: Codex (observatory) |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 640, "h": 992}, "pivot": {"x": 320, "y": 992}, "actions": [{"name": "ambient", "frames": 6, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a slender observatory tower of midnight-blue stone with an open brass dome and orbital rings inside; ambient = rings turning. Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 80x124 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 3840x992 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `celestial-leaderboard-obelisk` — Leaderboard obelisk

| | |
|---|---|
| Save as | `Assets/Sprites/Props/16-celestial-leaderboard-obelisk.png` + sidecar `Assets/Sprites/Props/16-celestial-leaderboard-obelisk.json` |
| Spec | W6 prop (pixel art) - 28x60 art px, export x8 nearest-neighbour = 224x480 px, transparent background |
| On screen | 240 px tall; 4 px per art px |
| Cell | 28x60 art px = 224x480 authored; pivot (112, 480) authored = art (14, 60) |
| Priority | P2 |
| Used in | Celestial town: Leaderboards board |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 224, "h": 480}, "pivot": {"x": 112, "y": 480}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a star-silver obelisk with brass rank bands and blank glowing plaques (no text). Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 28x60 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 224x480 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `celestial-waystone` — Waystone

| | |
|---|---|
| Save as | `Assets/Sprites/Props/17-celestial-waystone.png` + sidecar `Assets/Sprites/Props/17-celestial-waystone.json` |
| Spec | W6 prop (pixel art) - 24x56 art px per frame, sheet 144x56 art px, export x8 nearest-neighbour = 1152x448 px (192x448 per frame), transparent background |
| On screen | 220 px tall; 4 px per art px |
| Cell | 24x56 art px = 192x448 authored; pivot (96, 448) authored = art (12, 56) |
| Priority | P2 |
| Used in | Celestial town: Waystone |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 192, "h": 448}, "pivot": {"x": 96, "y": 448}, "actions": [{"name": "ambient", "frames": 6, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
the standing waystone in midnight stone and brass with the Celestial socket lit blue. Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 24x56 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1152x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `celestial-lamp-post` — Star lamp post

| | |
|---|---|
| Save as | `Assets/Sprites/Props/18-celestial-lamp-post.png` + sidecar `Assets/Sprites/Props/18-celestial-lamp-post.json` |
| Spec | W6 prop (pixel art) - 12x48 art px per frame, sheet 48x48 art px, export x8 nearest-neighbour = 384x384 px (96x384 per frame), transparent background |
| On screen | 180 px tall; 4 px per art px |
| Cell | 12x48 art px = 96x384 authored; pivot (48, 384) authored = art (6, 48) |
| Priority | P2 |
| Used in | Celestial town: street dressing |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 96, "h": 384}, "pivot": {"x": 48, "y": 384}, "actions": [{"name": "ambient", "frames": 4, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a brass lamp post with a small orrery lamp of star-silver light. Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 12x48 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 4 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 384x384 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

## Verdant town — Rootglass Canopy

### `verdant-sanctum-gate` — Sanctum gate

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/09-verdant-sanctum-gate.png` + sidecar `Assets/Sprites/Buildings/09-verdant-sanctum-gate.json` |
| Spec | W5 building (pixel art) - 96x112 art px per frame, sheet 384x112 art px, export x8 nearest-neighbour = 3072x896 px (768x896 per frame), transparent background |
| On screen | 440 px tall; 4 px per art px |
| Cell | 96x112 art px = 768x896 authored; pivot (384, 896) authored = art (48, 112) |
| Priority | P2 |
| Used in | Verdant town: Sanctum (expeditions) |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 768, "h": 896}, "pivot": {"x": 384, "y": 896}, "actions": [{"name": "ambient", "frames": 4, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
the Sanctum gate: a tall gate of living rootwood and gold-veined obsidian with closed doors bearing an eclipse seal, warm amber light at the threshold. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 96x112 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 4 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 3072x896 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `verdant-quest-board` — Quest board

| | |
|---|---|
| Save as | `Assets/Sprites/Props/19-verdant-quest-board.png` + sidecar `Assets/Sprites/Props/19-verdant-quest-board.json` |
| Spec | W6 prop (pixel art) - 40x52 art px, export x8 nearest-neighbour = 320x416 px, transparent background |
| On screen | 200 px tall; 4 px per art px |
| Cell | 40x52 art px = 320x416 authored; pivot (160, 416) authored = art (20, 52) |
| Priority | P2 |
| Used in | Verdant town: Quests |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 416}, "pivot": {"x": 160, "y": 416}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a rootwood notice board under a small mossy roof with pinned parchment notices and wax seals, all writing only illegible marks. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 40x52 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 320x416 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `verdant-arena-gate` — Arena gate

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/10-verdant-arena-gate.png` + sidecar `Assets/Sprites/Buildings/10-verdant-arena-gate.json` |
| Spec | W5 building (pixel art) - 96x104 art px, export x8 nearest-neighbour = 768x832 px, transparent background |
| On screen | 400 px tall; 4 px per art px |
| Cell | 96x104 art px = 768x832 authored; pivot (384, 832) authored = art (48, 104) |
| Priority | P2 |
| Used in | Verdant town: Arena |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 768, "h": 832}, "pivot": {"x": 384, "y": 832}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a rootwood-and-crystal arch gate into an arena, crossed banners without emblems. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 96x104 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 768x832 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `verdant-trials-gate` — Trials gate

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/11-verdant-trials-gate.png` + sidecar `Assets/Sprites/Buildings/11-verdant-trials-gate.json` |
| Spec | W5 building (pixel art) - 80x104 art px per frame, sheet 320x104 art px, export x8 nearest-neighbour = 2560x832 px (640x832 per frame), transparent background |
| On screen | 400 px tall; 4 px per art px |
| Cell | 80x104 art px = 640x832 authored; pivot (320, 832) authored = art (40, 104) |
| Priority | P2 |
| Used in | Verdant town: Trials |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 640, "h": 832}, "pivot": {"x": 320, "y": 832}, "actions": [{"name": "ambient", "frames": 4, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a narrow gate of thorn and dark crystal with a violet seam of light between its doors. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 80x104 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 4 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 2560x832 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `verdant-waystone` — Waystone

| | |
|---|---|
| Save as | `Assets/Sprites/Props/20-verdant-waystone.png` + sidecar `Assets/Sprites/Props/20-verdant-waystone.json` |
| Spec | W6 prop (pixel art) - 24x56 art px per frame, sheet 144x56 art px, export x8 nearest-neighbour = 1152x448 px (192x448 per frame), transparent background |
| On screen | 220 px tall; 4 px per art px |
| Cell | 24x56 art px = 192x448 authored; pivot (96, 448) authored = art (12, 56) |
| Priority | P2 |
| Used in | Verdant town: Waystone |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 192, "h": 448}, "pivot": {"x": 96, "y": 448}, "actions": [{"name": "ambient", "frames": 6, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
the standing waystone wrapped in roots with the Verdant socket lit green. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 24x56 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1152x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `verdant-lantern` — Amber lantern

| | |
|---|---|
| Save as | `Assets/Sprites/Props/21-verdant-lantern.png` + sidecar `Assets/Sprites/Props/21-verdant-lantern.json` |
| Spec | W6 prop (pixel art) - 12x48 art px per frame, sheet 48x48 art px, export x8 nearest-neighbour = 384x384 px (96x384 per frame), transparent background |
| On screen | 180 px tall; 4 px per art px |
| Cell | 12x48 art px = 96x384 authored; pivot (48, 384) authored = art (6, 48) |
| Priority | P2 |
| Used in | Verdant town: street dressing |
| Shows today | flat rectangles or nothing |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 96, "h": 384}, "pivot": {"x": 48, "y": 384}, "actions": [{"name": "ambient", "frames": 4, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a crooked rootwood post holding an amber bioluminescent pod. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 12x48 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 4 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 384x384 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```
