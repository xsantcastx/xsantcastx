# Delve creatures (world layer)

Sprite style guide, cell/pivot rules, the sidecar JSON schema and the scale table are in [../README.md](../README.md#world-layer--sprites). Image generators are poor at consistent multi-frame sheets: use the **design prompt** to fix the look (one key pose or a model sheet), then animate the frames from it by hand or in a sprite tool, keeping the cell grid and pivot exact.

The Delve's two enemies reuse other creatures' art and rigs today. Both need their own sprite and a one-line engine change to use a dedicated key. The Delve draws figures at half size (`figureScale`), so author at the normal creature scale.


### `rune-warden` - Rune-Warden

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/06-rune-warden.png` + sidecar `Assets/Sprites/Creatures/06-rune-warden.json` |
| Spec | W2 creature sheet (`walk` omitted: it is a stationary guardian) |
| On screen (1x) | about 192 px tall (the Delve draws figures at half size via figureScale) |
| Cell (authored 2x) | 384x448; pivot (192, 432) |
| Priority | P1 |
| Used in | Ember Delve fragment chamber (Magma Halls, 260 HP, defeated once per player; its fall frees the Godforge fragment) |
| Shows today | Mirror Substitute art on the Mirror Substitute rig (creature-rigs.ts key `mirror-substitute`) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 8 | yes | breathing / hover |
| 1 | `windup` | 4 | 10 | no | telegraph - the tell the player reacts to; exaggerate it |
| 2 | `strike` | 4 | 14 | no | the hit; frame 2 is the contact frame |
| 3 | `hurt` | 3 | 10 | no | recoil and flash-friendly pose |
| 4 | `death` | 6 | 8 | no | collapse; last frame may be empty (engine dissolves) |

_Code stand-in: the engine spawns `creature: 'mirror-substitute'` named Rune-Warden (towns/infernal.ts). An engine-side change must switch the key to `rune-warden`._

**Design prompt** (key pose / model sheet; animate from it)

```text
Rune-Warden: a towering stone-and-gold guardian of the Godforge fragment, a tall armoured figure of basalt plates carved with glowing Godstone runes #e8c47a, a heavy rune-lit shield-arm and a hammer-spear, a blank faceplate with one slit of violet light, dutiful rather than cruel; match the painted master Creatures/Masters/11-rune-warden.png in design; facing right; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `magma-maw` - Magma Maw

| | |
|---|---|
| Save as | `Assets/Sprites/Creatures/07-magma-maw.png` + sidecar `Assets/Sprites/Creatures/07-magma-maw.json` |
| Spec | W2 creature sheet |
| On screen (1x) | body 150 px long, 105 px tall |
| Cell (authored 2x) | 384x288; pivot (192, 272) |
| Priority | P1 |
| Used in | Ember Delve Basalt cavern and Magma Halls (110 HP; two spawn points) |
| Shows today | Rivet Maw art and rig (creature-rigs.ts) |

**Actions** - one sheet row per action, in this order

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 8 | yes | breathing / hover |
| 1 | `walk` | 8 | 10 | yes | patrol gait |
| 2 | `windup` | 4 | 10 | no | telegraph - the tell the player reacts to; exaggerate it |
| 3 | `strike` | 4 | 14 | no | the hit; frame 2 is the contact frame |
| 4 | `hurt` | 3 | 10 | no | recoil and flash-friendly pose |
| 5 | `death` | 6 | 8 | no | collapse; last frame may be empty (engine dissolves) |

_Variant of rivet-maw: same cell, pivot and frame counts so the existing rig timings reuse. Code stand-in: `creature: 'rivet-maw'` named Magma Maw; needs key `magma-maw`._

**Design prompt** (key pose / model sheet; animate from it)

```text
Magma Maw: the Rivet Maw's hotter cousin, same low four-legged basalt-and-rivet body and square plated jaw, but its hide is cracked open with glowing lava seams #ff8a3d, molten drool, a scorched darker colour so it is told apart from the Rivet Maw at a glance; match the Rivet Maw sprite's proportions and pose rhythm exactly; facing right; side view. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```
