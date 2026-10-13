# First test set — make these first

**Art direction (owner, 2026-10-13): Terraria-style pixel art** ([docs/art/style-guide.md](../art/style-guide.md)).
This set replaces the earlier seven-sheet test (Keeper, Rivet Maw and five smooth Infernal props): it is picked to
prove the *new* style end to end, from a character's animation to auto-tiled terrain, item icons and a parallax
sky. Deliver these **21 files** (plus sidecars) at their final library paths; nothing here is throwaway, later
deliveries only add rows to the same sheets. Everything else waits for the A/B verdict.

| # | What it proves | Asset | Save as (under `Assets/`) | Deliver |
|---|---|---|---|---|
| 1 | a character's pixel density, outline and animation | The Keeper | `Sprites/Characters/01-keeper.png` | `idle` 4, `run` 8 (walk), `attack` 4 (swing), with `hand_front` / `hand_back` anchors |
| 2 | a creature and its telegraph | Rivet Maw | `Sprites/Creatures/01-rivet-maw.png` | `idle` 4, `windup` 3, `strike` 3 |
| 3 | a keeper NPC next to the Keeper | Kael (world sprite) | `Sprites/NPCs/01-npc-kael.png` | `idle` 4, `talk` 2 |
| 4 | soil, top faces, Root Hollows | Loose dirt | `Sprites/Tiles/01-tile-dirt.png` | full W7a sheet |
| 5 | the default wall | Basalt | `Sprites/Tiles/04-tile-rock.png` | full W7a sheet |
| 6 | a harder stone reading apart from basalt | Hard basalt | `Sprites/Tiles/05-tile-hard-rock.png` | full W7a sheet |
| 7 | the floor of everything | Bedrock | `Sprites/Tiles/07-tile-bedrock.png` | full W7a sheet |
| 8 | ore that reads from across the screen | Cinder Ore vein | `Sprites/Tiles/15-tile-cinder-vein.png` | full W7a sheet |
| 9 | the Glowcap Grotto palette | Grotto stone | `Sprites/Tiles/11-tile-grotto-stone.png` | full W7a sheet |
| 10 | the Magma Halls palette | Scorched basalt | `Sprites/Tiles/13-tile-scorched-basalt.png` | full W7a sheet |
| 11 | a placed block reading as masonry | Basalt block | `Sprites/Tiles/06-tile-basalt-block.png` | full W7a sheet |
| 12 | a tool icon | Pickaxe I | `Items/ArtBible/Tools/124-pickaxe-1-idle.png` | I1 icon |
| 13 | a placeable's icon | Torch | `Items/Materials/19-torch.png` | I1 icon |
| 14 | a block's icon matching its tile | Dirt Block | `Items/Materials/17-dirt-block.png` | I1 icon |
| 15 | a glowing material | Glowcap | `Items/Materials/15-glowcap.png` | I1 icon |
| 16 | a quest item | Kael's Hammer | `Items/Quest/05-kaels-hammer.png` | I1 icon |
| 17 | a named unique in a rarity slot | Tinder's Due | `Items/ArtBible/Armor/101-unique-tinders-due-idle.png` | I1 icon |
| 18–21 | a parallax sky behind the town | Basalt Seamworks sky, far, mid, near | `Sprites/Parallax/01..04-parallax-infernal-*.png` | four W8 layers |

The eight tiles are four Delve biomes (Root Hollows, Basalt Caverns, Glowcap Grotto, Magma Halls) plus the
shared bedrock and one placed block, so the A/B sees every tile palette and the natural/placed contrast.

## Test sidecars

The full sheets list more rows (see each brief); for the test, a sidecar lists only the delivered rows, and the
sheet is exactly as big as those rows. The importer accepts any subset.

| Sheet | Rows in the test sidecar | Sheet size |
|---|---|---|
| Keeper | `idle` 4, `run` 8, `attack` 4 | 8 x 3 cells of 384 x 384 = **3072 x 1152** (48 x 48 art px x8) |
| Rivet Maw | `idle` 4, `windup` 3, `strike` 3 | 4 x 3 cells of 384 x 288 = **1536 x 864** |
| Kael | `idle` 4, `talk` 2 | 4 x 2 cells of 320 x 384 = **1280 x 768** |
| Each tile | all seven W7a rows | **256 x 448**; also save a 256 x 64 crop of row 0 for the in-game check (below) |
| Each parallax layer | `layer` 1 | **3840 x 1536** |

