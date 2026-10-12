# The Keeper and attachable equipment (world layer)

Sprite style guide, cell/pivot rules, the sidecar JSON schema and the scale table are in [../README.md](../README.md#world-layer--sprites). Image generators are poor at consistent multi-frame sheets: use the **design prompt** to fix the look (one key pose or a model sheet), then animate the frames from it by hand or in a sprite tool, keeping the cell grid and pivot exact.

### `keeper` — The Keeper  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Characters/01-keeper.png` + sidecar `Assets/Sprites/Characters/01-keeper.json` |
| Spec | W1 character sheet |
| On screen (1x) | figure 160 px tall (= 320 px authored) |
| Cell (authored 2x) | 384x384 per frame; pivot (192, 368) = between the feet on the ground line |
| Priority | P0 |
| Used in | the player and every remote Keeper in the side-scroller and towns (/play) |
| Shows today | the menu painting `keeper-base` bent by the mesh rig |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 8 | yes | breathing, cape drift; weapon hand relaxed at the hip |
| 1 | `run` | 8 | 12 | yes | contact on frames 1 and 5; cape trails; hood bobs |
| 2 | `jump` | 3 | 10 | no | crouch, takeoff, rise |
| 3 | `fall` | 2 | 8 | yes | apex, falling (loops) |
| 4 | `attack` | 6 | 14 | no | 2 anticipation (arm back), 1 strike with a smear arc, 3 follow-through |
| 5 | `dodge` | 4 | 14 | no | low dash, cape snapping behind |
| 6 | `hurt` | 3 | 10 | no | recoil, flinch, recover |
| 7 | `death` | 6 | 8 | no | optional — knees, fall, dissolve into violet motes (engine also fades) |


**Equipment is drawn by the engine, not painted in.** Draw the Keeper with **empty hands** (front hand
in a loose fist, back hand open). Weapons and off-hands are separate sprites (`world-sprites/01-keeper.md`,
"Attachable equipment") that the engine places on the hand every frame. To make that possible the sidecar
carries two anchors per frame for every action:

- `hand_front` — `[x, y, deg]`: the centre of the front fist's grip, and the angle the held weapon points
  (degrees clockwise from straight up; e.g. idle ≈ 150 = blade down-forward, attack strike ≈ 60).
- `hand_back` — `[x, y]`: where an off-hand (shield, tome, lantern) is held.

Easiest way to produce them: add a layer named `anchors` in the source file with a 2px dot per hand per
frame (front = red, back = blue), then read the coordinates off that layer into the JSON. Coordinates are cell-relative, in authored (2x) pixels.

**Design prompt** (key pose / model sheet; animate from it)

```text
the Keeper, a masked mortal attuned to runes: deep hood, bird-like pale gold mask with a single violet eye-gem, black layered robe with aged-gold trim and an eclipse medallion glowing violet at the chest, short cape, soft boots; empty hands; about 2.75 heads tall; three-quarter side view facing right. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

## Attachable equipment

Single-frame sprites the engine draws at the Keeper's `hand_front` (weapons) or `hand_back` (off-hands), rotated to the anchor angle. Draw each **pointing straight up with the grip at the bottom**; the sidecar `pivot` is the centre of the grip. Same outline weight and palette rules as the Keeper. One sprite per weapon *class*; the engine maps every item to a class.

### `equip-sword` — one-handed sword

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/01-equip-sword.png` |
| Spec | W4 attachable equipment (single frame) |
| On screen (1x) | 96 px long |
| Cell (authored 2x) | 96x192 single frame; pivot = centre of the grip (state it in the sidecar) |
| Priority | P1 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |

**Design prompt** (key pose / model sheet; animate from it)

```text
a straight longsword, dark steel blade, gold crossguard; drawn vertically, pointing straight up, grip at the bottom; single object. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `equip-axe` — one-handed axe

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/02-equip-axe.png` |
| Spec | W4 attachable equipment (single frame) |
| On screen (1x) | 96 px long |
| Cell (authored 2x) | 96x192 single frame; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |

**Design prompt** (key pose / model sheet; animate from it)

```text
a bearded axe with a basalt head and ember edge; drawn vertically, pointing straight up, grip at the bottom; single object. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `equip-mace` — mace

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/03-equip-mace.png` |
| Spec | W4 attachable equipment (single frame) |
| On screen (1x) | 96 px long |
| Cell (authored 2x) | 96x192 single frame; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |

**Design prompt** (key pose / model sheet; animate from it)

```text
a flanged iron mace with brass bands; drawn vertically, pointing straight up, grip at the bottom; single object. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `equip-dagger` — dagger

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/04-equip-dagger.png` |
| Spec | W4 attachable equipment (single frame) |
| On screen (1x) | 64 px long |
| Cell (authored 2x) | 64x128 single frame; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |

**Design prompt** (key pose / model sheet; animate from it)

```text
a curved dagger with a violet gem pommel; drawn vertically, pointing straight up, grip at the bottom; single object. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `equip-wand` — wand

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/05-equip-wand.png` |
| Spec | W4 attachable equipment (single frame) |
| On screen (1x) | 64 px long |
| Cell (authored 2x) | 64x128 single frame; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |

**Design prompt** (key pose / model sheet; animate from it)

```text
a short rootwood wand tipped with a glowing crystal; drawn vertically, pointing straight up, grip at the bottom; single object. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `equip-hammer` — forge hammer

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/06-equip-hammer.png` |
| Spec | W4 attachable equipment (single frame) |
| On screen (1x) | 96 px long |
| Cell (authored 2x) | 96x192 single frame; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |

**Design prompt** (key pose / model sheet; animate from it)

```text
a heavy forge hammer, iron head, wrapped haft; drawn vertically, pointing straight up, grip at the bottom; single object. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `equip-basalt-edge` — Basalt Edge (quest blade)

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/07-equip-basalt-edge.png` |
| Spec | W4 attachable equipment (single frame) |
| On screen (1x) | 96 px long |
| Cell (authored 2x) | 96x192 single frame; pivot = centre of the grip (state it in the sidecar) |
| Priority | P1 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |

**Design prompt** (key pose / model sheet; animate from it)

```text
the Basalt Edge: a short basalt-black blade with live ember seams, the Seamworks quest reward; drawn vertically, pointing straight up, grip at the bottom; single object. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `equip-staff` — staff

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/08-equip-staff.png` |
| Spec | W4 attachable equipment (single frame) |
| On screen (1x) | 160 px long (taller than the Keeper's shoulder) |
| Cell (authored 2x) | 96x320 single frame; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |

**Design prompt** (key pose / model sheet; animate from it)

```text
a tall staff of obsidian with a brass orbit ring at the head; drawn vertically, pointing straight up, grip at the bottom; single object. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `equip-polearm` — polearm / glaive

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/09-equip-polearm.png` |
| Spec | W4 attachable equipment (single frame) |
| On screen (1x) | 160 px long (taller than the Keeper's shoulder) |
| Cell (authored 2x) | 96x320 single frame; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |

**Design prompt** (key pose / model sheet; animate from it)

```text
a glaive with a crescent blade on a long dark haft; drawn vertically, pointing straight up, grip at the bottom; single object. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `equip-bow` — bow

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/10-equip-bow.png` |
| Spec | W4 attachable equipment (single frame) |
| On screen (1x) | 128 px long |
| Cell (authored 2x) | 128x256 single frame; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |

**Design prompt** (key pose / model sheet; animate from it)

```text
a recurve bow of rootwood and brass, string straight; drawn vertically, pointing straight up, grip at the bottom; single object. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `equip-crossbow` — crossbow

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/11-equip-crossbow.png` |
| Spec | W4 attachable equipment (single frame) |
| On screen (1x) | 64 px long |
| Cell (authored 2x) | 192x128 single frame; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |

**Design prompt** (key pose / model sheet; animate from it)

```text
a compact iron crossbow, loaded; drawn vertically, pointing straight up, grip at the bottom; single object. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `equip-shield` — off-hand shield

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/12-equip-shield.png` |
| Spec | W4 attachable equipment (single frame) |
| On screen (1x) | 80 px long |
| Cell (authored 2x) | 128x160 single frame; pivot = centre of the grip (state it in the sidecar) |
| Priority | P1 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |

**Design prompt** (key pose / model sheet; animate from it)

```text
a kite shield of obsidian with a gold eclipse boss; drawn vertically, pointing straight up, grip at the bottom; single object. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `equip-tome` — off-hand tome

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/13-equip-tome.png` |
| Spec | W4 attachable equipment (single frame) |
| On screen (1x) | 48 px long |
| Cell (authored 2x) | 80x96 single frame; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |

**Design prompt** (key pose / model sheet; animate from it)

```text
a thick tome with brass corners and a violet clasp; drawn vertically, pointing straight up, grip at the bottom; single object. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `equip-lantern` — off-hand lantern

| | |
|---|---|
| Save as | `Assets/Sprites/Equipment/14-equip-lantern.png` |
| Spec | W4 attachable equipment (single frame) |
| On screen (1x) | 64 px long |
| Cell (authored 2x) | 64x128 single frame; pivot = centre of the grip (state it in the sidecar) |
| Priority | P2 |
| Used in | held by the Keeper sprite at `hand_front` / `hand_back`; the engine maps each item to one of these classes |
| Shows today | nothing drawn in hand (or the painted Basalt Edge, scaled) |

**Design prompt** (key pose / model sheet; animate from it)

```text
a hanging lantern with a violet flame on a short chain; drawn vertically, pointing straight up, grip at the bottom; single object. shared palette: obsidian, aged gold, restrained violet glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```
