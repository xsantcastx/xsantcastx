# Delve creatures (pixel art)

Pixel scale, sizes, outline and shading, palettes, animation and the sidecar are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Image generators do not make clean pixel art or consistent frames: use the **design prompt** for the look, then draw or clean the frames on the art-pixel grid (style guide §14), keeping the cell, pivot and export factor exact.

The Delve's two enemies are the creature atlas's Seam Eater and Cinder Bailiff. The engine already spawns them under their own keys (`seam-eater`, `cinder-bailiff`) and borrows other creatures' art and rigs only until these sheets land (style guide ENG-1, done). The Delve draws figures at half size (`figureScale` 0.5), so author at the normal creature scale: the x8 sheet lands on the Delve's 2 px grid.

### `seam-eater` — Seam Eater

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/06-seam-eater.png` + sidecar `Assets/Sprites/Creatures/06-seam-eater.json` |
| Spec | W2 creature sheet (pixel art) - 64x60 art px per frame, sheet 320x300 art px, export x8 nearest-neighbour = 2560x2400 px (512x480 per frame), transparent background |
| On screen | about 240 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 64x60 art px = 512x480 authored; pivot (256, 464) authored = art (32, 58) |
| Priority | P1 |
| Used in | Ember Delve fragment chamber (Magma Halls, 260 HP, defeated once per player; its fall frees the Godforge fragment) |
| Shows today | Mirror Substitute art on the Mirror Substitute rig (the engine spawns key `seam-eater`; creature-rigs.ts and art.ts alias it to `mirror-substitute` until this sheet lands) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 512, "h": 480}, "pivot": {"x": 256, "y": 464}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "windup", "frames": 3, "fps": 8, "loop": false}, {"name": "strike", "frames": 3, "fps": 12, "loop": false}, {"name": "hurt", "frames": 2, "fps": 10, "loop": false}, {"name": "death", "frames": 5, "fps": 10, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | breathing / hover; 1 art px rise and fall |
| 1 | `windup` | 3 | 8 | no | the telegraph the player reacts to; exaggerate it. Timed to the game's 0.85 s windup |
| 2 | `strike` | 3 | 12 | no | the hit, timed to 0.2 s; frame 2 is the contact frame |
| 3 | `hurt` | 2 | 10 | no | recoil, flash-friendly pose |
| 4 | `death` | 5 | 10 | no | collapse; the last frame may be empty (the engine dissolves) |

_The engine already spawns `creature: 'seam-eater'` (towns/infernal.ts) and draws `spriteFor('seam-eater')` as soon as this sheet is imported (style guide ENG-1, done); until then it keeps the stand-in above._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Seam Eater: a colossal serpentine mass of cooled slag, broken iron braces and snapped rivets, coiled up from the floor, molten interior channels glowing #ff8a3d and #ffd08a through the cracks between its slag plates, a blunt eyeless head that splits open along one glowing seam; it rises from the deepest failed repairs and unthreads the Seamworks' platforms; heavy and patient rather than cruel; match the painted master Creatures/Masters/11-seam-eater.png in design; facing right. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one frame on a 64x60 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, windup 3, strike 3, hurt 2, death 5. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 2560x2400 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, left-facing view, multiple creatures, cropped body
```

### `cinder-bailiff` — Cinder Bailiff

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/07-cinder-bailiff.png` + sidecar `Assets/Sprites/Creatures/07-cinder-bailiff.json` |
| Spec | W2 creature sheet (pixel art) - 40x56 art px per frame, sheet 240x336 art px, export x8 nearest-neighbour = 1920x2688 px (320x448 per frame), transparent background |
| On screen | about 220 px tall in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 40x56 art px = 320x448 authored; pivot (160, 432) authored = art (20, 54) |
| Priority | P1 |
| Used in | Ember Delve Basalt cavern and Magma Halls (110 HP; two spawn points) |
| Shows today | Rivet Maw art and rig (the engine spawns key `cinder-bailiff`; creature-rigs.ts and art.ts alias it to `rivet-maw` until this sheet lands) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 320, "h": 448}, "pivot": {"x": 160, "y": 432}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true}, {"name": "walk", "frames": 6, "fps": 10, "loop": true}, {"name": "windup", "frames": 3, "fps": 8, "loop": false}, {"name": "strike", "frames": 3, "fps": 12, "loop": false}, {"name": "hurt", "frames": 2, "fps": 10, "loop": false}, {"name": "death", "frames": 5, "fps": 10, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | breathing / hover; 1 art px rise and fall |
| 1 | `walk` | 6 | 10 | yes | patrol gait (flyers: drift) |
| 2 | `windup` | 3 | 8 | no | the telegraph the player reacts to; exaggerate it. Timed to the game's 0.85 s windup |
| 3 | `strike` | 3 | 12 | no | the hit, timed to 0.2 s; frame 2 is the contact frame |
| 4 | `hurt` | 2 | 10 | no | recoil, flash-friendly pose |
| 5 | `death` | 5 | 10 | no | collapse; the last frame may be empty (the engine dissolves) |

_The engine already spawns `creature: 'cinder-bailiff'` (towns/infernal.ts) and draws `spriteFor('cinder-bailiff')` as soon as this sheet is imported (style guide ENG-1, done); until then it keeps the stand-in above._

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
Cinder Bailiff: a tall basalt-and-iron figure with a glowing furnace aperture in the chest, one hand ending in a heavy seal-stamp, fused paper-like heat records hanging down its back; orange heat only along its structural seams; formal and relentless, it walks work routes and stamps heat debts onto shortcuts; match the painted master Creatures/Masters/08-cinder-bailiff.png in design; facing right. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one frame on a 40x56 art-pixel cell, side view facing right, feet on a ground line 2 art px above the cell bottom, no ground shadow; for a sprite sheet with rows idle 4, walk 6, windup 3, strike 3, hurt 2, death 5. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 1920x2688 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, left-facing view, multiple creatures, cropped body
```
