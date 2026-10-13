# Tools, Delve kit and Delve quest items (I1 pixel icons)

Pixel scale, palettes and the export rules are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Paste **Prompt** as the positive prompt and **Negative** as the negative prompt, then clean the result on the art-pixel grid (style guide §14). The spec line is the export contract.

Library numbering continues the existing Art Bible (tools 124-139 in `Items/ArtBible/Tools/`, after unique 123). Delve materials continue `Items/Materials/` at 14, Kael's Hammer is `Items/Quest/05`, the Seam Eater master is `Creatures/Masters/11` (it stays a painting). The Fracture rune (`fracture`, `Items/Runes/14-fracture`) and the Codex Solarii (`codex-solarii`, `Items/Artifacts/32-codex-solarii`) are **already painted and in the manifest**; they are re-iconed in the later re-icon wave, not here.

### `pickaxe-1` — Pickaxe I  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/124-pickaxe-1-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the iron-hammer painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Pickaxe I, a Keeper-forged soulbound off-hand tool, tier 1 of 4: a plain black-iron pickaxe, a worn ash-wood haft and a single-spike head, workmanlike; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `pickaxe-2` — Pickaxe II

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/125-pickaxe-2-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the obsidian-mallet painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Pickaxe II, a Keeper-forged soulbound off-hand tool, tier 2 of 4: a darker pickaxe with an obsidian-edged head and a bound haft, a faint ember seam; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `pickaxe-3` — Pickaxe III

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/126-pickaxe-3-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the nox-crusher painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Pickaxe III, a Keeper-forged soulbound off-hand tool, tier 3 of 4: a pickaxe with a heartstone-red glowing inlay along the head and a gold-banded haft; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `pickaxe-4` — Pickaxe IV

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/127-pickaxe-4-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the eclipse-hammer painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Pickaxe IV, a Keeper-forged soulbound off-hand tool, tier 4 of 4: an eclipse pickaxe: a black head with a violet eclipse disc inlaid and orbiting sparks, gold filigree haft; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `axe-1` — Axe I

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/128-axe-1-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the rootbreaker-mace painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Axe I, a Keeper-forged soulbound off-hand tool, tier 1 of 4: a plain woodsman's axe, rootwood haft and an iron head with a leaf-shaped bit; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `axe-2` — Axe II

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/129-axe-2-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the radiant-halberd painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Axe II, a Keeper-forged soulbound off-hand tool, tier 2 of 4: a heavier axe with a green-bronze head and amber-wrapped haft; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `axe-3` — Axe III

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/130-axe-3-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the astral-glaive painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Axe III, a Keeper-forged soulbound off-hand tool, tier 3 of 4: an axe with a gold-trimmed head and a glowing sap-amber inlay; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `axe-4` — Axe IV

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/131-axe-4-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the starfall-maul painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Axe IV, a Keeper-forged soulbound off-hand tool, tier 4 of 4: a black-violet axe with a pale silver edge and a thread of moonlit silk bound around the haft; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `sickle-1` — Sickle I

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/132-sickle-1-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the briarvein-kris painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Sickle I, a Keeper-forged soulbound off-hand tool, tier 1 of 4: a plain iron sickle with a curved blade and a pale wood handle; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `sickle-2` — Sickle II

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/133-sickle-2-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the ashveil-throwing-knives painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Sickle II, a Keeper-forged soulbound off-hand tool, tier 2 of 4: a sickle with a silver-blue blade and a leaf-carved grip; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `sickle-3` — Sickle III

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/134-sickle-3-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the hollow-fang painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Sickle III, a Keeper-forged soulbound off-hand tool, tier 3 of 4: a sickle whose blade glows faintly violet like a night bloom, dark handle bound in silk; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `sickle-4` — Sickle IV

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/135-sickle-4-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the cindergnaw painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Sickle IV, a Keeper-forged soulbound off-hand tool, tier 4 of 4: a thorned amber sickle: a hooked blade with a thorn-ridge spine and a rootwood handle, faint teal glow; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `staff-1` — Staff I

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/136-staff-1-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the keeper-staff painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Staff I, a Keeper-forged soulbound off-hand tool, tier 1 of 4: a plain Keeper's staff of pale wood with a simple iron cap and a small clear crystal; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `staff-2` — Staff II

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/137-staff-2-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the keeper-staff painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Staff II, a Keeper-forged soulbound off-hand tool, tier 2 of 4: a staff with a silver cap and a prism of warm gold light in its head; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `staff-3` — Staff III

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/138-staff-3-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the nullthorn-staff painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Staff III, a Keeper-forged soulbound off-hand tool, tier 3 of 4: a staff topped with a cyan quartz geode held in silver prongs; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `staff-4` — Staff IV

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Tools/139-staff-4-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, off-hand slot, Skills panel tool row, crafting recipe (Smithing gates 1/10/25/45) |
| Shows today | stand-in via ART_ALIAS: the pyreclast-wand painting |

