# One art style — handoff

Owner, 2026-10-14: "yup go pixel ... make sure to be migrating everything we had in the past to pixel and make it
consistent." Reference: Terraria. The Keeper was already pixel (48×48 art px at 4×, one dark outline); NPCs,
creatures and props were still smooth paintings or canvas vectors beside it.

**The rule now:** one grid — 4 world px per art px in towns, hunts and the Homestead, 2 in the Delve (figureScale
0.5) — one outline (`keeper-paint.ts OUTLINE`, 1 art px), light from the upper left, colours only from the art
bible ramps (`docs/art/style-guide.md` §5) and the palettes already in code. Every in-house sprite is painted once
per look/frame into a small canvas, outlined, cached, and drawn as one unsmoothed blit.

## Audit (2026-10-14) — every visual in /play and the game pages

| Visual | Where it is drawn | Style before | Now / plan |
|---|---|---|---|
| The Keeper (player, Hearth peers, paper doll, Glass) | `shared/keeper-look/keeper-paint.ts` | pixel | unchanged; peers now on the player's 4 px box (were 3.6) |
| **Town keepers (21 named people)** | `play/engine/town-life.ts` `figure()` | **vector** placeholder (robe/hood/smith/coat paths) | **pixel** — the Keeper painter with a fixed look each (`npc-looks.ts`) |
| **Townsfolk** (2–4 per town) | same | **vector** | **pixel** — seeded face + realm palette, walk cycle |
| **Hollis Fenn** (the High Roads) | `engine.ts drawFolk` → `life.drawAt` | **vector** | **pixel** |
| **Hunt creatures**: Rivet Maw, Prism Forager, Mirror Substitute, Ephemeris Leech, Rootglass Stag | `engine.ts creature()` + `creature-rigs.ts` | **painted** WebP bent by a mesh rig | **pixel** (`creature-pixel.ts`), 7 frames each |
| **Delve creatures**: Cinder Bailiff, Seam Eater, the Drowned Lamp | same (wore the Maw's / Mirror's painting) | **painted** stand-ins | **pixel**, own designs |
| Underhearth / Ink Deeps: Banked Ember, Ironwood Sentinel, Shadeling, Gloam Warden, Banked Furnace | `engine.ts drawEmber/drawSentinel/drawShade/drawFurnace*` | pixel (2 px grid) | unchanged (already on the Delve grid) |
| **Market stalls** | `engine.ts drawStall` | **vector** (rects, arc scallops, glow ring) | **pixel** (`prop-pixel.ts`); the station icon on the plaque is still painted |
| **Waystone, passage arch, beacon, quest pedestal** | `drawWaystone`, `drawStation` | **vector** | **pixel**; the halo stays engine light |
| **Gathering nodes** (tree, outcrop, herbs, stumps) | `drawSite` | **vector** (arcs, curves, polygon) | **pixel**; the material icon over it is painted |
| **Coin drops** | render loop | **vector** (squashed ellipse + "$") | **pixel** 4-frame spin |
| Felled-creature embers | `dissolve` | vector dots | pixel squares |
| Glim (world + icons) | `play/engine/glim-sprite.ts`, `shared/glim/glim-art.ts` | pixel | unchanged |
| Delve tiles, placeables, cave backdrop, rails, cart, liquids | `tile-art.ts`, `terrain-render.ts`, `cave-backdrop.ts` | pixel | unchanged |
| Ground strip, High Roads ledges/trunks | `ground-strip.ts`, `surface-render.ts` | pixel | unchanged |
| Town + hunt **backdrops** | `engine.ts` `bg-*` paintings, `drawCachedBackdrop` | **painted** | remains — W8 pixel parallax sets are wired (`parallax.ts`) but `PARALLAX` is empty: needs art or a procedural set |
| Hub dressing (bunting, lanterns, Hearth sign, trail sign) | `atmosphere.ts` hub / scenery | vector + painted | remains |
| Ambient particles | `atmosphere.ts` | vector arcs | remains (tiny; could snap to the grid) |
| Drop beams, auras, light pools, name tags, bubbles, HP bars | `engine.ts` | vector (UI / light) | stays — light and UI, not sprites |
| Homestead buildings, automatons, thralls, explorers | `homestead-render.ts` | **vector** stick figures | remains — needs a layout pass (figures are 40 px at 22 px spacing; a pixel figure is 160 px) |
| Item icons (satchel, Vault, hotbar, drops, held fallback) | `shared/art/art.ts artFor()` | **painted** (~270 WebP) + 44 procedural pixel icons | remains — the I1 re-icon wave |
| NPC dialogue portraits | `shared/npc/npc-dialogue.component.ts` | monogram (no `npc-*` art exists) | plan: `KeeperPainter.still()` of the NPC's look (one call; owned by the UI pass) |
| Paper doll | `shared/rpg/equipment-panel.component.ts` | pixel Keeper | unchanged |
| Reels, Seam Sweeper, Eclipse Ascent, Rune Drop | `shared/reels`, `seam-sweeper`, `eclipse-ascent`, `rune-drop` | pixel SVG | unchanged |
| Gambler altar | `shared/gambler/gambler.component.html` | **painted** layers | remains |