Keeper test sidecar (`Assets/Sprites/Characters/01-keeper.json`); the anchor points are examples, read yours
off the `anchors` layer (`art x * 8 + 4`):

```json
{
  "scale": 2,
  "pixelArt": true,
  "frame": { "w": 384, "h": 384 },
  "pivot": { "x": 192, "y": 368 },
  "actions": [
    { "name": "idle",   "frames": 4, "fps": 6,  "loop": true,
      "anchors": { "hand_front": [[212, 260, 150], [212, 268, 150], [212, 268, 150], [212, 260, 150]],
                   "hand_back":  [[164, 260], [164, 268], [164, 268], [164, 260]] } },
    { "name": "run",    "frames": 8, "fps": 12, "loop": true,  "anchors": { "hand_front": ["...8 points..."], "hand_back": ["...8 points..."] } },
    { "name": "attack", "frames": 4, "fps": 14, "loop": false, "anchors": { "hand_front": ["...4 points..."], "hand_back": ["...4 points..."] } }
  ]
}
```

(The `"..."` entries are placeholders: the importer rejects a list whose length does not match `frames`.)

## How the A/B runs

```bash
python3 scripts/import-assets.py --check --only=Sprites     # validate, writes nothing
python3 scripts/import-assets.py --only=Sprites             # Keeper, Rivet Maw, Kael (+ tile row-0 crops)
python3 scripts/import-assets.py --only=Items               # the six icons
python3 scripts/import-assets.py --commissions              # confirms what landed
```

- **In game today:** the Keeper, Rivet Maw and Kael switch to their sheets in the Basalt Seamworks the moment
  they import (`docs/handoff/sprite-renderer.md`); the six icons show in the bag, hotbar and Inspect.
- **Tiles:** the tile importer takes one-row strips only, so for the in-game look import the **row-0 crop**
  (`NN-tile-<id>.png`, 256 x 64, sidecar `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64},
  "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}]}`) and keep the full sheet beside the
  library for review. Edges, top faces and corners show in game once IMP-1 and RND-1 land (style guide §12).
- **Parallax:** reviewed as images until IMP-2 and RND-2 add a parallax family and renderer; then it replaces
  `bg-basalt-seamworks` behind the town.
- **Verdict:** go / no-go for the full pass, per class (characters, creatures, tiles, icons, parallax). A
  no-go on one class does not block the others.

## The 21 briefs

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

