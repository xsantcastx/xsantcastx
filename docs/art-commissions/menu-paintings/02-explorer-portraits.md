# Explorer portraits (I2 pixel portraits)

Folder: `Assets/Characters/explorers/`. Pixel scale, palettes and the export rules are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Paste **Prompt** as the positive prompt and **Negative** as the negative prompt, then clean the result on the art-pixel grid (style guide §14). The spec line is the export contract.

Rarity is not painted in: the roster card and the Works-map token draw the tier rim (style guide §5.4).

### `explorer-tobin-ashfoot` — Tobin Ashfoot

| | |
|---|---|
| Save as | `Assets/Characters/explorers/01-explorer-tobin-ashfoot.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P0 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Common rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Tobin Ashfoot, a young forge sweeper turned explorer; soot on his cheeks, broad hopeful face, patched leather jerkin over a grey work shirt, a worn broom-handle walking staff over one shoulder, a little brave and a little out of his depth. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-marda-quell` — Marda Quell

| | |
|---|---|
| Save as | `Assets/Characters/explorers/02-explorer-marda-quell.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P0 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Common rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Marda Quell, a former Sanctum ledger-keeper turned explorer; middle-aged, ink-stained fingers, spectacles pushed up into tied-back dark hair, a sturdy travelling cloak over a clerk's waistcoat, a slim ledger and a pencil tucked into a bandolier. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-ren-sixgate` — Ren Sixgate

| | |
|---|---|
| Save as | `Assets/Characters/explorers/03-explorer-ren-sixgate.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P1 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Uncommon rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Ren Sixgate, a wiry quick explorer who once walked through six gates in one night; short cropped hair, a ring of six small brass gate-keys at her throat, light star-silver scout armour, wry confident look. Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-callum-drossvane` — Callum Drossvane

| | |
|---|---|
| Save as | `Assets/Characters/explorers/04-explorer-callum-drossvane.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P1 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Uncommon rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Callum Drossvane, a slag-sorter who judges ore by ear; head tilted as if listening, a small brass tuning-hammer held near his ear, heat-scarred leather apron, iron ear-cuffs, ember glow from below. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-ilse-thornwake` — Ilse Thornwake

| | |
|---|---|
| Save as | `Assets/Characters/explorers/05-explorer-ilse-thornwake.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P1 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Uncommon rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Ilse Thornwake, a sharp-tongued scholar explorer; thorn-vine embroidery on a moss-green coat, amber-bead earrings, four small notebooks in different bindings strapped across her chest, raised eyebrow. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-bracken-hale` — Bracken Hale

| | |
|---|---|
| Save as | `Assets/Characters/explorers/06-explorer-bracken-hale.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P1 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Uncommon rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Bracken Hale, a huge good-natured porter; enormous overloaded pack whose straps frame his shoulders, sun-browned skin, ivory-and-gold cloth wraps, gentle polite smile that explains nothing. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-lyra-starwalker` — Lyra the Starwalker

| | |
|---|---|
| Save as | `Assets/Characters/explorers/07-explorer-lyra-starwalker.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P1 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Rare rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Lyra the Starwalker, a navigator who follows a constellation no archive records; freckles that glow faintly like an unknown star map, rootwood circlet set with a single living crystal, moss-green hooded mantle, serene certainty. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-grimjaw-unyielding` — Grimjaw the Unyielding

| | |
|---|---|
| Save as | `Assets/Characters/explorers/08-explorer-grimjaw-unyielding.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P1 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Rare rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Grimjaw the Unyielding, a scarred veteran declared lost four times and never actually lost; heavy square jaw with an iron jaw-guard, battered basalt-plate pauldrons, ember-lit rivets, flat unimpressed stare. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-seris-lowlantern` — Seris Lowlantern

