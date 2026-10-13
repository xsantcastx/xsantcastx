# Gathering nodes (pixel art)

Pixel scale, sizes, outline and shading, palettes, animation and the sidecar are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Image generators do not make clean pixel art or consistent frames: use the **design prompt** for the look, then draw or clean the frames on the art-pixel grid (style guide §14), keeping the cell, pivot and export factor exact.

One prop sheet per gatherable material, two states: `ready` (row 0) and `harvested` (row 1). Fifteen nodes cover the four tool families (`TOOL_OPENS` in `src/app/shared/skills/tools.ts`): pickaxe ores, axe trees, sickle herbs, staff crystals. Pickaxe I is the Cinder Ore seam that already exists as a station; the rest arrive with the engine host's gathering work. The material icons are painted today and are re-iconed later; match the material's realm palette, not the painting's soft light.

### `node-cinder-ore` — Cinder Ore outcrop

| | |
|---|---|
| Save as | `Assets/Sprites/Props/27-node-cinder-ore.png` + sidecar `Assets/Sprites/Props/27-node-cinder-ore.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P0 |
| Used in | Gathering node for `cinder-ore` (Pickaxe I, pickaxe); the material icon is already painted. `ready` shows while the node can be mined; `harvested` while it recovers |
| Shows today | a labelled station rectangle (only Cinder Ore has a resource station today) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `cinder-ore` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Cinder Ore outcrop: a squat outcrop of black basalt veined with glowing orange-red cinder ore, three chunky nodules breaking the surface; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `node-slag-fragment` — Slag outcrop

| | |
|---|---|
| Save as | `Assets/Sprites/Props/28-node-slag-fragment.png` + sidecar `Assets/Sprites/Props/28-node-slag-fragment.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P1 |
| Used in | Gathering node for `slag-fragment` (Pickaxe II, pickaxe); the material icon is already painted. `ready` shows while the node can be mined; `harvested` while it recovers |
| Shows today | not in the world yet |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `slag-fragment` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Slag outcrop: a basalt outcrop shot through with greenish-teal glassy slag shards, cool glints against dark stone; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `node-infernal-heartstone` — Heartstone outcrop

| | |
|---|---|
| Save as | `Assets/Sprites/Props/29-node-infernal-heartstone.png` + sidecar `Assets/Sprites/Props/29-node-infernal-heartstone.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P1 |
| Used in | Gathering node for `infernal-heartstone` (Pickaxe III, pickaxe); the material icon is already painted. `ready` shows while the node can be mined; `harvested` while it recovers |
| Shows today | not in the world yet |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `infernal-heartstone` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Heartstone outcrop: a crimson-black rock face holding a faceted rose-red heartstone cluster, one bright facet highlight; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `node-emberheart-ore` — Emberheart outcrop

| | |
|---|---|
| Save as | `Assets/Sprites/Props/30-node-emberheart-ore.png` + sidecar `Assets/Sprites/Props/30-node-emberheart-ore.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P2 |
| Used in | Gathering node for `emberheart-ore` (Pickaxe IV, pickaxe); the material icon is already painted. `ready` shows while the node can be mined; `harvested` while it recovers |
| Shows today | not in the world yet |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `emberheart-ore` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Emberheart outcrop: a tall dark outcrop split by a white-hot vein with an orange heart-glow at its core, rarest of the Infernal ores; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `node-world-root-bark` — World-Root sapling

| | |
|---|---|
| Save as | `Assets/Sprites/Props/31-node-world-root-bark.png` + sidecar `Assets/Sprites/Props/31-node-world-root-bark.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P1 |
| Used in | Gathering node for `world-root-bark` (Axe I, axe); the material icon is already painted. `ready` shows while the node can be felled; `harvested` while it recovers |
| Shows today | not in the world yet |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `world-root-bark` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
World-Root sapling: a young gnarled World-Root sapling with thick furrowed bark and a few amber leaves; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `node-verdant-sap` — Sap tree

| | |
|---|---|
| Save as | `Assets/Sprites/Props/32-node-verdant-sap.png` + sidecar `Assets/Sprites/Props/32-node-verdant-sap.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P2 |
| Used in | Gathering node for `verdant-sap` (Axe II, axe); the material icon is already painted. `ready` shows while the node can be felled; `harvested` while it recovers |
| Shows today | not in the world yet |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `verdant-sap` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Sap tree: a broad Verdant tree with a tapped trunk, amber sap beading down a bright wound, bioluminescent teal leaf edges; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `node-solar-resin` — Golden Oak

| | |
|---|---|
| Save as | `Assets/Sprites/Props/33-node-solar-resin.png` + sidecar `Assets/Sprites/Props/33-node-solar-resin.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P2 |
| Used in | Gathering node for `solar-resin` (Axe III, axe); the material icon is already painted. `ready` shows while the node can be felled; `harvested` while it recovers |
| Shows today | not in the world yet |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `solar-resin` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Golden Oak: a stout Golden Oak with warm gold bark and resin amber beads, ivory-white blossoms; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `node-shadowthread-silk` — Shadowbark tree

| | |
|---|---|
| Save as | `Assets/Sprites/Props/34-node-shadowthread-silk.png` + sidecar `Assets/Sprites/Props/34-node-shadowthread-silk.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P2 |
| Used in | Gathering node for `shadowthread-silk` (Axe IV, axe); the material icon is already painted. `ready` shows while the node can be felled; `harvested` while it recovers |
| Shows today | not in the world yet |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `shadowthread-silk` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Shadowbark tree: a tall black-violet Shadowbark tree wound with pale silver silk threads, moonlight on the bark; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `node-starlight-herb` — Starlight Herb patch

