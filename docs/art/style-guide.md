# Eclipse Realms — art bible (pixel art)

**Decision (owner, 2026-10-13):** the whole game moves to **Terraria-style pixel art**. This replaces the
2026-10-12 "hybrid, Ragnarok-style sprites + paintings" direction. Every brief in
[`docs/art-commissions/`](../art-commissions/README.md) follows this guide.

**Style reference, not a source.** Terraria (Re-Logic) is the reference for *how the game should feel*:
16 px tiles drawn at 2x, chunky outlined sprites, saturated biome palettes, auto-tiled terrain with top
faces, layered parallax skies, framed inventory slots. Nothing is copied from it. Do not trace, sample,
recolour or palette-pick its sprites, tiles, backgrounds, fonts or UI, and do not use its names, item
designs or layouts. Every design here comes from the Eclipse Realms canon
(`~/Documents/1. Projects/Eclipse Realms/docs/03-lore-and-design/`). A brief may not name Terraria in a
prompt; it describes the look in its own words.

Contents: [1 Layers](#1-what-is-pixel-art-and-what-stays-a-painting) · [2 Pixel scale](#2-pixel-scale-and-grid) ·
[3 Sizes](#3-sprite-sizes-per-class) · [4 Outline and shading](#4-outline-and-shading) ·
[5 Palettes](#5-palettes) · [6 Animation](#6-animation) · [7 Auto-tiles](#7-auto-tile-sheets-terrain) ·
[8 Parallax](#8-parallax-backgrounds) · [9 UI frames](#9-in-world-ui-slots-and-panels) ·
[10 Export](#10-export-format) · [11 Sidecar](#11-the-importer-sidecar) ·
[12 Pipeline status](#12-pipeline-status) · [13 Do and don't](#13-do-and-dont) ·
[14 Generators](#14-working-from-an-image-generator)

---

## 1. What is pixel art and what stays a painting

| Surface | Before (2026-10-12) | Now (2026-10-13) |
|---|---|---|
| Keeper, remote Keepers, creatures, keeper NPCs, townsfolk, automatons | smooth cel-shaded sprites | **pixel-art sprite sheets** (W1–W3) |
| Delve terrain | flat code fills, planned 4-variant tile strips | **auto-tiled pixel terrain** with outlines, bevels and top faces (W7a), pixel back walls (W7b) |
| Town buildings, props, stations, gathering nodes, Homestead | smooth sprites | **pixel-art props and buildings** (W5, W6) |
| Held weapons and off-hands | smooth sprites | **pixel-art attachables** (W4) |
| Town and hunting-ground backgrounds | painted 3:2 backdrops (`bg-*`) | **pixel parallax sets** (W8): sky, far, mid, near |
| Item and tool icons (bag, hotbar, Inspect, crafting) | painted 1254 px collectibles | **32 x 32 pixel icons** (I1) |
| NPC and explorer portraits, Thralls | painted busts and figures | **64 x 64 pixel portraits** (I2), Thralls as I1 icons |
| In-world HUD: hotbar, satchel, station panels | design-system chrome | **pixel slot and panel frames** (§9) |
| Codex Bestiary splash (creature masters) | painting | **stays a painting** (S3) |
| Boss concept sheets | painting, review only | **stays a painting** (S7), never shipped |
| Realm town key art (`Locations/Towns/*`) | planned in-world backdrop | **stays a painting, demoted to key art** (S6): realm pages, store/social, loading cards. It is no longer the in-world backdrop; W8 parallax is |
| Site chrome outside the game (`/`, tools, header, footer) | design system | **unchanged**: keeps the design system and the cosmic palette in `CLAUDE.md` |

**Why these paintings stay.** The Codex is the game's lore book, and lore splash art is the one place where
a painting adds something a 40 px sprite cannot. Four creature masters are already painted and shown there,
so the six commissioned masters keep the set consistent. Town key art never sits behind a sprite any more,
so it no longer fights the pixel layer. Everything a player *plays with* is pixel art.

**What the new direction retires** (as replacements land, never before):

- **The Keeper mesh rig** (`rig.ts`, `rig-poses.ts`: the `keeper-base` painting bent by a deformation mesh).
  It stays the fallback until `spriteFor('keeper')` resolves; after the A/B it is removed, which also removes
  its phone cost (`docs/handoff/play-perf.md`). The per-creature rigs in `creature-rigs.ts` retire the same way.
- **Painted in-world backdrops** (`bg-basalt-seamworks`, `bg-luminous`, `bg-umbral`, `bg-celestial`,
  `bg-verdant`). They stay until each realm's W8 set lands, then move to key-art use only.
- **Painted item icons in the bag.** The ~160 painted collectibles already imported (runes, artifacts, Art
  Bible gear, materials) keep working; they are replaced by I1 icons in a later re-icon wave (not in this
  pack). Until then a bag can mix both; the slot frame (§9) keeps them reading as one UI.
- **The paper doll painting** (`characters/keeper-base` on `/character`). It stays until the Character panel
  gets a pixel equipment column (follow-up, not in this pack).

---

## 2. Pixel scale and grid

One **art pixel** (art px) is one hand-placed pixel in the source file. The game never draws a fraction of
one: every art pixel lands on a whole number of screen pixels, with smoothing off.

| Where it is drawn | Logical px per art px | Why |
|---|---:|---|
| **Ember Delve** (tiles, placeables, and figures, which the Delve draws at `figureScale` 0.5) | **2** | A Delve cell is 32 logical px (`CELL` in `terrain.ts`) = **16 x 16 art px**. Figures drawn at half size land on the same 2 px grid, so the Keeper and the rock share one pixel density |
| **Towns, hunting grounds, Homestead** (`figureScale` 1) | **4** | The same sheets drawn at full size: the towns read as the Delve zoomed in 2x |
| **In-world HUD icons** | 1, 2 or 4 | a 32 art px icon drawn at 32, 64 or 128 px; never 48 or 96 in the HUD |

### Export factor

The importer reduces a sheet by an exact integer (`scale`) to make its 1x copy, and it cannot upscale. So
pixel art is **exported pre-upscaled with nearest-neighbour** (Aseprite: export at 400% or 800%; never
bilinear, never "smooth"):

| Kind | Export factor | Sidecar `scale` | Result |
|---|---:|---:|---|
| Figure-scale sheets: Keeper, creatures, NPCs, townsfolk, automatons, equipment, town props and buildings, gathering nodes, Homestead (W1–W6) | **x8** | 2 | 1x copy = 4 logical px per art px; drawn at 0.5 in the Delve = 2 |
| Delve-grid sheets: tiles, back walls, Delve placeables (W6 cell, W7) | **x4** | 2 | 1x copy = a 32 px cell, 2 logical px per art px |
| Parallax layers (W8) | **x8** | 2 | as figure-scale |
| Item icons (I1) | **x8** | n/a (collectible ladder) | 256 x 256 master; the ladder emits 96 (x3) and 256 (x8) |
| Portraits (I2) | **x8** | n/a (portrait ladder) | 512 x 512 master; the ladder emits 96, 256 (x4) and 512 (x8) |

Every authored number in a brief (cell, pivot, anchors) is **authored pixels** = art px x export factor.
Every cell size in the pack is a whole number of art pixels, so the existing cell sizes did not change:
the Keeper's 384 x 384 cell is 48 x 48 art px at x8.

---

## 3. Sprite sizes per class

Sizes are in art px. "Town" = on screen at `figureScale` 1, "Delve" = at 0.5.

| Class | Figure (art px) | Cell (art px) | Authored cell | Pivot (authored) | Town / Delve on screen |
|---|---|---|---|---|---|
| **Keeper** (and remote Keepers) | 40 tall, ~2.5 heads | 48 x 48 | 384 x 384 | (192, 368) between the feet | 160 / 80 px tall |
| **Keeper NPCs** (shopkeepers, named NPCs) | 36–42 tall | 40 x 48 | 320 x 384 | (160, 368) | 144–168 px tall |
| **Townsfolk** | 34–40 tall | 40 x 48 | 320 x 384 | (160, 368) | 136–160 px |
| **Automatons** (Homestead) | 36–42 tall | 40 x 48 | 320 x 384 | (160, 368) | as NPCs |
| **Small creatures** (Rivet Maw, Ephemeris Leech) | 26–38 long | 48 x 36 or 40 x 28 | 384 x 288 / 320 x 224 | bottom-centre, 2 art px up | 105–150 px long |
| **Large creatures** (Prism Forager, Mirror Substitute, Rootglass Stag, Cinder Bailiff, Seam Eater) | 40–56 tall | 40 x 48 to 64 x 60 | 320 x 384 to 512 x 480 | bottom-centre, 2 art px up | 165–215 px |
| **Bosses** (when commissioned) | 72–120 tall | up to 128 x 128 | up to 1024 x 1024 | bottom-centre | 290–480 px |
| **Held weapons / off-hands** (W4) | 6–24 long | 8 x 16 to 16 x 32 | 64 x 128 to 128 x 256 | grip centre | 32–96 px |
| **Staff, polearm** | up to 40 long | 12 x 40 | 96 x 320 | grip centre | 160 px |
| **Delve tile** (W7) | 16 x 16 | 16 x 16 | 64 x 64 (x4) | fills the cell | 32 px |
| **Delve placeable** (torch, ladder, chest, camp, supports, charge) | fits 16 x 16 | 16 x 16 | 64 x 64 (x4) | bottom-centre (32, 64) | 32 px |
| **Small props** (bench, campfire, anvil) | 12–24 tall | 16–40 wide | 128–320 wide | bottom-centre | 50–110 px |
| **Tall props** (waystones, lamp posts, beacons, obelisks) | 44–60 tall | 12–28 wide | 96–224 wide | bottom-centre | 180–240 px |
| **Stalls** | 64 x 68 | 64 x 68 | 512 x 544 | bottom-centre | 260 px |
| **Buildings** | 100–124 tall | 80–104 wide | 640–832 x 832–992 | bottom-centre | 400–496 px |
| **Gathering nodes** | ~32 x 30 | 32 x 32 | 256 x 256 | (128, 240) | ~130 x 120 px |
| **Item icon** (I1) | fits 28 x 28 | 32 x 32 | 256 x 256 | n/a | 32 / 64 / 128 px |
| **Portrait** (I2) | head and shoulders | 64 x 64 | 512 x 512 | n/a | 80 px orb, 40–64 px tokens |

Pivots sit **2 art px above the cell bottom** for figures (feet never touch the cell edge) and on the cell
bottom for props. The pivot never moves between frames; bobs and jumps happen around it.

---

## 4. Outline and shading

**Outline**

- **1 art px**, on the outer silhouette of every sprite, prop, icon and portrait.
- **Coloured, never pure black.** Use the darkest step of the ramp it borders (dark leather → `#2a1810`,
  ember plate → `#3a1410`); the floor for black and obsidian materials is `#140a1f`. `#000000` is banned.
- **Selective outline (sel-out):** on the lit top-left edges the outline may step one shade lighter, so
  big shapes do not look cut out of paper. The bottom-right outline stays the darkest.
- **Inner lines** only where two materials meet, one shade darker than the darker side; never a full
  inner outline around every shape.
- **No outline** on flame tips, glow cores, sparks and smoke: they read by brightness.
- **Tiles:** outline and bevel only on edges that face open air (§7). Interior pieces have no outline.
- **Parallax:** near layer only, and lighter than any play-layer outline; far and sky layers have none.

**Shading**

- Light from the **upper left**, everywhere (sprites, tiles, icons, parallax).
- **3–4 tones per material ramp plus one highlight**; ramps hue-shift (shadows cooler and towards violet,
  highlights warmer). No flat 50% darken.
- Shade by form: a highlight on the upper-left plane, a core shadow on the lower right. **No pillow
  shading** (darkening every edge towards the outline).
- **Dithering:** none on sprites, icons and tiles, except one 2-tone checker band for a large sky gradient
  (§8). No noise texture.
- **Anti-aliasing:** none on the outer silhouette (the game composites over many backgrounds). At most one
  hand-placed intermediate pixel inside a curve between two ramp tones.
- **Emissives** (ember seams, the Keeper's violet eye-gem, glowcaps, crystals) use the two brightest steps
  of their ramp; the engine adds the halo (`lighting.ts`). Never paint a glow past the cell or into the
  transparent background.
- **Shadows:** characters and creatures carry **no** baked ground shadow (the engine draws one that follows
  jumps). Props and buildings carry a 1–2 art px contact shadow under the base, in the darkest ground tone at
  most 35% opacity, inside the cell. Delve placeables carry none.
- **Opacity:** bodies are 100% opaque. Semi-transparent pixels only for glass, wing membranes and smoke,
  and only inside the silhouette. The importer rejects a figure that is under 50% solid.
- **Colours per sprite:** up to 24 before emissives; icons up to 16; tiles up to 12 per sheet.

**Readability tests** (do all three before delivery)

1. At 1x on the darkest biome back wall, the silhouette still separates (the 1 px outline plus a lit edge).
2. Flipped horizontally (the engine mirrors), nothing reads wrong: no text, no left-handed-only detail.
3. Greyscale: the main shapes separate on value alone.

---

## 5. Palettes

Hexes are the shared vocabulary for briefs, tiles and code. Ramps run dark → light. Tile ramps are taken
from the node colours in `src/app/play/engine/terrain.ts` (`dark`, `base`, `light`, `fleck`) and the biome
colours in `src/app/play/world/towns/infernal.ts`, so a tile and its code fallback stay the same colour.
Saturation goes **up** for sprites (they sit in front) and **down** for far parallax layers.

### 5.1 Shared (Godforge, the Keeper, UI)

| Ramp | Hexes | Use |
|---|---|---|
| Outline floor | `#140a1f` | darkest outline, obsidian edges |
| Obsidian | `#1e1428` `#2e2238` `#463650` `#6a5878` | the Keeper's robe, UI panels, Godforge stone |
| Aged gold | `#5a3c1a` `#a5793a` `#e8c898` `#f8e8c8` | trim, filigree, the Keeper's mask edge, selected slot |
| Eclipse violet | `#3a1f63` `#7b3fc4` `#a855f7` `#d9b8ff` | the medallion, eye-gem, rune glow, enchanting. The shared system energy, never a realm colour |
| Mask ivory | `#8c7a58` `#c9b98f` `#efe4c4` | the Keeper's bird mask |
| Skin (light) | `#7a4a34` `#b87a58` `#e0a882` `#f4cfae` | townsfolk, explorers |
| Skin (deep) | `#3a2018` `#6a3e2a` `#9a6a4a` `#c4926a` | townsfolk, explorers |
| Void accent | `#050308` `#0a0610` `#160f22` + edge `#ff6dd7` | Void items (Hollowmark, Unstruck Hour); the magenta is the Singular rarity colour |

### 5.2 Realms

| Realm (town) | Main material | Accent | Emissive | Sky (W8, top → horizon) |
|---|---|---|---|---|
| **Infernal** (Basalt Seamworks) | basalt `#241a1c` `#3a2b2c` `#5a4440` `#6b5148`; iron black `#171116` `#2a2027` `#443540` `#57474f` | ember `#7a2a12` `#c4501e` `#E8752A` | `#ff9b4f` `#ffd08a` | `#120a0c` `#2a1210` `#4a1c14` `#7a2e1a`, ash `#8a7468` |
| **Luminous** (Heliograph Court) | sunlit stone `#4a4030` `#8a7a58` `#c9b88e` `#efe4c8` | gold `#7a5a14` `#b8901e` `#E8D44D` | dawn crystal `#ffe7a0` `#fff1b0` `#fffaf0` | `#3a2a3a` `#a8607a` `#f2a86a` `#ffe0a0` |
| **Umbral** (Nocturne Archive) | black-violet `#0e0912` `#1a1220` `#33263a` `#4a3260` | amethyst `#5a2f8a` `#7b4fc0` `#A855F7` | `#c9a0ff`, moonlight `#8a90b0` `#d8dcf0` | `#05040a` `#0e0a18` `#160f22` `#1e1630`, moon `#d8dcf0` |
| **Celestial** (Meridian Orrery) | midnight `#0a1428` `#14284a` `#24406e` `#3a5a8a`; brass `#5a4020` `#8a6a3a` `#b08a55` `#e8c47a` | star silver `#6a7890` `#a8b8cc` `#d8ecff` | orbit blue `#1e5a9a` `#5fb6ff` `#00d4ff` | `#03060f` `#0a1428` `#14284a` `#24406e`, stars `#d8ecff` |
| **Verdant** (Rootglass Canopy) | moss `#1e2a14` `#3a5a2a` `#4a7a3a` `#7fb85a` `#d8f2a0`; rootwood `#24190f` `#3a2a1c` `#7a5a36` `#b08a55` | amber `#6a4010` `#c08a3e` `#ffc669` | bioluminescent `#2a8a6a` `#7fd5a3` `#c4ffe0` | `#0a1a14` `#14302a` `#2a5a40` `#4a7a3a` |

The three renamed code realms map as before: Verge = Celestial, Nexus = Infernal, Archivum = Verdant.

### 5.3 Ember Delve biomes

Each tile row is the node's `dark` `base` `light` `fleck` from `terrain.ts`. The renderer adds two steps of its own
(`tile-art.ts nodePalette`): the **outline**, `dark` pulled 72% towards the outline floor `#140a1f`, and the
**highlight** on an open top edge, `light` 28% towards `#fff4e0`. A top face (§7) may add **one** lip step above
`light`, listed per biome.

The Delve reads like Terraria's caverns: bright, saturated blocks with hard lit edges and dark outlines, each biome
with its own hue (Root Hollows green and brown, Basalt Caverns grey with ember, Glowcap Grotto teal and cyan glow,
Magma Halls red and orange). Back walls are 2 steps darker and less saturated than their tiles, never black.

| Biome (rows) | Back wall (W7b) | Darkness | Wash / particles | Tiles (dark, base, light, fleck) | Top-face lip |
|---|---|---|---|---|---|
| **Root Hollows** (0–11) | `#1a110b` `#34251a` `#3c2b1e` | `#060403` | `#6a8a3a` / spores `#c9b27a` | dirt `#5c3a22` `#8c5a37` `#b47a4c` `#cf9c68`; root-loam `#48301e` `#6e4a2e` `#946642` `#7fb04a`; roots `#3a2614` `#5a3c22` `#a8854c` `#d8b66c`; petrified trunk `#4a2f18` `#70492a` `#a6784a` `#d4a86c`; shadow-root `#281838` `#3e2858` `#7c54aa` `#c4a0ff` | moss `#4c9a2e` `#9ad84e`, flower `#d8f2a0` |
| **Basalt Caverns** (12–25) | `#141216` `#29252b` `#302b32` | `#050309` | `#b97a45` / ash `#8a7468` | basalt (`rock`) `#3a3339` `#5c5359` `#877c84` `#a0949b`; hard basalt `#2a2530` `#423b48` `#655c6e` `#7d7486`; slag vein `#2e2a32` `#4a454e` `#6e6874` `#5ff0d8` (glow `#8fd6cf`); cinder vein = basalt + `#ffa040`; ember-veined basalt = basalt + `#ffc25c` (glow `#ff8a3d`) | ash `#9a8c84` `#d4c8bc` |
| **Glowcap Grotto** (26–39) | `#08161e` `#122c3a` `#163444` | `#03070c` | `#4fa8e0` / motes `#9fdcff` | grotto stone `#1c3846` `#2c5668` `#4a8296` `#86d2e6`; glowcap `#163242` `#244a5c` `#6fdcff` `#d0f6ff` (glow `#7fc8ff`) | lichen `#2a8eb0` `#bff4ff` |
| **Magma Halls** (40–) | `#1a0806` `#35140f` `#3e1812` | `#0c0302` | `#ff5a2a` / embers `#ff9b4f` | scorched basalt `#481812` `#6e2a1e` `#9c4630` `#ff8040`; heartstone vein `#3a1424` `#5c2438` `#8a3c56` `#ff5a8a` | hot crust `#8a2a14` `#ffc45c` |
| **The Underhearth** (56–117, Phase 8) | `#0e0a12` `#241a28` `#1c1420` | `#040206` | `#c4501e` α .10 / embers `#ffd08a` | iron-black basalt `#171116` `#2a2027` `#443540` `#c4501e`; banked obsidian `#1e1428` `#2e2238` `#463650` `#6a5878`; ironwood pillar `#2a2027` `#4a3a30` `#6e5a48` `#c4501e`; ironwood heartpost `#2a2027` `#5a4434` `#8a6a50` `#ffd08a`; emberheart vein `#1e1428` `#3a2430` `#6a3a3a` `#ffd08a` (glow `#E8752A`); pyrite seam `#2a2027` `#443540` `#6a5878` `#e8c47a`; cold coal `#0e0a12` `#1c1420` `#2e2238` `#57474f` (glow `#ff9b4f` only once struck); furnace slag `#1c1420` `#3a2a22` `#6a4a3a` `#ffd08a`; fracture seam `#140a1f` `#2a1440` `#7b3fc4` `#b88cff` (Godforge violet: the crack only); hearth brick (the Four's masonry, brick pattern) `#2a1418` `#4a2a28` `#7a3a2a` `#c4501e`; the Banked seal `#1e1428` `#443540` `#c4501e` `#ffd08a` | hot crust (shared with the Halls) |
| **Everywhere** | | | | bedrock `#16121a` `#28222e` `#3c3446` `#4c4258`; packed dirt (placed) `#684429` `#96643f` `#bc8b5e` `#d2a678`; basalt block (placed) `#403a46` `#645b6a` `#8c8494` `#a49cac`; cracked wall `#2e2242` `#4c3a62` `#715a8c` `#d8b4ff`; Keeper's cache `#3a2617` `#6b4a2c` `#c9a06a` `#ffd36d`; Kael's cache `#2e1f14` `#5a3f2a` `#d8b07a` `#ffd9a0`; Godforge fragment `#2a1f12` `#4a3a24` `#ffe9a8` `#fff4d0`; inscription `#e8c47a` | |

Light (`lighting.ts`): unlit rock sits under the biome's darkness at most 80% deep, so its shape still shows; a
light's pool is broad and bright (falloff `1 − d²/r²`) and lit ground takes a warm `#ffb066` cast. Torches reach
150 px (240 px of light). Placed objects (§7.2, W6 cell props) are drawn as 16 × 16 pixel maps in their own node
colours until their art lands (`tile-art.ts PLACED_ART`).

Ore must be told apart at 32 px: **cinder** = orange seams, **slag** = teal glass, **heartstone** = rose-red
facets, **ember-veined** = scattered warm flecks, not seams. In the Underhearth: **emberheart** = white-hot
nuggets on obsidian, **pyrite** = gold glints, **cold coal** = matte black until a swing cracks it (then ember).

**The Underhearth's figures and props** (Phase 8, drawn in code on the 2 px grid until their art lands; `engine.ts`
`drawDeepCreature`, `drawFurnaceFacade`, `drawRails`, `tile-art.ts PLACED_ART`): Banked Ember (14 × 10 art px,
coal `#1c1420` with cracks `#3a2a30` asleep, `#ff9b4f`/`#ffd08a` awake, `#fff4dc` before it strikes); Ironwood
Sentinel (12 × 46, wood `#4a3a30`, grain `#2a2027`, lit edge `#6e5a48`, ember seams `#c4501e`, eyes `#ffd08a`);
the Banked Furnace's face (mortar seams `#7a2a12` asleep → `#E8752A` awake → `#ffd08a` open, eye-slits, a grate
`#171116`/`#57474f`, a round core `#3a1410`…`#fff4dc`); rails (iron `#a49cac` with a `#d8c8bc` running edge,
sleepers in the rail's dark, timber trestles `#2a1c12`/`#6a5040` over open air); the Seam Cart (`#443540` body,
`#7a656e` rim, Kael's stencil `#c4501e`); rope, Rift Anchor (violet shard `#b88cff`), hammer-mark slab, vent grate.

**Liquids and obsidian** (Phase 6, `liquid-render.ts`, `docs/world/delve-and-beyond.md` §4.1): water body
`#2e6e9a` `#1e4a6a` `#0e2a3a` at α 0.6, lip `#86d2e6`, sparkle `#d0f6ff` (the Grotto ramp); lava body `#E8752A`
`#c4501e` `#7a2a12` opaque, lip `#ffd08a`, flecks `#ff9b4f` (the Infernal ember; lava lights its cavern from
its own surface). Obsidian `#140e20` `#2a1f3a` `#5a4a7a` `#a48bff`; the placed block one step lighter. A liquid
level is 2 art px (8 to a cell), so every surface sits on the art grid.

### 5.4 Rarity and tier

Rarity is **never baked into an icon** (no aura, no glow ring). The slot frame's inner rim and the item name
carry it (§9).

| Tier | Colour |
|---|---|
| Common | `#8f8aa1` |
| Uncommon | `#9db8a8` |
| Rare | `#00d4ff` |
| Epic | `#a855f7` |
| Legendary | `#e8c898` |
| Mythic | `#f8e8c8` |
| Singular | `#ff6dd7` |

### 5.5 Where the website palette overlaps

The site's cosmic palette (`CLAUDE.md` §2) is for site chrome only. Overlaps are deliberate and limited:
amber `#ffc669` = Verdant amber; mint `#7fd5a3` = Verdant bioluminescence; blue `#5fb6ff` = Celestial orbit
blue; magenta `#ff6dd7` = Singular rarity and the Void edge. The site's brand cyan `#00ffcc` / `#4dffe0` and
violet `#7b61ff` / `#a48bff` **never** appear in world art: the game's violet is `#a855f7`.

---

## 6. Animation

Fewer, stronger frames: pixel animation reads on its key poses. Engine action names are fixed
(`docs/handoff/sprite-renderer.md`); the owner's words map to them as below.

| Figure | Action (engine name) | Frames | fps | Loop | Notes |
|---|---|---:|---:|:---:|---|
| Keeper | `idle` | 4 | 6 | yes | breathing: the head and cape move 1 art px |
| Keeper | `run` (= walk) | 8 | 12 | yes | contact on frames 1 and 5; 1 art px body bob |
| Keeper | `jump` | 2 | 10 | no | crouch, rise |
| Keeper | `fall` | 2 | 8 | yes | apex, falling |
| Keeper | `attack` (= swing) | 4 | (14) | no | wind-up, strike, follow-through, recover. Played across the game's 0.4 s attack window (`frameAtProgress`), so fps is nominal; frame 2 is the hit frame |
| Keeper | `dodge` | 3 | 14 | no | low dash, cape snaps behind |
| Keeper | `hurt` | 2 | 10 | no | recoil, recover (the engine adds the white flash) |
| Keeper | `death` | 5 | 10 | no | knees, fall, dissolve into violet motes; the last frame may be empty |
| Creature | `idle` | 4 | 6 | yes | breathing / hover |
| Creature | `walk` | 6 | 10 | yes | patrol gait; flyers drift. Omit for stationary guardians |
| Creature | `windup` | 3 | (8) | no | the tell; exaggerate it. Timed to the game's 0.85 s window |
| Creature | `strike` | 3 | (12) | no | timed to 0.2 s; frame 2 is the contact frame |
| Creature | `hurt` | 2 | 10 | no | recoil, flash-friendly pose |
| Creature | `death` | 5 | 10 | no | collapse; the last frame may be empty (the engine dissolves) |
| NPC / townsfolk | `idle` | 4 | 6 | yes | at their station, a small fidget |
| NPC | `talk` | 2 | 6 | yes | mouth or hand gesture while their line shows |
| Townsfolk | `walk` | 6 | 10 | yes | only for townsfolk who wander |
| Automaton | `idle` / `strike` | 4 / 4 | 6 / 12 | yes / yes | strike frame 2 = contact |
| Props, buildings | `ambient` | 4–6 | 6–10 | yes | fire 6 @ 10, glow and rune pulse 4–6 @ 6–8; frame 1 doubles as the still |
| Delve placeables | `ambient` | 4–6 | 8–12 | yes | the torch flame, camp fire, charge fuse |
| Gathering nodes | `ready` / `harvested` | 1 / 1 | 0 | no | same footprint and pivot in both rows |

**Rules:** the pivot never moves; a looping action's last frame flows into its first; reduced motion holds
frame 0 (a dead creature holds its last death frame), so frame 0 of every action must be a good still.
Smears are 1–2 art px wide arcs in the weapon's brightest tone, on the strike frame only.

**Equipment anchors (Keeper).** The Keeper is drawn with **empty hands**: front hand a loose fist, back hand
open. Every frame of every action carries `hand_front: [x, y, deg]` (grip centre and the held item's angle,
degrees clockwise from straight up) and `hand_back: [x, y]` in authored pixels. Put a 1 art px dot per hand
per frame on a hidden layer named `anchors` (front red, back blue) and read the centres off it: an anchor
is the art pixel's centre, `art px x 8 + 4`.

---

## 7. Auto-tile sheets (terrain)

Terrain looks the way it does in the reference because a block knows its neighbours: an exposed top gets a
lit lip, an exposed side gets an outline and a bevel, corners round off. That is spec **W7a**.

### 7.1 W7a layout — one sheet per solid terrain node

Cells are 16 x 16 art px (64 x 64 authored at x4). The sheet is **4 columns x 7 rows = 64 x 112 art px =
256 x 448 authored**, one action per row:

```text
        col 0          col 1          col 2          col 3
row 0  tile     │ interior A   │ interior B   │ interior C   │ interior D   │   no side exposed (4 variants)
row 1  top      │ top A        │ top B        │ top-left     │ top-right    │   N exposed / N+W / N+E
row 2  bottom   │ bottom A     │ bottom B     │ bottom-left  │ bottom-right │   S exposed / S+W / S+E
row 3  sides    │ left A       │ left B       │ right A      │ right B      │   W exposed / E exposed
row 4  thin     │ ledge (N+S)  │ pillar (E+W) │ single (all) │ single B     │   one cell thick
row 5  caps     │ pillar top   │ pillar foot  │ ledge left   │ ledge right  │   N+E+W / S+E+W / N+S+W / N+S+E
row 6  inner    │ inner NW     │ inner NE     │ inner SW     │ inner SE     │   all four sides solid, one diagonal open
```

**Which piece a cell uses** (N/E/S/W = the neighbour on that side is open: air, a dug cell or a non-solid
placeable):

| Open sides | Piece |
|---|---|
| none | `tile` (by cell hash); if a diagonal neighbour is open, the matching `inner` piece |
| N | `top` A/B · N+W `top-left` · N+E `top-right` |
| S | `bottom` A/B · S+W `bottom-left` · S+E `bottom-right` |
| W | `left` A/B · E `right` A/B |
| N+S | `ledge` · E+W `pillar` |
| N+E+W | `pillar top` · S+E+W `pillar foot` · N+S+W `ledge left` · N+S+E `ledge right` |
| all four | `single` (A/B by hash) |

**Drawing rules**

- **Interior** (row 0): fully opaque, seamless on all four edges and against every other interior variant;
  no outline; ore, crystal and glow stay at least 2 art px inside the cell so edge pixels are plain matrix.
- **Exposed top face:** a 2 art px lit lip in the biome's top-face colour (§5.3) over a 1 art px outline,
  with a slightly irregular silhouette (1 art px bumps) so a long floor does not read as a ruler.
- **Exposed sides and bottom:** a 1 art px outline, a 1 art px bevel (the light step on the left side, the
  dark step on the right and bottom).
- **Outer corners** round off by 1–2 art px. Those corner pixels are **transparent**: the back wall shows
  through, as in the reference. Only edge pieces may have transparent pixels, and only outside the
  silhouette; row 0 is fully opaque.
- **Inner corners** (row 6): an interior piece with a 2 x 2 art px notch of outline and bevel in one corner.
- **Different solids touching** count as connected (no outline between dirt and basalt); a 1 art px darker
  seam is the engine's job if it is wanted later.
- **Variants:** A/B pieces differ only in surface detail (pebbles, cracks, root threads), never in silhouette
  height at the cell edge, so any A sits next to any B.

### 7.2 Which nodes are W7a and which are not

| Spec | Nodes |
|---|---|
| **W7a auto-tile** (natural and placed blocks) | `dirt`, `root-loam`, `rock`, `hard-rock`, `bedrock`, `roots`, `petrified-trunk`, `shadow-root`, `grotto-stone`, `glowcap`, `scorched-basalt`, `ember-rock`, `cinder-vein`, `slag-vein`, `heartstone-vein`, `packed-dirt`, `basalt-block` |
| **W7 feature strip** (an object set into the rock: 4 variants of one framed block with its own outline on all sides, row `tile` only) | `cracked-wall`, `cache`, `kaels-cache`, `godforge-fragment` |
| **W7b back wall** (4 interior variants, row `tile` only, no outline, 2 steps darker and less saturated than the biome's tiles) | `tile-wall-root-hollows`, `tile-wall-basalt-caverns`, `tile-wall-glowcap-grotto`, `tile-wall-magma-halls` |
| **W7 overlay** (transparent, drawn over the back wall) | `tile-inscription` |
| **W6 cell prop** (transparent, `Sprites/Props/`) | torch, ladder, platform, chest, camp, timber and basalt supports, blasting charge |
| **W7a** (Phase 6) | `obsidian` (made where water meets lava), `obsidian-block` (placed) |
| **W7L liquid** (Phase 6, proposed): per liquid a 16 × 16 body tile × 2 variants and a 16 × 4 surface strip × 4 frames, seamless, no outline; brief in `docs/art-commissions/world-sprites/12-fishing-liquids.md` | `liquid-water`, `liquid-lava` (procedural flat fills until they land) |

Crack stages, glow halos, loose-rock dust and the dig highlight are drawn by the engine over the tile.

---

## 8. Parallax backgrounds

Spec **W8**. Each town and hunting ground gets four layers, drawn back to front behind the play layer. They
replace the painted `bg-*` backdrops in the world.

| Layer | Scroll factor | Content | Alpha | Outline |
|---|---:|---|---|---|
| `sky` | 0.0–0.05 | sky gradient in 4–6 flat bands (one 2-tone checker row between bands allowed), sun, moon, stars or the eclipse ring | opaque | none |
| `far` | 0.15–0.25 | the realm's landmark silhouettes on the horizon (the Godforge ring, the Orrery, the Canopy) | transparent above the silhouette | none |
| `mid` | 0.4–0.5 | hills, ruins, town roofs; 2–3 tone ramp | transparent above | none |
| `near` | 0.65–0.75 | big foreground-ish shapes behind the walk lane: chimneys, roots, crystals | transparent above | 1 art px, lighter than any play-layer outline |

- **Size:** each layer is **480 x 192 art px** (x8 = 3840 x 1536 authored, sidecar `scale` 2, 1x copy
  1920 x 768 logical px), **seamless left to right**. The bottom edge is the town ground line.
- **Atmospheric perspective:** each layer back is closer to the sky's horizon colour, lower in contrast and
  saturation. `far` uses at most 4 colours, `mid` 6, `near` 8.
- **Keep the walk lane clean:** nothing in any layer may look like something to stand on or walk into.
  The bottom 24 art px of `near` stays low and dark.
- **No people, no text, no signs, no UI.** No light source that the play layer would have to match except
  the sky's, which stays upper left.

---

## 9. In-world UI: slots and panels

The in-world HUD (hotbar, satchel, station panels, Quick Inspect, the Hearth pill) moves to framed pixel
panels. Pages outside `/play` keep the design system.

- **Frames are 9-slice PNGs** (CSS `border-image` with `image-rendering: pixelated`), drawn at **2 logical px
  per art px**.
- **Slot:** 22 x 22 art px frame with a 3 art px border: outline `#140a1f`, bevel `#463650` (top-left) /
  `#0e0912` (bottom-right), fill `#1e1428` at 90% opacity. Drawn at 2x = a **44 x 44 px** slot (the phone
  hit-area minimum) with a 32 x 32 px well, so a 32 art px icon sits in it at 1x. The bag and Inspect draw the
  icon at 64 / 128 px in a frame scaled by the same 9-slice.
- **Selected slot:** border in aged gold `#a5793a` with a 1 art px `#e8c898` inner line.
- **Rarity:** a 1 art px inner rim in the tier colour (§5.4) on the slot, and the item name text in that
  colour. Common has no rim.
- **Panel:** 9-slice with a 4 art px border (outline, bevel, an inset line), aged-gold rivets `#a5793a` in
  the corners, fill `#1e1428` at 92%. A title bar uses the same frame, gold text.
- **Text** stays in the design system's font at real sizes (never pixel-font body copy); counts on slots
  are the only pixel-font text (white `#f4ecd6` with a 1 px `#140a1f` outline).
- Briefs for the frame sheet are written with the HUD work; they are not part of this pack.

---

## 10. Export format

- **PNG, RGBA, sRGB**, no colour profile surprises, no metadata needed.
- **Transparent background** with transparent corners, except W7a row 0, W7 feature strips, W7b back walls
  and the W8 `sky` layer, which are opaque.
- **Nearest-neighbour** upscale by the factor in §2; never resized again after export.
- One file per sheet at the **exact library path** in its brief, kebab-case, the `NN-` prefix kept; sidecar
  `.json` with the same name beside it (W1–W8). Icons and portraits have no sidecar.
- Never save `-key`, `-chromakey`, `-source`, `-draft` or `-v2` files into the library, and never a
  `name 2.png` copy (the synced folder makes them by itself).
- Keep the **source** (`.aseprite` at 1 art px) next to the library, not in it.

---

## 11. The importer sidecar

`scripts/import-assets.py` reads one sidecar per sheet (schema also in the
[commission README](../art-commissions/README.md)):

```jsonc
{
  "id": "keeper",               // optional; default = filename minus the NN- prefix
  "scale": 2,                   // authored scale; the importer also emits an exact 1x reduction
  "pixelArt": true,             // REQUIRED for every sheet in this pack: smoothing off, whole-pixel draws
  "frame": { "w": 384, "h": 384 },   // one cell, authored px (= art px x export factor)
  "pivot": { "x": 192, "y": 368 },   // ground contact, authored px; default bottom-centre
  "actions": [                  // one sheet row each, top to bottom
    { "name": "idle", "frames": 4, "fps": 6, "loop": true,
      "anchors": { "hand_front": [[196, 236, 150], [196, 244, 150], [196, 244, 150], [196, 236, 150]],
                   "hand_back":  [[156, 236], [156, 244], [156, 244], [156, 236]] } }
  ]
}
```

| Field | Rule |
|---|---|
| `scale` | 1–4; `frame.w` and `frame.h` divisible by it. 2 for everything in this pack |
| `pixelArt` | boolean; `true` on every pixel sheet. The importer rejects a non-boolean and passes `true` through to `sprite-manifest.generated.ts`, where the renderer turns smoothing off and snaps draws |
| `frame` | the sheet must be exactly `max(frames) x frame.w` by `actions x frame.h` |
| `actions` | unique names; rows in listed order; any subset of a figure's actions may ship first |
| `anchors` | one point per frame; `[x, y]` or `[x, y, deg]` |
| Tiles (W7) | `{ "scale": 2, "pixelArt": true, "frame": {"w": 64, "h": 64}, "actions": [{"name": "tile", "frames": 4, "fps": 0, "loop": false}] }`; the importer infers this when the sidecar is missing |

---

## 12. Pipeline status

IMP-1, IMP-2, IMP-3, RND-1, RND-2 and ENG-1 landed with the terrain pass 2 (2026-10-13); RND-3 is still open.

| Id | What | Status |
|---|---|---|
| **IMP-1** | `import_tiles` accepts a full W7a sheet (rows `tile top bottom sides thin caps inner`, 4 pieces each; inferred from a 4 x 7 sheet without a sidecar). Only row 0 must be opaque; edge pieces may round their corners off. The manifest marks it `autotile: true`. One-row W7 strips (interiors, back walls, feature strips) import as before | done |
| **RND-1** | `terrain-render.ts` uses an imported sheet when `tileFor(<node id>)` has one and its image has loaded: a W7a sheet draws the piece for the cell's neighbours (`tile-art.ts autoTilePiece`, §7.1) and replaces the procedural edges and top face; a one-row strip replaces only the interior. Back walls are `tile-wall-<biome id>`. Everything else keeps the procedural tile, and cached chunks repaint once when a sheet loads | done |
| **IMP-2** | `Sprites/Parallax` family: `NN-parallax-<place>-<sky|far|mid|near>.png`, one `layer` action, the sky opaque and the rest clear at their top corners; written to `parallax-manifest.generated.ts` | done |
| **RND-2** | `parallax.ts`: a town or hunting ground draws its realm's imported layers (`parallax-<realm>-<layer>`, scroll 0.03 / 0.2 / 0.45 / 0.7, bottom edge on the ground line, snapped to art pixels) once every imported layer has loaded, else the painted `bg-*`. The Delve's cave uses `parallax-delve-<biome id>-far|near` at 2 px per art px when imported, else its procedural layers | done |
| **IMP-3** | collectible and portrait ladders resize nearest-neighbour for pixel art: any file commissioned as `menu-pixel` in `commissions.csv`, or any stem marked `-px` (not part of the key) | done |
| **RND-3** | HUD chrome is CSS from the design system; §9 frames need the frame sheet and a CSS pass on the in-world panels | open |
| **ENG-1** | the Delve spawns its creatures under their atlas keys `cinder-bailiff` and `seam-eater` (creature-rigs.ts and art.ts alias them to the Rivet Maw and Mirror Substitute until their art lands); the briefs, paths and CSV rows use those keys | done |

## 13. Do and don't

**Do**

- Draw the Keeper as a chunky, 40 art px figure whose hood, gold mask and single violet eye-gem read at 80 px
  in the Delve: the mask is the brightest shape on the body, the eye-gem is 1–2 pixels of `#d9b8ff`.
- Give a basalt block a lit top lip and a dark right bevel so a dug tunnel reads as carved space at a glance.
- Make the Cinder Ore vein three or four orange seams that zig-zag inside the cell, brightest pixel at the
  thickest point, so the vein reads from across the screen.
- Exaggerate a creature's wind-up: the Rivet Maw's jaw opens 3–4 art px wider than at idle and its ember
  seams brighten one step; the player learns the tell from the silhouette.
- Draw an icon at 32 art px and judge it at 32 screen px: one dominant shape, one accent colour, a 1 px
  outline, the long axis on the lower-left to upper-right diagonal.
- Keep realm colour where it means something: ember in the Seamworks, amethyst in Umbral, violet only for
  Godforge energy.

**Don't**

- Don't mix pixel sizes: no half-size detail pixels inside a sprite, no scaled-down painting pasted in.
- Don't outline in pure black or outline every inner shape; don't pillow-shade.
- Don't let glow, smoke or a flame bleed into the transparent background as soft alpha: emissives are
  bright pixels; the engine does the halo.
- Don't bake the rarity aura, a slot frame, text or a drop shadow into an icon.
- Don't draw a front-facing walk cycle or a left-facing sheet: sheets face right and the engine mirrors.
- Don't copy, trace or colour-pick from the reference game, or from any other game's assets.
- Don't give back walls an outline or a bright accent: they must sit behind tunnels and sprites.
- Don't put anything walkable-looking in a parallax layer, and don't light a layer from anywhere but the
  upper left.

---

## 14. Working from an image generator

Generators do not produce clean pixel art or consistent frames. Use them for **design only**:

1. Generate the key pose or object with the brief's prompt and negative prompt.
2. Downscale with **nearest-neighbour** to the art-pixel canvas in the brief (for example 48 x 48 for one
   Keeper frame), or redraw over it at that size.
3. Clean it by hand: one outline, the palette from §5 (index the colours), no stray anti-aliasing.
4. Animate the frames by hand on the cell grid, pivot fixed.
5. Export at the brief's factor with nearest-neighbour, write the sidecar, run
   `python3 scripts/import-assets.py --check --only=Sprites`.