_Tools carry no rarity, so their slot shows no rarity rim; the four tiers escalate by material and by one accent colour, not by a glow. Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Staff IV, a Keeper-forged soulbound off-hand tool, tier 4 of 4: a staff topped with a swirling violet void crystal in a brass-and-obsidian crown; the four tiers of this tool share one silhouette family and clearly escalate in finish and glow. Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `torch` — Torch  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Items/Materials/19-torch.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | Delve kit craft (x3: 1 Cinder Ore + 1 World-Root Bark); Delve hotbar slot, bag, Crafting Bench |
| Shows today | stand-in via ART_ALIAS: the ember-stoker painting |

_Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Torch, a Delve kit item: a wrapped wooden torch with an iron collar and a bright ember-orange flame; simple and readable at 64 px. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `ladder` — Ladder

| | |
|---|---|
| Save as | `Assets/Items/Materials/20-ladder.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | Delve kit craft (x4: 2 World-Root Bark); Delve hotbar slot, bag, Crafting Bench |
| Shows today | stand-in via ART_ALIAS: the world-root-bark painting |

_Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Ladder, a Delve kit item: a short rootwood ladder section with three iron-banded rungs, laid on the diagonal; simple and readable at 64 px. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `platform` — Platform

| | |
|---|---|
| Save as | `Assets/Items/Materials/21-platform.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | Delve kit craft (x4: World-Root Bark + Thornroot); Delve hotbar slot, bag, Crafting Bench |
| Shows today | stand-in via ART_ALIAS: the rootwall-shield painting |

_Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Platform, a Delve kit item: a flat rootwood plank with iron end-caps and rivets, laid on the diagonal; simple and readable at 64 px. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `chest` — Chest

| | |
|---|---|
| Save as | `Assets/Items/Materials/22-chest.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | Delve kit craft (4 World-Root Bark + 2 Cinder Ore); Delve hotbar slot, bag, Crafting Bench |
| Shows today | stand-in via ART_ALIAS: the quest-items painting |

_Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Chest, a Delve kit item: a small iron-banded rootwood chest with a brass latch, lid closed, a faint warm glow at the seam; simple and readable at 64 px. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `camp` — Camp

| | |
|---|---|
| Save as | `Assets/Items/Materials/23-camp.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | Delve kit craft (6 World-Root Bark + 4 Cinder Ore + 1 Ember Residue); Delve hotbar slot, bag, Crafting Bench |
| Shows today | stand-in via ART_ALIAS: the forge painting |

_Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Camp, a Delve kit item: a rolled canvas lean-to bundled with a bedroll, a cooking pot and a coil of rope, a spark of ember on top; simple and readable at 64 px. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `dirt-block` — Dirt Block  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Items/Materials/17-dirt-block.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | dropped by digging dirt or loam; Delve hotbar slot, bag, Crafting Bench |
| Shows today | stand-in via ART_ALIAS: the relic-dust painting |

_Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Dirt Block, a Delve kit item: a neat square block of tamped brown earth with a few pebbles and root threads; simple and readable at 64 px. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `basalt-block` — Basalt Block

| | |
|---|---|
| Save as | `Assets/Items/Materials/18-basalt-block.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | dropped by digging basalt, hard basalt, grotto stone or scorched basalt; Delve hotbar slot, bag, Crafting Bench |
| Shows today | stand-in via ART_ALIAS: the godforge-slag painting |

_Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Basalt Block, a Delve kit item: a squared block of dark violet-grey basalt with chiselled edges; simple and readable at 64 px. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `shadow-root-cutting` — Shadow-Root Cutting

| | |
|---|---|
| Save as | `Assets/Items/Materials/14-shadow-root-cutting.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | Delve material (Root Hollows shadow-root, sickle); Verrin's mission delve-verrin-shadow; unlocks the Nullthorn Staff recipe; bag, Skills panel, Codex Collection, mission UI |
| Shows today | stand-in via ART_ALIAS: the thornroot painting |

_Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Shadow-Root Cutting: a cut length of shadow-root: a violet-black root with a fresh pale cut end, a tiny curved thorn and a faint amethyst gleam along its length. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `glowcap` — Glowcap  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Items/Materials/15-glowcap.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | Delve material (Glowcap Grotto, sickle); the Merchant's repeatable order delve-merchant-glowcaps; bag, Skills panel, Codex Collection, mission UI |
| Shows today | stand-in via ART_ALIAS: the nightbloom painting |

_Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Glowcap: a cluster of three bioluminescent mushroom caps, pale cyan fading to deep blue, dark stems, a soft cool glow. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `godforge-fragment` — Godforge Fragment

