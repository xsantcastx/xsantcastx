# First test set — make these first

The owner wants to A/B the sprite world layer before committing to the full pack. Deliver exactly these
**seven sheets (plus sidecars)** at their final library paths; nothing here is throwaway, later deliveries just
add rows to the same sheets. Everything else in the pack waits for the verdict.

| # | Asset | Save as | Delivered actions |
|---|---|---|---|
| 1 | The Keeper | `Assets/Sprites/Characters/01-keeper.png` | idle 6, run 8, attack 6 (+ `hand_front` / `hand_back` anchors) |
| 2 | Rivet Maw | `Assets/Sprites/Creatures/01-rivet-maw.png` | idle 6, windup 4, strike 4 |
| 3 | Campfire | `Assets/Sprites/Props/01-infernal-campfire.png` | ambient loop |
| 4 | Bench | `Assets/Sprites/Props/02-infernal-bench.png` | single frame |
| 5 | Crafting Bench | `Assets/Sprites/Props/03-infernal-crafting-bench.png` | single frame |
| 6 | Forge anvil | `Assets/Sprites/Props/04-infernal-anvil.png` | ambient loop |
| 7 | Waystone | `Assets/Sprites/Props/05-infernal-waystone.png` | ambient loop |

For the test, the Keeper sidecar lists only `idle`, `run`, `attack` (rows 0-2) and Rivet Maw only `idle`,
`windup`, `strike`. The importer accepts any subset as long as the sheet's size matches the rows listed.

Example Keeper test sidecar (`Assets/Sprites/Characters/01-keeper.json`):

```json
{
  "scale": 2,
  "frame": { "w": 384, "h": 384 },
  "pivot": { "x": 192, "y": 368 },
  "actions": [
    { "name": "idle",   "frames": 6, "fps": 8,  "loop": true,
      "anchors": { "hand_front": [[236, 236, 150], [236, 238, 150], [236, 240, 150], [236, 240, 150], [236, 238, 150], [236, 236, 150]],
                   "hand_back":  [[150, 232], [150, 234], [150, 236], [150, 236], [150, 234], [150, 232]] } },
    { "name": "run",    "frames": 8, "fps": 12, "loop": true,  "anchors": { "hand_front": ["...8 points..."], "hand_back": ["...8 points..."] } },
    { "name": "attack", "frames": 6, "fps": 14, "loop": false, "anchors": { "hand_front": ["...6 points..."], "hand_back": ["...6 points..."] } }
  ]
}
```

(The `"..."` entries are placeholders for the real per-frame points — the importer rejects a list whose length
does not match `frames`.) Sheet size for that sidecar: 8 columns x 3 rows of 384 = **3072 x 1152 px**.

Then run:

```bash
python3 scripts/import-assets.py --only=Sprites
python3 scripts/import-assets.py --commissions     # confirms the seven landed
```

`spriteFor('keeper')`, `spriteFor('rivet-maw')` and `spriteFor('infernal-campfire')` etc. start returning
entries immediately. Drawing them in the side-scroller is a change in `src/app/play/**`, owned by the world-foundation work; until then the engine keeps its rig and rectangles.

## The seven briefs

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

### `rivet-maw` — Rivet Maw  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/01-rivet-maw.png` + sidecar `Assets/Sprites/Creatures/01-rivet-maw.json` |
| Spec | W2 creature sheet |
| On screen (1x) | body 150 px long, 105 px tall |
| Cell (authored 2x) | 384x288; pivot (192, 272) |
| Priority | P0 |
| Used in | Basalt Seamworks hunting ground (live now) |
| Shows today | the painted master bent by the mesh rig (Rivet Maw) / not in the world yet (others) |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 8 | yes | breathing / hover |
| 1 | `walk` | 8 | 10 | yes | patrol gait (flyers: drift) |
| 2 | `windup` | 4 | 10 | no | telegraph — the tell the player reacts to; exaggerate it |
| 3 | `strike` | 4 | 14 | no | the hit; frame 2 is the contact frame |
| 4 | `hurt` | 3 | 10 | no | recoil and flash-friendly pose |
| 5 | `death` | 6 | 8 | no | collapse; last frame may be empty (engine dissolves) |


No baked shadow: the engine draws the contact shadow (it must follow the creature).

**Design prompt** (key pose / model sheet; animate from it)

```text
Rivet Maw: a low, heavy, four-legged scavenger built of basalt hide and iron rivet plates, a square mechanical jaw of plates with ember-lit mouth seams, compulsive and territorial; match the approved painted master Creatures/Masters/03-rivet-maw.png in design; side view facing right. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-campfire` — Campfire  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Props/01-infernal-campfire.png` + sidecar `Assets/Sprites/Props/01-infernal-campfire.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 60 px tall |
| Cell (authored 2x) | 128x128; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P0 |
| Used in | Infernal town: camp rest point |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a camp fire ring of basalt stones with crossed iron-black logs and a lively ember-orange flame; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-bench` — Bench  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Props/02-infernal-bench.png` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 50 x 120 px |
| Cell (authored 2x) | 256x128; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P0 |
| Used in | Infernal town: camp seating |
| Shows today | flat rectangles or nothing |

**Design prompt** (key pose / model sheet; animate from it)

```text
a low bench made of a riveted iron beam on two basalt blocks; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-crafting-bench` — Crafting Bench  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Props/03-infernal-crafting-bench.png` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 100 x 150 px |
| Cell (authored 2x) | 320x224; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P0 |
| Used in | Infernal town: Crafting Bench station (crafting panel) |
| Shows today | flat rectangles or nothing |

**Design prompt** (key pose / model sheet; animate from it)

```text
a sturdy crafting bench of dark rootwood and iron bands with a vice, small brass tools and a rune-etched mat; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-anvil` — Forge anvil  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Props/04-infernal-anvil.png` + sidecar `Assets/Sprites/Props/04-infernal-anvil.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 90 x 120 px |
| Cell (authored 2x) | 256x192; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P0 |
| Used in | Infernal town: Seamworks forge station (repair / Basalt Edge) |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 4 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a heavy basalt-and-iron anvil on a riveted stone block with a small furnace mouth glowing behind it, tongs and hammer on top; ambient loop = furnace glow pulse; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `infernal-waystone` — Waystone  ★ FIRST TEST SET

| | |
|---|---|
| Save as | `Assets/Sprites/Props/05-infernal-waystone.png` + sidecar `Assets/Sprites/Props/05-infernal-waystone.json` |
| Spec | W6 prop (single frame or ambient loop) |
| On screen (1x) | 220 px tall |
| Cell (authored 2x) | 192x448; pivot = bottom-centre of the base (default when no sidecar) |
| Priority | P0 |
| Used in | Infernal town: Waystone travel panel |
| Shows today | flat rectangles or nothing |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `ambient` | 6 | 8 | yes | loop; frame 1 doubles as the still |


**Design prompt** (key pose / model sheet; animate from it)

```text
a standing waystone of ancient basalt masonry with a brass orbital ring circling it and five small realm sockets, the Infernal socket lit orange; ambient loop = ring turning, socket pulsing; side view with a slight high angle, standing on the ground line. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```
