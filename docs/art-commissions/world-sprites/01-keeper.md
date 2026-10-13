# The Keeper and attachable equipment (pixel art)

Pixel scale, sizes, outline and shading, palettes, animation and the sidecar are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Image generators do not make clean pixel art or consistent frames: use the **design prompt** for the look, then draw or clean the frames on the art-pixel grid (style guide §14), keeping the cell, pivot and export factor exact.

### `keeper` — The Keeper  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Characters/01-keeper.png` + sidecar `Assets/Sprites/Characters/01-keeper.json` |
| Spec | W1 character sheet (pixel art) - 48x48 art px per frame, sheet 384x384 art px, export x8 nearest-neighbour = 3072x3072 px (384x384 per frame), transparent background |
| On screen | figure 160 px tall in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 48x48 art px = 384x384 authored; pivot (192, 368) authored = art (24, 46) |
| Priority | P0 |
| Used in | the player and every remote Keeper in the side-scroller and towns (/play) |
| Shows today | the menu painting `keeper-base` bent by the mesh rig |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 384, "h": 384}, "pivot": {"x": 192, "y": 368}, "actions": [{"name": "idle", "frames": 4, "fps": 6, "loop": true, "anchors": {"hand_front": <4 x [x, y, deg]>, "hand_back": <4 x [x, y]>}}, {"name": "run", "frames": 8, "fps": 12, "loop": true, "anchors": {"hand_front": <8 x [x, y, deg]>, "hand_back": <8 x [x, y]>}}, {"name": "jump", "frames": 2, "fps": 10, "loop": false, "anchors": {"hand_front": <2 x [x, y, deg]>, "hand_back": <2 x [x, y]>}}, {"name": "fall", "frames": 2, "fps": 8, "loop": true, "anchors": {"hand_front": <2 x [x, y, deg]>, "hand_back": <2 x [x, y]>}}, {"name": "attack", "frames": 4, "fps": 14, "loop": false, "anchors": {"hand_front": <4 x [x, y, deg]>, "hand_back": <4 x [x, y]>}}, {"name": "dodge", "frames": 3, "fps": 14, "loop": false, "anchors": {"hand_front": <3 x [x, y, deg]>, "hand_back": <3 x [x, y]>}}, {"name": "hurt", "frames": 2, "fps": 10, "loop": false, "anchors": {"hand_front": <2 x [x, y, deg]>, "hand_back": <2 x [x, y]>}}, {"name": "death", "frames": 5, "fps": 10, "loop": false, "anchors": {"hand_front": <5 x [x, y, deg]>, "hand_back": <5 x [x, y]>}}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 4 | 6 | yes | breathing: hood and cape rise 1 art px on frames 2-3; fists relaxed at the hips |
| 1 | `run` | 8 | 12 | yes | contact on frames 1 and 5; 1 art px body bob; cape trails; hood bobs |
| 2 | `jump` | 2 | 10 | no | crouch, rise |
| 3 | `fall` | 2 | 8 | yes | apex, falling |
| 4 | `attack` | 4 | 14 | no | wind-up (arm back), strike (frame 2, the hit; a 1-2 art px smear arc), follow-through, recover. Played across the game's 0.4 s attack window |
| 5 | `dodge` | 3 | 14 | no | low dash, cape snapping behind |
| 6 | `hurt` | 2 | 10 | no | recoil, recover (the engine adds the white flash) |
| 7 | `death` | 5 | 10 | no | optional: knees, fall, dissolve into violet #a855f7 motes; the last frame may be empty |

**Equipment is drawn by the engine, not painted in.** Draw the Keeper with **empty hands** (front hand a loose fist, back hand open). Weapons and off-hands are separate W4 sprites (below) that the engine places on the hand every frame, so the sidecar carries two anchors per frame for every action:

- `hand_front` - `[x, y, deg]`: the centre of the front fist's grip, and the angle the held item points (degrees clockwise from straight up; idle about 150 = blade down-forward, attack strike about 60).
- `hand_back` - `[x, y]`: where an off-hand (shield, tome, lantern) is held.

Put a 1 art px dot per hand per frame on a hidden layer named `anchors` (front red, back blue). An anchor is the centre of that art pixel in authored pixels: `art x * 8 + 4`, `art y * 8 + 4`.

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
the Keeper, a masked mortal attuned to runes: deep hood, bird-like pale gold mask with a single violet eye-gem, black layered robe with aged-gold trim and an eclipse medallion glowing violet at the chest, short cape, soft boots; empty hands; about 2.5 heads tall, 40 art px from boots to hood. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f, mask ivory #8c7a58 #c9b98f #efe4c4. one frame on a 48x48 art-pixel cell, three-quarter side view facing right, empty hands (front fist loose, back hand open), feet on a ground line 2 art px above the cell bottom; for a sprite sheet with rows idle 4, run 8, jump 2, fall 2, attack 4, dodge 3, hurt 2, death 5. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 3072x3072 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, scenery, floor, cast shadow, front-facing view, left-facing view, multiple characters, cropped feet, weapon in hand
```

## Attachable equipment

Single-frame W4 sprites the engine draws at the Keeper's `hand_front` (weapons) or `hand_back` (off-hands), rotated to the anchor angle. Draw each **pointing straight up with the grip at the bottom**; the sidecar `pivot` is the centre of the grip in authored pixels. Same outline and palette rules as the Keeper; the engine rotates the sprite, so keep the blade 1-2 art px wide with a bright edge pixel that survives rotation. One sprite per weapon *class*; the engine maps every item to a class.

### `equip-sword` — one-handed sword

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/01-equip-sword.png` + sidecar `Assets/Sprites/Equipment/01-equip-sword.json` |
| Spec | W4 attachable equipment, single frame (pixel art) - 12x24 art px, export x8 nearest-neighbour = 96x192 px, transparent background |
| On screen | 96 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 12x24 art px = 96x192 authored; pivot = centre of the grip (state it in the sidecar) |
| Priority | P1 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 96, "h": 192}, "pivot": {"x": <grip x>, "y": <grip y>}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a straight longsword, dark steel blade, gold crossguard; drawn vertically, pointing straight up, grip at the bottom. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. one object on a 12x24 art-pixel canvas, drawn pointing straight up with the grip at the bottom, no hand. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 96x192 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, hand, character, multiple objects, diagonal or horizontal orientation, cast shadow
```

### `equip-axe` — one-handed axe

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/02-equip-axe.png` + sidecar `Assets/Sprites/Equipment/02-equip-axe.json` |
| Spec | W4 attachable equipment, single frame (pixel art) - 12x24 art px, export x8 nearest-neighbour = 96x192 px, transparent background |
| On screen | 96 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 12x24 art px = 96x192 authored; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 96, "h": 192}, "pivot": {"x": <grip x>, "y": <grip y>}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a bearded axe with a basalt head and ember edge; drawn vertically, pointing straight up, grip at the bottom. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. one object on a 12x24 art-pixel canvas, drawn pointing straight up with the grip at the bottom, no hand. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 96x192 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, hand, character, multiple objects, diagonal or horizontal orientation, cast shadow
```

### `equip-mace` — mace

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/03-equip-mace.png` + sidecar `Assets/Sprites/Equipment/03-equip-mace.json` |
| Spec | W4 attachable equipment, single frame (pixel art) - 12x24 art px, export x8 nearest-neighbour = 96x192 px, transparent background |
| On screen | 96 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 12x24 art px = 96x192 authored; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 96, "h": 192}, "pivot": {"x": <grip x>, "y": <grip y>}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a flanged iron mace with brass bands; drawn vertically, pointing straight up, grip at the bottom. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. one object on a 12x24 art-pixel canvas, drawn pointing straight up with the grip at the bottom, no hand. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 96x192 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, hand, character, multiple objects, diagonal or horizontal orientation, cast shadow
```

### `equip-dagger` — dagger

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/04-equip-dagger.png` + sidecar `Assets/Sprites/Equipment/04-equip-dagger.json` |
| Spec | W4 attachable equipment, single frame (pixel art) - 8x16 art px, export x8 nearest-neighbour = 64x128 px, transparent background |
| On screen | 64 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 8x16 art px = 64x128 authored; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 128}, "pivot": {"x": <grip x>, "y": <grip y>}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a curved dagger with a violet gem pommel; drawn vertically, pointing straight up, grip at the bottom. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. one object on a 8x16 art-pixel canvas, drawn pointing straight up with the grip at the bottom, no hand. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 64x128 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, hand, character, multiple objects, diagonal or horizontal orientation, cast shadow
```

### `equip-wand` — wand

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/05-equip-wand.png` + sidecar `Assets/Sprites/Equipment/05-equip-wand.json` |
| Spec | W4 attachable equipment, single frame (pixel art) - 8x16 art px, export x8 nearest-neighbour = 64x128 px, transparent background |
| On screen | 64 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 8x16 art px = 64x128 authored; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 128}, "pivot": {"x": <grip x>, "y": <grip y>}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a short rootwood wand tipped with a glowing crystal; drawn vertically, pointing straight up, grip at the bottom. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. one object on a 8x16 art-pixel canvas, drawn pointing straight up with the grip at the bottom, no hand. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 64x128 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, hand, character, multiple objects, diagonal or horizontal orientation, cast shadow
```

### `equip-hammer` — forge hammer

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/06-equip-hammer.png` + sidecar `Assets/Sprites/Equipment/06-equip-hammer.json` |
| Spec | W4 attachable equipment, single frame (pixel art) - 12x24 art px, export x8 nearest-neighbour = 96x192 px, transparent background |
| On screen | 96 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 12x24 art px = 96x192 authored; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 96, "h": 192}, "pivot": {"x": <grip x>, "y": <grip y>}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a heavy forge hammer, iron head, wrapped haft; drawn vertically, pointing straight up, grip at the bottom. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. one object on a 12x24 art-pixel canvas, drawn pointing straight up with the grip at the bottom, no hand. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 96x192 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, hand, character, multiple objects, diagonal or horizontal orientation, cast shadow
```

### `equip-basalt-edge` — Basalt Edge (quest blade)

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/07-equip-basalt-edge.png` + sidecar `Assets/Sprites/Equipment/07-equip-basalt-edge.json` |
| Spec | W4 attachable equipment, single frame (pixel art) - 12x24 art px, export x8 nearest-neighbour = 96x192 px, transparent background |
| On screen | 96 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 12x24 art px = 96x192 authored; pivot = centre of the grip (state it in the sidecar) |
| Priority | P1 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 96, "h": 192}, "pivot": {"x": <grip x>, "y": <grip y>}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
the Basalt Edge: a short basalt-black blade with live ember seams, the Seamworks quest reward; drawn vertically, pointing straight up, grip at the bottom. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. one object on a 12x24 art-pixel canvas, drawn pointing straight up with the grip at the bottom, no hand. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 96x192 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, hand, character, multiple objects, diagonal or horizontal orientation, cast shadow
```

### `equip-staff` — staff

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/08-equip-staff.png` + sidecar `Assets/Sprites/Equipment/08-equip-staff.json` |
| Spec | W4 attachable equipment, single frame (pixel art) - 12x40 art px, export x8 nearest-neighbour = 96x320 px, transparent background |
| On screen | 160 px long (taller than the Keeper's shoulder) in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 12x40 art px = 96x320 authored; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 96, "h": 320}, "pivot": {"x": <grip x>, "y": <grip y>}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a tall staff of obsidian with a brass orbit ring at the head; drawn vertically, pointing straight up, grip at the bottom. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. one object on a 12x40 art-pixel canvas, drawn pointing straight up with the grip at the bottom, no hand. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 96x320 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, hand, character, multiple objects, diagonal or horizontal orientation, cast shadow
```

### `equip-polearm` — polearm / glaive

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/09-equip-polearm.png` + sidecar `Assets/Sprites/Equipment/09-equip-polearm.json` |
| Spec | W4 attachable equipment, single frame (pixel art) - 12x40 art px, export x8 nearest-neighbour = 96x320 px, transparent background |
| On screen | 160 px long (taller than the Keeper's shoulder) in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 12x40 art px = 96x320 authored; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 96, "h": 320}, "pivot": {"x": <grip x>, "y": <grip y>}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a glaive with a crescent blade on a long dark haft; drawn vertically, pointing straight up, grip at the bottom. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. one object on a 12x40 art-pixel canvas, drawn pointing straight up with the grip at the bottom, no hand. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 96x320 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, hand, character, multiple objects, diagonal or horizontal orientation, cast shadow
```

### `equip-bow` — bow

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/10-equip-bow.png` + sidecar `Assets/Sprites/Equipment/10-equip-bow.json` |
| Spec | W4 attachable equipment, single frame (pixel art) - 16x32 art px, export x8 nearest-neighbour = 128x256 px, transparent background |
| On screen | 128 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 16x32 art px = 128x256 authored; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 128, "h": 256}, "pivot": {"x": <grip x>, "y": <grip y>}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a recurve bow of rootwood and brass, string straight; drawn vertically, pointing straight up, grip at the bottom. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. one object on a 16x32 art-pixel canvas, drawn pointing straight up with the grip at the bottom, no hand. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 128x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, hand, character, multiple objects, diagonal or horizontal orientation, cast shadow
```

### `equip-crossbow` — crossbow

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/11-equip-crossbow.png` + sidecar `Assets/Sprites/Equipment/11-equip-crossbow.json` |
| Spec | W4 attachable equipment, single frame (pixel art) - 24x16 art px, export x8 nearest-neighbour = 192x128 px, transparent background |
| On screen | 64 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 24x16 art px = 192x128 authored; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 192, "h": 128}, "pivot": {"x": <grip x>, "y": <grip y>}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a compact iron crossbow, loaded; drawn vertically, pointing straight up, grip at the bottom. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. one object on a 24x16 art-pixel canvas, drawn pointing straight up with the grip at the bottom, no hand. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 192x128 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, hand, character, multiple objects, diagonal or horizontal orientation, cast shadow
```

### `equip-shield` — off-hand shield

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/12-equip-shield.png` + sidecar `Assets/Sprites/Equipment/12-equip-shield.json` |
| Spec | W4 attachable equipment, single frame (pixel art) - 16x20 art px, export x8 nearest-neighbour = 128x160 px, transparent background |
| On screen | 80 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 16x20 art px = 128x160 authored; pivot = centre of the grip (state it in the sidecar) |
| Priority | P1 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 128, "h": 160}, "pivot": {"x": <grip x>, "y": <grip y>}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a kite shield of obsidian with a gold eclipse boss; drawn vertically, pointing straight up, grip at the bottom. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. one object on a 16x20 art-pixel canvas, drawn pointing straight up with the grip at the bottom, no hand. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 128x160 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, hand, character, multiple objects, diagonal or horizontal orientation, cast shadow
```

### `equip-tome` — off-hand tome

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/13-equip-tome.png` + sidecar `Assets/Sprites/Equipment/13-equip-tome.json` |
| Spec | W4 attachable equipment, single frame (pixel art) - 10x12 art px, export x8 nearest-neighbour = 80x96 px, transparent background |
| On screen | 48 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 10x12 art px = 80x96 authored; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 80, "h": 96}, "pivot": {"x": <grip x>, "y": <grip y>}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a thick tome with brass corners and a violet clasp; drawn vertically, pointing straight up, grip at the bottom. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. one object on a 10x12 art-pixel canvas, drawn pointing straight up with the grip at the bottom, no hand. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 80x96 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, hand, character, multiple objects, diagonal or horizontal orientation, cast shadow
```

### `equip-lantern` — off-hand lantern

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/14-equip-lantern.png` + sidecar `Assets/Sprites/Equipment/14-equip-lantern.json` |
| Spec | W4 attachable equipment, single frame (pixel art) - 8x16 art px, export x8 nearest-neighbour = 64x128 px, transparent background |
| On screen | 64 px long in towns and hunting grounds (4 px per art px); drawn at half size in the Delve (2 px per art px) |
| Cell | 8x16 art px = 64x128 authored; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 128}, "pivot": {"x": <grip x>, "y": <grip y>}}` |

**Design prompt** (key pose; clean up on the art-pixel grid and animate from it, style guide §14)

```text
a hanging lantern with a violet flame on a short chain; drawn vertically, pointing straight up, grip at the bottom. Godforge palette: obsidian #1e1428 #2e2238 #463650 #6a5878, aged gold #5a3c1a #a5793a #e8c898 #f8e8c8, eclipse violet #3a1f63 #7b3fc4 #a855f7 #d9b8ff, outline floor #140a1f. one object on a 8x16 art-pixel canvas, drawn pointing straight up with the grip at the bottom, no hand. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 64x128 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, hand, character, multiple objects, diagonal or horizontal orientation, cast shadow
```