### `tile-dirt` — Loose dirt  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/01-tile-dirt.png` + sidecar `Assets/Sprites/Tiles/01-tile-dirt.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Root Hollows band, every dug seam; the most-seen tile in the Delve |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_Interior row 0 alone imports today (crop it to 256x64 with the one-action W7 sidecar); the full sheet needs the auto-tile importer and renderer (style guide IMP-1, RND-1). Keep the full sheet in the library._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a cell of loose brown earth with small pebbles, a few pale root threads and crumbs of darker soil; warm browns #5b3b2c and #7f5640, flecks #8c6a4f. Root Hollows palette: back wall #0a0706 #16100c #1a130f, spores #c9b27a, top-face fringe #c9b27a. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-rock` — Basalt  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/04-tile-rock.png` + sidecar `Assets/Sprites/Tiles/04-tile-rock.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Basalt Caverns band; the default wall of the Delve (node id `rock`) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_Interior row 0 alone imports today (crop it to 256x64 with the one-action W7 sidecar); the full sheet needs the auto-tile importer and renderer (style guide IMP-1, RND-1). Keep the full sheet in the library._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
cut basalt with a few angular cracks and a pale fleck of mica; dark violet-grey stone #2a2027 with edges #443540. Basalt Caverns palette: back wall #0a0608 #160e12 #1a1115, basalt #241a1c #3a2b2c #5a4440 #6b5148, ash #8a7468, top-face lip #7a6058. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-hard-rock` — Hard basalt  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/05-tile-hard-rock.png` + sidecar `Assets/Sprites/Tiles/05-tile-hard-rock.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Basalt Caverns / Magma Halls; takes 4 hits (node id `hard-rock`) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_Interior row 0 alone imports today (crop it to 256x64 with the one-action W7 sidecar); the full sheet needs the auto-tile importer and renderer (style guide IMP-1, RND-1). Keep the full sheet in the library._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
dense dark basalt with tight crossing fractures and a heavier look than plain basalt; #2a2027 with highlights #57474f. Basalt Caverns palette: back wall #0a0608 #160e12 #1a1115, basalt #241a1c #3a2b2c #5a4440 #6b5148, ash #8a7468, top-face lip #7a6058. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-bedrock` — Bedrock  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/07-tile-bedrock.png` + sidecar `Assets/Sprites/Tiles/07-tile-bedrock.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: floor and edge of every cavern; cannot be dug |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_Interior row 0 alone imports today (crop it to 256x64 with the one-action W7 sidecar); the full sheet needs the auto-tile importer and renderer (style guide IMP-1, RND-1). Keep the full sheet in the library._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
near-black unbreakable bedrock, smooth and slightly glassy with only a few faint hairline cracks, deliberately featureless so it reads as nothing happens here; #141016 with #2d2430 flecks. Delve palette: bedrock #09070a #141016 #231c25 #2d2430, back walls #0a0608 #160e12 #1a1115. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-cinder-vein` — Cinder Ore vein  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/15-tile-cinder-vein.png` + sidecar `Assets/Sprites/Tiles/15-tile-cinder-vein.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Root Hollows, Basalt Caverns; pickaxe I, yields `cinder-ore` |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_Interior row 0 alone imports today (crop it to 256x64 with the one-action W7 sidecar); the full sheet needs the auto-tile importer and renderer (style guide IMP-1, RND-1). Keep the full sheet in the library._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
basalt holding chunky nodules of cinder ore, glowing orange-red seams #ff9b4f inside black ore; ore stays inside the cell. Basalt Caverns palette: back wall #0a0608 #160e12 #1a1115, basalt #241a1c #3a2b2c #5a4440 #6b5148, ash #8a7468, top-face lip #7a6058. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-grotto-stone` — Grotto stone  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/11-tile-grotto-stone.png` + sidecar `Assets/Sprites/Tiles/11-tile-grotto-stone.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Glowcap Grotto band (rows 26-39) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_Interior row 0 alone imports today (crop it to 256x64 with the one-action W7 sidecar); the full sheet needs the auto-tile importer and renderer (style guide IMP-1, RND-1). Keep the full sheet in the library._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
cool slate-blue wet stone #0f1820 with damp highlights and tiny pale-cyan crystal specks #5fb8e8. Glowcap Grotto palette: back wall #05090c #0c141b #0f1820, grotto stone #141d24 #22303a #3c5664 #6fa8c0, glow #7fc8ff #a8e4ff, wet top-face sheen #8fd0e8. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-scorched-basalt` — Scorched basalt  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/13-tile-scorched-basalt.png` + sidecar `Assets/Sprites/Tiles/13-tile-scorched-basalt.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: Magma Halls band (rows 40-55) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_Interior row 0 alone imports today (crop it to 256x64 with the one-action W7 sidecar); the full sheet needs the auto-tile importer and renderer (style guide IMP-1, RND-1). Keep the full sheet in the library._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
basalt blackened and scorched, with ash-brown streaks and a single faint ember line #ff9b4f, base #1e0d0a. Magma Halls palette: back wall #0b0403 #190a08 #1e0d0a, scorched basalt #220f0e #3a1e1c #6a3328 #ff6a3a, hot top-face crust #ff8a3d. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

