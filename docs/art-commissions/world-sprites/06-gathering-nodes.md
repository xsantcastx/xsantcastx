# Gathering nodes (world layer)

Sprite style guide, cell/pivot rules, the sidecar JSON schema and the scale table are in [../README.md](../README.md#world-layer--sprites). Image generators are poor at consistent multi-frame sheets: use the **design prompt** to fix the look (one key pose or a model sheet), then animate the frames from it by hand or in a sprite tool, keeping the cell grid and pivot exact.

One prop sheet per gatherable material, two states: `ready` (row 0) and `harvested` (row 1). Fifteen nodes cover the four tool families (`TOOL_OPENS` in `src/app/shared/skills/tools.ts`): pickaxe ores, axe trees, sickle herbs, staff crystals. Pickaxe I is the Cinder Ore seam that already exists as a station; the rest have no station yet and arrive with the engine host's gathering work. The material icons are already painted, so the node must match the icon's colours.


### `node-cinder-ore` - Cinder Ore outcrop

| | |
|---|---|
| Save as | `Assets/Sprites/Props/27-node-cinder-ore.png` + sidecar `Assets/Sprites/Props/27-node-cinder-ore.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P0 |
| Used in | Gathering node for `cinder-ore` (Pickaxe I, pickaxe); the material icon is already painted. `ready` shows while the node can be mined; `harvested` while it recovers |
| Shows today | a labelled station rectangle (only Cinder Ore has a resource station today) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `cinder-ore` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Cinder Ore outcrop: a squat outcrop of black basalt veined with glowing orange-red cinder ore, three chunky nodules breaking the surface; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `node-slag-fragment` - Slag outcrop

| | |
|---|---|
| Save as | `Assets/Sprites/Props/28-node-slag-fragment.png` + sidecar `Assets/Sprites/Props/28-node-slag-fragment.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P1 |
| Used in | Gathering node for `slag-fragment` (Pickaxe II, pickaxe); the material icon is already painted. `ready` shows while the node can be mined; `harvested` while it recovers |
| Shows today | not in the world yet |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `slag-fragment` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Slag outcrop: a basalt outcrop shot through with greenish-teal glassy slag shards, cool glints against dark stone; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `node-infernal-heartstone` - Heartstone outcrop

| | |
|---|---|
| Save as | `Assets/Sprites/Props/29-node-infernal-heartstone.png` + sidecar `Assets/Sprites/Props/29-node-infernal-heartstone.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P1 |
| Used in | Gathering node for `infernal-heartstone` (Pickaxe III, pickaxe); the material icon is already painted. `ready` shows while the node can be mined; `harvested` while it recovers |
| Shows today | not in the world yet |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `infernal-heartstone` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Heartstone outcrop: a crimson-black rock face holding a faceted rose-red heartstone cluster, one bright facet highlight; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `node-emberheart-ore` - Emberheart outcrop

| | |
|---|---|
| Save as | `Assets/Sprites/Props/30-node-emberheart-ore.png` + sidecar `Assets/Sprites/Props/30-node-emberheart-ore.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P2 |
| Used in | Gathering node for `emberheart-ore` (Pickaxe IV, pickaxe); the material icon is already painted. `ready` shows while the node can be mined; `harvested` while it recovers |
| Shows today | not in the world yet |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `emberheart-ore` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Emberheart outcrop: a tall dark outcrop split by a white-hot vein with an orange heart-glow at its core, rarest of the Infernal ores; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `node-world-root-bark` - World-Root sapling

| | |
|---|---|
| Save as | `Assets/Sprites/Props/31-node-world-root-bark.png` + sidecar `Assets/Sprites/Props/31-node-world-root-bark.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P1 |
| Used in | Gathering node for `world-root-bark` (Axe I, axe); the material icon is already painted. `ready` shows while the node can be felled; `harvested` while it recovers |
| Shows today | not in the world yet |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `world-root-bark` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
World-Root sapling: a young gnarled World-Root sapling with thick furrowed bark and a few amber leaves; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Verdant sprite palette: moss green, amber, rootwood brown, soft bioluminescent teal. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `node-verdant-sap` - Sap tree

| | |
|---|---|
| Save as | `Assets/Sprites/Props/32-node-verdant-sap.png` + sidecar `Assets/Sprites/Props/32-node-verdant-sap.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P2 |
| Used in | Gathering node for `verdant-sap` (Axe II, axe); the material icon is already painted. `ready` shows while the node can be felled; `harvested` while it recovers |
| Shows today | not in the world yet |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `verdant-sap` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Sap tree: a broad Verdant tree with a tapped trunk, amber sap beading down a bright wound, bioluminescent teal leaf edges; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Verdant sprite palette: moss green, amber, rootwood brown, soft bioluminescent teal. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `node-solar-resin` - Golden Oak

| | |
|---|---|
| Save as | `Assets/Sprites/Props/33-node-solar-resin.png` + sidecar `Assets/Sprites/Props/33-node-solar-resin.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P2 |
| Used in | Gathering node for `solar-resin` (Axe III, axe); the material icon is already painted. `ready` shows while the node can be felled; `harvested` while it recovers |
| Shows today | not in the world yet |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `solar-resin` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Golden Oak: a stout Golden Oak with warm gold bark and resin amber beads, ivory-white blossoms; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Luminous sprite palette: warm gold #E8D44D, ivory, dawn crystal, sunlit stone. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `node-shadowthread-silk` - Shadowbark tree

| | |
|---|---|
| Save as | `Assets/Sprites/Props/34-node-shadowthread-silk.png` + sidecar `Assets/Sprites/Props/34-node-shadowthread-silk.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P2 |
| Used in | Gathering node for `shadowthread-silk` (Axe IV, axe); the material icon is already painted. `ready` shows while the node can be felled; `harvested` while it recovers |
| Shows today | not in the world yet |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `shadowthread-silk` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Shadowbark tree: a tall black-violet Shadowbark tree wound with pale silver silk threads, moonlight on the bark; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Umbral sprite palette: amethyst #A855F7, black-violet, obsidian, moonlight. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `node-starlight-herb` - Starlight Herb patch

| | |
|---|---|
| Save as | `Assets/Sprites/Props/35-node-starlight-herb.png` + sidecar `Assets/Sprites/Props/35-node-starlight-herb.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P1 |
| Used in | Gathering node for `starlight-herb` (Sickle I, sickle); the material icon is already painted. `ready` shows while the node can be cut; `harvested` while it recovers |
| Shows today | not in the world yet |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `starlight-herb` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Starlight Herb patch: a low patch of silver-blue herb with star-shaped leaves and tiny cyan glints; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Celestial sprite palette: midnight blue, star silver, brass, cyan #00d4ff glints. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `node-sunbloom` - Sunbloom patch

| | |
|---|---|
| Save as | `Assets/Sprites/Props/36-node-sunbloom.png` + sidecar `Assets/Sprites/Props/36-node-sunbloom.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P2 |
| Used in | Gathering node for `sunbloom` (Sickle II, sickle); the material icon is already painted. `ready` shows while the node can be cut; `harvested` while it recovers |
| Shows today | not in the world yet |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `sunbloom` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Sunbloom patch: a patch of tall gold-and-ivory sunbloom flowers with dawn-crystal dew; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Luminous sprite palette: warm gold #E8D44D, ivory, dawn crystal, sunlit stone. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `node-nightbloom` - Nightbloom patch

| | |
|---|---|
| Save as | `Assets/Sprites/Props/37-node-nightbloom.png` + sidecar `Assets/Sprites/Props/37-node-nightbloom.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P2 |
| Used in | Gathering node for `nightbloom` (Sickle III, sickle); the material icon is already painted. `ready` shows while the node can be cut; `harvested` while it recovers |
| Shows today | not in the world yet |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `nightbloom` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Nightbloom patch: a patch of deep violet night-blooming flowers that open towards moonlight, faint amethyst glow; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Umbral sprite palette: amethyst #A855F7, black-violet, obsidian, moonlight. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `node-thornroot` - Thornroot patch

| | |
|---|---|
| Save as | `Assets/Sprites/Props/38-node-thornroot.png` + sidecar `Assets/Sprites/Props/38-node-thornroot.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P2 |
| Used in | Gathering node for `thornroot` (Sickle IV, sickle); the material icon is already painted. `ready` shows while the node can be cut; `harvested` while it recovers |
| Shows today | not in the world yet |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `thornroot` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Thornroot patch: a tangle of thorned amber roots rising from moss, wicked hooked thorns and a pale root-cream tip; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Verdant sprite palette: moss green, amber, rootwood brown, soft bioluminescent teal. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `node-luminous-prism` - Prism cluster

| | |
|---|---|
| Save as | `Assets/Sprites/Props/39-node-luminous-prism.png` + sidecar `Assets/Sprites/Props/39-node-luminous-prism.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P2 |
| Used in | Gathering node for `luminous-prism` (Staff II, staff); the material icon is already painted. `ready` shows while the node can be shattered; `harvested` while it recovers |
| Shows today | not in the world yet |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `luminous-prism` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Prism cluster: a cluster of clear dawn-crystal prisms in warm gold light, each facet throwing a tiny rainbow edge; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Luminous sprite palette: warm gold #E8D44D, ivory, dawn crystal, sunlit stone. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `node-celestial-quartz` - Quartz geode

| | |
|---|---|
| Save as | `Assets/Sprites/Props/40-node-celestial-quartz.png` + sidecar `Assets/Sprites/Props/40-node-celestial-quartz.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P2 |
| Used in | Gathering node for `celestial-quartz` (Staff III, staff); the material icon is already painted. `ready` shows while the node can be shattered; `harvested` while it recovers |
| Shows today | not in the world yet |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `celestial-quartz` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Quartz geode: a split midnight-blue geode ringed with silver and lined with pale cyan quartz points; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Celestial sprite palette: midnight blue, star silver, brass, cyan #00d4ff glints. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `node-void-crystal` - Void geode

| | |
|---|---|
| Save as | `Assets/Sprites/Props/41-node-void-crystal.png` + sidecar `Assets/Sprites/Props/41-node-void-crystal.json` |
| Spec | W6 prop, two 1-frame actions: `ready` row 0, `harvested` row 1 (same footprint and pivot) |
| On screen (1x) | about 130 x 120 px |
| Cell (authored 2x) | 256x256; pivot (128, 240) |
| Priority | P2 |
| Used in | Gathering node for `void-crystal` (Staff IV, staff); the material icon is already painted. `ready` shows while the node can be shattered; `harvested` while it recovers |
| Shows today | not in the world yet |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ready` | 1 | 0 | no | full, inviting, the material clearly visible |
| 1 | `harvested` | 1 | 0 | no | same footprint but stripped - stump, bare soil, dull cracked stone; a hint of regrowth, no glow |

_Material id `void-crystal` (TOOL_OPENS in skills/tools.ts). Props bake a soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Void geode: a black geode whose inside is a bruised violet crystal swirling like deep space, the rim cracked open; reads as a resource at a glance, the harvested state is the same outcrop stripped bare, identical base silhouette and pivot in both rows; side view. Umbral sprite palette: amethyst #A855F7, black-violet, obsidian, moonlight. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```
