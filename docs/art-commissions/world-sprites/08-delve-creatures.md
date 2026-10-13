# Delve creatures (pixel art)

Pixel scale, sizes, outline and shading, palettes, animation and the sidecar are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Image generators do not make clean pixel art or consistent frames: use the **design prompt** for the look, then draw or clean the frames on the art-pixel grid (style guide §14), keeping the cell, pivot and export factor exact.

The Delve's two enemies reuse other creatures' art and rigs today. Both need their own sprite and a one-line engine change to use a dedicated key (style guide ENG-1). The Delve draws figures at half size (`figureScale` 0.5), so author at the normal creature scale: the x8 sheet lands on the Delve's 2 px grid.

### `rune-warden` — Rune-Warden

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/06-rune-warden.png` + sidecar `Assets/Sprites/Creatures/06-rune-warden.json` |
| Spec | W2 creature sheet (pixel art) - 48x56 art px per frame, sheet 240x280 art px, export x8 nearest-neighbour = 1920x2240 px (384x448 per frame), transparent background |
| On screen | about 192 px tall in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 48x56 art px = 384x448 authored; pivot (192, 432) authored = art (24, 54) |
| Priority | P1 |
| Used in | Ember Delve fragment chamber (Magma Halls, 260 HP, defeated once per player; its fall frees the Godforge fragment) |
| Shows today | Mirror Substitute art on the Mirror Substitute rig (creature-rigs.ts key `mirror-substitute`) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 384, "h": 448}, "pivot": {"x": 192, "y": 432}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "windup", "frames": 3, "fps": 8, "loop": false}, {"name": "strike", "frames": 3, "fps": 12, "loop": false}, {"name": "hurt", "frames": 2, "fps": 10, "loop": false}, {"name": "death", "frames": 5, "fps": 10, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | breathing / hover; 1 art px rise and fall |
| 1 | `windup` | 3 | 8 | no | the telegraph the player reacts to; exaggerate it. Timed to the game's 0.85 s windup |
| 2 | `strike` | 3 | 12 | no | the hit, timed to 0.2 s; frame 2 is the contact frame |
| 3 | `hurt` | 2 | 10 | no | recoil, flash-friendly pose |
| 4 | `death` | 5 | 10 | no | collapse; the last frame may be empty (the engine dissolves) |

_Code stand-in (atlas name now Seam Eater): the engine spawns `creature: 'mirror-substitute'` named Rune-Warden (towns/infernal.ts). An engine-side change must switch the key to `rune-warden` (style guide ENG-1)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Rune-Warden: a towering stone-and-gold guardian of the Godforge fragment, a tall armoured figure of basalt plates carved with glowing Godstone runes #e8c47a, a heavy rune-lit shield-arm and a hammer-spear, a blank faceplate with one slit of violet light, dutiful rather than cruel; match the painted master Creatures/Masters/11-rune-warden.png in design; facing right. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one frame on a 48x56 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, windup 3, strike 3, hurt 2, death 5. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x2240 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, left-facing view, multiple creatures, cropped body
```

### `magma-maw` — Magma Maw

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/07-magma-maw.png` + sidecar `Assets/Sprites/Creatures/07-magma-maw.json` |
| Spec | W2 creature sheet (pixel art) - 48x36 art px per frame, sheet 288x216 art px, export x8 nearest-neighbour = 2304x1728 px (384x288 per frame), transparent background |
| On screen | body 150 px long, 105 px tall in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 48x36 art px = 384x288 authored; pivot (192, 272) authored = art (24, 34) |
| Priority | P1 |
| Used in | Ember Delve Basalt cavern and Magma Halls (110 HP; two spawn points) |
| Shows today | Rivet Maw art and rig (creature-rigs.ts) |
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

_Variant of rivet-maw: same cell, pivot and frame counts. Code stand-in: `creature: 'rivet-maw'` named Magma Maw (atlas name now Cinder Bailiff); needs the key `magma-maw` (style guide ENG-1)._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Magma Maw: the Rivet Maw's hotter cousin, same low four-legged basalt-and-rivet body and square plated jaw, but its hide is cracked open with glowing lava seams #ff8a3d, molten drool, a scorched darker colour so it is told apart from the Rivet Maw at a glance; match the Rivet Maw sprite's proportions and pose rhythm exactly; facing right. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one frame on a 48x36 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, walk 6, windup 3, strike 3, hurt 2, death 5. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 2304x1728 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, left-facing view, multiple creatures, cropped body
```
