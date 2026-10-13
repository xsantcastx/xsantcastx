# NPC portraits (I2 pixel portraits)

Folder: `Assets/Characters/npcs/`. Pixel scale, palettes and the export rules are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Paste **Prompt** as the positive prompt and **Negative** as the negative prompt, then clean the result on the art-pixel grid (style guide §14). The spec line is the export contract.

Each named NPC also has a W3 world sprite (`world-sprites/03-npcs.md`); costume, colours and outline match between the two.

### `npc-aureth` — Aureth, the Radiant

| | |
|---|---|
| Save as | `Assets/Characters/npcs/01-npc-aureth.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P0 |
| Used in | NPC dialogue widget portrait (80px orb) on /world/realms/luminous |
| Shows today | monogram orb "AU" in #E8D44D |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Aureth the Radiant, goddess of order and keeper of the Luminous crystals; serene, exacting, ageless; a high collar of ivory stone plates and dawn-glass crystal shards rising behind the head like a sunrise held still, warm gold light from within the crystals; her expression is calm certainty, a little too sure; no halo, no wings. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, angel, saint, nun, crucifix
```

### `npc-verrin` — Verrin, the Hollow

| | |
|---|---|
| Save as | `Assets/Characters/npcs/02-npc-verrin.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P0 |
| Used in | NPC dialogue widget portrait (80px orb) on /world/realms/umbral and /world/trials |
| Shows today | monogram orb "VE" in #A855F7 |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Verrin the Hollow, god of endings who speaks from the space light leaves behind; a tall hooded figure whose face is partly a smooth obsidian mirror reflecting a faint moon, amethyst light pooling in the hollow of the hood, robes of black-violet layered cloth edged in tarnished silver; quiet, patient, not evil. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, grim reaper, scythe, skeleton, evil grin
```

### `npc-kael` — Kael, the Broken Flame

| | |
|---|---|
| Save as | `Assets/Characters/npcs/03-npc-kael.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P0 |
| Used in | NPC dialogue widget portrait (80px orb) on /world, /forge, /character, /sanctum, /world/realms/infernal, and the onboarding tutorial (every new player) |
| Shows today | monogram orb "KA" in #E8752A |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of Kael the Broken Flame, the Forge Keeper; a weathered smith-warden in cracked blackened plate armour with ember-orange light leaking from the cracks, one eye still burning with furnace fire and the other scarred shut, soot-dark skin, braided grey beard bound with iron rings, a heavy leather forge apron over the armour; stern but kind, tired; his left hand is missing (lost sealing a covenant with the Godforge). Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, demon, fire hair, full face on fire
```

### `npc-archivist` — The Archivist

| | |
|---|---|
| Save as | `Assets/Characters/npcs/04-npc-archivist.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P0 |
| Used in | NPC dialogue widget portrait (80px orb) on /codex and /world/quests |
| Shows today | monogram orb "AR" in #5fb6ff |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of the Archivist, keeper of fragments, an ancient scholar of indeterminate gender; deep blue scholar robes with brass lens-rings and star-silver clasps, bare forearms and neck covered in faint glowing blue rune-lines that are still being written onto the skin as we watch, a brass loupe over one eye; curious, precise, kind. Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, wizard hat, long white Gandalf beard, readable text
```

### `npc-merchant` — The Merchant, of the long till

| | |
|---|---|
| Save as | `Assets/Characters/npcs/05-npc-merchant.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P0 |
| Used in | NPC dialogue widget portrait (80px orb) on /market, /gambler and /exchange |
| Shows today | monogram orb "ME" in #c89868 |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of the Merchant of the long till, a trader who sells anything and counts everything; layered travelling coat of worn copper-brown leather and dark velvet, many small brass scales, keys and coin-strings hung from the collar, a pair of fine balance-scale earrings, warm copper accents (#c89868), knowing half-smile, eyes that remember what you nearly bought. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, pirate, gold teeth, caricature, greedy grin
```

### `npc-nameless` — The Nameless

| | |
|---|---|
| Save as | `Assets/Characters/npcs/06-npc-nameless.png` |
| Spec | I2 portrait (pixel art) - 64x64 art px bust, export x8 nearest-neighbour = 512x512 PNG, transparent background, OPAQUE figure |
| On screen | 80 px dialogue orb, 40-64 px tokens (the 96 / 256 / 512 ladder) |
| Priority | P1 |
| Used in | NPC dialogue widget portrait (80px orb) on any page, once its hidden gate opens |
| Shows today | monogram orb "??" in #c9c4d6 |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
portrait of the Nameless, the figure who exists in all five realms at once and has no epithet; a calm, genderless face that is hard to fix in memory, its edges very slightly repeated as if painted five times in a pale lilac-grey (#c9c4d6), simple undyed robes, five faint realm colours (gold, blue, orange, violet, green) caught only in the eyes; unsettlingly ordinary. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. a head-and-shoulders portrait bust on a 64x64 art-pixel canvas, cut at mid-chest, face in the upper middle, facing the viewer at a slight three-quarter turn, still reads when cropped to a circle and shown at 40 px, opaque body. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 512x512 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background scene, circle mask baked in, full body, hands in frame, ghostly translucent body, cropped head, ghost, transparent body, glitch art
```
