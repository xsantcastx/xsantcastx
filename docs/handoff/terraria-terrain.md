# Handoff: Terraria-style Delve terrain (2026-10-13)

Owner direction: Terraria is the art reference. The Delve's terrain was drawn as flat
squares in each node's colours. It is now pixel art with joined blocks, top faces,
back walls, a distant cave behind the caverns and a smoothed light grid. No new art
assets. Gameplay did not change: cell HP, collision, tools and saves are untouched,
and so are the save format and the generator.

## What changed

| Area | File | What |
|---|---|---|
| Pixel tiles | `engine/tile-art.ts` (new) | A 32 px cell is 16×16 art pixels at 2 world px each. Each node kind is baked once into 3 variants from its own `base/dark/light/fleck` palette. The patterns: blotchy stone with pebbles; ore as bright clustered nuggets with a shine pixel; roots as wavy strands; petrified wood grain; glowcaps; the Godforge wedge; the cracked wall; bedrock streaks; caches; placed blocks as bricks. All the textures live in one atlas canvas (48 × ~624 px). Each row is painted the first time it is asked for, and never again. A cell picks its variant with a fixed hash. |
| Auto-tiling | `tile-art.ts` `tileMask`, `paintEdges` | An 8-neighbour solid mask (a diagonal counts only when both orthogonals beside it are solid). Solid cells join, so ore sits *inside* its rock. A side open to air gets a dark outline pixel and a bevel (lit top and left, shadowed bottom and right). A corner open on both sides is rounded, and an air pocket on a diagonal notches the corner. |
| Top faces | `tile-art.ts` `topFaceOf`, `paintTopFace` | Where a solid cell has air above, the biome's crust grows: moss in the Root Hollows, ash in the Basalt Caverns, glowing lichen in the Glowcap Grotto, ember crust in the Magma Halls. The face comes from the biome's own `particles.kind` (spore/ash/mote/ember), so the world data is unchanged. Caches, the fragment, glowcaps and placed blocks get no face. |
| Back wall | `terrain-render.ts` `paintWall` | A dug cell (generated solid, now air) shows the biome's wall as a dim brick-and-grout texture, shadowed under and beside rock. Carved inscriptions sit on it too. Generated air (the caverns, the old tunnel) is left clear. |
| Parallax | `engine/cave-backdrop.ts` (new) | There are two procedural pixel layers per biome. The far layer is opaque: a rock face with stalactites and stalagmites, scrolling at ×0.2. The near layer is transparent apart from dark columns and hanging rock rimmed in the wash colour, scrolling at ×0.45. Each layer is baked once per biome and laid as a repeating pattern, clipped to that biome's rows and snapped to art pixels. Below the surface, the town painting and its shade are skipped instead. The opaque terrain used to hide them completely, so the frame does 2 pattern fills where it used to do 3 full-screen passes. |
| Crisp pixels | `terrain-render.ts` | Chunks are painted and blitted with `imageSmoothingEnabled = false`. Cracks and the loose-rock fracture are drawn on the art-pixel grid (`pixelLine`). Chunk resolution (1, 1.5 or 2 device px per world px) keeps every art pixel a whole number of chunk pixels. |
| Sparkle | `engine.ts` glints | The lantern glint on a vein now sits on its nugget's shine pixel (`sparkleOffset`) and is drawn as a pixel star. Under reduced motion it stays still at 0.7, as before. |
| Lighting | `engine/lighting.ts` | The lantern/torch/fuse/blast/vein model is the same (`lightGrid` reproduces `darknessAt`; there is a test). It is now evaluated on a grid, one sample every 16 world px. The grid is written into a tiny canvas (one pixel per sample) and upscaled with bilinear filtering, as Terraria's smooth lighting does. Light reaches less far into solid rock: rock that touches no air takes 0.8 of each light, and 0.6 one ring deeper (`RockShade`, rebuilt only when a chunk revision moves). The phone tint (`under`) is folded into each sample in JS, using the same premultiplied formula as before. Desktop upscales the grid straight onto the frame. The phone filters it into the half-res overlay and lays that nearest-neighbour, exactly as round 2 of play-perf did. The per-light radial-gradient hole punching is gone. |
| Chunk revisions | `terrain.ts` `touch` | A chunk-corner cell also bumps the diagonal chunk, since the corner notch reads 8 neighbours. This only affects rendering. |

## Perf (opt-in harness, Delve scene, 390×844 @3, 4× CPU, 30 s, software raster)

