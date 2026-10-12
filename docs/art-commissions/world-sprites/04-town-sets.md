# Town building and prop sets (world layer)

Sprite style guide, cell/pivot rules, the sidecar JSON schema and the scale table are in [../README.md](../README.md#world-layer--sprites). Image generators are poor at consistent multi-frame sheets: use the **design prompt** to fix the look (one key pose or a model sheet), then animate the frames from it by hand or in a sprite tool, keeping the cell grid and pivot exact.

Which building lives in which town follows `docs/roadmap/world-plan.md` ("Where each page lives"). Buildings and props **do** carry a baked soft contact shadow (an ellipse under the base, at most 35% opacity) because they never move; characters and creatures do not.

## Infernal town — Basalt Seamworks

### `infernal-campfire` — Campfire  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Props/01-infernal-campfire.png` + sidecar `Assets/Sprites/Props/01-infernal-campfire.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 60 px tall |
| Cell (authored 2x) | 128x128; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P0 |
| Used in | Infernal town: camp rest point |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a camp fire ring of basalt stones with crossed iron-black logs and a lively ember-orange flame; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-bench` — Bench  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Props/02-infernal-bench.png` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 50 x 120 px |
| Cell (authored 2x) | 256x128; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P0 |
| Used in | Infernal town: camp seating |
| Shows today | flat rectangles or nothing |

**Design prompt** (key pose / model sheet; animate from it)

```text
a low bench made of a riveted iron beam on two basalt blocks; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-crafting-bench` — Crafting Bench  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Props/03-infernal-crafting-bench.png` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 100 x 150 px |
| Cell (authored 2x) | 320x224; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P0 |
| Used in | Infernal town: Crafting Bench station (crafting panel) |
| Shows today | flat rectangles or nothing |

**Design prompt** (key pose / model sheet; animate from it)

```text
a sturdy crafting bench of dark rootwood and iron bands with a vice, small brass tools and a rune-etched mat; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-anvil` — Forge anvil  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Props/04-infernal-anvil.png` + sidecar `Assets/Sprites/Props/04-infernal-anvil.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 90 x 120 px |
| Cell (authored 2x) | 256x192; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P0 |
| Used in | Infernal town: Seamworks forge station (repair / Basalt Edge) |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a heavy basalt-and-iron anvil on a riveted stone block with a small furnace mouth glowing behind it, tongs and hammer on top; ambient loop = furnace glow pulse; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-waystone` — Waystone  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Props/05-infernal-waystone.png` + sidecar `Assets/Sprites/Props/05-infernal-waystone.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 220 px tall |
| Cell (authored 2x) | 192x448; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P0 |
| Used in | Infernal town: Waystone travel panel |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a standing waystone of ancient basalt masonry with a brass orbital ring circling it and five small realm sockets, the Infernal socket lit orange; ambient loop = ring turning, socket pulsing; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-rune-forge` — Rune Forge

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/01-infernal-rune-forge.png` + sidecar `Assets/Sprites/Buildings/01-infernal-rune-forge.json` |
| Spec | W5 building (single frame or ambient loop) |
| On screen (1x) | 420 px tall |
| Cell (authored 2x) | 768x864; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P1 |
| Used in | Infernal town: Rune Forge building (runes panel) |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
the Rune Forge: a squat domed forge-house of basalt and iron with a great round furnace door shaped like an eclipse ring, ember light pouring out, chimneys venting violet sparks; ambient loop = door glow; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-enchanting-table` — Enchanting Table

| | |
|---|---|
| Save as | `Assets/Sprites/Props/06-infernal-enchanting-table.png` + sidecar `Assets/Sprites/Props/06-infernal-enchanting-table.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 110 px tall |
| Cell (authored 2x) | 256x256; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P1 |
| Used in | Infernal town: Enchanting Table station |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
an enchanting table of carved obsidian with a floating lens and a hovering rune glyph above a basin of violet light; ambient loop = glyph bob; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-material-stall` — Material Vendor stall

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/02-infernal-material-stall.png` |
| Spec | W5 building (single frame or ambient loop) |
| On screen (1x) | 260 px tall |
| Cell (authored 2x) | 512x544; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P1 |
| Used in | Infernal town: Material Vendor |
| Shows today | flat rectangles or nothing |

**Design prompt** (key pose / model sheet; animate from it)

```text
a vendor stall with an iron frame and a scorched canvas awning, crates of cinder ore and ember residue, a hanging scale; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-ore-deposit` — Cinder Ore deposit

| | |
|---|---|
| Save as | `Assets/Sprites/Props/07-infernal-ore-deposit.png` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 92 x 116 px |
| Cell (authored 2x) | 256x192; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P1 |
| Used in | Infernal town: quest station: ore |
| Shows today | flat rectangles or nothing |

**Design prompt** (key pose / model sheet; animate from it)

```text
a knee-high outcrop of iron-black ore split by live orange seams; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-eclipse-beacon` — Eclipse beacon

| | |
|---|---|
| Save as | `Assets/Sprites/Props/08-infernal-eclipse-beacon.png` + sidecar `Assets/Sprites/Props/08-infernal-eclipse-beacon.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 240 px tall |
| Cell (authored 2x) | 160x480; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P1 |
| Used in | Infernal town: quest station: beacon |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a tall narrow beacon of carved obsidian on a four-point anchor base with an eclipse ring at the top holding a slow violet flame; ambient loop = flame; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-passage-arch` — Passage arch

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/03-infernal-passage-arch.png` |
| Spec | W5 building (single frame or ambient loop) |
| On screen (1x) | 300 px tall |
| Cell (authored 2x) | 448x608; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P1 |
| Used in | Infernal town: quest station: passage |
| Shows today | flat rectangles or nothing |

**Design prompt** (key pose / model sheet; animate from it)

```text
a free-standing iron-and-basalt archway leading onward, heavy rivets, ember sparks drifting through, the opening painted as dark depth; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-lantern-post` — Lantern post

| | |
|---|---|
| Save as | `Assets/Sprites/Props/09-infernal-lantern-post.png` + sidecar `Assets/Sprites/Props/09-infernal-lantern-post.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 180 px tall |
| Cell (authored 2x) | 96x384; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Infernal town: street dressing |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
an iron lantern post with a caged ember lamp; ambient loop = flicker; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

## Luminous town — Heliograph Court

### `luminous-market-hall` — Market hall

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/04-luminous-market-hall.png` |
| Spec | W5 building (single frame or ambient loop) |
| On screen (1x) | 440 px tall |
| Cell (authored 2x) | 832x896; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Luminous town: Market (upgrades) |
| Shows today | flat rectangles or nothing |

**Design prompt** (key pose / model sheet; animate from it)

```text
a sunlit-stone market hall with ivory columns, a gold-trimmed awning and dawn-prism windows; side view with a slight high angle, standing on the ground line. Luminous sprite palette: warm gold #E8D44D, ivory, pale crystal, sunlit stone. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `luminous-market-stall` — Market stall

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/05-luminous-market-stall.png` |
| Spec | W5 building (single frame or ambient loop) |
| On screen (1x) | 260 px tall |
| Cell (authored 2x) | 512x544; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Luminous town: Market shelves |
| Shows today | flat rectangles or nothing |

**Design prompt** (key pose / model sheet; animate from it)

```text
a merchant stall with an ivory awning on brass poles, a counter of pale stone with small scales and wrapped wares; side view with a slight high angle, standing on the ground line. Luminous sprite palette: warm gold #E8D44D, ivory, pale crystal, sunlit stone. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `luminous-waystone` — Waystone

| | |
|---|---|
| Save as | `Assets/Sprites/Props/10-luminous-waystone.png` + sidecar `Assets/Sprites/Props/10-luminous-waystone.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 220 px tall |
| Cell (authored 2x) | 192x448; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Luminous town: Waystone |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
the standing waystone in sunlit stone with the Luminous socket lit gold; side view with a slight high angle, standing on the ground line. Luminous sprite palette: warm gold #E8D44D, ivory, pale crystal, sunlit stone. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `luminous-lamp-post` — Prism lamp post

| | |
|---|---|
| Save as | `Assets/Sprites/Props/11-luminous-lamp-post.png` + sidecar `Assets/Sprites/Props/11-luminous-lamp-post.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 180 px tall |
| Cell (authored 2x) | 96x384; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Luminous town: street dressing |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a slender stone lamp post holding a dawn prism that glows warm gold; side view with a slight high angle, standing on the ground line. Luminous sprite palette: warm gold #E8D44D, ivory, pale crystal, sunlit stone. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `luminous-bench` — Bench

| | |
|---|---|
| Save as | `Assets/Sprites/Props/12-luminous-bench.png` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 50 x 120 px |
| Cell (authored 2x) | 256x128; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Luminous town: seating |
| Shows today | flat rectangles or nothing |

**Design prompt** (key pose / model sheet; animate from it)

```text
a pale stone bench with gold inlay; side view with a slight high angle, standing on the ground line. Luminous sprite palette: warm gold #E8D44D, ivory, pale crystal, sunlit stone. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

## Umbral town — Nocturne Archive

### `umbral-gamblers-den` — Gambler's den

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/06-umbral-gamblers-den.png` + sidecar `Assets/Sprites/Buildings/06-umbral-gamblers-den.json` |
| Spec | W5 building (single frame or ambient loop) |
| On screen (1x) | 400 px tall |
| Cell (authored 2x) | 768x832; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Umbral town: Gambler |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a narrow obsidian building with a violet-lit doorway, a hanging sign of a closed box (no letters); ambient = door glow; side view with a slight high angle, standing on the ground line. Umbral sprite palette: black-violet, amethyst #A855F7, obsidian, moonlight grey. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `umbral-gamblers-table` — Gambler's table

| | |
|---|---|
| Save as | `Assets/Sprites/Props/13-umbral-gamblers-table.png` + sidecar `Assets/Sprites/Props/13-umbral-gamblers-table.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 110 x 200 px |
| Cell (authored 2x) | 416x256; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Umbral town: Gambler altar |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a round obsidian gambling table with an inlaid violet-lit wheel and sealed mystery boxes; ambient = wheel shimmer; side view with a slight high angle, standing on the ground line. Umbral sprite palette: black-violet, amethyst #A855F7, obsidian, moonlight grey. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `umbral-exchange-house` — Exchange house

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/07-umbral-exchange-house.png` |
| Spec | W5 building (single frame or ambient loop) |
| On screen (1x) | 420 px tall |
| Cell (authored 2x) | 800x864; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Umbral town: Exchange |
| Shows today | flat rectangles or nothing |

**Design prompt** (key pose / model sheet; animate from it)

```text
an obsidian counting-house with moonlit windows, silver balance-scale emblem over the door; side view with a slight high angle, standing on the ground line. Umbral sprite palette: black-violet, amethyst #A855F7, obsidian, moonlight grey. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `umbral-waystone` — Waystone

| | |
|---|---|
| Save as | `Assets/Sprites/Props/14-umbral-waystone.png` + sidecar `Assets/Sprites/Props/14-umbral-waystone.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 220 px tall |
| Cell (authored 2x) | 192x448; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Umbral town: Waystone |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
the standing waystone in obsidian with the Umbral socket lit violet; side view with a slight high angle, standing on the ground line. Umbral sprite palette: black-violet, amethyst #A855F7, obsidian, moonlight grey. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `umbral-lantern` — Ink lantern post

| | |
|---|---|
| Save as | `Assets/Sprites/Props/15-umbral-lantern.png` + sidecar `Assets/Sprites/Props/15-umbral-lantern.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 180 px tall |
| Cell (authored 2x) | 96x384; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Umbral town: street dressing |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a black iron post with a shuttered lantern giving thin violet light; side view with a slight high angle, standing on the ground line. Umbral sprite palette: black-violet, amethyst #A855F7, obsidian, moonlight grey. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

## Celestial town — Meridian Orrery

### `celestial-observatory` — Observatory

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/08-celestial-observatory.png` + sidecar `Assets/Sprites/Buildings/08-celestial-observatory.json` |
| Spec | W5 building (single frame or ambient loop) |
| On screen (1x) | 480 px tall |
| Cell (authored 2x) | 640x992; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Celestial town: Codex (observatory) |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a slender observatory tower of midnight-blue stone with an open brass dome and orbital rings inside; ambient = rings turning; side view with a slight high angle, standing on the ground line. Celestial sprite palette: midnight blue, star silver, brass, cyan glints. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `celestial-leaderboard-obelisk` — Leaderboard obelisk

| | |
|---|---|
| Save as | `Assets/Sprites/Props/16-celestial-leaderboard-obelisk.png` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 240 px tall |
| Cell (authored 2x) | 224x480; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Celestial town: Leaderboards board |
| Shows today | flat rectangles or nothing |

**Design prompt** (key pose / model sheet; animate from it)

```text
a star-silver obelisk with brass rank bands and blank glowing plaques (no text); side view with a slight high angle, standing on the ground line. Celestial sprite palette: midnight blue, star silver, brass, cyan glints. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `celestial-waystone` — Waystone

| | |
|---|---|
| Save as | `Assets/Sprites/Props/17-celestial-waystone.png` + sidecar `Assets/Sprites/Props/17-celestial-waystone.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 220 px tall |
| Cell (authored 2x) | 192x448; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Celestial town: Waystone |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
the standing waystone in midnight stone and brass with the Celestial socket lit blue; side view with a slight high angle, standing on the ground line. Celestial sprite palette: midnight blue, star silver, brass, cyan glints. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `celestial-lamp-post` — Star lamp post

| | |
|---|---|
| Save as | `Assets/Sprites/Props/18-celestial-lamp-post.png` + sidecar `Assets/Sprites/Props/18-celestial-lamp-post.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 180 px tall |
| Cell (authored 2x) | 96x384; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Celestial town: street dressing |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a brass lamp post with a small orrery lamp of star-silver light; side view with a slight high angle, standing on the ground line. Celestial sprite palette: midnight blue, star silver, brass, cyan glints. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

## Verdant town — Rootglass Canopy

### `verdant-sanctum-gate` — Sanctum gate

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/09-verdant-sanctum-gate.png` + sidecar `Assets/Sprites/Buildings/09-verdant-sanctum-gate.json` |
| Spec | W5 building (single frame or ambient loop) |
| On screen (1x) | 440 px tall |
| Cell (authored 2x) | 768x896; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Verdant town: Sanctum (expeditions) |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
the Sanctum gate: a tall gate of living rootwood and gold-veined obsidian with closed doors bearing an eclipse seal, warm amber light at the threshold; side view with a slight high angle, standing on the ground line. Verdant sprite palette: moss green, rootwood brown, amber, soft green glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `verdant-quest-board` — Quest board

| | |
|---|---|
| Save as | `Assets/Sprites/Props/19-verdant-quest-board.png` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 200 px tall |
| Cell (authored 2x) | 320x416; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Verdant town: Quests |
| Shows today | flat rectangles or nothing |

**Design prompt** (key pose / model sheet; animate from it)

```text
a rootwood notice board under a small mossy roof with pinned parchment notices and wax seals, all writing only illegible marks; side view with a slight high angle, standing on the ground line. Verdant sprite palette: moss green, rootwood brown, amber, soft green glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `verdant-arena-gate` — Arena gate

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/10-verdant-arena-gate.png` |
| Spec | W5 building (single frame or ambient loop) |
| On screen (1x) | 400 px tall |
| Cell (authored 2x) | 768x832; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Verdant town: Arena |
| Shows today | flat rectangles or nothing |

**Design prompt** (key pose / model sheet; animate from it)

```text
a rootwood-and-crystal arch gate into an arena, crossed banners without emblems; side view with a slight high angle, standing on the ground line. Verdant sprite palette: moss green, rootwood brown, amber, soft green glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `verdant-trials-gate` — Trials gate

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/11-verdant-trials-gate.png` + sidecar `Assets/Sprites/Buildings/11-verdant-trials-gate.json` |
| Spec | W5 building (single frame or ambient loop) |
| On screen (1x) | 400 px tall |
| Cell (authored 2x) | 640x832; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Verdant town: Trials |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a narrow gate of thorn and dark crystal with a violet seam of light between its doors; side view with a slight high angle, standing on the ground line. Verdant sprite palette: moss green, rootwood brown, amber, soft green glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `verdant-waystone` — Waystone

| | |
|---|---|
| Save as | `Assets/Sprites/Props/20-verdant-waystone.png` + sidecar `Assets/Sprites/Props/20-verdant-waystone.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 220 px tall |
| Cell (authored 2x) | 192x448; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Verdant town: Waystone |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
the standing waystone wrapped in roots with the Verdant socket lit green; side view with a slight high angle, standing on the ground line. Verdant sprite palette: moss green, rootwood brown, amber, soft green glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `verdant-lantern` — Amber lantern

| | |
|---|---|
| Save as | `Assets/Sprites/Props/21-verdant-lantern.png` + sidecar `Assets/Sprites/Props/21-verdant-lantern.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 180 px tall |
| Cell (authored 2x) | 96x384; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P2 |
| Used in | Verdant town: street dressing |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a crooked rootwood post holding an amber bioluminescent pod; side view with a slight high angle, standing on the ground line. Verdant sprite palette: moss green, rootwood brown, amber, soft green glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```
