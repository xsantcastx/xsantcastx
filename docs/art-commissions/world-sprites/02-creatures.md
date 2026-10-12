# Hunting-ground creatures (world layer)

Sprite style guide, cell/pivot rules, the sidecar JSON schema and the scale table are in [../README.md](../README.md#world-layer--sprites). Image generators are poor at consistent multi-frame sheets: use the **design prompt** to fix the look (one key pose or a model sheet), then animate the frames from it by hand or in a sprite tool, keeping the cell grid and pivot exact.

Each creature also has a painted master for the Codex (`Creatures/Masters/`); the sprite must be recognisably the same animal.

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

### `prism-forager` — Prism Forager

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/02-prism-forager.png` + sidecar `Assets/Sprites/Creatures/02-prism-forager.json` |
| Spec | W2 creature sheet |
| On screen (1x) | 165 px tall |
| Cell (authored 2x) | 320x384; pivot (160, 368) |
| Priority | P1 |
| Used in | Luminous hunting ground (Phase 2) |
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
Prism Forager: a human-height faceted crystal forager of ivory, warm gold and clear crystal with a hollow chest holding refracted gestures; fastidious and communal; match Creatures/Masters/01-prism-forager.png; side view facing right. Luminous sprite palette: warm gold #E8D44D, ivory, pale crystal, sunlit stone. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `ephemeris-leech` — Ephemeris Leech

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/03-ephemeris-leech.png` + sidecar `Assets/Sprites/Creatures/03-ephemeris-leech.json` |
| Spec | W2 creature sheet |
| On screen (1x) | 70 px tall, 110 px long |
| Cell (authored 2x) | 320x224; pivot (160, 208) |
| Priority | P1 |
| Used in | Celestial hunting ground (Phase 2) |
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
Ephemeris Leech: a jointed star-silver crawler like a folded measuring tool with a dark blue glass abdomen, constellation sparks leaking from its seams; patient, nearly invisible; match Creatures/Masters/02-ephemeris-leech.png; side view facing right. Celestial sprite palette: midnight blue, star silver, brass, cyan glints. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `mirror-substitute` — Mirror Substitute

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/04-mirror-substitute.png` + sidecar `Assets/Sprites/Creatures/04-mirror-substitute.json` |
| Spec | W2 creature sheet |
| On screen (1x) | 165 px tall |
| Cell (authored 2x) | 320x384; pivot (160, 368) |
| Priority | P1 |
| Used in | Umbral hunting ground (Phase 2) |
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
Mirror Substitute: a person-sized asymmetrical reflection made of obsidian mirror fragments, its face only resolving in reflected surfaces; charming, attentive; match Creatures/Masters/04-mirror-substitute.png; side view facing right. Umbral sprite palette: black-violet, amethyst #A855F7, obsidian, moonlight grey. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `rootglass-stag` — Rootglass Stag

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/05-rootglass-stag.png` + sidecar `Assets/Sprites/Creatures/05-rootglass-stag.json` |
| Spec | W2 creature sheet |
| On screen (1x) | 215 px tall including antlers, 200 px long |
| Cell (authored 2x) | 512x480; pivot (256, 464) |
| Priority | P1 |
| Used in | Verdant hunting ground (Phase 2) |
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
Rootglass Stag: a large rootwood cervid with living-crystal antlers, amber bioluminescent seams, moss and brass root braces; skittish but discerning; match Creatures/Masters/05-rootglass-stag.png; side view facing right. Verdant sprite palette: moss green, rootwood brown, amber, soft green glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```
