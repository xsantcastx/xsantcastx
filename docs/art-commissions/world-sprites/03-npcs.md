# NPC shopkeepers and townsfolk (world layer)

Sprite style guide, cell/pivot rules, the sidecar JSON schema and the scale table are in [../README.md](../README.md#world-layer--sprites). Image generators are poor at consistent multi-frame sheets: use the **design prompt** to fix the look (one key pose or a model sheet), then animate the frames from it by hand or in a sprite tool, keeping the cell grid and pivot exact.

Roles marked "proposed role, name TBD" are new townsfolk implied by the world plan's buildings; they need a name and owner approval before they speak.

### `npc-kael` — Kael at the Rune Forge

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/01-npc-kael.png` + sidecar `Assets/Sprites/NPCs/01-npc-kael.json` |
| Spec | W3 NPC sheet |
| On screen (1x) | 150-170 px tall (Kael is the tallest) |
| Cell (authored 2x) | 320x384; pivot (160, 368) |
| Priority | P1 |
| Used in | Infernal town: Crafting Bench / Rune Forge |
| Shows today | empty station (no one stands there) |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 6 | yes | standing at their station, small fidget |
| 1 | `talk` | 4 | 8 | yes | gesture while the dialogue bubble is open |
| 2 | `walk` | 8 | 10 | yes | optional — only for townsfolk who wander |


Named NPCs also have a painted dialogue portrait (`menu-paintings/01-npc-portraits.md`); keep costume and colours identical between the two.

**Design prompt** (key pose / model sheet; animate from it)

```text
Kael the Broken Flame as a world sprite: broad smith-warden in cracked blackened plate with ember light in the cracks, one burning eye, grey braided beard with iron rings, leather forge apron, missing left hand; three-quarter side view facing right. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `npc-material-vendor` — Material Vendor (proposed role, name TBD)

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/02-npc-material-vendor.png` + sidecar `Assets/Sprites/NPCs/02-npc-material-vendor.json` |
| Spec | W3 NPC sheet |
| On screen (1x) | 150-170 px tall (Kael is the tallest) |
| Cell (authored 2x) | 320x384; pivot (160, 368) |
| Priority | P2 |
| Used in | Infernal town: Material Vendor stall |
| Shows today | empty station (no one stands there) |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 6 | yes | standing at their station, small fidget |
| 1 | `talk` | 4 | 8 | yes | gesture while the dialogue bubble is open |
| 2 | `walk` | 8 | 10 | yes | optional — only for townsfolk who wander |


Named NPCs also have a painted dialogue portrait (`menu-paintings/01-npc-portraits.md`); keep costume and colours identical between the two.

**Design prompt** (key pose / model sheet; animate from it)

```text
a stocky ore trader in a scorched leather coat with a sack of cinder ore over one shoulder and a set of brass weighing tongs; friendly, loud; three-quarter side view facing right. Infernal sprite palette: iron black, basalt grey, ember orange #E8752A seams. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `npc-merchant` — The Merchant

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/03-npc-merchant.png` + sidecar `Assets/Sprites/NPCs/03-npc-merchant.json` |
| Spec | W3 NPC sheet |
| On screen (1x) | 150-170 px tall (Kael is the tallest) |
| Cell (authored 2x) | 320x384; pivot (160, 368) |
| Priority | P1 |
| Used in | Luminous town: Market |
| Shows today | empty station (no one stands there) |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 6 | yes | standing at their station, small fidget |
| 1 | `talk` | 4 | 8 | yes | gesture while the dialogue bubble is open |
| 2 | `walk` | 8 | 10 | yes | optional — only for townsfolk who wander |


Named NPCs also have a painted dialogue portrait (`menu-paintings/01-npc-portraits.md`); keep costume and colours identical between the two.

**Design prompt** (key pose / model sheet; animate from it)

```text
the Merchant of the long till as a world sprite: layered copper-brown travelling coat, brass scales and keys hanging from the collar, balance-scale earrings, knowing half-smile; three-quarter side view facing right. Luminous sprite palette: warm gold #E8D44D, ivory, pale crystal, sunlit stone. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `npc-aureth` — Aureth

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/04-npc-aureth.png` + sidecar `Assets/Sprites/NPCs/04-npc-aureth.json` |
| Spec | W3 NPC sheet |
| On screen (1x) | 150-170 px tall (Kael is the tallest) |
| Cell (authored 2x) | 320x384; pivot (160, 368) |
| Priority | P2 |
| Used in | Luminous town: Heliograph Court plaza |
| Shows today | empty station (no one stands there) |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 6 | yes | standing at their station, small fidget |
| 1 | `talk` | 4 | 8 | yes | gesture while the dialogue bubble is open |
| 2 | `walk` | 8 | 10 | yes | optional — only for townsfolk who wander |


Named NPCs also have a painted dialogue portrait (`menu-paintings/01-npc-portraits.md`); keep costume and colours identical between the two.

**Design prompt** (key pose / model sheet; animate from it)

```text
Aureth the Radiant as a world sprite: tall serene goddess figure, ivory stone collar with dawn-glass crystal shards rising behind her head, warm gold light; no wings or halo; three-quarter side view facing right. Luminous sprite palette: warm gold #E8D44D, ivory, pale crystal, sunlit stone. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `npc-croupier` — Gambler's croupier (proposed role, name TBD)

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/05-npc-croupier.png` + sidecar `Assets/Sprites/NPCs/05-npc-croupier.json` |
| Spec | W3 NPC sheet |
| On screen (1x) | 150-170 px tall (Kael is the tallest) |
| Cell (authored 2x) | 320x384; pivot (160, 368) |
| Priority | P2 |
| Used in | Umbral town: Gambler |
| Shows today | empty station (no one stands there) |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 6 | yes | standing at their station, small fidget |
| 1 | `talk` | 4 | 8 | yes | gesture while the dialogue bubble is open |
| 2 | `walk` | 8 | 10 | yes | optional — only for townsfolk who wander |


Named NPCs also have a painted dialogue portrait (`menu-paintings/01-npc-portraits.md`); keep costume and colours identical between the two.

**Design prompt** (key pose / model sheet; animate from it)

```text
a slim hooded croupier in black-violet with silver rings, shuffling glowing violet cards, half-mask; three-quarter side view facing right. Umbral sprite palette: black-violet, amethyst #A855F7, obsidian, moonlight grey. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `npc-exchange-broker` — Exchange broker (proposed role, name TBD)

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/06-npc-exchange-broker.png` + sidecar `Assets/Sprites/NPCs/06-npc-exchange-broker.json` |
| Spec | W3 NPC sheet |
| On screen (1x) | 150-170 px tall (Kael is the tallest) |
| Cell (authored 2x) | 320x384; pivot (160, 368) |
| Priority | P2 |
| Used in | Umbral town: Exchange |
| Shows today | empty station (no one stands there) |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 6 | yes | standing at their station, small fidget |
| 1 | `talk` | 4 | 8 | yes | gesture while the dialogue bubble is open |
| 2 | `walk` | 8 | 10 | yes | optional — only for townsfolk who wander |


Named NPCs also have a painted dialogue portrait (`menu-paintings/01-npc-portraits.md`); keep costume and colours identical between the two.

**Design prompt** (key pose / model sheet; animate from it)

```text
a precise broker in an obsidian-buttoned long coat holding a ledger and a moonlit lantern; three-quarter side view facing right. Umbral sprite palette: black-violet, amethyst #A855F7, obsidian, moonlight grey. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `npc-verrin` — Verrin

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/07-npc-verrin.png` + sidecar `Assets/Sprites/NPCs/07-npc-verrin.json` |
| Spec | W3 NPC sheet |
| On screen (1x) | 150-170 px tall (Kael is the tallest) |
| Cell (authored 2x) | 320x384; pivot (160, 368) |
| Priority | P2 |
| Used in | Umbral town: trials approach |
| Shows today | empty station (no one stands there) |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 6 | yes | standing at their station, small fidget |
| 1 | `talk` | 4 | 8 | yes | gesture while the dialogue bubble is open |
| 2 | `walk` | 8 | 10 | yes | optional — only for townsfolk who wander |


Named NPCs also have a painted dialogue portrait (`menu-paintings/01-npc-portraits.md`); keep costume and colours identical between the two.

**Design prompt** (key pose / model sheet; animate from it)

```text
Verrin the Hollow as a world sprite: tall hooded figure whose face is a smooth obsidian mirror, amethyst light in the hood, layered black-violet robes; quiet, not evil; three-quarter side view facing right. Umbral sprite palette: black-violet, amethyst #A855F7, obsidian, moonlight grey. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `npc-archivist` — The Archivist

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/08-npc-archivist.png` + sidecar `Assets/Sprites/NPCs/08-npc-archivist.json` |
| Spec | W3 NPC sheet |
| On screen (1x) | 150-170 px tall (Kael is the tallest) |
| Cell (authored 2x) | 320x384; pivot (160, 368) |
| Priority | P1 |
| Used in | Celestial town: Codex observatory |
| Shows today | empty station (no one stands there) |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 6 | yes | standing at their station, small fidget |
| 1 | `talk` | 4 | 8 | yes | gesture while the dialogue bubble is open |
| 2 | `walk` | 8 | 10 | yes | optional — only for townsfolk who wander |


Named NPCs also have a painted dialogue portrait (`menu-paintings/01-npc-portraits.md`); keep costume and colours identical between the two.

**Design prompt** (key pose / model sheet; animate from it)

```text
the Archivist as a world sprite: ancient scholar in deep blue robes with brass lens-rings, glowing blue rune-lines on the arms, a brass loupe over one eye, a floating open book; three-quarter side view facing right. Celestial sprite palette: midnight blue, star silver, brass, cyan glints. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```

### `npc-expedition-steward` — Expedition steward (proposed role, name TBD)

| | |
|---|---|
| Save as | `Assets/Sprites/NPCs/09-npc-expedition-steward.png` + sidecar `Assets/Sprites/NPCs/09-npc-expedition-steward.json` |
| Spec | W3 NPC sheet |
| On screen (1x) | 150-170 px tall (Kael is the tallest) |
| Cell (authored 2x) | 320x384; pivot (160, 368) |
| Priority | P2 |
| Used in | Verdant town: Sanctum (expeditions) |
| Shows today | empty station (no one stands there) |

**Actions** — one sheet row per action; rows follow the order the sidecar lists them (this is the recommended order for the full sheet)

| Row | Action | Frames | fps | Loop | Key poses |
|---|---|---:|---:|:---:|---|
| 0 | `idle` | 6 | 6 | yes | standing at their station, small fidget |
| 1 | `talk` | 4 | 8 | yes | gesture while the dialogue bubble is open |
| 2 | `walk` | 8 | 10 | yes | optional — only for townsfolk who wander |


Named NPCs also have a painted dialogue portrait (`menu-paintings/01-npc-portraits.md`); keep costume and colours identical between the two.

**Design prompt** (key pose / model sheet; animate from it)

```text
a rootwood-armoured expedition steward with a map case and a rope coil, moss-green cloak, amber lantern; three-quarter side view facing right. Verdant sprite palette: moss green, rootwood brown, amber, soft green glow. stylised 2D side-scroller game sprite, chibi-leaning proportions, clean cel shading in two to three tone steps, crisp dark violet-black outline of even weight, limited palette, flat transparent background, lit from the upper left, strong readable silhouette at small size, Eclipse Realms world-sprite style.
```

**Negative**

```text
painterly texture, brush noise, soft airbrush shading, photorealism, 3D render, blur, motion blur, gradient background, scenery, floor tiles, text, UI, watermark, signature, frame, border, pixel-art dithering, jagged aliasing, inconsistent outline weight, front-facing view, multiple characters, skulls, horns, demonic anatomy, angel wings, halo
```