The shared machine was much busier than during play-perf.md's runs: the baseline measured 83 / 100 ms
here, against 33 / 50 there. So the builds were run alternately, against each other, from two preview
servers. `before` is main at `adf9dab`.

| Run (software raster) | Frames | p50 / p95 ms | Task ms/frame | Script ms/frame | Alloc KB/frame |
|---|---|---|---|---|---|
| before #1 | 370 | 83.3 / 100.0 | 81.45 | 18.58 | 61.6 |
| before #2 | 377 | 83.3 / 100.0 | 79.80 | 18.18 | 61.8 |
| after #1 | 467 | 66.6 / 85.1 | 64.44 | 14.18 | 53.1 |
| after #2 | 517 | 51.9 / 83.2 | 58.08 | 12.84 | 51.9 |
| before #3 | 431 | 66.7 / 85.2 | 69.74 | 15.67 | 56.7 |
| before #4 | 448 | 66.7 / 83.4 | 67.15 | 15.12 | 57.4 |
| after #3 | 525 | 51.4 / 68.4 | 57.24 | 12.69 | 52.7 |

| Run (GPU raster, Metal) | Frames | p50 / p95 ms | Task ms/frame | Script ms/frame | Alloc KB/frame |
|---|---|---|---|---|---|
| before | 1806 | 16.7 / 18.3 | 5.25 | 3.24 | 32.3 |
| after | 1803 | 16.7 / 18.3 | 5.44 | 3.32 | 31.9 |

In software raster the "after" build is faster than the "before" run taken next to it in every pair: about
−10 to −15 ms of main thread per frame, and +15–20% more frames in the same 30 s. Most of that is fill
that went away: below the surface the painting and shade passes are skipped, and the darkness is one
tiny-grid upscale instead of a fill plus a destination-out gradient per light. The light grid's JS (about
4k samples, with each light visiting only its own box) costs less than the hole punching did. In GPU mode
the frame was already at 60 fps, and main-thread time moved by +0.2 ms, which is within noise. Chunk cost
per frame is unchanged: chunks are still cached and blitted once each. Repainting a chunk is now
`drawImage` from the atlas plus a few edge rects per cell, and it happens only when a cell changes.

## Screenshots (not committed)

`output/terraria-terrain/{before,after}-{root-hollows,basalt-caverns,glowcap-grotto,magma-halls}-{desktop,phone}.png`.
Desktop is 1280×800; phone is 390×844 @3. They come from a throwaway spec that seeds a camp in each biome's
cavern (with a dug pocket and two torches) using `DelveFixture`, then descends.

## Tests (`scripts/seamworks-engine.test.cjs`, 131 pass)

- Auto-tile mask: holes, diagonals, a lone block, diagonal-only neighbours. Variants are stable and all of them are used.
- Edges: only open sides are outlined, a diagonal notch costs one pixel, and everything stays on the art grid.
- Top faces per biome (the four Delve biomes map to moss/ash/lichen/crust).
- Textures: deterministic, variants differ, ore nuggets carry a shine where the sparkle sits.
- Atlas: one canvas; each kind and each biome wall is baked once; nothing is retried without a canvas.
- Diagonal chunk bump. `lightGrid` equals `darknessAt`; rock shade dims only inside rock. `RockShade` depths and rebuild on dig.
- Parallax layers: deterministic, far is opaque, near is mostly open, both wrap in x.
- The Delve render-budget test was rewritten for the grid. Desktop upscales the grid smoothed. The phone folds its tint into the grid and lays it through the overlay unsmoothed, and smoothing is restored afterwards.

## Gates

`check:meaning` (no new violations), `tsc`, the node test suites (148 pass), DS adherence, i18n keys, the nav audit,
`npm run build` (Initial total 1.74 MB) and the CSP hashes all pass. Full `e2e/play-*.spec.ts` on chromium: 84 passed, 3 failed.
Rerun alone, the two `play-delve-extras` failures pass: they were walk-timing flakes on a loaded machine.
`play-inventory-stacks` "forge 300 runes" fails the same way on the baseline build (main `adf9dab`): the
footer intercepts the Rune Forge button. It predates this work and has nothing to do with the terrain.

## Not done / next

- Placed things (torch, ladder, chest, camp, supports, charge, platform) are still vector stand-ins drawn over
  the wall. They should become pixel tiles when their art is commissioned (`delve-building.md`).
- Light does not flood around corners (no BFS propagation). Rock only attenuates it. A real flood fill on the
  grid would be the next step if caves should go fully black behind a bend.
- Rows above the surface keep the town painting. The parallax starts at the terrain's top edge.