### `tile-basalt-block` — Basalt block (placed)  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Tiles/06-tile-basalt-block.png` + sidecar `Assets/Sprites/Tiles/06-tile-basalt-block.json` |
| Spec | W7a auto-tile sheet (pixel art) - 16x16 art px cells, 4 x 7 grid = 64x112 art px, export x4 nearest-neighbour = 256x448, OPAQUE interior row, rounded transparent outer corners on edge pieces |
| On screen | 32 x 32 px (one Delve cell, 2 px per art px) |
| Cell | 16x16 art px = 64x64 authored; fills the cell |
| Priority | P0 |
| Used in | Ember Delve: the player-placed Basalt block (stack `basalt-block`) |
| Shows today | flat colour fill drawn in code (terrain-render.ts) |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}, {"name": "top", "frames": 4, "fps": 0, "loop": false}, {"name": "bottom", "frames": 4, "fps": 0, "loop": false}, {"name": "sides", "frames": 4, "fps": 0, "loop": false}, {"name": "thin", "frames": 4, "fps": 0, "loop": false}, {"name": "caps", "frames": 4, "fps": 0, "loop": false}, {"name": "inner", "frames": 4, "fps": 0, "loop": false}]}` |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `tile` | 4 | 0 | no | four interior variants (no side open); fully opaque and seamless with each other |
| 1 | `top` | 4 | 0 | no | top A, top B, top-left corner, top-right corner: a 2 art px lit lip over a 1 px outline |
| 2 | `bottom` | 4 | 0 | no | bottom A, bottom B, bottom-left, bottom-right |
| 3 | `sides` | 4 | 0 | no | left A, left B, right A, right B: 1 px outline + 1 px bevel |
| 4 | `thin` | 4 | 0 | no | ledge (N+S open), pillar (E+W open), single A, single B (all four open) |
| 5 | `caps` | 4 | 0 | no | pillar top (N+E+W), pillar foot (S+E+W), ledge left (N+S+W), ledge right (N+S+E) |
| 6 | `inner` | 4 | 0 | no | inner corners NW, NE, SW, SE: interior with a 2x2 art px notch of outline and bevel |

_Interior row 0 alone imports today (crop it to 256x64 with the one-action W7 sidecar); the full sheet needs the auto-tile importer and renderer (style guide IMP-1, RND-1). Keep the full sheet in the library._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
a squared basalt block with chiselled edge lines like laid masonry, one brick-sized seam, clean and regular so it reads as built; #2a2027 and #443540. Basalt Caverns palette: back wall #0a0608 #160e12 #1a1115, basalt #241a1c #3a2b2c #5a4440 #6b5148, ash #8a7468, top-face lip #7a6058. a 16x16 art-pixel terrain block drawn as a 4 by 7 auto-tile sheet (64x112 art px): four seamless opaque interior variants, top faces with a 2 art px lit lip, outlined and bevelled sides and bottoms, outer corners rounded off by 1-2 art px, one-cell ledges, pillars and singles, inner corners; flat elevation view, no perspective; ore and glow stay 2 art px inside the cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; opaque interior row, transparent only outside the rounded edge silhouettes; export with nearest-neighbour x4 to 256x448 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, perspective, isometric view, visible seams between interior variants, edge vignette, glow bleeding past the cell, transparent pixels in the interior row, bevel on interior pieces
```

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

