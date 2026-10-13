# Ember Delve tiles and placeables (pixel art)

Pixel scale, sizes, outline and shading, palettes, animation and the sidecar are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Image generators do not make clean pixel art or consistent frames: use the **design prompt** for the look, then draw or clean the frames on the art-pixel grid (style guide §14), keeping the cell, pivot and export factor exact.

**Tiles are 16x16 art px on the Delve's 32 px cells, exported x4** (style guide §2, §7). Three tile specs:

- **W7a auto-tile sheet** for natural and placed blocks: 4 x 7 cells (interiors, top faces, bottoms, sides, thin pieces, caps, inner corners), 256x448 authored. The layout and the neighbour rules are in style guide §7.1.
- **W7 feature strip** for objects set into the rock (cracked wall, caches, the Godforge fragment) and **W7b back-wall strip**: one row of 4 variants, 256x64, the existing importer layout.
- **W7 overlay** for the inscription: transparent, drawn over the back wall.

Ids are `tile-<node id>` using the ids in `src/app/play/engine/terrain.ts` (`rock` is Basalt, `hard-rock` is Hard basalt, `packed-dirt` is the placed Dirt block). Palettes are the node colours (style guide §5.3). Glow halos, crack stages and dust are drawn by the engine. **Importer:** the `Sprites/Tiles` family imports W7 strips and full W7a sheets; the renderer picks the auto-tile piece per cell (style guide §12, IMP-1 and RND-1). Placeables live in `Sprites/Props/` as W6 cell props (16x16 art px, x4) and import today.

