# Hunting-ground creatures (pixel art)

Pixel scale, sizes, outline and shading, palettes, animation and the sidecar are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Image generators do not make clean pixel art or consistent frames: use the **design prompt** for the look, then draw or clean the frames on the art-pixel grid (style guide §14), keeping the cell, pivot and export factor exact.

Each creature also has a painted Codex master (`Creatures/Masters/`); the sprite must be recognisably the same animal, simplified to 3-5 big pixel shapes.

### `rivet-maw` — Rivet Maw  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/01-rivet-maw.png` + sidecar `Assets/Sprites/Creatures/01-rivet-maw.json` |
| Spec | W2 creature sheet (pixel art) - 48x36 art px per frame, sheet 288x216 art px, export x8 nearest-neighbour = 2304x1728 px (384x288 per frame), transparent background |
| On screen | body 150 px long, 105 px tall in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 48x36 art px = 384x288 authored; pivot (192, 272) authored = art (24, 34) |
| Priority | P0 |
| Used in | Basalt Seamworks hunting ground (live now) |
| Shows today | the painted master bent by the mesh rig (Rivet Maw) / not in the world yet (others) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 384, "h": 288}, "pivot": {"x": 192, "y": 272}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}, {"name": "windup", "frames": 3, "fps": 8, "loop": false}, {"name": "strike", "frames": 3, "fps": 12, "loop": false}, {"name": "hurt", "frames": 2, "fps": 10, "loop": false}, {"name": "death", "frames": 5, "fps": 10, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | breathing / hover; 1 art px rise and fall |
| 1 | `walk` | 6 | 10 | yes | patrol gait (flyers: drift) |
| 2 | `windup` | 3 | 8 | no | the telegraph the player reacts to; exaggerate it. Timed to the game's 0.85 s windup |
| 3 | `strike` | 3 | 12 | no | the hit, timed to 0.2 s; frame 2 is the contact frame |
| 4 | `hurt` | 2 | 10 | no | recoil, flash-friendly pose |
| 5 | `death` | 5 | 10 | no | collapse; the last frame may be empty (the engine dissolves) |

No baked shadow: the engine draws the contact shadow (it must follow the creature).

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Rivet Maw: a low, heavy, four-legged scavenger built of basalt hide and iron rivet plates, a square mechanical jaw of plates with ember-lit mouth seams, compulsive and territorial; match the approved painted master Creatures/Masters/03-rivet-maw.png in design. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one frame on a 48x36 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, walk 6, windup 3, strike 3, hurt 2, death 5. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 2304x1728 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, left-facing view, multiple creatures, cropped body
```

### `prism-forager` — Prism Forager

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/02-prism-forager.png` + sidecar `Assets/Sprites/Creatures/02-prism-forager.json` |
| Spec | W2 creature sheet (pixel art) - 40x48 art px per frame, sheet 240x288 art px, export x8 nearest-neighbour = 1920x2304 px (320x384 per frame), transparent background |
| On screen | 165 px tall in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 40x48 art px = 320x384 authored; pivot (160, 368) authored = art (20, 46) |
| Priority | P1 |
| Used in | Luminous hunting ground (Phase 2) |
| Shows today | the painted master bent by the mesh rig (Rivet Maw) / not in the world yet (others) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 384}, "pivot": {"x": 160, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}, {"name": "windup", "frames": 3, "fps": 8, "loop": false}, {"name": "strike", "frames": 3, "fps": 12, "loop": false}, {"name": "hurt", "frames": 2, "fps": 10, "loop": false}, {"name": "death", "frames": 5, "fps": 10, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | breathing / hover; 1 art px rise and fall |
| 1 | `walk` | 6 | 10 | yes | patrol gait (flyers: drift) |
| 2 | `windup` | 3 | 8 | no | the telegraph the player reacts to; exaggerate it. Timed to the game's 0.85 s windup |
| 3 | `strike` | 3 | 12 | no | the hit, timed to 0.2 s; frame 2 is the contact frame |
| 4 | `hurt` | 2 | 10 | no | recoil, flash-friendly pose |
| 5 | `death` | 5 | 10 | no | collapse; the last frame may be empty (the engine dissolves) |

No baked shadow: the engine draws the contact shadow (it must follow the creature).

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Prism Forager: a human-height faceted crystal forager of ivory, warm gold and clear crystal with a hollow chest holding refracted gestures; fastidious and communal; match Creatures/Masters/01-prism-forager.png. Luminous palette: sunlit stone #4a4030 #8a7a58 #c9b88e #efe4c8, gold #7a5a14 #b8901e #E8D44D, dawn crystal #ffe7a0 #fff1b0 #fffaf0. one frame on a 40x48 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, walk 6, windup 3, strike 3, hurt 2, death 5. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x2304 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, left-facing view, multiple creatures, cropped body
```

### `ephemeris-leech` — Ephemeris Leech

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/03-ephemeris-leech.png` + sidecar `Assets/Sprites/Creatures/03-ephemeris-leech.json` |
| Spec | W2 creature sheet (pixel art) - 40x28 art px per frame, sheet 240x168 art px, export x8 nearest-neighbour = 1920x1344 px (320x224 per frame), transparent background |
| On screen | 70 px tall, 110 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 40x28 art px = 320x224 authored; pivot (160, 208) authored = art (20, 26) |
| Priority | P1 |
| Used in | Celestial hunting ground (Phase 2) |
| Shows today | the painted master bent by the mesh rig (Rivet Maw) / not in the world yet (others) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 224}, "pivot": {"x": 160, "y": 208}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}, {"name": "windup", "frames": 3, "fps": 8, "loop": false}, {"name": "strike", "frames": 3, "fps": 12, "loop": false}, {"name": "hurt", "frames": 2, "fps": 10, "loop": false}, {"name": "death", "frames": 5, "fps": 10, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | breathing / hover; 1 art px rise and fall |
| 1 | `walk` | 6 | 10 | yes | patrol gait (flyers: drift) |
| 2 | `windup` | 3 | 8 | no | the telegraph the player reacts to; exaggerate it. Timed to the game's 0.85 s windup |
| 3 | `strike` | 3 | 12 | no | the hit, timed to 0.2 s; frame 2 is the contact frame |
| 4 | `hurt` | 2 | 10 | no | recoil, flash-friendly pose |
| 5 | `death` | 5 | 10 | no | collapse; the last frame may be empty (the engine dissolves) |

No baked shadow: the engine draws the contact shadow (it must follow the creature).

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Ephemeris Leech: a jointed star-silver crawler like a folded measuring tool with a dark blue glass abdomen, constellation sparks leaking from its seams; patient, nearly invisible; match Creatures/Masters/02-ephemeris-leech.png. Celestial palette: midnight #0a1428 #14284a #24406e #3a5a8a, star silver #6a7890 #a8b8cc #d8ecff, orbit blue #1e5a9a #5fb6ff #00d4ff, brass #8a6a3a #b08a55 #e8c47a. one frame on a 40x28 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, walk 6, windup 3, strike 3, hurt 2, death 5. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x1344 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, left-facing view, multiple creatures, cropped body
```

### `mirror-substitute` — Mirror Substitute

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/04-mirror-substitute.png` + sidecar `Assets/Sprites/Creatures/04-mirror-substitute.json` |
| Spec | W2 creature sheet (pixel art) - 40x48 art px per frame, sheet 240x288 art px, export x8 nearest-neighbour = 1920x2304 px (320x384 per frame), transparent background |
| On screen | 165 px tall in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 40x48 art px = 320x384 authored; pivot (160, 368) authored = art (20, 46) |
| Priority | P1 |
| Used in | Umbral hunting ground (Phase 2) |
| Shows today | the painted master bent by the mesh rig (Rivet Maw) / not in the world yet (others) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 384}, "pivot": {"x": 160, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}, {"name": "windup", "frames": 3, "fps": 8, "loop": false}, {"name": "strike", "frames": 3, "fps": 12, "loop": false}, {"name": "hurt", "frames": 2, "fps": 10, "loop": false}, {"name": "death", "frames": 5, "fps": 10, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | breathing / hover; 1 art px rise and fall |
| 1 | `walk` | 6 | 10 | yes | patrol gait (flyers: drift) |
| 2 | `windup` | 3 | 8 | no | the telegraph the player reacts to; exaggerate it. Timed to the game's 0.85 s windup |
| 3 | `strike` | 3 | 12 | no | the hit, timed to 0.2 s; frame 2 is the contact frame |
| 4 | `hurt` | 2 | 10 | no | recoil, flash-friendly pose |
| 5 | `death` | 5 | 10 | no | collapse; the last frame may be empty (the engine dissolves) |

No baked shadow: the engine draws the contact shadow (it must follow the creature).

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Mirror Substitute: a person-sized asymmetrical reflection made of obsidian mirror fragments, its face only resolving in reflected surfaces; charming, attentive; match Creatures/Masters/04-mirror-substitute.png. Umbral palette: black-violet #0e0912 #1a1220 #33263a #4a3260, amethyst #5a2f8a #7b4fc0 #A855F7 #c9a0ff, moonlight #8a90b0 #d8dcf0. one frame on a 40x48 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, walk 6, windup 3, strike 3, hurt 2, death 5. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x2304 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, left-facing view, multiple creatures, cropped body
```

### `rootglass-stag` — Rootglass Stag

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/05-rootglass-stag.png` + sidecar `Assets/Sprites/Creatures/05-rootglass-stag.json` |
| Spec | W2 creature sheet (pixel art) - 64x60 art px per frame, sheet 384x360 art px, export x8 nearest-neighbour = 3072x2880 px (512x480 per frame), transparent background |
| On screen | 215 px tall including antlers, 200 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 64x60 art px = 512x480 authored; pivot (256, 464) authored = art (32, 58) |
| Priority | P1 |
| Used in | Verdant hunting ground (Phase 2) |
| Shows today | the painted master bent by the mesh rig (Rivet Maw) / not in the world yet (others) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 512, "h": 480}, "pivot": {"x": 256, "y": 464}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}, {"name": "windup", "frames": 3, "fps": 8, "loop": false}, {"name": "strike", "frames": 3, "fps": 12, "loop": false}, {"name": "hurt", "frames": 2, "fps": 10, "loop": false}, {"name": "death", "frames": 5, "fps": 10, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | breathing / hover; 1 art px rise and fall |
| 1 | `walk` | 6 | 10 | yes | patrol gait (flyers: drift) |
| 2 | `windup` | 3 | 8 | no | the telegraph the player reacts to; exaggerate it. Timed to the game's 0.85 s windup |
| 3 | `strike` | 3 | 12 | no | the hit, timed to 0.2 s; frame 2 is the contact frame |
| 4 | `hurt` | 2 | 10 | no | recoil, flash-friendly pose |
| 5 | `death` | 5 | 10 | no | collapse; the last frame may be empty (the engine dissolves) |

No baked shadow: the engine draws the contact shadow (it must follow the creature).

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Rootglass Stag: a large rootwood cervid with living-crystal antlers, amber bioluminescent seams, moss and brass root braces; skittish but discerning; match Creatures/Masters/05-rootglass-stag.png. Verdant palette: moss #1e2a14 #3a5a2a #4a7a3a #7fb85a #d8f2a0, rootwood #24190f #3a2a1c #7a5a36 #b08a55, amber #6a4010 #c08a3e #ffc669, bioluminescent #2a8a6a #7fd5a3 #c4ffe0. one frame on a 64x60 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, walk 6, windup 3, strike 3, hurt 2, death 5. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 3072x2880 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, left-facing view, multiple creatures, cropped body
```