### `unique-tinders-due` — Tinder's Due  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Items/ArtBible/Armor/101-unique-tinders-due-idle.png` |
| Spec | I1 item icon (pixel art) - 32x32 art px, export x8 nearest-neighbour = 256x256 PNG, transparent background, no rarity aura |
| On screen | 32 / 64 / 128 px (hotbar, bag, Inspect: whole multiples only) |
| Priority | P0 |
| Used in | bag tile, Inspect panel, paper doll, Collection Log, discovery toast, Gambler reveal |
| Shows today | Uncommon rarity orb |

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
Tinder's Due, an uncommon named hands item: a pair of soot-blackened leather forge gloves lying crossed, still faintly glowing ember-orange at the fingertips as if warm a year after being left on an anvil. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one item icon on a 32x32 art-pixel canvas, the item filling about 28x28 art px with a transparent margin, long items on the diagonal from lower left to upper right, no rarity glow. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, a 1-pixel coloured outline (the darkest shade of the material it borders, never pure black, floor #140a1f) with a lighter selective outline on the lit upper-left edges, 3 to 4 hue-shifted tones per material plus one highlight, light from the upper left, saturated readable colours, no anti-aliasing on the silhouette, no dithering, no soft glow past the silhouette; transparent background; export with nearest-neighbour x8 to 256x256 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, background, slot frame, rarity aura, glow ring, multiple items, hand holding it, cropped item, cast shadow, isometric view
```

### `parallax-infernal-sky` — Infernal parallax: Sky  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Parallax/01-parallax-infernal-sky.png` + sidecar `Assets/Sprites/Parallax/01-parallax-infernal-sky.json` |
| Spec | W8 parallax layer (pixel art) - 480x192 art px, seamless left to right, export x8 nearest-neighbour = 3840x1536, opaque |
| On screen | 1920 x 768 logical px per repeat (4 px per art px), tiled horizontally |
| Priority | P0 |
| Used in | Basalt Seamworks (Infernal town and hunting ground) in-world background, `sky` layer, scroll factor 0.0-0.05; replaces the painted bg-basalt-seamworks once a parallax family and renderer exist (style guide IMP-2, RND-2) |
| Shows today | the painted bg-basalt-seamworks backdrop |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 3840, "h": 1536}, "actions": [{"name": "layer", "frames": 1, "fps": 0, "loop": false}]}` |

_Scroll factor 0.0-0.05. No importer family or renderer exists yet (style guide IMP-2, RND-2): the file is tracked by `--commissions` and waits in the library with its sidecar._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
the Basalt Seamworks sky: a low ember-dusk sky over the forge quarter in five flat colour bands from #120a0c at the top through #2a1210 and #4a1c14 to #7a2e1a at the horizon, one 2-tone checker row between bands, a dark eclipse disc with a thin #a855f7 and #ffd08a corona in the upper left, a few ash flecks #8a7468. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one parallax layer, 480x192 art px, seamless left to right, the bottom edge is the town ground line, opaque, atmospheric perspective towards the horizon colour. hand-placed pixel art for a 2D sandbox side-scroller background, every pixel on the art-pixel grid, flat colour shapes with 2 to 3 tones each, no outline except on the near layer, light from the upper left, colours pulled towards the horizon colour the further back the layer sits, no anti-aliasing, dithering only as one 2-tone checker row between sky bands; export with nearest-neighbour x8 to 3840x1536 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, characters, people, creatures, readable signs, light from the right, walkable platforms, foreground objects in the walk lane, outlines on far layers
```

### `parallax-infernal-far` — Infernal parallax: Far ridge  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Parallax/02-parallax-infernal-far.png` + sidecar `Assets/Sprites/Parallax/02-parallax-infernal-far.json` |
| Spec | W8 parallax layer (pixel art) - 480x192 art px, seamless left to right, export x8 nearest-neighbour = 3840x1536, transparent above the silhouette |
| On screen | 1920 x 768 logical px per repeat (4 px per art px), tiled horizontally |
| Priority | P0 |
| Used in | Basalt Seamworks (Infernal town and hunting ground) in-world background, `far` layer, scroll factor 0.15-0.25; replaces the painted bg-basalt-seamworks once a parallax family and renderer exist (style guide IMP-2, RND-2) |
| Shows today | the painted bg-basalt-seamworks backdrop |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 3840, "h": 1536}, "actions": [{"name": "layer", "frames": 1, "fps": 0, "loop": false}]}` |

_Scroll factor 0.15-0.25. No importer family or renderer exists yet (style guide IMP-2, RND-2): the file is tracked by `--commissions` and waits in the library with its sidecar._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
the far horizon of the Infernal realm: a jagged basalt ridge with the silhouettes of great forge chimneys and the broken ring of a Godforge-era furnace, rim-lit along the top by the ember sky, at most 4 colours close to the horizon colour #7a2e1a, no outline. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one parallax layer, 480x192 art px, seamless left to right, the bottom edge is the town ground line, transparent above the silhouette, atmospheric perspective towards the horizon colour. hand-placed pixel art for a 2D sandbox side-scroller background, every pixel on the art-pixel grid, flat colour shapes with 2 to 3 tones each, no outline except on the near layer, light from the upper left, colours pulled towards the horizon colour the further back the layer sits, no anti-aliasing, dithering only as one 2-tone checker row between sky bands; export with nearest-neighbour x8 to 3840x1536 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, characters, people, creatures, readable signs, light from the right, walkable platforms, foreground objects in the walk lane, outlines on far layers
```

