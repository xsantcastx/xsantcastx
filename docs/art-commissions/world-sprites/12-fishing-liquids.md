# Water, lava, obsidian and Fishing (pixel art)

Pixel scale, sizes, outline and shading, palettes, animation and the sidecar are in the art bible, [docs/art/style-guide.md](../../art/style-guide.md); the save checklist is in [../README.md](../README.md). Image generators do not make clean pixel art or consistent frames: use the **design prompt** for the look, then draw or clean the frames on the art-pixel grid (style guide §14), keeping the cell, pivot and export factor exact.

Phase 6 of [docs/world/delve-and-beyond.md](../../world/delve-and-beyond.md) (§4 Liquids, §5 Fishing, §9 art briefs). What ships today draws everything procedurally (`docs/handoff/liquids-fishing.md`):

- **Liquids** are flat fills in the spec palettes, drawn per row in runs (`play/engine/liquid-render.ts`): a three-band body (surface, one cell down, deeper), a 1-art-px lip and a 2-frame shimmer on the surface pixels only. Water is translucent (α 0.6) and drawn over the Keeper, lava is opaque and lights its cavern.
- **Obsidian** is a procedural tile from its node palette (`terrain.ts` `obsidian`, `obsidian-block`).
- **Item icons** (fish, rods, bait, crates, junk, buckets, oil, the Lodge's charms) are procedural 16 × 16 pixel icons (`shared/art/pixel-icons.ts`) that `artFor()` uses only until a painted file lands, so the importer replaces them with no code change.
- **The Drowned Lamp** wears the Ephemeris Leech's rig (`creature-rigs.ts`) and painting (`ART_ALIAS`).
- **The bob** is four code-drawn art pixels.

Not yet in `commissions.csv`: add the rows when the brief is approved. Priority P2 (the game reads without them).

Common negative (all briefs):

```text
anti-aliasing, soft edges, blur, smooth gradient shading, airbrush, painterly texture, photorealism, 3D render, vector art, mixed pixel sizes, sub-pixel detail, jpeg artifacts, noise, heavy dithering, pure black outline, pillow shading, glow halo past the silhouette, text, letters, numbers, watermark, signature, background, scenery, copied or traced sprites from any existing game
```

## W7L — liquids (new spec, proposed for style guide §7)

Per liquid: a **body tile** 16 × 16 art px, 2 variants (`Assets/Tiles/liquid-<id>.png`, sheet 32 × 16, ×8 = 256 × 128), and a **surface strip** 16 × 4 art px × 4 frames (`Assets/Tiles/liquid-<id>-surface.png`, sheet 64 × 4, ×8 = 512 × 32). The body tiles seamlessly in both axes; the strip sits on top of the top body row and animates at 4 fps (reduced motion holds frame 0). The renderer draws levels in 2-art-px steps (8 per cell), so the strip's lip is exactly 1 art px and the body must read when cropped to any even height.

| id | Body (top → deep) | Lip / flecks | Alpha | Notes |
|---|---|---|---|---|
| `water` | `#2e6e9a` `#1e4a6a` `#0e2a3a` | lip `#86d2e6`, sparkle `#d0f6ff` | 0.6 (translucent; the Keeper shows through) | the Grotto ramp; a few rising bubbles in the deep variant |
| `lava` | `#E8752A` `#c4501e` `#7a2a12` | lip `#ffd08a`, flecks `#ff9b4f` | opaque | the Infernal ember; 2-frame churn of brighter flecks rolling in the top body row; it is a light source (the code lights it) |

```text
water body tile: deep underground lake water seen side-on, three blue bands darkening downward (#2e6e9a, #1e4a6a, #0e2a3a), a few 1-art-pixel pale bubbles and a faint vertical caustic shimmer, seamless in both directions, 16x16 art-pixel cell, flat colour areas. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, no outline (it is a fluid), light from above, no anti-aliasing, no dithering; export with nearest-neighbour x8.
```

```text
lava body tile: molten rock seen side-on, bright orange top band fading to dark red-brown (#E8752A, #c4501e, #7a2a12), slow crusted swirls of darker cooled skin, a few bright #ffd08a sparks, seamless in both directions, 16x16 art-pixel cell. hand-placed pixel art for a 2D sandbox side-scroller, every pixel on the art-pixel grid, no outline, no anti-aliasing, no dithering; export with nearest-neighbour x8.
```

```text
liquid surface strip, 4 frames: the top edge of the liquid, a 1-art-pixel bright lip (#86d2e6 for water, #ffd08a for lava) with 2-3 short highlight dashes that move one art pixel to the right each frame, 16x4 art pixels per frame, transparent above the lip. hand-placed pixel art, every pixel on the art-pixel grid, no anti-aliasing; export with nearest-neighbour x8.
```

## W7a — `obsidian` and `obsidian-block`

Auto-tile sheets as every W7a node (style guide §7.1: rows `tile top bottom sides thin caps inner` × 4), `Assets/Tiles/obsidian.png` and `Assets/Tiles/obsidian-block.png`. Palette: `#140e20` `#2a1f3a` `#5a4a7a`, fleck `#a48bff` (the block one step lighter, with mortar lines so a built wall reads as built).

```text
obsidian rock: glassy black-violet volcanic glass in conchoidal facets, sharp pale violet edge highlights on the lit upper-left of each facet (#5a4a7a, #a48bff), the rest #2a1f3a and #140e20, no grain, no pebbles, 16x16 art-pixel tile. hand-placed pixel art for a 2D sandbox side-scroller, a 1-pixel coloured outline (never pure black, floor #140a1f) only where it meets air, light from the upper left, 3 to 4 hue-shifted tones plus one highlight, no anti-aliasing, no dithering; export with nearest-neighbour x8.
```

## I1 icons (16 × 16 art px, ×8 = 128 × 128, transparent; `Assets/Sprites/Items/<id>.png`)

Every icon reads at 40 px on the satchel's dark well. Each replaces the procedural icon of the same id (`pixel-icons.ts`; delete its row there when it lands).

| id | Subject | Palette notes |
|---|---|---|
| `seam-bucket`, `seam-bucket-water`, `seam-bucket-lava` | a riveted slag-iron pail with a rope handle; empty, brimming with water (`#86d2e6` lip), brimming with lava (`#ffd08a`, a heat shimmer pixel) | slag greys `#2e2a32` `#5a545e` `#8c8494` |
| `worn-rod`, `root-rod`, `seam-rod`, `glowline-rod` | a diagonal rod (grip bottom-left, tip top-right), line hanging to a tiny bob: re-knotted grey wood; World-Root bark with a green thorn; slag-grey with an ember-orange reel; teal glowcap fibre with a cyan glowing line | the tier is read by the rod's material and the reel |
| `ember-grub`, (`glowcap`, `blindfin`, `shadow-root-cutting` exist or are fish) | a fat segmented orange grub with a warm glow in its segments | `#e8956a` `#c4501e` `#ffc8a0` |
| `blindfin`, `rootling-eel`, `glowcap-minnow`, `mere-perch`, `emberling`, `slagjaw-eel` | side-on fish, head left: an eyeless grey-violet cave fish; a brown eel with green root stripes; a small teal minnow glowing cyan from inside; a plain green perch ("ordinary"); a tiny orange lava fish with ember flecks; a grey eel with a teal slag jaw | each in its water's palette |
| `the-kept-morning`, `the-unpaid-debt` | legendaries, one art px larger silhouette: a gold lampfish carrying a small warm sunrise inside it; a dark ember fish with a heat-seal stamp (a ring with a notch) on its flank | a faint 1-px aura is allowed only for these two |
| 20 Ledger Catch fish (`tallyfish` … `closing-entry-carp`, `fishing.model.ts`) | one sheet `Assets/Sprites/Items/ledger-catch.png`, 20 cells: each a distinct fish with a written mark on it (tallies, a struck line, a seal, a nib spine, a folded corner…) per its Codex line | muted ink-and-paper hues, so they read as the Warden's set |
| `rusted-rivet`, `waterlogged-ledger-page` | a rust-orange rivet with a domed head; a sodden page with blue-grey ink columns that stop at a waterline | |
| `root-crate`, `seam-crate` | a bark-bound crate swollen with water, a green tie; a slag-grey crate with Kael's stencil upside down on the lid | |
| `lampfish-oil` | a stoppered flask of pale gold oil glowing softly | `#e8b84a` `#fff4d0` |
| `tackle-box`, `anglers-patience`, `lodge-reel` | a green lacquered tackle box with brass corners; a knot of root that never tightens; a wooden rod reel with a green leaf inlay | the Lodge's Verdant palette |
| `fishing-bob` (UI) | the bob, 4 frames: floating, dip, deep dip, splash ring | red cap `#e04a3a`, ivory belly `#f4ead6` |

## The Drowned Lamp (creature sprite + concept sheet)

Creature sheet (style guide creature spec), `Assets/Sprites/Creatures/drowned-lamp.png`, rig key `drowned-lamp`: idle (4), windup (3), strike (3), hurt (2), death (5); pivot at the belly line; on screen about 4 cells long at the Delve's half scale. Plus a painted concept sheet for review only.

```text
the Drowned Lamp: a lampfish the size of a cart, long eel-like body of deep blue-black scales (#0e2a3a, #1e4a6a) with a lantern lure hanging from its brow that holds a warm gold sunrise (#ffe9a8, #e8b84a) — the only warm thing in the cave — its body swallowing light: no highlights on the body except where the lure lights it; in the hurt frames the lure flares and the scales show (#2e6e9a, #86d2e6). side view, head left. hand-placed pixel art for a 2D sandbox side-scroller, a 1-pixel coloured outline (never pure black, floor #140a1f), light from its own lure, 3 to 4 hue-shifted tones per material, no anti-aliasing, no dithering; transparent background; export with nearest-neighbour x8.
```

Lore it must carry (lore addendum, "The Drowned Lamp"): it circles the lamp the Archivist left at the bottom of the Mere and "dims every other light in the cavern, as if the morning should only be kept in one place". In the dark it is a rumour; in the light it is a fight (the game exposes it only beside a lit torch).
