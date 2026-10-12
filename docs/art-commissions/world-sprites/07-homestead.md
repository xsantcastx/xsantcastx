# Homestead (world layer)

Sprite style guide, cell/pivot rules, the sidecar JSON schema and the scale table are in [../README.md](../README.md#world-layer--sprites). Image generators are poor at consistent multi-frame sheets: use the **design prompt** to fix the look (one key pose or a model sheet), then animate the frames from it by hand or in a sprite tool, keeping the cell grid and pivot exact.

Everything on the Homestead plot is drawn in code today (`src/app/play/engine/homestead-render.ts`; `frame.art(key, ...)` is the swap-in point). Your Anvil and Your Enchanting Circle each have four tiers that the engine scales and lights by tier, so the art for tier N must read as the same object one rung grander.


### `hs-anvil-1` - Your Anvil, tier I

| | |
|---|---|
| Save as | `Assets/Sprites/Props/42-hs-anvil-1.png` + sidecar `Assets/Sprites/Props/42-hs-anvil-1.json` |
| Spec | W6 prop loop - 6-frame `ambient` (fps 8); sparks and glow animate, the anvil body stays still |
| On screen (1x) | x1.0 of tier I (tier I is 160 x 128 px) |
| Cell (authored 2x) | 320x256; pivot bottom-centre of the plinth |
| Priority | P0 |
| Used in | Homestead plot station `hs-anvil` (x 2400): HOME_FORGE_CONFIG tier 1 (price free Gold); opens the Crafting Bench with the anvil mini-game |
| Shows today | anvil drawn in code (homestead-render.ts, anvilLook(tier) scales 1.0 to 1.42) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | sparks / glow loop; frame 1 = still |

_Draw tier I first and grow it; the engine adds the gold I-IV plaque._

**Design prompt** (key pose / model sheet; animate from it)

```text
Your Anvil, tier 1: a plain black-iron anvil on a squat basalt block, a hammer resting on the face, cold; tiers I-IV share one design language and read as the same anvil growing; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `hs-anvil-2` - Your Anvil, tier II

| | |
|---|---|
| Save as | `Assets/Sprites/Props/43-hs-anvil-2.png` + sidecar `Assets/Sprites/Props/43-hs-anvil-2.json` |
| Spec | W6 prop loop - 6-frame `ambient` (fps 8); sparks and glow animate, the anvil body stays still |
| On screen (1x) | x1.15 of tier I (tier I is 160 x 128 px) |
| Cell (authored 2x) | 384x320; pivot bottom-centre of the plinth |
| Priority | P1 |
| Used in | Homestead plot station `hs-anvil` (x 2400): HOME_FORGE_CONFIG tier 2 (price 750K Gold); opens the Crafting Bench with the anvil mini-game |
| Shows today | anvil drawn in code (homestead-render.ts, anvilLook(tier) scales 1.0 to 1.42) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | sparks / glow loop; frame 1 = still |

**Design prompt** (key pose / model sheet; animate from it)

```text
Your Anvil, tier 2: a sturdier anvil on a bigger basalt block, ember-orange glow along the hot face, a rack of tongs; tiers I-IV share one design language and read as the same anvil growing; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `hs-anvil-3` - Your Anvil, tier III

| | |
|---|---|
| Save as | `Assets/Sprites/Props/44-hs-anvil-3.png` + sidecar `Assets/Sprites/Props/44-hs-anvil-3.json` |
| Spec | W6 prop loop - 6-frame `ambient` (fps 8); sparks and glow animate, the anvil body stays still |
| On screen (1x) | x1.3 of tier I (tier I is 160 x 128 px) |
| Cell (authored 2x) | 384x320; pivot bottom-centre of the plinth |
| Priority | P1 |
| Used in | Homestead plot station `hs-anvil` (x 2400): HOME_FORGE_CONFIG tier 3 (price 6M Gold); opens the Crafting Bench with the anvil mini-game |
| Shows today | anvil drawn in code (homestead-render.ts, anvilLook(tier) scales 1.0 to 1.42) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | sparks / glow loop; frame 1 = still |

**Design prompt** (key pose / model sheet; animate from it)

```text
Your Anvil, tier 3: a large anvil with a glowing white-orange face, a second small horn, three drifting sparks, brass bands on the block; tiers I-IV share one design language and read as the same anvil growing; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `hs-anvil-4` - Your Anvil, tier IV

| | |
|---|---|
| Save as | `Assets/Sprites/Props/45-hs-anvil-4.png` + sidecar `Assets/Sprites/Props/45-hs-anvil-4.json` |
| Spec | W6 prop loop - 6-frame `ambient` (fps 8); sparks and glow animate, the anvil body stays still |
| On screen (1x) | x1.42 of tier I (tier I is 160 x 128 px) |
| Cell (authored 2x) | 384x320; pivot bottom-centre of the plinth |
| Priority | P1 |
| Used in | Homestead plot station `hs-anvil` (x 2400): HOME_FORGE_CONFIG tier 4 (price 250M Gold); opens the Crafting Bench with the anvil mini-game |
| Shows today | anvil drawn in code (homestead-render.ts, anvilLook(tier) scales 1.0 to 1.42) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | sparks / glow loop; frame 1 = still |

**Design prompt** (key pose / model sheet; animate from it)

```text
Your Anvil, tier 4: a grand anvil on a carved obsidian-and-gold plinth, a white-hot face, a ring of orbiting sparks and a faint violet eclipse shimmer #a855f7; tiers I-IV share one design language and read as the same anvil growing; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `hs-circle-1` - Your Enchanting Circle, tier I

| | |
|---|---|
| Save as | `Assets/Sprites/Props/46-hs-circle-1.png` + sidecar `Assets/Sprites/Props/46-hs-circle-1.json` |
| Spec | W6 prop loop - 6-frame `ambient` (fps 6); runes pulse, the floor ring stays still |
| On screen (1x) | 224 x 128 px |
| Cell (authored 2x) | 448x256; pivot bottom-centre of the ring |
| Priority | P0 |
| Used in | Homestead plot station `hs-circle` (x 2700): HOME_FORGE_CONFIG tier 1 (free); opens the Enchanting Table with the rune ritual |
| Shows today | ring and runes drawn in code (circleLook(tier) lights 4/6/8/10 runes) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 6 | yes | rune pulse loop; frame 1 = still |

**Design prompt** (key pose / model sheet; animate from it)

```text
Your Enchanting Circle, tier 1: a floor ring of pale stone with ten standing rune-stones around it, only four faintly lit in violet, the centre empty; the lit-rune count must be exactly 4, 6, 8, 10 for tiers I-IV; viewed from a slight high angle so the ring reads as an ellipse; side view. Umbral sprite palette: amethyst #A855F7, black-violet, obsidian, moonlight. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `hs-circle-2` - Your Enchanting Circle, tier II

| | |
|---|---|
| Save as | `Assets/Sprites/Props/47-hs-circle-2.png` + sidecar `Assets/Sprites/Props/47-hs-circle-2.json` |
| Spec | W6 prop loop - 6-frame `ambient` (fps 6); runes pulse, the floor ring stays still |
| On screen (1x) | 224 x 128 px |
| Cell (authored 2x) | 448x256; pivot bottom-centre of the ring |
| Priority | P1 |
| Used in | Homestead plot station `hs-circle` (x 2700): HOME_FORGE_CONFIG tier 2 (750K Gold); opens the Enchanting Table with the rune ritual |
| Shows today | ring and runes drawn in code (circleLook(tier) lights 4/6/8/10 runes) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 6 | yes | rune pulse loop; frame 1 = still |

**Design prompt** (key pose / model sheet; animate from it)

```text
Your Enchanting Circle, tier 2: the same ring with six rune-stones lit in brighter violet, a thin gold socket ring inlaid in the floor; the lit-rune count must be exactly 4, 6, 8, 10 for tiers I-IV; viewed from a slight high angle so the ring reads as an ellipse; side view. Umbral sprite palette: amethyst #A855F7, black-violet, obsidian, moonlight. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `hs-circle-3` - Your Enchanting Circle, tier III

| | |
|---|---|
| Save as | `Assets/Sprites/Props/48-hs-circle-3.png` + sidecar `Assets/Sprites/Props/48-hs-circle-3.json` |
| Spec | W6 prop loop - 6-frame `ambient` (fps 6); runes pulse, the floor ring stays still |
| On screen (1x) | 224 x 128 px |
| Cell (authored 2x) | 448x256; pivot bottom-centre of the ring |
| Priority | P1 |
| Used in | Homestead plot station `hs-circle` (x 2700): HOME_FORGE_CONFIG tier 3 (6M Gold); opens the Enchanting Table with the rune ritual |
| Shows today | ring and runes drawn in code (circleLook(tier) lights 4/6/8/10 runes) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 6 | yes | rune pulse loop; frame 1 = still |

**Design prompt** (key pose / model sheet; animate from it)

```text
Your Enchanting Circle, tier 3: the ring with eight rune-stones brightly lit, a thicker gold socket ring, one rune hovering above the centre; the lit-rune count must be exactly 4, 6, 8, 10 for tiers I-IV; viewed from a slight high angle so the ring reads as an ellipse; side view. Umbral sprite palette: amethyst #A855F7, black-violet, obsidian, moonlight. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `hs-circle-4` - Your Enchanting Circle, tier IV

| | |
|---|---|
| Save as | `Assets/Sprites/Props/49-hs-circle-4.png` + sidecar `Assets/Sprites/Props/49-hs-circle-4.json` |
| Spec | W6 prop loop - 6-frame `ambient` (fps 6); runes pulse, the floor ring stays still |
| On screen (1x) | 224 x 128 px |
| Cell (authored 2x) | 448x256; pivot bottom-centre of the ring |
| Priority | P1 |
| Used in | Homestead plot station `hs-circle` (x 2700): HOME_FORGE_CONFIG tier 4 (250M Gold); opens the Enchanting Table with the rune ritual |
| Shows today | ring and runes drawn in code (circleLook(tier) lights 4/6/8/10 runes) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 6 | yes | rune pulse loop; frame 1 = still |

**Design prompt** (key pose / model sheet; animate from it)

```text
Your Enchanting Circle, tier 4: the ring with all ten rune-stones blazing violet #a855f7, a broad gold socket ring, a rune orbiting above the centre and a soft violet bloom; the lit-rune count must be exactly 4, 6, 8, 10 for tiers I-IV; viewed from a slight high angle so the ring reads as an ellipse; side view. Umbral sprite palette: amethyst #A855F7, black-violet, obsidian, moonlight. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `homestead-forge` - The Forge (homestead click target)

| | |
|---|---|
| Save as | `Assets/Sprites/Props/50-homestead-forge.png` + sidecar `Assets/Sprites/Props/50-homestead-forge.json` |
| Spec | W6 prop, two actions: `idle` 4 frames (fps 6, loop) and `strike` 4 frames (fps 14, no loop) |
| On screen (1x) | 192 x 160 px |
| Cell (authored 2x) | 384x320; pivot bottom-centre of the base |
| Priority | P1 |
| Used in | Homestead: the clickable Forge in the middle of the plot; each click is a strike (squash, sparks, +N) |
| Shows today | violet forge flame image plus code squash |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | low violet flame breathing |
| 1 | `strike` | 4 | 14 | no | hammer-blow squash and spark burst; frame 2 = contact |

_The violet flame ties to the Godforge energy colour._

**Design prompt** (key pose / model sheet; animate from it)

```text
a squat Godforge-fed anvil-furnace: black iron body with riveted bands, an open mouth with a violet eclipse flame #a855f7 and ember-orange rim light, a hammer-head crest on top; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `homestead-workshop-hammer` - Thrall Workshop hammer

| | |
|---|---|
| Save as | `Assets/Sprites/Props/51-homestead-workshop-hammer.png` + sidecar `Assets/Sprites/Props/51-homestead-workshop-hammer.json` |
| Spec | W6 prop, single frame, pivot at the haft end (the engine rotates it by cycleAt(lastRollAt, rollInterval)) |
| On screen (1x) | 48 x 96 px |
| Cell (authored 2x) | 96x192; pivot (48, 176) the end of the haft |
| Priority | P2 |
| Used in | Homestead Thrall Workshop: the hammer swung by the roll timer |
| Shows today | a rectangle rotated in code |

**Design prompt** (key pose / model sheet; animate from it)

```text
a heavy smith's hammer pointing straight up, iron head with ember seams, wrapped leather haft, grip at the bottom; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `homestead-gate` - YOUR HOMESTEAD gate

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/12-homestead-gate.png` |
| Spec | W5 building - single frame, OPAQUE body, baked contact shadow (<= 35%) |
| On screen (1x) | 416 x 480 px |
| Cell (authored 2x) | 832x960; pivot bottom-centre (default) |
| Priority | P1 |
| Used in | Infernal town, x 1075: the arch into the Homestead plot |
| Shows today | shape drawn in code (homestead-render.ts) |

_Buildings carry a baked soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
YOUR HOMESTEAD gate: an iron-and-basalt arch gate with a banner post, a lit brazier on each pillar and a plain dark lintel (no lettering), warm welcoming light; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `homestead-treasury` - Treasury

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/13-homestead-treasury.png` |
| Spec | W5 building - single frame, OPAQUE body, baked contact shadow (<= 35%) |
| On screen (1x) | 320 x 416 px |
| Cell (authored 2x) | 640x832; pivot bottom-centre (default) |
| Priority | P1 |
| Used in | Homestead: holds Gold; coins arc into it on every strike |
| Shows today | shape drawn in code (homestead-render.ts) |

_Buildings carry a baked soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Treasury: a squat stone vault with a heavy round door, gold coin piles visible through a barred window, a small brass scale on the roof; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `homestead-furnace` - Furnace

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/14-homestead-furnace.png` |
| Spec | W5 building - single frame, OPAQUE body, baked contact shadow (<= 35%) |
| On screen (1x) | 320 x 416 px |
| Cell (authored 2x) | 640x832; pivot bottom-centre (default) |
| Priority | P1 |
| Used in | Homestead: scales with forge rungs (furnaceScale) |
| Shows today | shape drawn in code (homestead-render.ts) |

_Buildings carry a baked soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Furnace: a great brick furnace with a tall chimney, glowing mouth and an anvil-shaped weathervane; ember orange glow; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `homestead-explorer-camp` - Explorer Camp

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/15-homestead-explorer-camp.png` |
| Spec | W5 building - single frame, OPAQUE body, baked contact shadow (<= 35%) |
| On screen (1x) | 416 x 320 px |
| Cell (authored 2x) | 832x640; pivot bottom-centre (default) |
| Priority | P1 |
| Used in | Homestead: one tent per explorer slot; explorers walk out and back |
| Shows today | shape drawn in code (homestead-render.ts) |

_Buildings carry a baked soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Explorer Camp: a cluster of three patched canvas tents around a cold fire pit, a map table, gear crates and a lantern pole; the engine repeats the tent per slot; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `homestead-thrall-workshop` - Thrall Workshop

| | |
|---|---|
| Save as | `Assets/Sprites/Buildings/16-homestead-thrall-workshop.png` |
| Spec | W5 building - single frame, OPAQUE body, baked contact shadow (<= 35%) |
| On screen (1x) | 416 x 352 px |
| Cell (authored 2x) | 832x704; pivot bottom-centre (default) |
| Priority | P1 |
| Used in | Homestead: Forge Thralls hammer here |
| Shows today | shape drawn in code (homestead-render.ts) |

_Buildings carry a baked soft contact shadow._

**Design prompt** (key pose / model sheet; animate from it)

```text
Thrall Workshop: an open-fronted smithy with a low workbench, a rack of tools and a stone hearth; no hammer drawn (it is a separate sprite); side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `automaton-apprentice-striker` - Apprentice Striker

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/10-automaton-apprentice-striker.png` + sidecar `Assets/Sprites/NPCs/10-automaton-apprentice-striker.json` |
| Spec | W3 NPC sheet (actions `idle`, `strike`) |
| On screen (1x) | 150-170 px tall |
| Cell (authored 2x) | 320x384; pivot (160, 368) |
| Priority | P1 |
| Used in | Homestead: one figure per owned level of the Apprentice Striker rung; strikes the Forge on beat (clicksPerSecond) |
| Shows today | figure drawn in code (homestead-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 6 | yes | ready stance, small fidget |
| 1 | `strike` | 4 | 12 | yes | hammer blow loop; frame 2 = contact |

_The painted Market master already exists; keep identical colours and silhouette._

**Design prompt** (key pose / model sheet; animate from it)

```text
Apprentice Striker as a world sprite: a hunched apprentice automaton of riveted brass and black iron with one oversized hammer-arm and a lantern eye, eager and a little clumsy; match the painted Market master Market/Items/Automatons/apprentice-striker.png in design; three-quarter side view facing right; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `automaton-forge-golem` - Forge Golem

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/11-automaton-forge-golem.png` + sidecar `Assets/Sprites/NPCs/11-automaton-forge-golem.json` |
| Spec | W3 NPC sheet (actions `idle`, `strike`) |
| On screen (1x) | 150-170 px tall |
| Cell (authored 2x) | 320x384; pivot (160, 368) |
| Priority | P1 |
| Used in | Homestead: one figure per owned level of the Forge Golem rung; strikes the Forge on beat (clicksPerSecond) |
| Shows today | figure drawn in code (homestead-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 6 | yes | ready stance, small fidget |
| 1 | `strike` | 4 | 12 | yes | hammer blow loop; frame 2 = contact |

_The painted Market master already exists; keep identical colours and silhouette._

**Design prompt** (key pose / model sheet; animate from it)

```text
Forge Golem as a world sprite: a hulking forge golem of basalt plates and iron bands, furnace window in its chest, slow powerful hammer-fist; match the painted Market master Market/Items/Automatons/forge-golem.png in design; three-quarter side view facing right; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `automaton-eclipse-automaton` - Eclipse Automaton

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/12-automaton-eclipse-automaton.png` + sidecar `Assets/Sprites/NPCs/12-automaton-eclipse-automaton.json` |
| Spec | W3 NPC sheet (actions `idle`, `strike`) |
| On screen (1x) | 150-170 px tall |
| Cell (authored 2x) | 320x384; pivot (160, 368) |
| Priority | P1 |
| Used in | Homestead: one figure per owned level of the Eclipse Automaton rung; strikes the Forge on beat (clicksPerSecond) |
| Shows today | figure drawn in code (homestead-render.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 6 | yes | ready stance, small fidget |
| 1 | `strike` | 4 | 12 | yes | hammer blow loop; frame 2 = contact |

_The painted Market master already exists; keep identical colours and silhouette._

**Design prompt** (key pose / model sheet; animate from it)

```text
Eclipse Automaton as a world sprite: a tall precise automaton of obsidian and gold with a violet eclipse disc for a face, twin hammer-limbs moving in sync; match the painted Market master Market/Items/Automatons/eclipse-automaton.png in design; three-quarter side view facing right; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```
