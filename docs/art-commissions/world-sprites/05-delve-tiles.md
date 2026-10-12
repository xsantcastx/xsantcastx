# Ember Delve tiles and placeables (world layer)

Sprite style guide, cell/pivot rules, the sidecar JSON schema and the scale table are in [../README.md](../README.md#world-layer--sprites). Image generators are poor at consistent multi-frame sheets: use the **design prompt** to fix the look (one key pose or a model sheet), then animate the frames from it by hand or in a sprite tool, keeping the cell grid and pivot exact.

**New spec W7 - tile strip.** The Delve is a grid of 32 px cells. Each terrain node is one tile authored at 2x (64x64), delivered as a strip of **4 variants** in a single row (action `tile`), so the sheet is **256 x 64** and the sidecar is `{ "scale": 2, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}] }`. Tiles are the one exception to the transparent-background rule: they are **fully opaque** and must repeat cleanly on all four edges (and next to every other tile, so plain rock reaches the edge pixels). Glow halos for glowing cells are drawn by the engine (`lighting.ts`), so paint only an inner glow. Crack stages are drawn in code over the top. Ids are `tile-<node id>` using the id in `src/app/play/engine/terrain.ts` (`rock` is Basalt, `hard-rock` is Hard basalt, `packed-dirt` is the placed Dirt block).

**Importer prerequisite:** `scripts/import-assets.py` has no `Sprites/Tiles` family and rejects any sprite with opaque corners, so opaque tiles cannot land until the importer gains that family. Placeables (torch, ladder, platform, chest, camp) live in `Sprites/Props/` and import today. See [../01-second-wave.md](../01-second-wave.md).


### `tile-dirt` - Loose dirt

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/01-tile-dirt.png` + sidecar `Assets/Sprites/Tiles/01-tile-dirt.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: Root Hollows band, every dug seam; the most-seen tile in the Delve |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
a cell of loose brown earth with small pebbles, a few pale root threads and crumbs of darker soil; warm browns #5b3b2c and #7f5640, flecks #8c6a4f. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-root-loam` - Root-bound loam

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/02-tile-root-loam.png` + sidecar `Assets/Sprites/Tiles/02-tile-root-loam.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P1 |
| Used in | Ember Delve: Root Hollows band (rows 0-11) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
dark loam bound by a mesh of fine pale roots, damp and crumbly; browns #3a2a1c with rootwood fibres #7a5a36. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-packed-dirt` - Packed dirt (placed dirt block)

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/03-tile-packed-dirt.png` + sidecar `Assets/Sprites/Tiles/03-tile-packed-dirt.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: the player-placed Dirt block (stack `dirt-block`); must read as built, not natural |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
tamped earth pressed into a neat square block with a faint trowelled surface and one chipped corner line; same browns as loose dirt but smoother and slightly lighter so a placed block is told apart from the wall at a glance. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-rock` - Basalt

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/04-tile-rock.png` + sidecar `Assets/Sprites/Tiles/04-tile-rock.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: Basalt Caverns band; the default wall of the Delve (node id `rock`) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
cut basalt with a few angular cracks and a pale fleck of mica; dark violet-grey stone #2a2027 with edges #443540. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-hard-rock` - Hard basalt

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/05-tile-hard-rock.png` + sidecar `Assets/Sprites/Tiles/05-tile-hard-rock.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: Basalt Caverns / Magma Halls; takes 4 hits (node id `hard-rock`) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
dense dark basalt with tight crossing fractures and a heavier look than plain basalt; #2a2027 with highlights #57474f. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-basalt-block` - Basalt block (placed)

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/06-tile-basalt-block.png` + sidecar `Assets/Sprites/Tiles/06-tile-basalt-block.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: the player-placed Basalt block (stack `basalt-block`) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
a squared basalt block with chiselled edge lines like laid masonry, one brick-sized seam, clean and regular so it reads as built; #2a2027 and #443540. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-bedrock` - Bedrock

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/07-tile-bedrock.png` + sidecar `Assets/Sprites/Tiles/07-tile-bedrock.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: floor and edge of every cavern; cannot be dug |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
near-black unbreakable bedrock, smooth and slightly glassy with only a few faint hairline cracks, deliberately featureless so it reads as nothing happens here; #141016 with #2d2430 flecks. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-roots` - Tangled roots

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/08-tile-roots.png` + sidecar `Assets/Sprites/Tiles/08-tile-roots.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: Root Hollows; sickle or blade |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
a knot of thick gnarled roots filling the whole cell, pale wood #9b8452 over dark #1f1513, a few thorns. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-petrified-trunk` - Petrified trunk

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/09-tile-petrified-trunk.png` + sidecar `Assets/Sprites/Tiles/09-tile-petrified-trunk.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P1 |
| Used in | Ember Delve: Root Hollows; axe, yields World-Root Bark |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
a cross-section of petrified wood: growth rings visible, bark edge #6d5a3a, stone-grey heartwood, fine cracks; fills the cell. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-shadow-root` - Shadow-root

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/10-tile-shadow-root.png` + sidecar `Assets/Sprites/Tiles/10-tile-shadow-root.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: Root Hollows; sickle or blade, yields `shadow-root-cutting` (Verrin's mission) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
violet-black roots threaded through dark loam, each root tipped with a faint violet gleam #9b7ad6; the gleam stays inside the cell. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-grotto-stone` - Grotto stone

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/11-tile-grotto-stone.png` + sidecar `Assets/Sprites/Tiles/11-tile-grotto-stone.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P1 |
| Used in | Ember Delve: Glowcap Grotto band (rows 26-39) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
cool slate-blue wet stone #0f1820 with damp highlights and tiny pale-cyan crystal specks #5fb8e8. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-glowcap` - Glowcap cluster

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/12-tile-glowcap.png` + sidecar `Assets/Sprites/Tiles/12-tile-glowcap.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: Glowcap Grotto; sickle or blade, yields `glowcap` |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
a cluster of bioluminescent mushroom caps on a slate wall, caps pale cyan #a8e4ff fading to deep blue #5fb8e8, stems dark; the engine adds the outer halo, so paint only a soft inner glow. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-scorched-basalt` - Scorched basalt

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/13-tile-scorched-basalt.png` + sidecar `Assets/Sprites/Tiles/13-tile-scorched-basalt.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P1 |
| Used in | Ember Delve: Magma Halls band (rows 40-55) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
basalt blackened and scorched, with ash-brown streaks and a single faint ember line #ff9b4f, base #1e0d0a. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-ember-rock` - Ember-veined basalt

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/14-tile-ember-rock.png` + sidecar `Assets/Sprites/Tiles/14-tile-ember-rock.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: Magma Halls; glowing cells cast a halo |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
basalt split by thin glowing ember-orange veins #ff8a3d with bright core lines #ffb35c, rock #2a2024 around them; veins do not touch the cell edge. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-cinder-vein` - Cinder Ore vein

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/15-tile-cinder-vein.png` + sidecar `Assets/Sprites/Tiles/15-tile-cinder-vein.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: Root Hollows, Basalt Caverns; pickaxe I, yields `cinder-ore` |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
basalt holding chunky nodules of cinder ore, glowing orange-red seams #ff9b4f inside black ore; ore stays inside the cell. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-slag-vein` - Slag vein

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/16-tile-slag-vein.png` + sidecar `Assets/Sprites/Tiles/16-tile-slag-vein.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: Basalt Caverns, Glowcap Grotto; pickaxe II, yields `slag-fragment` |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
basalt with greenish-teal glassy slag shards #8fd6cf in a dark frame #2f2830; cool glints, readable as different from cinder at 32 px. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-heartstone-vein` - Heartstone vein

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/17-tile-heartstone-vein.png` + sidecar `Assets/Sprites/Tiles/17-tile-heartstone-vein.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: Magma Halls; pickaxe III, yields `infernal-heartstone` |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
dark crimson stone #2a1a22 holding a faceted heartstone cluster in rose-red #ff4f7a with a bright facet highlight; the rarest-looking ore of the three. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-cracked-wall` - Cracked wall

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/18-tile-cracked-wall.png` + sidecar `Assets/Sprites/Tiles/18-tile-cracked-wall.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: staff blast breaks it; hides pockets and caches |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
a wall of violet-tinted basalt #33263a split by one bold zig-zag crack with pale violet light #c9a0ff leaking from it; unmistakably blast me. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-cache` - Keeper's cache

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/19-tile-cache.png` + sidecar `Assets/Sprites/Tiles/19-tile-cache.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P1 |
| Used in | Ember Delve: sealed cache pocket (Basalt Caverns); any tool breaks it |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
a small buried strongbox of aged gold-trimmed iron #e8c47a half-set into the rock, a keeper's mark on the lid (a shape, not letters). Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-kaels-cache` - Kael's old cache

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/20-tile-kaels-cache.png` + sidecar `Assets/Sprites/Tiles/20-tile-kaels-cache.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: Basalt Caverns, east end of the Maws' cavern (85, 18); yields `kaels-hammer` once |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interchangeable variants; the engine picks one by cell hash; each must repeat cleanly next to every other variant |

**Design prompt** (key pose / model sheet; animate from it)

```text
an old smith's cache wedged in the rock: scorched leather roll and a hammer-head glint, ember highlight #ffc97a, Kael's hammer-mark (a shape, not letters). Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-godforge-fragment` - Godforge fragment

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/21-tile-godforge-fragment.png` + sidecar `Assets/Sprites/Tiles/21-tile-godforge-fragment.json` |
| Spec | W7 tile strip - 64x64 cell, 6-frame `ambient` loop, OPAQUE |
| On screen (1x) | 32 x 32 px (one grid cell) |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a (fills the cell) |
| Priority | P0 |
| Used in | Ember Delve: Magma Halls fragment chamber; yields `godforge-fragment` once per player (guarded by the Rune-Warden) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 6 | yes | slow glow pulse, frame 1 = still |

**Design prompt** (key pose / model sheet; animate from it)

```text
a shard of the Godforge embedded in bedrock: warm white-gold faceted crystal #ffe9a8 with a bright core #fff4d0 and thin violet fracture lines; the hero tile of the Delve. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-wall-root-hollows` - Root Hollows back wall

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/22-tile-wall-root-hollows.png` + sidecar `Assets/Sprites/Tiles/22-tile-wall-root-hollows.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a |
| Priority | P1 |
| Used in | Ember Delve: the open-air back wall behind tunnels in the Root Hollows biome |
| Shows today | biome wall gradient drawn in code |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four variants; deliberately low contrast so tunnels and sprites read in front |

**Design prompt** (key pose / model sheet; animate from it)

```text
a quiet back-wall tile: warm brown-black rootwood-and-earth wall #1a130f, faint root silhouettes; much lower contrast than the diggable tiles so it reads as distant. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-wall-basalt-caverns` - Basalt Caverns back wall

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/23-tile-wall-basalt-caverns.png` + sidecar `Assets/Sprites/Tiles/23-tile-wall-basalt-caverns.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a |
| Priority | P1 |
| Used in | Ember Delve: the open-air back wall behind tunnels in the Basalt Caverns biome |
| Shows today | biome wall gradient drawn in code |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four variants; deliberately low contrast so tunnels and sprites read in front |

**Design prompt** (key pose / model sheet; animate from it)

```text
a quiet back-wall tile: violet-black basalt wall #1a1115 with faint horizontal strata; much lower contrast than the diggable tiles so it reads as distant. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-wall-glowcap-grotto` - Glowcap Grotto back wall

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/24-tile-wall-glowcap-grotto.png` + sidecar `Assets/Sprites/Tiles/24-tile-wall-glowcap-grotto.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a |
| Priority | P1 |
| Used in | Ember Delve: the open-air back wall behind tunnels in the Glowcap Grotto biome |
| Shows today | biome wall gradient drawn in code |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four variants; deliberately low contrast so tunnels and sprites read in front |

**Design prompt** (key pose / model sheet; animate from it)

```text
a quiet back-wall tile: cold slate-blue cave wall #0f1820 with faint damp streaks; much lower contrast than the diggable tiles so it reads as distant. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-wall-magma-halls` - Magma Halls back wall

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/25-tile-wall-magma-halls.png` + sidecar `Assets/Sprites/Tiles/25-tile-wall-magma-halls.json` |
| Spec | W7 tile strip - 64x64 cell (32 px grid x 2), 4 variants left to right in one row (action `tile`), seamless, OPAQUE |
| On screen (1x) | 32 x 32 px |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a |
| Priority | P1 |
| Used in | Ember Delve: the open-air back wall behind tunnels in the Magma Halls biome |
| Shows today | biome wall gradient drawn in code |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four variants; deliberately low contrast so tunnels and sprites read in front |

**Design prompt** (key pose / model sheet; animate from it)

```text
a quiet back-wall tile: red-black scorched wall #1e0d0a with very faint heat-cracks; much lower contrast than the diggable tiles so it reads as distant. Delve rock palette: dark violet-black stone (#1a1115 to #0a0608) with cooler and warmer accents only where named. seamless square tile that repeats cleanly on all four edges, fully opaque to every edge, flat elevation view with no perspective, no border, no frame, any ore, crystal or glow sits well inside the cell so the edge pixels are plain rock. stylised 2D side-scroller game tile, clean cel shading in two to three tone steps, crisp dark violet-black outline on inner shapes only, limited palette, lit from the upper left, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, perspective grid, bevelled border, drop shadow, glow bleeding past the cell edge, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, visible seam, edge vignette, cell outline
```

### `tile-inscription` - Inscription carving (overlay)

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/26-tile-inscription.png` + sidecar `Assets/Sprites/Tiles/26-tile-inscription.json` |
| Spec | W7 tile strip - 64x64 cell, 4 variants (one per biome), TRANSPARENT background overlay (drawn over the biome back wall) |
| On screen (1x) | 32 x 32 px |
| Cell (authored 2x) | 64x64 (32 px logical); pivot n/a |
| Priority | P1 |
| Used in | Ember Delve: the 8 carved inscription cells (press E or tap to read); variant 1 Root Hollows, 2 Basalt Caverns, 3 Glowcap Grotto, 4 Magma Halls |
| Shows today | faint glyph drawn in code |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | variant per biome, in biome order |

_Transparent overlay, so it passes the importer's corner check as-is; the opaque tiles do not (see 01-second-wave.md prerequisite)._

**Design prompt** (key pose / model sheet; animate from it)

```text
a carved wall plaque overlay: a shallow rectangular recess with a short column of abstract chiselled marks (shapes, not letters) catching the light on its lower lip, a soft pale-gold edge light #e8c47a, transparent outside the carving. Variant 1 root-etched, 2 hammer-struck, 3 lit by pale cyan, 4 glowing faint ember. stylised 2D side-scroller game tile, flat elevation view, clean cel shading in two to three tone steps, crisp dark violet-black outline, limited palette, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo, readable text, letters, alphabet, opaque background
```

### `tile-torch` - Torch

| | |
|---|---|
| Save as | `Assets/Sprites/Props/22-tile-torch.png` + sidecar `Assets/Sprites/Props/22-tile-torch.json` |
| Spec | W6 prop loop - 64x64 cell, 6-frame `ambient` flame loop (fps 10) |
| On screen (1x) | 32 x 32 px |
| Cell (authored 2x) | 64x64; pivot (32, 62) |
| Priority | P0 |
| Used in | Ember Delve: placed beside the Keeper (never in a floor); always lit, radius 120 |
| Shows today | shape drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 10 | yes | flame flicker; frame 1 = still; the wall bracket never moves |

_Sits in a grid cell, so no baked ground shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
a wall torch: black iron bracket and a wrapped wooden head with a lively ember-orange flame #ff9b4f with a pale yellow core; the flame fills the upper half of the cell and leaves transparent corners; 6 frames of flicker; transparent background, one grid cell (64x64 authored = 32 px on screen), pivot bottom-centre (32, 62); side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `tile-ladder` - Ladder

| | |
|---|---|
| Save as | `Assets/Sprites/Props/23-tile-ladder.png` |
| Spec | W6 prop - 64x64 cell, single frame, MUST tile vertically |
| On screen (1x) | 32 x 32 px |
| Cell (authored 2x) | 64x64; pivot (32, 62) |
| Priority | P0 |
| Used in | Ember Delve: placed where the Keeper stands; climbed with Up / Down |
| Shows today | shape drawn in code (terrain-render.ts) |

_Sits in a grid cell, so no baked ground shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
a wooden ladder section: two rootwood rails and three iron-banded rungs; rails run edge to edge top and bottom so stacked cells form one continuous ladder; transparent between the rails; transparent background, one grid cell (64x64 authored = 32 px on screen), pivot bottom-centre (32, 62); side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `tile-platform` - Platform

| | |
|---|---|
| Save as | `Assets/Sprites/Props/24-tile-platform.png` |
| Spec | W6 prop - 64x64 cell, single frame, MUST tile horizontally |
| On screen (1x) | 32 x 32 px |
| Cell (authored 2x) | 64x64; pivot (32, 62) |
| Priority | P0 |
| Used in | Ember Delve: one-way floor; hold Down to drop through |
| Shows today | shape drawn in code (terrain-render.ts) |

_Sits in a grid cell, so no baked ground shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
a thin one-way platform plank in the top quarter of the cell: dark rootwood plank with iron end-caps and two rivets, plank runs edge to edge left and right so neighbours join; everything below the plank is transparent; transparent background, one grid cell (64x64 authored = 32 px on screen), pivot bottom-centre (32, 62); side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `tile-chest` - Chest

| | |
|---|---|
| Save as | `Assets/Sprites/Props/25-tile-chest.png` + sidecar `Assets/Sprites/Props/25-tile-chest.json` |
| Spec | W6 prop - 64x64 cell, two 1-frame actions: `closed` row 0, `open` row 1 |
| On screen (1x) | 32 x 32 px |
| Cell (authored 2x) | 64x64; pivot (32, 62) |
| Priority | P0 |
| Used in | Ember Delve: holds 4 kinds of material; E or tap opens it |
| Shows today | shape drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `closed` | 1 | 0 | no | lid down, latch shut |
| 1 | `open` | 1 | 0 | no | lid up, a warm glow inside |

_Sits in a grid cell, so no baked ground shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
a small iron-banded rootwood chest with a brass latch; closed: lid down; open: lid thrown back and a warm gold glow #e8c47a rising from inside; identical footprint in both states; transparent background, one grid cell (64x64 authored = 32 px on screen), pivot bottom-centre (32, 62); side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `tile-camp` - Camp

| | |
|---|---|
| Save as | `Assets/Sprites/Props/26-tile-camp.png` + sidecar `Assets/Sprites/Props/26-tile-camp.json` |
| Spec | W6 prop loop - 64x64 cell, 6-frame `ambient` loop (fps 8) |
| On screen (1x) | 32 x 32 px |
| Cell (authored 2x) | 64x64; pivot (32, 62) |
| Priority | P0 |
| Used in | Ember Delve: one per Delve; E opens the Crafting Bench on Ready now; Descend to your camp from town |
| Shows today | shape drawn in code (terrain-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | firelight flicker; the small tent and bedroll stay still |

_Sits in a grid cell, so no baked ground shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
a tiny Keeper's camp: a small patched canvas lean-to over a bedroll, a ring of basalt stones with a low ember-orange fire in front, a cooking pot; reads as a safe place to craft; transparent background, one grid cell (64x64 authored = 32 px on screen), pivot bottom-centre (32, 62); side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```