### `tile-dirt` — Loose dirt  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/01-tile-dirt.png` + sidecar `Assets/Sprites/Tiles/01-tile-dirt.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Root Hollows band, every dug seam; the most-seen tile in the Delve |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a cell of loose brown earth with small pebbles, a few pale root threads and crumbs of darker soil; warm browns #5b3b2c and #7f5640, flecks #8c6a4f. Root Hollows palette: back wall #0a0706 #16100c #1a130f, spores #c9b27a, top-face fringe #c9b27a. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-root-loam` — Root-bound loam

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/02-tile-root-loam.png` + sidecar `Assets/Sprites/Tiles/02-tile-root-loam.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P1 |
| Used in | Ember Delve: Root Hollows band (rows 0-11) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
dark loam bound by a mesh of fine pale roots, damp and crumbly; browns #3a2a1c with rootwood fibres #7a5a36. Root Hollows palette: back wall #0a0706 #16100c #1a130f, spores #c9b27a, top-face fringe #c9b27a. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-packed-dirt` — Packed dirt (placed dirt block)

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/03-tile-packed-dirt.png` + sidecar `Assets/Sprites/Tiles/03-tile-packed-dirt.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: the player-placed Dirt block (stack `dirt-block`); must read as built, not natural |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
tamped earth pressed into a neat square block with a faint trowelled surface and one chipped corner line; same browns as loose dirt but smoother and slightly lighter so a placed block is told apart from the wall at a glance. Root Hollows palette: back wall #0a0706 #16100c #1a130f, spores #c9b27a, top-face fringe #c9b27a. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-rock` — Basalt  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/04-tile-rock.png` + sidecar `Assets/Sprites/Tiles/04-tile-rock.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Basalt Caverns band; the default wall of the Delve (node id `rock`) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
cut basalt with a few angular cracks and a pale fleck of mica; dark violet-grey stone #2a2027 with edges #443540. Basalt Caverns palette: back wall #0a0608 #160e12 #1a1115, basalt #241a1c #3a2b2c #5a4440 #6b5148, ash #8a7468, top-face lip #7a6058. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-hard-rock` — Hard basalt  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/05-tile-hard-rock.png` + sidecar `Assets/Sprites/Tiles/05-tile-hard-rock.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Basalt Caverns / Magma Halls; takes 4 hits (node id `hard-rock`) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
dense dark basalt with tight crossing fractures and a heavier look than plain basalt; #2a2027 with highlights #57474f. Basalt Caverns palette: back wall #0a0608 #160e12 #1a1115, basalt #241a1c #3a2b2c #5a4440 #6b5148, ash #8a7468, top-face lip #7a6058. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-basalt-block` — Basalt block (placed)  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/06-tile-basalt-block.png` + sidecar `Assets/Sprites/Tiles/06-tile-basalt-block.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: the player-placed Basalt block (stack `basalt-block`) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a squared basalt block with chiselled edge lines like laid masonry, one brick-sized seam, clean and regular so it reads as built; #2a2027 and #443540. Basalt Caverns palette: back wall #0a0608 #160e12 #1a1115, basalt #241a1c #3a2b2c #5a4440 #6b5148, ash #8a7468, top-face lip #7a6058. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-bedrock` — Bedrock  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/07-tile-bedrock.png` + sidecar `Assets/Sprites/Tiles/07-tile-bedrock.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: floor and edge of every cavern; cannot be dug |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
near-black unbreakable bedrock, smooth and slightly glassy with only a few faint hairline cracks, deliberately featureless so it reads as nothing happens here; #141016 with #2d2430 flecks. Delve palette: bedrock #09070a #141016 #231c25 #2d2430, back walls #0a0608 #160e12 #1a1115. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-roots` — Tangled roots

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/08-tile-roots.png` + sidecar `Assets/Sprites/Tiles/08-tile-roots.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Root Hollows; sickle or blade |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a knot of thick gnarled roots filling the whole cell, pale wood #9b8452 over dark #1f1513, a few thorns. Root Hollows palette: back wall #0a0706 #16100c #1a130f, spores #c9b27a, top-face fringe #c9b27a. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-petrified-trunk` — Petrified trunk

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/09-tile-petrified-trunk.png` + sidecar `Assets/Sprites/Tiles/09-tile-petrified-trunk.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P1 |
| Used in | Ember Delve: Root Hollows; axe, yields World-Root Bark |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a cross-section of petrified wood: growth rings visible, bark edge #6d5a3a, stone-grey heartwood, fine cracks; fills the cell. Root Hollows palette: back wall #0a0706 #16100c #1a130f, spores #c9b27a, top-face fringe #c9b27a. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-shadow-root` — Shadow-root

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/10-tile-shadow-root.png` + sidecar `Assets/Sprites/Tiles/10-tile-shadow-root.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Root Hollows; sickle or blade, yields `shadow-root-cutting` (Verrin's mission) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
violet-black roots threaded through dark loam, each root tipped with a faint violet gleam #9b7ad6; the gleam stays inside the cell. Root Hollows palette: back wall #0a0706 #16100c #1a130f, spores #c9b27a, top-face fringe #c9b27a. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-grotto-stone` — Grotto stone  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/11-tile-grotto-stone.png` + sidecar `Assets/Sprites/Tiles/11-tile-grotto-stone.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Glowcap Grotto band (rows 26-39) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
cool slate-blue wet stone #0f1820 with damp highlights and tiny pale-cyan crystal specks #5fb8e8. Glowcap Grotto palette: back wall #05090c #0c141b #0f1820, grotto stone #141d24 #22303a #3c5664 #6fa8c0, glow #7fc8ff #a8e4ff, wet top-face sheen #8fd0e8. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-glowcap` — Glowcap cluster

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/12-tile-glowcap.png` + sidecar `Assets/Sprites/Tiles/12-tile-glowcap.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Glowcap Grotto; sickle or blade, yields `glowcap` |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a cluster of bioluminescent mushroom caps on a slate wall, caps pale cyan #a8e4ff fading to deep blue #5fb8e8, stems dark; the engine adds the outer halo, so paint only a soft inner glow. Glowcap Grotto palette: back wall #05090c #0c141b #0f1820, grotto stone #141d24 #22303a #3c5664 #6fa8c0, glow #7fc8ff #a8e4ff, wet top-face sheen #8fd0e8. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-scorched-basalt` — Scorched basalt  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/13-tile-scorched-basalt.png` + sidecar `Assets/Sprites/Tiles/13-tile-scorched-basalt.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Magma Halls band (rows 40-55) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
basalt blackened and scorched, with ash-brown streaks and a single faint ember line #ff9b4f, base #1e0d0a. Magma Halls palette: back wall #0b0403 #190a08 #1e0d0a, scorched basalt #220f0e #3a1e1c #6a3328 #ff6a3a, hot top-face crust #ff8a3d. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-ember-rock` — Ember-veined basalt

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/14-tile-ember-rock.png` + sidecar `Assets/Sprites/Tiles/14-tile-ember-rock.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Magma Halls; glowing cells cast a halo |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
basalt split by thin glowing ember-orange veins #ff8a3d with bright core lines #ffb35c, rock #2a2024 around them; veins do not touch the cell edge. Basalt Caverns palette: back wall #0a0608 #160e12 #1a1115, basalt #241a1c #3a2b2c #5a4440 #6b5148, ash #8a7468, top-face lip #7a6058. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-cinder-vein` — Cinder Ore vein  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/15-tile-cinder-vein.png` + sidecar `Assets/Sprites/Tiles/15-tile-cinder-vein.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Root Hollows, Basalt Caverns; pickaxe I, yields `cinder-ore` |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
basalt holding chunky nodules of cinder ore, glowing orange-red seams #ff9b4f inside black ore; ore stays inside the cell. Basalt Caverns palette: back wall #0a0608 #160e12 #1a1115, basalt #241a1c #3a2b2c #5a4440 #6b5148, ash #8a7468, top-face lip #7a6058. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-slag-vein` — Slag vein

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/16-tile-slag-vein.png` + sidecar `Assets/Sprites/Tiles/16-tile-slag-vein.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Basalt Caverns, Glowcap Grotto; pickaxe II, yields `slag-fragment` |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
basalt with greenish-teal glassy slag shards #8fd6cf in a dark frame #2f2830; cool glints, readable as different from cinder at 32 px. Basalt Caverns palette: back wall #0a0608 #160e12 #1a1115, basalt #241a1c #3a2b2c #5a4440 #6b5148, ash #8a7468, top-face lip #7a6058. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-heartstone-vein` — Heartstone vein

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/17-tile-heartstone-vein.png` + sidecar `Assets/Sprites/Tiles/17-tile-heartstone-vein.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Magma Halls; pickaxe III, yields `infernal-heartstone` |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_The full W7a sheet imports as is and the Delve draws the right piece for each cell's neighbours (style guide §12, IMP-1 and RND-1)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
dark crimson stone #2a1a22 holding a faceted heartstone cluster in rose-red #ff4f7a with a bright facet highlight; the rarest-looking ore of the three. Magma Halls palette: back wall #0b0403 #190a08 #1e0d0a, scorched basalt #220f0e #3a1e1c #6a3328 #ff6a3a, hot top-face crust #ff8a3d. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-cracked-wall` — Cracked wall

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/18-tile-cracked-wall.png` + sidecar `Assets/Sprites/Tiles/18-tile-cracked-wall.json` |
| Spec | W7 feature strip (pixel art) - 16x16 art px cells, 4 variants in one row = 64x16 art px, export x4 nearest-neighbour = 256x64, OPAQUE |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: staff blast breaks it; hides pockets and caches |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four variants of the same set-in block, its own 1 px outline on all four sides; fully opaque. Any pulse or glow is drawn by the engine |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a wall of violet-tinted basalt #33263a split by one bold zig-zag crack with pale violet light #c9a0ff leaking from it; unmistakably blast me. Basalt Caverns palette: back wall #0a0608 #160e12 #1a1115, basalt #241a1c #3a2b2c #5a4440 #6b5148, ash #8a7468, top-face lip #7a6058. a 16x16 art-pixel block set into the rock, 4 variants in one row (64x16 art px), its own 1 px outline on all four sides, fully opaque, flat elevation view. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; fully opaque; export with nearest-neighbour x4 to 256x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, transparent pixels, glow bleeding past the cell, edge vignette
```

### `tile-cache` — Keeper's cache

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/19-tile-cache.png` + sidecar `Assets/Sprites/Tiles/19-tile-cache.json` |
| Spec | W7 feature strip (pixel art) - 16x16 art px cells, 4 variants in one row = 64x16 art px, export x4 nearest-neighbour = 256x64, OPAQUE |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P1 |
| Used in | Ember Delve: sealed cache pocket (Basalt Caverns); any tool breaks it |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four variants of the same set-in block, its own 1 px outline on all four sides; fully opaque. Any pulse or glow is drawn by the engine |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a small buried strongbox of aged gold-trimmed iron #e8c47a half-set into the rock, a keeper's mark on the lid (a shape, not letters). Basalt Caverns palette: back wall #0a0608 #160e12 #1a1115, basalt #241a1c #3a2b2c #5a4440 #6b5148, ash #8a7468, top-face lip #7a6058. a 16x16 art-pixel block set into the rock, 4 variants in one row (64x16 art px), its own 1 px outline on all four sides, fully opaque, flat elevation view. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; fully opaque; export with nearest-neighbour x4 to 256x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, transparent pixels, glow bleeding past the cell, edge vignette
```

### `tile-kaels-cache` — Kael's old cache

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/20-tile-kaels-cache.png` + sidecar `Assets/Sprites/Tiles/20-tile-kaels-cache.json` |
| Spec | W7 feature strip (pixel art) - 16x16 art px cells, 4 variants in one row = 64x16 art px, export x4 nearest-neighbour = 256x64, OPAQUE |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Basalt Caverns, east end of the Maws' cavern (85, 18); yields `kaels-hammer` once |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four variants of the same set-in block, its own 1 px outline on all four sides; fully opaque. Any pulse or glow is drawn by the engine |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
an old smith's cache wedged in the rock: scorched leather roll and a hammer-head glint, ember highlight #ffc97a, Kael's hammer-mark (a shape, not letters). Basalt Caverns palette: back wall #0a0608 #160e12 #1a1115, basalt #241a1c #3a2b2c #5a4440 #6b5148, ash #8a7468, top-face lip #7a6058. a 16x16 art-pixel block set into the rock, 4 variants in one row (64x16 art px), its own 1 px outline on all four sides, fully opaque, flat elevation view. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; fully opaque; export with nearest-neighbour x4 to 256x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, transparent pixels, glow bleeding past the cell, edge vignette
```

### `tile-godforge-fragment` — Godforge fragment

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/21-tile-godforge-fragment.png` + sidecar `Assets/Sprites/Tiles/21-tile-godforge-fragment.json` |
| Spec | W7 feature strip (pixel art) - 16x16 art px cells, 4 variants in one row = 64x16 art px, export x4 nearest-neighbour = 256x64, OPAQUE |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Magma Halls fragment chamber; yields `godforge-fragment` once per player (guarded by the Seam Eater) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four variants of the same set-in block, its own 1 px outline on all four sides; fully opaque. Any pulse or glow is drawn by the engine |

_Was briefed as a 6-frame `ambient` loop, which the tile importer rejects (a tile strip has exactly one action, `tile`). Now a still 4-variant strip; the pulse comes from the engine light (`glow` radius 96)._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a shard of the Godforge embedded in bedrock: warm white-gold faceted crystal #ffe9a8 with a bright core #fff4d0 and thin violet fracture lines; the hero tile of the Delve. Magma Halls palette: back wall #0b0403 #190a08 #1e0d0a, scorched basalt #220f0e #3a1e1c #6a3328 #ff6a3a, hot top-face crust #ff8a3d. a 16x16 art-pixel block set into the rock, 4 variants in one row (64x16 art px), its own 1 px outline on all four sides, fully opaque, flat elevation view. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; fully opaque; export with nearest-neighbour x4 to 256x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, transparent pixels, glow bleeding past the cell, edge vignette
```

### `tile-wall-root-hollows` — Root Hollows back wall

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/22-tile-wall-root-hollows.png` + sidecar `Assets/Sprites/Tiles/22-tile-wall-root-hollows.json` |
| Spec | W7b back-wall strip (pixel art) - 16x16 art px cells, 4 variants in one row = 64x16 art px, export x4 nearest-neighbour = 256x64, seamless, OPAQUE |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P1 |
| Used in | Ember Delve: the open-air back wall behind tunnels in the Root Hollows biome |
| Shows today | biome wall gradient drawn in code |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four variants; deliberately low contrast so tunnels and sprites read in front |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a quiet back-wall tile: warm brown-black rootwood-and-earth wall #1a130f, faint root silhouettes; much lower contrast than the diggable tiles so it reads as distant. Root Hollows palette: back wall #0a0706 #16100c #1a130f, spores #c9b27a, top-face fringe #c9b27a. a 16x16 art-pixel back-wall tile, 4 seamless variants in one row (64x16 art px), no outline, two steps darker and less saturated than the biome rock, fully opaque, flat elevation view. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; fully opaque; export with nearest-neighbour x4 to 256x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, outline, bevel, bright accents, high contrast, ore, perspective, visible seam, transparent pixels
```

### `tile-wall-basalt-caverns` — Basalt Caverns back wall

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/23-tile-wall-basalt-caverns.png` + sidecar `Assets/Sprites/Tiles/23-tile-wall-basalt-caverns.json` |
| Spec | W7b back-wall strip (pixel art) - 16x16 art px cells, 4 variants in one row = 64x16 art px, export x4 nearest-neighbour = 256x64, seamless, OPAQUE |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P1 |
| Used in | Ember Delve: the open-air back wall behind tunnels in the Basalt Caverns biome |
| Shows today | biome wall gradient drawn in code |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four variants; deliberately low contrast so tunnels and sprites read in front |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a quiet back-wall tile: violet-black basalt wall #1a1115 with faint horizontal strata; much lower contrast than the diggable tiles so it reads as distant. Basalt Caverns palette: back wall #0a0608 #160e12 #1a1115, basalt #241a1c #3a2b2c #5a4440 #6b5148, ash #8a7468, top-face lip #7a6058. a 16x16 art-pixel back-wall tile, 4 seamless variants in one row (64x16 art px), no outline, two steps darker and less saturated than the biome rock, fully opaque, flat elevation view. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; fully opaque; export with nearest-neighbour x4 to 256x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, outline, bevel, bright accents, high contrast, ore, perspective, visible seam, transparent pixels
```

### `tile-wall-glowcap-grotto` — Glowcap Grotto back wall

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/24-tile-wall-glowcap-grotto.png` + sidecar `Assets/Sprites/Tiles/24-tile-wall-glowcap-grotto.json` |
| Spec | W7b back-wall strip (pixel art) - 16x16 art px cells, 4 variants in one row = 64x16 art px, export x4 nearest-neighbour = 256x64, seamless, OPAQUE |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P1 |
| Used in | Ember Delve: the open-air back wall behind tunnels in the Glowcap Grotto biome |
| Shows today | biome wall gradient drawn in code |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four variants; deliberately low contrast so tunnels and sprites read in front |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a quiet back-wall tile: cold slate-blue cave wall #0f1820 with faint damp streaks; much lower contrast than the diggable tiles so it reads as distant. Glowcap Grotto palette: back wall #05090c #0c141b #0f1820, grotto stone #141d24 #22303a #3c5664 #6fa8c0, glow #7fc8ff #a8e4ff, wet top-face sheen #8fd0e8. a 16x16 art-pixel back-wall tile, 4 seamless variants in one row (64x16 art px), no outline, two steps darker and less saturated than the biome rock, fully opaque, flat elevation view. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; fully opaque; export with nearest-neighbour x4 to 256x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, outline, bevel, bright accents, high contrast, ore, perspective, visible seam, transparent pixels
```

### `tile-wall-magma-halls` — Magma Halls back wall

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/25-tile-wall-magma-halls.png` + sidecar `Assets/Sprites/Tiles/25-tile-wall-magma-halls.json` |
| Spec | W7b back-wall strip (pixel art) - 16x16 art px cells, 4 variants in one row = 64x16 art px, export x4 nearest-neighbour = 256x64, seamless, OPAQUE |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P1 |
| Used in | Ember Delve: the open-air back wall behind tunnels in the Magma Halls biome |
| Shows today | biome wall gradient drawn in code |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four variants; deliberately low contrast so tunnels and sprites read in front |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a quiet back-wall tile: red-black scorched wall #1e0d0a with very faint heat-cracks; much lower contrast than the diggable tiles so it reads as distant. Magma Halls palette: back wall #0b0403 #190a08 #1e0d0a, scorched basalt #220f0e #3a1e1c #6a3328 #ff6a3a, hot top-face crust #ff8a3d. a 16x16 art-pixel back-wall tile, 4 seamless variants in one row (64x16 art px), no outline, two steps darker and less saturated than the biome rock, fully opaque, flat elevation view. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; fully opaque; export with nearest-neighbour x4 to 256x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, outline, bevel, bright accents, high contrast, ore, perspective, visible seam, transparent pixels
```

### `tile-inscription` — Inscription carving (overlay)

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/26-tile-inscription.png` + sidecar `Assets/Sprites/Tiles/26-tile-inscription.json` |
| Spec | W7 overlay strip (pixel art) - 16x16 art px cells, 4 variants (one per biome) in one row = 64x16 art px, export x4 = 256x64, TRANSPARENT outside the carving |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P1 |
| Used in | Ember Delve: the 8 carved inscription cells (press E or tap to read); variant 1 Root Hollows, 2 Basalt Caverns, 3 Glowcap Grotto, 4 Magma Halls |
| Shows today | faint glyph drawn in code |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | variant per biome, in biome order |

_Transparent overlay, so it passes the importer's opacity checks as a W7 strip today._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a carved wall plaque overlay: a shallow rectangular recess with a short column of abstract chiselled marks (shapes, not letters) catching the light on its lower lip, a soft pale-gold edge light #e8c47a, transparent outside the carving. Delve palette: bedrock #09070a #141016 #231c25 #2d2430, back walls #0a0608 #160e12 #1a1115. a 16x16 art-pixel overlay, 4 variants in one row (64x16 art px): variant 1 root-etched, 2 hammer-struck, 3 lit by pale cyan, 4 glowing faint ember; transparent outside the carving, flat elevation view. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x4 to 256x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, opaque background, rock texture outside the carving, readable letters, perspective, readable text, alphabet
```

### `tile-torch` — Torch

| | |
|---|---|
| Save as | `Assets/Sprites/Props/22-tile-torch.png` + sidecar `Assets/Sprites/Props/22-tile-torch.json` |
| Spec | W6 Delve cell prop (pixel art) - 16x16 art px per frame, sheet 96x16 art px, export x4 nearest-neighbour = 384x64 px (64x64 per frame), transparent background |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; pivot (32, 64) authored = art (8, 16) |
| Priority | P0 |
| Used in | Ember Delve: placed beside the Keeper (never in a floor); always lit, radius 120 |
| Shows today | shape drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "pivot": {"x": 32, "y": 64}, "actions": [{"name": "ambient", "frames": 6, "fps": 10, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 10 | yes | flame flicker; frame 1 = still; the wall bracket never moves |

_Sits in a grid cell, so no baked ground shadow._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a wall torch: black iron bracket and a wrapped wooden head with a lively ember-orange flame #ff9b4f with a pale yellow core; the flame fills the upper half of the cell and leaves transparent corners; 6 frames of flicker. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. fits one 16x16 art-pixel Delve cell, standing on the cell bottom, transparent around it, no ground shadow; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x4 to 384x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, rock behind it, ground shadow, larger than one cell, perspective
```

### `tile-ladder` — Ladder

| | |
|---|---|
| Save as | `Assets/Sprites/Props/23-tile-ladder.png` + sidecar `Assets/Sprites/Props/23-tile-ladder.json` |
| Spec | W6 Delve cell prop (pixel art) - 16x16 art px, export x4 nearest-neighbour = 64x64 px, transparent background |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; pivot (32, 64) authored = art (8, 16) |
| Priority | P0 |
| Used in | Ember Delve: placed where the Keeper stands; climbed with Up / Down |
| Shows today | shape drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "pivot": {"x": 32, "y": 64}}` |

_Sits in a grid cell, so no baked ground shadow._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a wooden ladder section: two rootwood rails and three iron-banded rungs; rails run edge to edge top and bottom so stacked cells form one continuous ladder; transparent between the rails. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. fits one 16x16 art-pixel Delve cell, standing on the cell bottom, transparent around it, no ground shadow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x4 to 64x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, rock behind it, ground shadow, larger than one cell, perspective
```

### `tile-platform` — Platform

| | |
|---|---|
| Save as | `Assets/Sprites/Props/24-tile-platform.png` + sidecar `Assets/Sprites/Props/24-tile-platform.json` |
| Spec | W6 Delve cell prop (pixel art) - 16x16 art px, export x4 nearest-neighbour = 64x64 px, transparent background |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; pivot (32, 64) authored = art (8, 16) |
| Priority | P0 |
| Used in | Ember Delve: one-way floor; hold Down to drop through |
| Shows today | shape drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "pivot": {"x": 32, "y": 64}}` |

_Sits in a grid cell, so no baked ground shadow._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a thin one-way platform plank in the top quarter of the cell: dark rootwood plank with iron end-caps and two rivets, plank runs edge to edge left and right so neighbours join; everything below the plank is transparent. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. fits one 16x16 art-pixel Delve cell, standing on the cell bottom, transparent around it, no ground shadow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x4 to 64x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, rock behind it, ground shadow, larger than one cell, perspective
```

### `tile-chest` — Chest

| | |
|---|---|
| Save as | `Assets/Sprites/Props/25-tile-chest.png` + sidecar `Assets/Sprites/Props/25-tile-chest.json` |
| Spec | W6 Delve cell prop (pixel art) - 16x16 art px per frame, sheet 16x32 art px, export x4 nearest-neighbour = 64x128 px (64x64 per frame), transparent background |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; pivot (32, 64) authored = art (8, 16) |
| Priority | P0 |
| Used in | Ember Delve: holds 4 kinds of material; E or tap opens it |
| Shows today | shape drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "pivot": {"x": 32, "y": 64}, "actions": [{"name": "closed", "frames": 1, "fps": 0, "loop": false}, {"name": "open", "frames": 1, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `closed` | 1 | 0 | no | lid down, latch shut |
| 1 | `open` | 1 | 0 | no | lid up, a warm glow inside |

_Sits in a grid cell, so no baked ground shadow._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a small iron-banded rootwood chest with a brass latch; closed: lid down; open: lid thrown back and a warm gold glow #e8c47a rising from inside; identical footprint in both states. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. fits one 16x16 art-pixel Delve cell, standing on the cell bottom, transparent around it, no ground shadow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x4 to 64x128 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, rock behind it, ground shadow, larger than one cell, perspective
```

### `tile-camp` — Camp

| | |
|---|---|
| Save as | `Assets/Sprites/Props/26-tile-camp.png` + sidecar `Assets/Sprites/Props/26-tile-camp.json` |
| Spec | W6 Delve cell prop (pixel art) - 16x16 art px per frame, sheet 96x16 art px, export x4 nearest-neighbour = 384x64 px (64x64 per frame), transparent background |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; pivot (32, 64) authored = art (8, 16) |
| Priority | P0 |
| Used in | Ember Delve: one per Delve; E opens the Crafting Bench on Ready now; Descend to your camp from town |
| Shows today | shape drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "pivot": {"x": 32, "y": 64}, "actions": [{"name": "ambient", "frames": 6, "fps": 8, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | firelight flicker; the small tent and bedroll stay still |

_Sits in a grid cell, so no baked ground shadow._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a tiny Keeper's camp: a small patched canvas lean-to over a bedroll, a ring of basalt stones with a low ember-orange fire in front, a cooking pot; reads as a safe place to craft. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. fits one 16x16 art-pixel Delve cell, standing on the cell bottom, transparent around it, no ground shadow; ambient 6 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x4 to 384x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, rock behind it, ground shadow, larger than one cell, perspective
```

## Delve extras: supports and blasting charges (added 2026-10-13)

Placeables like the torch and chest, so they live in `Sprites/Props/` (transparent, not tile strips) and import today; numbering continues at 52. Loose rock needs no tile: it is the biome's own rock, and the engine draws its cracks and dust.

### `tile-timber-support` — Timber support

| | |
|---|---|
| Save as | `Assets/Sprites/Props/52-tile-timber-support.png` + sidecar `Assets/Sprites/Props/52-tile-timber-support.json` |
| Spec | W6 Delve cell prop (pixel art) - 16x16 art px, export x4 nearest-neighbour = 64x64 px, transparent background |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; pivot (32, 64) authored = art (8, 16) |
| Priority | P1 |
| Used in | Ember Delve: placed beside the Keeper on solid ground; loose rock within 3 cells holds when dug; walked through, taken back whole (X) |
| Shows today | shape drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "pivot": {"x": 32, "y": 64}, "actions": [{"name": "idle", "frames": 1, "fps": 0, "loop": false}]}` |

_Sits in a grid cell and the Keeper walks through it, so no baked ground shadow and keep the middle open._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a mine shoring prop: two rootwood posts with iron bands holding up a short cap beam across the top of the cell; the posts stand on the cell floor; transparent between and around the posts so the wall behind shows. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. fits one 16x16 art-pixel Delve cell, standing on the cell bottom, transparent around it, no ground shadow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x4 to 64x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, rock behind it, ground shadow, larger than one cell, perspective
```

### `tile-basalt-support` — Basalt support

| | |
|---|---|
| Save as | `Assets/Sprites/Props/53-tile-basalt-support.png` + sidecar `Assets/Sprites/Props/53-tile-basalt-support.json` |
| Spec | W6 Delve cell prop (pixel art) - 16x16 art px, export x4 nearest-neighbour = 64x64 px, transparent background |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; pivot (32, 64) authored = art (8, 16) |
| Priority | P1 |
| Used in | Ember Delve: placed beside the Keeper on solid ground; loose rock within 5 cells holds when dug; walked through, taken back whole (X) |
| Shows today | shape drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "pivot": {"x": 32, "y": 64}, "actions": [{"name": "idle", "frames": 1, "fps": 0, "loop": false}]}` |

_Sits in a grid cell and the Keeper walks through it, so no baked ground shadow._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a dressed basalt pillar with a squared capital and an iron collar, faint ember-orange seams at its joints, standing on the cell floor and reaching the top edge; clearly sturdier than the timber prop; transparent to either side of the pillar. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. fits one 16x16 art-pixel Delve cell, standing on the cell bottom, transparent around it, no ground shadow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x4 to 64x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, rock behind it, ground shadow, larger than one cell, perspective
```

### `tile-blast-charge` — Blasting charge

| | |
|---|---|
| Save as | `Assets/Sprites/Props/54-tile-blast-charge.png` + sidecar `Assets/Sprites/Props/54-tile-blast-charge.json` |
| Spec | W6 Delve cell prop (pixel art) - 16x16 art px per frame, sheet 64x16 art px, export x4 nearest-neighbour = 256x64 px (64x64 per frame), transparent background |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; pivot (32, 64) authored = art (8, 16) |
| Priority | P1 |
| Used in | Ember Delve: placed beside the Keeper, lit at once from a staff; the fuse burns about 2 s, then it clears a small round of rock (X beside it pinches the fuse out) |
| Shows today | shape drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "pivot": {"x": 32, "y": 64}, "actions": [{"name": "ambient", "frames": 4, "fps": 12, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 12 | yes | the fuse spark sputters; the keg stays still |

_The engine draws the blast flash and debris; paint only the lit keg. No baked ground shadow._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a squat iron-banded keg of cinder powder sitting in the lower half of the cell, a short fuse rising from its lid with a bright spark #ffd36d that sputters across 4 frames; glowing orange cracks between the staves. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. fits one 16x16 art-pixel Delve cell, standing on the cell bottom, transparent around it, no ground shadow; ambient 4 frames. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x4 to 256x64 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, rock behind it, ground shadow, larger than one cell, perspective
```
