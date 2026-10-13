# Homestead (pixel art)

Pixel scale, sizes, outline and shading, palettes, animation and the sidecar are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Image generators do not make clean pixel art or consistent frames: use the **design prompt** for the look, then draw or clean the frames on the art-pixel grid (style guide §14), keeping the cell, pivot and export factor exact.

Everything on the Homestead plot is drawn in code today (`src/app/play/engine/homestead-render.ts`; `frame.art(key, ...)` is the swap-in point). Your Anvil and Your Enchanting Circle each have four tiers that the engine scales and lights by tier, so the art for tier N must read as the same object one rung grander, on the same art-pixel grid.

### `hs-anvil-1` — Your Anvil, tier I

| | |
|---|---|
| Save as | `Assets/Sprites/Props/42-hs-anvil-1.png` + sidecar `Assets/Sprites/Props/42-hs-anvil-1.json` |
| Spec | W6 prop (pixel art) - 40x32 art px per frame, sheet 240x32 art px, export x8 nearest-neighbour = 1920x256 px (320x256 per frame), transparent background |
| On screen | x1.0 of tier I (tier I is 160 x 128 px); 4 px per art px |
| Cell | 40x32 art px = 320x256 authored; pivot (160, 256) authored = art (20, 32) |
| Priority | P0 |
| Used in | Homestead plot station `hs-anvil` (x 2400): HOME_FORGE_CONFIG tier 1 (price free Gold); opens the Crafting Bench with the anvil mini-game |
| Shows today | anvil drawn in code (homestead-render.ts, anvilLook(tier) scales 1.0 to 1.42) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 256}, "pivot": {"x": 160, "y": 256}, "actions": [{"name": "ambient", "frames": 6, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | sparks / glow loop; frame 1 = still |

_Draw tier I first and grow it; the engine adds the gold I-IV plaque._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Your Anvil, tier 1: a plain black-iron anvil on a squat basalt block, a hammer resting on the face, cold; tiers I-IV share one design language and read as the same anvil growing. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 40x32 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `hs-anvil-2` — Your Anvil, tier II

| | |
|---|---|
| Save as | `Assets/Sprites/Props/43-hs-anvil-2.png` + sidecar `Assets/Sprites/Props/43-hs-anvil-2.json` |
| Spec | W6 prop (pixel art) - 48x40 art px per frame, sheet 288x40 art px, export x8 nearest-neighbour = 2304x320 px (384x320 per frame), transparent background |
| On screen | x1.15 of tier I (tier I is 160 x 128 px); 4 px per art px |
| Cell | 48x40 art px = 384x320 authored; pivot (192, 320) authored = art (24, 40) |
| Priority | P1 |
| Used in | Homestead plot station `hs-anvil` (x 2400): HOME_FORGE_CONFIG tier 2 (price 750K Gold); opens the Crafting Bench with the anvil mini-game |
| Shows today | anvil drawn in code (homestead-render.ts, anvilLook(tier) scales 1.0 to 1.42) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 384, "h": 320}, "pivot": {"x": 192, "y": 320}, "actions": [{"name": "ambient", "frames": 6, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | sparks / glow loop; frame 1 = still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Your Anvil, tier 2: a sturdier anvil on a bigger basalt block, ember-orange glow along the hot face, a rack of tongs; tiers I-IV share one design language and read as the same anvil growing. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 48x40 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 2304x320 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `hs-anvil-3` — Your Anvil, tier III

| | |
|---|---|
| Save as | `Assets/Sprites/Props/44-hs-anvil-3.png` + sidecar `Assets/Sprites/Props/44-hs-anvil-3.json` |
| Spec | W6 prop (pixel art) - 48x40 art px per frame, sheet 288x40 art px, export x8 nearest-neighbour = 2304x320 px (384x320 per frame), transparent background |
| On screen | x1.3 of tier I (tier I is 160 x 128 px); 4 px per art px |
| Cell | 48x40 art px = 384x320 authored; pivot (192, 320) authored = art (24, 40) |
| Priority | P1 |
| Used in | Homestead plot station `hs-anvil` (x 2400): HOME_FORGE_CONFIG tier 3 (price 6M Gold); opens the Crafting Bench with the anvil mini-game |
| Shows today | anvil drawn in code (homestead-render.ts, anvilLook(tier) scales 1.0 to 1.42) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 384, "h": 320}, "pivot": {"x": 192, "y": 320}, "actions": [{"name": "ambient", "frames": 6, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | sparks / glow loop; frame 1 = still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Your Anvil, tier 3: a large anvil with a glowing white-orange face, a second small horn, three drifting sparks, brass bands on the block; tiers I-IV share one design language and read as the same anvil growing. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 48x40 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 2304x320 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `hs-anvil-4` — Your Anvil, tier IV

| | |
|---|---|
| Save as | `Assets/Sprites/Props/45-hs-anvil-4.png` + sidecar `Assets/Sprites/Props/45-hs-anvil-4.json` |
| Spec | W6 prop (pixel art) - 48x40 art px per frame, sheet 288x40 art px, export x8 nearest-neighbour = 2304x320 px (384x320 per frame), transparent background |
| On screen | x1.42 of tier I (tier I is 160 x 128 px); 4 px per art px |
| Cell | 48x40 art px = 384x320 authored; pivot (192, 320) authored = art (24, 40) |
| Priority | P1 |
| Used in | Homestead plot station `hs-anvil` (x 2400): HOME_FORGE_CONFIG tier 4 (price 250M Gold); opens the Crafting Bench with the anvil mini-game |
| Shows today | anvil drawn in code (homestead-render.ts, anvilLook(tier) scales 1.0 to 1.42) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 384, "h": 320}, "pivot": {"x": 192, "y": 320}, "actions": [{"name": "ambient", "frames": 6, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | sparks / glow loop; frame 1 = still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Your Anvil, tier 4: a grand anvil on a carved obsidian-and-gold plinth, a white-hot face, a ring of orbiting sparks and a faint violet eclipse shimmer #a855f7; tiers I-IV share one design language and read as the same anvil growing. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 48x40 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 2304x320 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `hs-circle-1` — Your Enchanting Circle, tier I

| | |
|---|---|
| Save as | `Assets/Sprites/Props/46-hs-circle-1.png` + sidecar `Assets/Sprites/Props/46-hs-circle-1.json` |
| Spec | W6 prop (pixel art) - 56x32 art px per frame, sheet 336x32 art px, export x8 nearest-neighbour = 2688x256 px (448x256 per frame), transparent background |
| On screen | 224 x 128 px; 4 px per art px |
| Cell | 56x32 art px = 448x256 authored; pivot (224, 256) authored = art (28, 32) |
| Priority | P0 |
| Used in | Homestead plot station `hs-circle` (x 2700): HOME_FORGE_CONFIG tier 1 (free); opens the Enchanting Table with the rune ritual |
| Shows today | ring and runes drawn in code (circleLook(tier) lights 4/6/8/10 runes) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 448, "h": 256}, "pivot": {"x": 224, "y": 256}, "actions": [{"name": "ambient", "frames": 6, "fps": 6, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 6 | yes | rune pulse loop; frame 1 = still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Your Enchanting Circle, tier 1: a floor ring of pale stone with ten standing rune-stones around it, only four faintly lit in violet, the centre empty; the lit-rune count must be exactly 4, 6, 8, 10 for tiers I-IV; viewed from a slight high angle so the ring reads as an ellipse. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 56x32 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 2688x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `hs-circle-2` — Your Enchanting Circle, tier II

| | |
|---|---|
| Save as | `Assets/Sprites/Props/47-hs-circle-2.png` + sidecar `Assets/Sprites/Props/47-hs-circle-2.json` |
| Spec | W6 prop (pixel art) - 56x32 art px per frame, sheet 336x32 art px, export x8 nearest-neighbour = 2688x256 px (448x256 per frame), transparent background |
| On screen | 224 x 128 px; 4 px per art px |
| Cell | 56x32 art px = 448x256 authored; pivot (224, 256) authored = art (28, 32) |
| Priority | P1 |
| Used in | Homestead plot station `hs-circle` (x 2700): HOME_FORGE_CONFIG tier 2 (750K Gold); opens the Enchanting Table with the rune ritual |
| Shows today | ring and runes drawn in code (circleLook(tier) lights 4/6/8/10 runes) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 448, "h": 256}, "pivot": {"x": 224, "y": 256}, "actions": [{"name": "ambient", "frames": 6, "fps": 6, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 6 | yes | rune pulse loop; frame 1 = still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Your Enchanting Circle, tier 2: the same ring with six rune-stones lit in brighter violet, a thin gold socket ring inlaid in the floor; the lit-rune count must be exactly 4, 6, 8, 10 for tiers I-IV; viewed from a slight high angle so the ring reads as an ellipse. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 56x32 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 2688x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `hs-circle-3` — Your Enchanting Circle, tier III

| | |
|---|---|
| Save as | `Assets/Sprites/Props/48-hs-circle-3.png` + sidecar `Assets/Sprites/Props/48-hs-circle-3.json` |
| Spec | W6 prop (pixel art) - 56x32 art px per frame, sheet 336x32 art px, export x8 nearest-neighbour = 2688x256 px (448x256 per frame), transparent background |
| On screen | 224 x 128 px; 4 px per art px |
| Cell | 56x32 art px = 448x256 authored; pivot (224, 256) authored = art (28, 32) |
| Priority | P1 |
| Used in | Homestead plot station `hs-circle` (x 2700): HOME_FORGE_CONFIG tier 3 (6M Gold); opens the Enchanting Table with the rune ritual |
| Shows today | ring and runes drawn in code (circleLook(tier) lights 4/6/8/10 runes) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 448, "h": 256}, "pivot": {"x": 224, "y": 256}, "actions": [{"name": "ambient", "frames": 6, "fps": 6, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 6 | yes | rune pulse loop; frame 1 = still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Your Enchanting Circle, tier 3: the ring with eight rune-stones brightly lit, a thicker gold socket ring, one rune hovering above the centre; the lit-rune count must be exactly 4, 6, 8, 10 for tiers I-IV; viewed from a slight high angle so the ring reads as an ellipse. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 56x32 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 2688x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `hs-circle-4` — Your Enchanting Circle, tier IV

| | |
|---|---|
| Save as | `Assets/Sprites/Props/49-hs-circle-4.png` + sidecar `Assets/Sprites/Props/49-hs-circle-4.json` |
| Spec | W6 prop (pixel art) - 56x32 art px per frame, sheet 336x32 art px, export x8 nearest-neighbour = 2688x256 px (448x256 per frame), transparent background |
| On screen | 224 x 128 px; 4 px per art px |
| Cell | 56x32 art px = 448x256 authored; pivot (224, 256) authored = art (28, 32) |
| Priority | P1 |
| Used in | Homestead plot station `hs-circle` (x 2700): HOME_FORGE_CONFIG tier 4 (250M Gold); opens the Enchanting Table with the rune ritual |
| Shows today | ring and runes drawn in code (circleLook(tier) lights 4/6/8/10 runes) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 448, "h": 256}, "pivot": {"x": 224, "y": 256}, "actions": [{"name": "ambient", "frames": 6, "fps": 6, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 6 | yes | rune pulse loop; frame 1 = still |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Your Enchanting Circle, tier 4: the ring with all ten rune-stones blazing violet #a855f7, a broad gold socket ring, a rune orbiting above the centre and a soft violet bloom; the lit-rune count must be exactly 4, 6, 8, 10 for tiers I-IV; viewed from a slight high angle so the ring reads as an ellipse. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 56x32 art-pixel canvas, a 1-2 art px contact shadow under the base; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 2688x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `homestead-forge` — The Forge (homestead click target)

| | |
|---|---|
| Save as | `Assets/Sprites/Props/50-homestead-forge.png` + sidecar `Assets/Sprites/Props/50-homestead-forge.json` |
| Spec | W6 prop (pixel art) - 48x40 art px per frame, sheet 192x80 art px, export x8 nearest-neighbour = 1536x640 px (384x320 per frame), transparent background |
| On screen | 192 x 160 px; 4 px per art px |
| Cell | 48x40 art px = 384x320 authored; pivot (192, 320) authored = art (24, 40) |
| Priority | P1 |
| Used in | Homestead: the clickable Forge in the middle of the plot; each click is a strike (squash, sparks, +N) |
| Shows today | violet forge flame image plus code squash |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 384, "h": 320}, "pivot": {"x": 192, "y": 320}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "strike", "frames": 4, "fps": 14, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | low violet flame breathing |
| 1 | `strike` | 4 | 14 | no | hammer-blow squash and spark burst; frame 2 = contact |

_The violet flame ties to the Godforge energy colour._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a squat Godforge-fed anvil-furnace: black iron body with riveted bands, an open mouth with a violet eclipse flame #a855f7 and ember-orange rim light, a hammer-head crest on top. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 48x40 art-pixel canvas, a 1-2 art px contact shadow under the base; idle 4 frames, strike 4 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1536x640 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `homestead-workshop-hammer` — Thrall Workshop hammer

| | |
|---|---|
| Save as | `Assets/Sprites/Props/51-homestead-workshop-hammer.png` + sidecar `Assets/Sprites/Props/51-homestead-workshop-hammer.json` |
| Spec | W6 prop (pixel art) - 12x24 art px, export x8 nearest-neighbour = 96x192 px, transparent background |
| On screen | 48 x 96 px; 4 px per art px |
| Cell | 12x24 art px = 96x192 authored; pivot (48, 176) authored = art (6, 22) |
| Priority | P2 |
| Used in | Homestead Thrall Workshop: the hammer swung by the roll timer |
| Shows today | a rectangle rotated in code |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 96, "h": 192}, "pivot": {"x": 48, "y": 176}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a heavy smith's hammer pointing straight up, iron head with ember seams, wrapped leather haft, grip at the bottom. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 12x24 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 96x192 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `homestead-gate` — YOUR HOMESTEAD gate

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/12-homestead-gate.png` + sidecar `Assets/Sprites/Buildings/12-homestead-gate.json` |
| Spec | W5 building (pixel art) - 104x120 art px, export x8 nearest-neighbour = 832x960 px, transparent background |
| On screen | 416 x 480 px; 4 px per art px |
| Cell | 104x120 art px = 832x960 authored; pivot (416, 960) authored = art (52, 120) |
| Priority | P1 |
| Used in | Infernal town, x 1075: the arch into the Homestead plot |
| Shows today | shape drawn in code (homestead-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 832, "h": 960}, "pivot": {"x": 416, "y": 960}}` |

_Buildings carry a baked 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
YOUR HOMESTEAD gate: an iron-and-basalt arch gate with a banner post, a lit brazier on each pillar and a plain dark lintel (no lettering), warm welcoming light. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 104x120 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 832x960 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `homestead-treasury` — Treasury

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/13-homestead-treasury.png` + sidecar `Assets/Sprites/Buildings/13-homestead-treasury.json` |
| Spec | W5 building (pixel art) - 80x104 art px, export x8 nearest-neighbour = 640x832 px, transparent background |
| On screen | 320 x 416 px; 4 px per art px |
| Cell | 80x104 art px = 640x832 authored; pivot (320, 832) authored = art (40, 104) |
| Priority | P1 |
| Used in | Homestead: holds Gold; coins arc into it on every strike |
| Shows today | shape drawn in code (homestead-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 640, "h": 832}, "pivot": {"x": 320, "y": 832}}` |

_Buildings carry a baked 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Treasury: a squat stone vault with a heavy round door, gold coin piles visible through a barred window, a small brass scale on the roof. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 80x104 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 640x832 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `homestead-furnace` — Furnace

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/14-homestead-furnace.png` + sidecar `Assets/Sprites/Buildings/14-homestead-furnace.json` |
| Spec | W5 building (pixel art) - 80x104 art px, export x8 nearest-neighbour = 640x832 px, transparent background |
| On screen | 320 x 416 px; 4 px per art px |
| Cell | 80x104 art px = 640x832 authored; pivot (320, 832) authored = art (40, 104) |
| Priority | P1 |
| Used in | Homestead: scales with forge rungs (furnaceScale) |
| Shows today | shape drawn in code (homestead-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 640, "h": 832}, "pivot": {"x": 320, "y": 832}}` |

_Buildings carry a baked 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Furnace: a great brick furnace with a tall chimney, glowing mouth and an anvil-shaped weathervane; ember orange glow. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 80x104 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 640x832 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `homestead-explorer-camp` — Explorer Camp

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/15-homestead-explorer-camp.png` + sidecar `Assets/Sprites/Buildings/15-homestead-explorer-camp.json` |
| Spec | W5 building (pixel art) - 104x80 art px, export x8 nearest-neighbour = 832x640 px, transparent background |
| On screen | 416 x 320 px; 4 px per art px |
| Cell | 104x80 art px = 832x640 authored; pivot (416, 640) authored = art (52, 80) |
| Priority | P1 |
| Used in | Homestead: one tent per explorer slot; explorers walk out and back |
| Shows today | shape drawn in code (homestead-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 832, "h": 640}, "pivot": {"x": 416, "y": 640}}` |

_Buildings carry a baked 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Explorer Camp: a cluster of three patched canvas tents around a cold fire pit, a map table, gear crates and a lantern pole; the engine repeats the tent per slot. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 104x80 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 832x640 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `homestead-thrall-workshop` — Thrall Workshop

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/16-homestead-thrall-workshop.png` + sidecar `Assets/Sprites/Buildings/16-homestead-thrall-workshop.json` |
| Spec | W5 building (pixel art) - 104x88 art px, export x8 nearest-neighbour = 832x704 px, transparent background |
| On screen | 416 x 352 px; 4 px per art px |
| Cell | 104x88 art px = 832x704 authored; pivot (416, 704) authored = art (52, 88) |
| Priority | P1 |
| Used in | Homestead: Forge Thralls hammer here |
| Shows today | shape drawn in code (homestead-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 832, "h": 704}, "pivot": {"x": 416, "y": 704}}` |

_Buildings carry a baked 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Thrall Workshop: an open-fronted smithy with a low workbench, a rack of tools and a stone hearth; no hammer drawn (it is a separate sprite). Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 104x88 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 832x704 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `automaton-apprentice-striker` — Apprentice Striker

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/10-automaton-apprentice-striker.png` + sidecar `Assets/Sprites/NPCs/10-automaton-apprentice-striker.json` |
| Spec | W3 NPC sheet, actions `idle` and `strike` (pixel art) - 40x48 art px per frame, sheet 160x96 art px, export x8 nearest-neighbour = 1280x768 px (320x384 per frame), transparent background |
| On screen | 150-170 px tall; 4 px per art px |
| Cell | 40x48 art px = 320x384 authored; pivot (160, 368) authored = art (20, 46) |
| Priority | P1 |
| Used in | Homestead: one figure per owned level of the Apprentice Striker rung; strikes the Forge on beat (clicksPerSecond) |
| Shows today | figure drawn in code (homestead-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 384}, "pivot": {"x": 160, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "strike", "frames": 4, "fps": 12, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | ready stance, small fidget |
| 1 | `strike` | 4 | 12 | yes | hammer blow loop; frame 2 = contact |

_The painted Market master already exists; keep its colour blocks and silhouette, in pixel art._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Apprentice Striker as a world sprite: a hunched apprentice automaton of riveted brass and black iron with one oversized hammer-arm and a lantern eye, eager and a little clumsy; match the painted Market master Market/Items/Automatons/apprentice-striker.png in design. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one frame on a 40x48 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, strike 4. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1280x768 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, multiple figures, cropped feet
```

### `automaton-forge-golem` — Forge Golem

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/11-automaton-forge-golem.png` + sidecar `Assets/Sprites/NPCs/11-automaton-forge-golem.json` |
| Spec | W3 NPC sheet, actions `idle` and `strike` (pixel art) - 40x48 art px per frame, sheet 160x96 art px, export x8 nearest-neighbour = 1280x768 px (320x384 per frame), transparent background |
| On screen | 150-170 px tall; 4 px per art px |
| Cell | 40x48 art px = 320x384 authored; pivot (160, 368) authored = art (20, 46) |
| Priority | P1 |
| Used in | Homestead: one figure per owned level of the Forge Golem rung; strikes the Forge on beat (clicksPerSecond) |
| Shows today | figure drawn in code (homestead-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 384}, "pivot": {"x": 160, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "strike", "frames": 4, "fps": 12, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | ready stance, small fidget |
| 1 | `strike` | 4 | 12 | yes | hammer blow loop; frame 2 = contact |

_The painted Market master already exists; keep its colour blocks and silhouette, in pixel art._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Forge Golem as a world sprite: a hulking forge golem of basalt plates and iron bands, furnace window in its chest, slow powerful hammer-fist; match the painted Market master Market/Items/Automatons/forge-golem.png in design. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one frame on a 40x48 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, strike 4. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1280x768 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, multiple figures, cropped feet
```

### `automaton-eclipse-automaton` — Eclipse Automaton

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/12-automaton-eclipse-automaton.png` + sidecar `Assets/Sprites/NPCs/12-automaton-eclipse-automaton.json` |
| Spec | W3 NPC sheet, actions `idle` and `strike` (pixel art) - 40x48 art px per frame, sheet 160x96 art px, export x8 nearest-neighbour = 1280x768 px (320x384 per frame), transparent background |
| On screen | 150-170 px tall; 4 px per art px |
| Cell | 40x48 art px = 320x384 authored; pivot (160, 368) authored = art (20, 46) |
| Priority | P1 |
| Used in | Homestead: one figure per owned level of the Eclipse Automaton rung; strikes the Forge on beat (clicksPerSecond) |
| Shows today | figure drawn in code (homestead-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 384}, "pivot": {"x": 160, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "strike", "frames": 4, "fps": 12, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | ready stance, small fidget |
| 1 | `strike` | 4 | 12 | yes | hammer blow loop; frame 2 = contact |

_The painted Market master already exists; keep its colour blocks and silhouette, in pixel art._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Eclipse Automaton as a world sprite: a tall precise automaton of obsidian and gold with a violet eclipse disc for a face, twin hammer-limbs moving in sync; match the painted Market master Market/Items/Automatons/eclipse-automaton.png in design. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one frame on a 40x48 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, strike 4. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1280x768 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, multiple figures, cropped feet
```