### `parallax-infernal-mid` — Infernal parallax: Foundry terraces  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Parallax/03-parallax-infernal-mid.png` + sidecar `Assets/Sprites/Parallax/03-parallax-infernal-mid.json` |
| Spec | W8 parallax layer (pixel art) - 480x192 art px, seamless left to right, export x8 nearest-neighbour = 3840x1536, transparent above the silhouette |
| On screen | 1920 x 768 logical px per repeat (4 px per art px), tiled horizontally |
| Priority | P0 |
| Used in | Basalt Seamworks (Infernal town and hunting ground) in-world background, `mid` layer, scroll factor 0.4-0.5; replaces the painted bg-basalt-seamworks once a parallax family and renderer exist (style guide IMP-2, RND-2) |
| Shows today | the painted bg-basalt-seamworks backdrop |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 3840, "h": 1536}, "actions": [{"name": "layer", "frames": 1, "fps": 0, "loop": false}]}` |

_Scroll factor 0.4-0.5. No importer family or renderer exists yet (style guide IMP-2, RND-2): the file is tracked by `--commissions` and waits in the library with its sidecar._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
mid-distance foundry terraces: stepped basalt walls, iron gantries and cranes, furnace mouths seen as small #E8752A windows, two thin heat-haze bands; at most 6 colours, no outline. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one parallax layer, 480x192 art px, seamless left to right, the bottom edge is the town ground line, transparent above the silhouette, atmospheric perspective towards the horizon colour. hand-placed pixel art for a 2D sandbox side-scroller background, every pixel on the art-pixel grid, flat colour shapes with 2 to 3 tones each, no outline except on the near layer, light from the upper left, colours pulled towards the horizon colour the further back the layer sits, no anti-aliasing, dithering only as one 2-tone checker row between sky bands; export with nearest-neighbour x8 to 3840x1536 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, characters, people, creatures, readable signs, light from the right, walkable platforms, foreground objects in the walk lane, outlines on far layers
```

### `parallax-infernal-near` — Infernal parallax: Smokestacks  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Parallax/04-parallax-infernal-near.png` + sidecar `Assets/Sprites/Parallax/04-parallax-infernal-near.json` |
| Spec | W8 parallax layer (pixel art) - 480x192 art px, seamless left to right, export x8 nearest-neighbour = 3840x1536, transparent above the silhouette |
| On screen | 1920 x 768 logical px per repeat (4 px per art px), tiled horizontally |
| Priority | P0 |
| Used in | Basalt Seamworks (Infernal town and hunting ground) in-world background, `near` layer, scroll factor 0.65-0.75; replaces the painted bg-basalt-seamworks once a parallax family and renderer exist (style guide IMP-2, RND-2) |
| Shows today | the painted bg-basalt-seamworks backdrop |
| Sidecar | `{"scale": 2, "pixelArt": true, "frame": {"w": 3840, "h": 1536}, "actions": [{"name": "layer", "frames": 1, "fps": 0, "loop": false}]}` |

_Scroll factor 0.65-0.75. No importer family or renderer exists yet (style guide IMP-2, RND-2): the file is tracked by `--commissions` and waits in the library with its sidecar._

**Prompt** (design; clean up on the art-pixel grid, style guide §14)

```text
the near background behind the walk lane: thick iron-black smokestacks, slag heaps with #ff9b4f ember seams, a hanging chain and a cold crane hook; the bottom 24 art px low, dark and flat so nothing looks walkable; at most 8 colours, a 1 px outline lighter than any play-layer outline. Infernal palette: basalt #241a1c #3a2b2c #5a4440 #6b5148, iron black #171116 #2a2027 #443540, ember #7a2a12 #c4501e #E8752A, emissive #ff9b4f #ffd08a. one parallax layer, 480x192 art px, seamless left to right, the bottom edge is the town ground line, transparent above the silhouette, atmospheric perspective towards the horizon colour. hand-placed pixel art for a 2D sandbox side-scroller background, every pixel on the art-pixel grid, flat colour shapes with 2 to 3 tones each, no outline except on the near layer, light from the upper left, colours pulled towards the horizon colour the further back the layer sits, no anti-aliasing, dithering only as one 2-tone checker row between sky bands; export with nearest-neighbour x8 to 3840x1536 px.
```

**Negative**

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, brush strokes, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, rotated or resized pixels, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo, text, letters, UI, watermark, signature, frame, border, copied or traced sprites from any existing game, skulls, horns, demonic anatomy, angel wings, halo, real-world religious iconography, characters, people, creatures, readable signs, light from the right, walkable platforms, foreground objects in the walk lane, outlines on far layers
```