| | |
|---|---|
| Save as | `Assets/Characters/explorers/09-explorer-seris-lowlantern.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P1 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Rare rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Seris Lowlantern, a cautious vault-walker who keeps her flame low; she holds a small shuttered lantern at chin height giving a thin violet light, black-violet hood, calm methodical eyes. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-oda-fairweather` — Oda Fairweather

| | |
|---|---|
| Save as | `Assets/Characters/explorers/10-explorer-oda-fairweather.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P1 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Rare rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Oda Fairweather, a lucky survivor of three collapses, two floods and one gate; weathered cheerful older woman, ivory rain-cloak with gold buckles, a dawn-glass charm on a cord, a knowing grin about timing. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-whisper-of-nox` — Whisper of Nox

| | |
|---|---|
| Save as | `Assets/Characters/explorers/11-explorer-whisper-of-nox.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P2 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Epic rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Whisper of Nox, a near-silent explorer who speaks only to say what is in the bag; lower face wrapped in black-violet cloth, eyes pale as moonlight, obsidian mirror-shard pins on the hood, utterly still. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head
```

### `explorer-archivist-hollow` — The Archivist Hollow

| | |
|---|---|
| Save as | `Assets/Characters/explorers/12-explorer-archivist-hollow.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P2 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Epic rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of the Archivist Hollow, who was a shelf number before they were a person; androgynous, a brass catalogue plate set into the collarbone, rootwood-and-crystal reading frames, green archive robes, gentle blank expression. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-veyra-sunder` — Veyra Sunder

| | |
|---|---|
| Save as | `Assets/Characters/explorers/13-explorer-veyra-sunder.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P2 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Epic rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Veyra Sunder, a bold explorer who once cut a thread to see what lay beyond it; a severed glowing thread still trailing from her gauntlet, ember-red war braid, iron-black half-plate, fierce forward lean. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-hadrian-lastlight` — Hadrian Lastlight

| | |
|---|---|
| Save as | `Assets/Characters/explorers/14-explorer-hadrian-lastlight.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P2 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Legendary rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Hadrian Lastlight, a tireless surveyor whose final survey is dated in the future; dignified older man, warm gold surveyor's armour with prism lenses, a sealed survey scroll on his shoulder, steady gaze. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-the-unaccounted` — The Unaccounted

| | |
|---|---|
| Save as | `Assets/Characters/explorers/15-explorer-the-unaccounted.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P2 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Legendary rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of the Unaccounted, an explorer who appears on no roster and draws no wage; face half-shadowed by a midnight-blue hood, star-silver threads in the cloak, the faint outline of a crossed-out name stitched on the collar, a quiet amused look. Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-meren-quiet-ledger` — Meren of the Quiet Ledger

| | |
|---|---|
| Save as | `Assets/Characters/explorers/16-explorer-meren-quiet-ledger.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P2 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Legendary rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Meren of the Quiet Ledger, who keeps the only accurate count of what the realms have taken; elderly, a closed ledger held against her chest with both hands, amber clasps, moss-green mantle, polite refusal in the eyes. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-ashen-sovereign` — The Ashen Sovereign

| | |
|---|---|
| Save as | `Assets/Characters/explorers/17-explorer-ashen-sovereign.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P2 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Mythic rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of the Ashen Sovereign, a former ruler whose kingdom the Nexus scattered; a cracked crown of cooled slag, ash-grey skin with ember veins, a tattered ceremonial mantle over battle plate, regal and grieving. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```

### `explorer-nameless-scout` — The Nameless Scout

| | |
|---|---|
| Save as | `Assets/Characters/explorers/18-explorer-nameless-scout.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P2 |
| Used in | Sanctum > The Works map explorer token (works-map.component); roster card once wired |
| Shows today | Mythic rarity orb with level badge |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of the Nameless Scout, who walked out of the first expedition ever dispatched and never stopped; travel-worn ageless face, a cloak made of many faded patches from every realm, dust of five colours on the shoulders, eyes fixed on a far horizon. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, helmet covering the face
```