**Art pipeline rules (unchanged):** never hand-write an `assets/` path. Commissioned art goes through
`scripts/import-assets.py` → `shared/art/*.generated.ts` (never hand-edited) → `artFor()` / `spriteFor()`. A
commissioned sprite sheet still wins over the in-house pixel figure for creatures (`readySprite` is checked
first); for keepers and the player the pixel painter wins. `Reference/` never ships.

## What a player gets

- Every person in every town is a pixel Keeper like them: same size, same outline, their own look from the cast
  briefs and lore — **Kael** in cracked iron plate under a leather forge apron, grey beard, one burning eye, no
  left hand, hammer; **Orla Stave** in a clerk's robe and sash with her tally ledger; **Edrin Kade** with an ore
  sack and brass tongs; **Mara Voss** apron, braid and hammer; **Aureth** in ivory with dawn-glass shards behind
  her head (no halo); **Verrin** hooded with a mirror for a face; **the Archivist** old, loupe on the eye, a book
  floating at his shoulder; the Merchant's hat and scales, Tomas's lantern, Lune's violet cards, Sera's staff and
  circlet, Corran's halberd and grey beard, Hollis's hat and walking staff… Props are held in front where they
  read; a speaking keeper gestures (`talk`), townsfolk walk with a real stride (`walk`).
- Every creature you fight is a pixel sprite with a readable silhouette and a telegraph: idle breath, stride,
  a coiled wind-up, a lunge with the mouth or weapon out, a flinch, a white hit flash, a sinking death.
- Stalls, waystones, arches, the beacon, trees, outcrops, herb patches and coins are pixel too.

## How it works

| File | What |
|---|---|
| `shared/keeper-look/npc-looks.ts` | `KeeperGarb` (apron, sash, hat, sack, loupe, mirror face, shards, eye glow, elder, one hand, book), `NPC_LOOKS` by keeper id, `townsfolkLook(seed, palette, shape)`. Pure. |
| `shared/keeper-look/keeper-paint.ts` | painter takes an optional garb; `walk` / `talk` actions; NPCs carry the off-hand prop in front; `cards` and `scales` off-hands; `GearPiece.color/accent` (fixed NPC cloth). Exports the shared helpers (`px`, `limb`, `outlined`, `OUTLINE`). |
| `shared/keeper-look/keeper-gear.ts` | `GearPiece.color/accent`, `walk`/`talk` hold poses, the two off-hand kinds. |
| `play/engine/town-life.ts` | painters built on town entry; `figure()` draws the pixel figure first (sheet → rig → vector only without a DOM). Floor shadows, tags, bubbles, hit boxes unchanged. |
| `play/engine/creature-pixel.ts` | `CREATURE_ART` (8 creatures), `CreaturePainter` (7 cached frames + flash copies), `creatureFrame()`. |
| `play/engine/prop-pixel.ts` | `PropPainter`: stall, waystone, arch, beacon, pedestal, tree, outcrop, herbs, coin. |
| `play/engine/engine.ts` | `pixelCreature()` in the monster loop and `dissolve`; props in `drawStation/drawStall/drawWaystone/drawSite`; coins. |

Frame cost: each figure/creature/prop is one cached blit (+ the live arm/weapon for people). Sprites are built on
first sight and kept for the session. Without a DOM (SSR, the node harness) everything falls back to the old paths.

## Tests

- `shared/keeper-look/npc-looks.spec.ts`: every keeper (and Hollis) has a look; 22 distinct paintings; garb
  changes key + pixels; townsfolk seeded; walk/talk paint; every non-trait creature in every area has art; each
  creature's frames differ; the flash is a pure white silhouette.
- `scripts/seamworks-engine.test.cjs`: the backdrop-cache test now picks the backdrop canvas by the painting it
  holds (the pixel sprites bake their own small canvases).
- `e2e/art-shots.spec.ts` (skipped unless `ART_SHOTS=<prefix>`): the camera for this page.

## Screenshots (`docs/handoff/one-art-style/`)

`before-*` / `after-*` for the five towns, the five hunts and the Magma Halls bailiff hall, at `phone` (390×844)
and `desktop` (1280×800); `after-gallery-people.png` (all 22 named people) and `after-gallery-creatures.png`
(8 creatures × 7 frames). Best pairs: `town-infernal-desktop`, `town-umbral-desktop`, `hunt-verdant-*`,
`hunt-luminous-desktop`, `hunt-infernal-desktop`.

## Not done / next

1. **Backdrops**: towns and hunts still sit on painted scenes. Either commission the W8 parallax sets (the
   pipeline is ready) or build a procedural pixel parallax per realm like `cave-backdrop.ts`.
2. **Item icons** (I1 wave) and the **gambler altar**: still painted.
3. **NPC portraits**: render `KeeperPainter.still()` of `NPC_LOOKS[id]` in the dialogue orb (UI-owned file).
4. **Homestead figures and buildings**: vector; needs a layout pass for 160 px figures.
5. **Hub dressing** (bunting, lanterns, signs) and ambient particles: vector.
6. Creature-rigs (`creature-rigs.ts`) and the painted Keeper rig are now unused in the browser for these keys;
   retire them once a release has run without regressions.
