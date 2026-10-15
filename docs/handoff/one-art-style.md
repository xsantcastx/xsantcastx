# One art style — handoff

Owner, 2026-10-14: "yup go pixel ... make sure to be migrating everything we had in the past to pixel and make it
consistent." Reference: Terraria. The Keeper was already pixel (48×48 art px at 4×, one dark outline); NPCs,
creatures and props were still smooth paintings or canvas vectors beside it.

**The rule now:** one grid — 4 world px per art px in towns, hunts and the Homestead, 2 in the Delve (figureScale
0.5) — one outline (`keeper-paint.ts OUTLINE`, 1 art px), light from the upper left, colours only from the art
bible ramps (`docs/art/style-guide.md` §5) and the palettes already in code. Every in-house sprite is painted once
per look/frame into a small canvas, outlined, cached, and drawn as one unsmoothed blit.

## Audit (2026-10-14, pass 2 2026-10-15) — every visual in /play and the game pages

| Visual | Where it is drawn | Style before | Now / plan |
|---|---|---|---|
| The Keeper (player, Hearth peers, paper doll, Glass) | `shared/keeper-look/keeper-paint.ts` | pixel | unchanged; peers now on the player's 4 px box (were 3.6) |
| **Town keepers (21 named people)** | `play/engine/town-life.ts` `figure()` | **vector** placeholder (robe/hood/smith/coat paths) | **pixel** — the Keeper painter with a fixed look each (`npc-looks.ts`) |
| **Townsfolk** (2–4 per town) | same | **vector** | **pixel** — seeded face + realm palette, walk cycle |
| **Hollis Fenn** (the High Roads) | `engine.ts drawFolk` → `life.drawAt` | **vector** | **pixel** |
| **Hunt creatures**: Rivet Maw, Prism Forager, Mirror Substitute, Ephemeris Leech, Rootglass Stag | `engine.ts creature()` + `creature-rigs.ts` | **painted** WebP bent by a mesh rig | **pixel** (`creature-pixel.ts`), 7 frames each |
| **Delve creatures**: Cinder Bailiff, Seam Eater, the Drowned Lamp | same (wore the Maw's / Mirror's painting) | **painted** stand-ins | **pixel**, own designs |
| Underhearth / Ink Deeps: Banked Ember, Ironwood Sentinel, Shadeling, Gloam Warden, Banked Furnace | `engine.ts drawEmber/drawSentinel/drawShade/drawFurnace*` | pixel (2 px grid) | unchanged (already on the Delve grid) |
| **Market stalls** | `engine.ts drawStall` | **vector** (rects, arc scallops, glow ring) | **pixel** (`prop-pixel.ts`); plaque icon **pixel** at 4× (`item-icons.ts plaqueIcon`) — pass 2 |
| **Waystone, passage arch, beacon, quest pedestal** | `drawWaystone`, `drawStation` | **vector** | **pixel**; the halo stays engine light; the crown's portal is a pixel icon (pass 2) |
| **Gathering nodes** (tree, outcrop, herbs, stumps) | `drawSite` | **vector** (arcs, curves, polygon) | **pixel**; the material pin over it is a pixel icon at 2× (pass 2) |
| **Coin drops** | render loop | **vector** (squashed ellipse + "$") | **pixel** 4-frame spin |
| Felled-creature embers | `dissolve` | vector dots | pixel squares |
| Glim (world + icons) | `play/engine/glim-sprite.ts`, `shared/glim/glim-art.ts` | pixel | unchanged |
| Delve surface sky (above a delve's top, at half alpha) | `engine.ts` render | **painted** | remains — the pixel parallax has no vertical camera yet |
| Realm pages, Market category tiles, status glyphs, crests, Guild marks, cosmetics, effect renders on /forge | `artFor()` UI keys | **painted** | remains — UI chrome outside /play, not items (art bible §1) |
| Codex Bestiary splash | `codex/bestiary.ts` | painting | **stays a painting** (art bible §1, S3) |
| Delve tiles, placeables, cave backdrop, rails, cart, liquids | `tile-art.ts`, `terrain-render.ts`, `cave-backdrop.ts` | pixel | unchanged |
| Ground strip, High Roads ledges/trunks | `ground-strip.ts`, `surface-render.ts` | pixel | unchanged |
| Town + hunt **backdrops** | `engine.ts` `bg-*` paintings, `drawCachedBackdrop` | **painted** | **pixel** — procedural sky/far/mid/near per realm, town and hunt variants (`pixel-parallax.ts`); imported W8 layers still win; the painting is no longer fetched there (pass 2) |
| **Hub dressing** (bunting, supply stall, benches, rug, kettle, hearth, Hearth sign, trail sign, lanterns) | `atmosphere.ts` → `hub-pixel.ts` | vector | **pixel** — still parts one cached sprite, pennants sway a whole pixel, flames/steam/embers on the grid; sign words stay real text (pass 2) |
| **Ambient particles** | `atmosphere.ts ambientLayer` | vector arcs | **pixel** — every mote a 1–2 art px square on the 4 px grid; Luminous light shafts stay light (pass 2) |
| Drop beams, auras, light pools, name tags, bubbles, HP bars | `engine.ts` | vector (UI / light) | stays — light and UI, not sprites |
| **Homestead** buildings, automatons, thralls, explorers | `homestead-render.ts` + `homestead-pixel.ts` | **vector** stick figures | **pixel** — buildings painted once per look; automatons (3 rungs × 2 frames) and thralls (tier colour, 3 hammer frames + idle) are half-Keeper pixel workers; explorers are Keepers; layout: 5 automatons a row at 48 px (10 shown), 6 thralls at 34 px, tents 76 px apart east of the fire (pass 2) |
| **Item icons** (satchel, paper doll, item cards, hotbar, Vault, stations, Market rows, Codex, Slate, drops, held fallback, node pins, plaques) | `shared/art/art.ts artFor()` → `item-icons.ts` | **painted** (~270 WebP) + 44 procedural pixel icons | **pixel** — 16 px procedural icons by kind × material (art bible ramps), one outline with a lit sel-out edge; 221 ids incl. the 23 uniques still awaiting paintings; every rune and rune-word a carved tablet (`runeIcon`); rarity stays on the slot's inner rim (pass 2) |
| **NPC portraits** (dialogue orb, the story line in /play, the welcome screen, Codex People of the Realms) | `npc-portrait.ts` | monogram | **pixel** — the NPC's own Keeper, head and shoulders at 4×; Glim is its moth; the Nameless keeps its "??" (pass 2) |
| Paper doll | `shared/rpg/equipment-panel.component.ts` | pixel Keeper | unchanged |
| Reels, Seam Sweeper, Eclipse Ascent, Rune Drop | `shared/reels`, `seam-sweeper`, `eclipse-ascent`, `rune-drop` | pixel SVG | unchanged |
| **Gambler altar** (sigil, flames, portal, slab, wager coin, burst, halo, the box on the shelf) | `gambler.component` + `pixel-fx.ts` | **painted** layers | **pixel** — 32 px sigil/burst/halo/slab, 16 px flames/portal/coin/chest; the sigil no longer spins (rotation blurs pixels), the halo turns in quarter steps (pass 2) |

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

## Pass 2 (2026-10-15) — what moved and how

| File | What |
|---|---|
| `shared/keeper-look/npc-portrait.ts` | `npcPortrait(id)`: the NPC's `NPC_LOOKS` Keeper, `still()` cropped to head and shoulders at 4 px per art px, a cached PNG data URL (browser only; null under SSR). Glim's portrait is its moth (SVG). The dialogue widget imports it lazily (eager shell); /play, the welcome screen and the Codex import it directly. |
| `shared/art/item-icon-shapes.ts` | 87 silhouettes on a 16 px grid: weapons, tools, worn pieces, jewellery, potions, books, scrolls, ores, bars, gems, herbs, drops, relics, Delve placeables, plaque things; plus the rune tablet. Tones are letters (primary `Ddblh`, second `wvu`, accent `eaAG`, shine `s`). |
| `shared/art/item-icons.ts` | `ITEM_ICONS` (id → kind × material × accent × second), the art bible ramps, `itemIcon()` / `runeIcon()` / `plaqueIcon()` / `iconOf()` / `artIcon()`. The renderer centres the shape, adds the outline (`#140a1f`, one step lighter on the lit top-left), emits crisp SVG rects in a data URI, caches. `artFor()` asks `artIcon()` first. Rune glyphs are 5×7, built from ten strokes chosen by a hash, unique across the 41 runes. |
| `shared/art/pixel-fx.ts` | The altar's 32 px sigil, burst, halo and slab. |
| `play/engine/hub-pixel.ts` | `paintWorld()` (world-space vector code → quarter-size canvas, snapped, outlined), the Hearth's still dressing, pennants, flames, steam, embers, the lantern sprite. |
| `play/engine/pixel-parallax.ts` | `PixelParallax` / `buildParallax(realm, 'town' \| 'hunt')`: four 480 px layers per place, cropped to their bands, blitted at 4×; two places kept. |
| `play/engine/homestead-pixel.ts` | Automaton, thrall, tent, camp-fire and forge-fire sprites; `blit()`. |
| `play/engine/engine.ts` | `pixelIcon()` / `plaque()` (crisp, centred, 64 px plaques and crowns, 32 px node pins); the pixel backdrop before the painting. |

Tests: `item-icons.spec.ts` (every definition and every painted item group has its pixel icon; forged tools are their own kind; shapes fit the cell; one outline, no black; distinct per item; unique glyphs; aether vs Aether; plaque keys stay off other surfaces), `npc-portrait.spec.ts`, `rune-cards.spec.ts` (cards are pixel; the paintings stay in the library), `forge-recipes.spec.ts`, `entity-resolver.service.spec.ts`. Node: the ambient layer and Homestead layout tests still pass with the new spacing.

Shots (`docs/handoff/one-art-style-2/`, `before-*` / `after-*`, phone 390×844 and desktop 1280×800): towns and hunts ×5, Delve bailiff hall, satchel, NPC orb (Verrin), Codex people, Market, Gambler (+ reveal), the Hearth, the Homestead (+ east); galleries `after-gallery-items.png` (every item and rune icon) and `after-gallery-parallax.png` (ten parallax sets). Best pairs: `town-infernal-desktop`, `hunt-luminous-desktop`, `satchel-desktop`, `homestead-east-desktop`, `codex-people-desktop`, `gambler-reveal-phone`.

Cost: initial bundle +30 kB (1.76 → 1.79 MB; the icon atlas sits with `artFor`, which the shell needs). Every icon/sprite is built on first sight and cached; a town frame adds four parallax blits over their own bands and drops the full-screen painting and its gradient.

## Not done / next

1. ~~Backdrops~~, ~~item icons~~, ~~Gambler altar~~, ~~NPC portraits~~, ~~Homestead~~, ~~hub dressing and
   motes~~ — pass 2.
2. **The Delve surface's sky** (the painting at half alpha above a delve's top): needs the pixel parallax to
   follow a vertical camera.
3. **UI paintings outside /play** (realm pages' avatars and crests, Market category tiles and status glyphs,
   Guild marks, cosmetics, /forge effect renders): chrome, not items; a separate pass if the owner wants them.
4. **Explorer portraits** on the Works map and the roster still use the rarity orb (`EXPLORER_ARCHETYPES`
   art is pending); they could be Keeper stills like the NPCs.
5. **Painted rigs** (`creature-rigs.ts`, `rig.ts`, `rig-poses.ts`): still referenced — the engine's no-DOM
   fallback, the creature strike/wind-up timing constants and the node test suite import them — so not
   retired. Move the timing constants out, then delete with their tests.
