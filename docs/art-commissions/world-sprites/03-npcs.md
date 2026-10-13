# Keeper NPCs and townsfolk (pixel art)

Pixel scale, sizes, outline and shading, palettes, animation and the sidecar are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Image generators do not make clean pixel art or consistent frames: use the **design prompt** for the look, then draw or clean the frames on the art-pixel grid (style guide §14), keeping the cell, pivot and export factor exact.

Role titles were approved 2026-10-13; personal names for the role-titled keepers are still the owner's and never appear in an art file.

### `npc-kael` — Kael at the Rune Forge  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/01-npc-kael.png` + sidecar `Assets/Sprites/NPCs/01-npc-kael.json` |
| Spec | W3 NPC sheet (pixel art) - 40x48 art px per frame, sheet 240x144 art px, export x8 nearest-neighbour = 1920x1152 px (320x384 per frame), transparent background |
| On screen | 150-170 px tall (Kael is the tallest); 4 px per art px |
| Cell | 40x48 art px = 320x384 authored; pivot (160, 368) authored = art (20, 46) |
| Priority | P0 |
| Used in | Infernal town: Crafting Bench / Rune Forge |
| Shows today | empty station (no one stands there) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 384}, "pivot": {"x": 160, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "talk", "frames": 2, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | standing at their station, a small fidget |
| 1 | `talk` | 2 | 6 | yes | mouth or hand gesture while their line is showing |
| 2 | `walk` | 6 | 10 | yes | optional: only for townsfolk who wander |

Also has an I2 pixel dialogue portrait (`menu-paintings/01-npc-portraits.md`); keep costume, colours and the 1 px outline identical between the two.

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Kael the Broken Flame as a world sprite: broad smith-warden in cracked blackened plate with ember light in the cracks, one burning eye, grey braided beard with iron rings, leather forge apron, missing left hand. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one frame on a 40x48 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, talk 2, walk 6. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x1152 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, multiple characters, cropped feet
```

### `npc-material-vendor` — Material Vendor (proposed role, name TBD)

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/02-npc-material-vendor.png` + sidecar `Assets/Sprites/NPCs/02-npc-material-vendor.json` |
| Spec | W3 NPC sheet (pixel art) - 40x48 art px per frame, sheet 240x144 art px, export x8 nearest-neighbour = 1920x1152 px (320x384 per frame), transparent background |
| On screen | 150-170 px tall (Kael is the tallest); 4 px per art px |
| Cell | 40x48 art px = 320x384 authored; pivot (160, 368) authored = art (20, 46) |
| Priority | P2 |
| Used in | Infernal town: Material Vendor stall |
| Shows today | empty station (no one stands there) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 384}, "pivot": {"x": 160, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "talk", "frames": 2, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | standing at their station, a small fidget |
| 1 | `talk` | 2 | 6 | yes | mouth or hand gesture while their line is showing |
| 2 | `walk` | 6 | 10 | yes | optional: only for townsfolk who wander |

Role title approved 2026-10-13; the personal name is still the owner's. No portrait is commissioned yet.

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a stocky ore trader in a scorched leather coat with a sack of cinder ore over one shoulder and a set of brass weighing tongs; friendly, loud. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one frame on a 40x48 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, talk 2, walk 6. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x1152 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, multiple characters, cropped feet
```

### `npc-merchant` — The Merchant

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/03-npc-merchant.png` + sidecar `Assets/Sprites/NPCs/03-npc-merchant.json` |
| Spec | W3 NPC sheet (pixel art) - 40x48 art px per frame, sheet 240x144 art px, export x8 nearest-neighbour = 1920x1152 px (320x384 per frame), transparent background |
| On screen | 150-170 px tall (Kael is the tallest); 4 px per art px |
| Cell | 40x48 art px = 320x384 authored; pivot (160, 368) authored = art (20, 46) |
| Priority | P1 |
| Used in | Luminous town: Market |
| Shows today | empty station (no one stands there) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 384}, "pivot": {"x": 160, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "talk", "frames": 2, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | standing at their station, a small fidget |
| 1 | `talk` | 2 | 6 | yes | mouth or hand gesture while their line is showing |
| 2 | `walk` | 6 | 10 | yes | optional: only for townsfolk who wander |

Also has an I2 pixel dialogue portrait (`menu-paintings/01-npc-portraits.md`); keep costume, colours and the 1 px outline identical between the two.

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
the Merchant of the long till as a world sprite: layered copper-brown travelling coat, brass scales and keys hanging from the collar, balance-scale earrings, knowing half-smile. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. one frame on a 40x48 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, talk 2, walk 6. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x1152 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, multiple characters, cropped feet
```

### `npc-aureth` — Aureth

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/04-npc-aureth.png` + sidecar `Assets/Sprites/NPCs/04-npc-aureth.json` |
| Spec | W3 NPC sheet (pixel art) - 40x48 art px per frame, sheet 240x144 art px, export x8 nearest-neighbour = 1920x1152 px (320x384 per frame), transparent background |
| On screen | 150-170 px tall (Kael is the tallest); 4 px per art px |
| Cell | 40x48 art px = 320x384 authored; pivot (160, 368) authored = art (20, 46) |
| Priority | P2 |
| Used in | Luminous town: Heliograph Court plaza |
| Shows today | empty station (no one stands there) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 384}, "pivot": {"x": 160, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "talk", "frames": 2, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | standing at their station, a small fidget |
| 1 | `talk` | 2 | 6 | yes | mouth or hand gesture while their line is showing |
| 2 | `walk` | 6 | 10 | yes | optional: only for townsfolk who wander |

Also has an I2 pixel dialogue portrait (`menu-paintings/01-npc-portraits.md`); keep costume, colours and the 1 px outline identical between the two.

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Aureth the Radiant as a world sprite: tall serene goddess figure, ivory stone collar with dawn-glass crystal shards rising behind her head, warm gold light; no wings or halo. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. one frame on a 40x48 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, talk 2, walk 6. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x1152 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, multiple characters, cropped feet
```

### `npc-croupier` — Gambler's croupier (proposed role, name TBD)

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/05-npc-croupier.png` + sidecar `Assets/Sprites/NPCs/05-npc-croupier.json` |
| Spec | W3 NPC sheet (pixel art) - 40x48 art px per frame, sheet 240x144 art px, export x8 nearest-neighbour = 1920x1152 px (320x384 per frame), transparent background |
| On screen | 150-170 px tall (Kael is the tallest); 4 px per art px |
| Cell | 40x48 art px = 320x384 authored; pivot (160, 368) authored = art (20, 46) |
| Priority | P2 |
| Used in | Umbral town: Gambler |
| Shows today | empty station (no one stands there) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 384}, "pivot": {"x": 160, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "talk", "frames": 2, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | standing at their station, a small fidget |
| 1 | `talk` | 2 | 6 | yes | mouth or hand gesture while their line is showing |
| 2 | `walk` | 6 | 10 | yes | optional: only for townsfolk who wander |

Role title approved 2026-10-13; the personal name is still the owner's. No portrait is commissioned yet.

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a slim hooded croupier in black-violet with silver rings, shuffling glowing violet cards, half-mask. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. one frame on a 40x48 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, talk 2, walk 6. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x1152 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, multiple characters, cropped feet
```

### `npc-exchange-broker` — Exchange broker (proposed role, name TBD)

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/06-npc-exchange-broker.png` + sidecar `Assets/Sprites/NPCs/06-npc-exchange-broker.json` |
| Spec | W3 NPC sheet (pixel art) - 40x48 art px per frame, sheet 240x144 art px, export x8 nearest-neighbour = 1920x1152 px (320x384 per frame), transparent background |
| On screen | 150-170 px tall (Kael is the tallest); 4 px per art px |
| Cell | 40x48 art px = 320x384 authored; pivot (160, 368) authored = art (20, 46) |
| Priority | P2 |
| Used in | Umbral town: Exchange |
| Shows today | empty station (no one stands there) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 384}, "pivot": {"x": 160, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "talk", "frames": 2, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | standing at their station, a small fidget |
| 1 | `talk` | 2 | 6 | yes | mouth or hand gesture while their line is showing |
| 2 | `walk` | 6 | 10 | yes | optional: only for townsfolk who wander |

Role title approved 2026-10-13; the personal name is still the owner's. No portrait is commissioned yet.

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a precise broker in an obsidian-buttoned long coat holding a ledger and a moonlit lantern. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. one frame on a 40x48 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, talk 2, walk 6. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x1152 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, multiple characters, cropped feet
```

### `npc-verrin` — Verrin

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/07-npc-verrin.png` + sidecar `Assets/Sprites/NPCs/07-npc-verrin.json` |
| Spec | W3 NPC sheet (pixel art) - 40x48 art px per frame, sheet 240x144 art px, export x8 nearest-neighbour = 1920x1152 px (320x384 per frame), transparent background |
| On screen | 150-170 px tall (Kael is the tallest); 4 px per art px |
| Cell | 40x48 art px = 320x384 authored; pivot (160, 368) authored = art (20, 46) |
| Priority | P2 |
| Used in | Umbral town: trials approach |
| Shows today | empty station (no one stands there) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 384}, "pivot": {"x": 160, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "talk", "frames": 2, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | standing at their station, a small fidget |
| 1 | `talk` | 2 | 6 | yes | mouth or hand gesture while their line is showing |
| 2 | `walk` | 6 | 10 | yes | optional: only for townsfolk who wander |

Also has an I2 pixel dialogue portrait (`menu-paintings/01-npc-portraits.md`); keep costume, colours and the 1 px outline identical between the two.

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Verrin the Hollow as a world sprite: tall hooded figure whose face is a smooth obsidian mirror, amethyst light in the hood, layered black-violet robes; quiet, not evil. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. one frame on a 40x48 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, talk 2, walk 6. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x1152 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, multiple characters, cropped feet
```

### `npc-archivist` — The Archivist

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/08-npc-archivist.png` + sidecar `Assets/Sprites/NPCs/08-npc-archivist.json` |
| Spec | W3 NPC sheet (pixel art) - 40x48 art px per frame, sheet 240x144 art px, export x8 nearest-neighbour = 1920x1152 px (320x384 per frame), transparent background |
| On screen | 150-170 px tall (Kael is the tallest); 4 px per art px |
| Cell | 40x48 art px = 320x384 authored; pivot (160, 368) authored = art (20, 46) |
| Priority | P1 |
| Used in | Celestial town: Codex observatory |
| Shows today | empty station (no one stands there) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 384}, "pivot": {"x": 160, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "talk", "frames": 2, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | standing at their station, a small fidget |
| 1 | `talk` | 2 | 6 | yes | mouth or hand gesture while their line is showing |
| 2 | `walk` | 6 | 10 | yes | optional: only for townsfolk who wander |

Also has an I2 pixel dialogue portrait (`menu-paintings/01-npc-portraits.md`); keep costume, colours and the 1 px outline identical between the two.

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
the Archivist as a world sprite: ancient scholar in deep blue robes with brass lens-rings, glowing blue rune-lines on the arms, a brass loupe over one eye, a floating open book. Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. one frame on a 40x48 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, talk 2, walk 6. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x1152 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, multiple characters, cropped feet
```

### `npc-expedition-steward` — Expedition steward (proposed role, name TBD)

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/09-npc-expedition-steward.png` + sidecar `Assets/Sprites/NPCs/09-npc-expedition-steward.json` |
| Spec | W3 NPC sheet (pixel art) - 40x48 art px per frame, sheet 240x144 art px, export x8 nearest-neighbour = 1920x1152 px (320x384 per frame), transparent background |
| On screen | 150-170 px tall (Kael is the tallest); 4 px per art px |
| Cell | 40x48 art px = 320x384 authored; pivot (160, 368) authored = art (20, 46) |
| Priority | P2 |
| Used in | Verdant town: Sanctum (expeditions) |
| Shows today | empty station (no one stands there) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 384}, "pivot": {"x": 160, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "talk", "frames": 2, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | standing at their station, a small fidget |
| 1 | `talk` | 2 | 6 | yes | mouth or hand gesture while their line is showing |
| 2 | `walk` | 6 | 10 | yes | optional: only for townsfolk who wander |

Role title approved 2026-10-13; the personal name is still the owner's. No portrait is commissioned yet.

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a rootwood-armoured expedition steward with a map case and a rope coil, moss-green cloak, amber lantern. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. one frame on a 40x48 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, talk 2, walk 6. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x1152 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, multiple characters, cropped feet
```