| | |
|---|---|
| Save as | `Assets/Sprites/Props/35-node-starlight-herb.png` + sidecar `Assets/Sprites/Props/35-node-starlight-herb.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P1 |
| Used in | Gathering node for `starlight-herb` (Sickle I, sickle); the material icon is already painted. `ready` shows while the node can be cut; `harvested` while it recovers |
| Shows today | not in the world yet |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `starlight-herb` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Starlight Herb patch: a low patch of silver-blue herb with star-shaped leaves and tiny cyan glints; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `node-sunbloom` — Sunbloom patch

| | |
|---|---|
| Save as | `Assets/Sprites/Props/36-node-sunbloom.png` + sidecar `Assets/Sprites/Props/36-node-sunbloom.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P2 |
| Used in | Gathering node for `sunbloom` (Sickle II, sickle); the material icon is already painted. `ready` shows while the node can be cut; `harvested` while it recovers |
| Shows today | not in the world yet |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `sunbloom` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Sunbloom patch: a patch of tall gold-and-ivory sunbloom flowers with dawn-crystal dew; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `node-nightbloom` — Nightbloom patch

| | |
|---|---|
| Save as | `Assets/Sprites/Props/37-node-nightbloom.png` + sidecar `Assets/Sprites/Props/37-node-nightbloom.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P2 |
| Used in | Gathering node for `nightbloom` (Sickle III, sickle); the material icon is already painted. `ready` shows while the node can be cut; `harvested` while it recovers |
| Shows today | not in the world yet |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `nightbloom` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Nightbloom patch: a patch of deep violet night-blooming flowers that open towards moonlight, faint amethyst glow; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `node-thornroot` — Thornroot patch

| | |
|---|---|
| Save as | `Assets/Sprites/Props/38-node-thornroot.png` + sidecar `Assets/Sprites/Props/38-node-thornroot.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P2 |
| Used in | Gathering node for `thornroot` (Sickle IV, sickle); the material icon is already painted. `ready` shows while the node can be cut; `harvested` while it recovers |
| Shows today | not in the world yet |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `thornroot` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Thornroot patch: a tangle of thorned amber roots rising from moss, wicked hooked thorns and a pale root-cream tip; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `node-luminous-prism` — Prism cluster

| | |
|---|---|
| Save as | `Assets/Sprites/Props/39-node-luminous-prism.png` + sidecar `Assets/Sprites/Props/39-node-luminous-prism.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P2 |
| Used in | Gathering node for `luminous-prism` (Staff II, staff); the material icon is already painted. `ready` shows while the node can be shattered; `harvested` while it recovers |
| Shows today | not in the world yet |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `luminous-prism` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Prism cluster: a cluster of clear dawn-crystal prisms in warm gold light, each facet throwing a tiny rainbow edge; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `node-celestial-quartz` — Quartz geode

| | |
|---|---|
| Save as | `Assets/Sprites/Props/40-node-celestial-quartz.png` + sidecar `Assets/Sprites/Props/40-node-celestial-quartz.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P2 |
| Used in | Gathering node for `celestial-quartz` (Staff III, staff); the material icon is already painted. `ready` shows while the node can be shattered; `harvested` while it recovers |
| Shows today | not in the world yet |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `celestial-quartz` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Quartz geode: a split midnight-blue geode ringed with silver and lined with pale cyan quartz points; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```

### `node-void-crystal` — Void geode

| | |
|---|---|
| Save as | `Assets/Sprites/Props/41-node-void-crystal.png` + sidecar `Assets/Sprites/Props/41-node-void-crystal.json` |
| Spec | W6 prop (pixel art) - 32x32 art px per frame, sheet 32x64 art px, export x8 nearest-neighbour = 256x512 px (256x256 per frame), transparent background |
| On screen | about 130 x 120 px; 4 px per art px |
| Cell | 32x32 art px = 256x256 authored; pivot (128, 240) authored = art (16, 30) |
| Priority | P2 |
| Used in | Gathering node for `void-crystal` (Staff IV, staff); the material icon is already painted. `ready` shows while the node can be shattered; `harvested` while it recovers |
| Shows today | not in the world yet |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 256, "h": 256}, "pivot": {"x": 128, "y": 240}, "actions": [{"name": "ready", "frames": 1, "fps": 0, "loop": false}, {"name": "harvested", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `void-crystal` (TOOL_OPENS in skills/tools.ts). Props bake a 1-2 art px contact shadow (at most 35% opacity)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Void geode: a black geode whose inside is a bruised violet crystal swirling like deep space, the rim cracked open; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. side elevation with a slight high angle so the top reads, standing on the bottom edge of a 32x32 art-pixel canvas, a 1-2 art px contact shadow under the base. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, sky, characters, people, readable signs, perspective distortion, floating, cropped base
```