| | |
|---|---|
| Save as | `Assets/Items/Materials/16-godforge-fragment.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | Delve quest material (Magma Halls, once per player); Kael and Archivist mission delve-fracture, which rewards the Fracture rune; bag, Skills panel, Codex Collection, mission UI |
| Shows today | stand-in via ART_ALIAS: the godstone painting |

_Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Godforge Fragment: a jagged shard of the Godforge: warm white-gold faceted crystal with a bright core and thin violet fracture lines, warm on one face, a faint hum made visible as a slow halo. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `kaels-hammer` — Kael's Hammer  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Items/Quest/05-kaels-hammer.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | Mission delve-kael-seam (Kael); found in Kael's cache in the Basalt Caverns; bag, mission UI |
| Shows today | stand-in via ART_ALIAS: the iron-hammer painting |

_Quest stack key with no ItemDefinition. Match Kael's portrait (npc-kael) in metal and ember colour. Delete the ART_ALIAS row when it lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Kael's Hammer, an old smith's hammer left behind in the Delve: a heavy cracked-iron head with ember light in the cracks, a leather-wrapped haft worn smooth by one hand, a hammer-mark on the head (a shape, not letters), a scorched leather loop at the base. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `seam-eater` — Seam Eater

| | |
|---|---|
| Save as | `Assets/Creatures/Masters/11-seam-eater.png` |
| Spec | S3 figure - 1254x1254 PNG, transparent background, full body, OPAQUE figure (stays a painting: style guide §1) |
| Priority | P1 |
| Used in | Codex > Bestiary card (appears automatically once imported); the model the world sprite is drawn from |
| Shows today | not shown; counted in the sighted-and-not-yet-drawn total |

_Codex splash painting (style guide §1). The pixel sprite `seam-eater` (`world-sprites/08-delve-creatures.md`) is the gameplay read; the two share silhouette and colour blocks, and whichever is made first is the model for the other._

**Prompt** (painting)

```text
Seam Eater: a colossal serpentine mass of cooled slag, broken iron braces and snapped rivets coiled up from the floor, molten interior channels glowing through the cracks between its slag plates, a blunt eyeless head split by one glowing seam; it rises from the deepest failed repairs and unthreads the Seamworks' platforms; the one guardian that falls once and never rises again. Infernal palette: ember red, iron black, furnace orange seams (#E8752A, #ff9b4f), basalt (#3a2b2c). full-body figure in three-quarter view facing right, feet near the bottom edge, isolated on a fully transparent background, solid opaque body. Codex splash art: silhouette and colour blocks match the pixel-art world sprite of this creature when one exists; dark fantasy painterly digital illustration, ornate and highly detailed, deep charcoal and obsidian base tones, aged gold and brass filigree, restrained violet eclipse energy as the shared accent, key light from the upper left, crisp rim light, Eclipse Realms house style.
```

**Negative**

```text
text, letters, runes as writing, watermark, signature, logo, UI, frame, border, card, vignette, background scene, floor, cast shadow, drop shadow, multiple subjects, cropped subject, blurry, lowres, jpeg artifacts, photo, photorealistic, glossy 3D plastic render, cartoon, anime, chibi, cute mascot, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography
```

## Delve extras: supports and blasting charges (added 2026-10-13)

The Delve-extras merge added three craftable placeables that borrow other paintings today. Same I1 spec as the kit above; numbering continues `Items/Materials/` at 24.

### `timber-support` — Timber Support

| | |
|---|---|
| Save as | `Assets/Items/Materials/24-timber-support.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P1 |
| Used in | Delve kit craft (x2: 3 World-Root Bark + 1 Thornroot, Smithing 5); Delve hotbar slot, bag, Crafting Bench, chests |
| Shows today | stand-in via ART_ALIAS: the world-root-bark painting |

_Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Timber Support, a Delve kit item: a mine prop of two rough rootwood posts lashed with iron bands under a short cap beam, laid on the diagonal; reads as shoring that holds a ceiling up; simple and readable at 64 px. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `basalt-support` — Basalt Support

| | |
|---|---|
| Save as | `Assets/Items/Materials/25-basalt-support.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P1 |
| Used in | Delve kit craft (x2: 3 Slag Fragment + 2 Cinder Ore + 1 World-Root Bark, Smithing 12); Delve hotbar slot, bag, Crafting Bench, chests |
| Shows today | stand-in via ART_ALIAS: the godforge-slag painting |

_Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Basalt Support, a Delve kit item: a dressed basalt pillar with a squared capital and an iron collar, faint orange seams at the joints, heavier and more permanent than the timber prop; simple and readable at 64 px. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `blast-charge` — Blasting Charge

| | |
|---|---|
| Save as | `Assets/Items/Materials/26-blast-charge.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P1 |
| Used in | Delve kit craft (x2: 3 Cinder Ore + 1 Ember Residue + 2 Slag Fragment, Smithing 10); lit from a staff in the Delve; Delve hotbar slot, bag, Crafting Bench, chests |
| Shows today | stand-in via ART_ALIAS: the ember-stoker painting |

_Delete the matching ART_ALIAS row when the file lands._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Blasting Charge, a Delve kit item: a squat iron-banded keg of cinder powder with a coiled fuse ending in a small spark, glowing orange cracks between the staves; reads as dangerous but tool-like, never a bomb cartoon; simple and readable at 64 px. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```
