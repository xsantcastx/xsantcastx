# The deep Delve on a phone — measurements and fixes

2026-10-15. Covers the Underhearth beside the Umbral Rift Gate, the Furnace Hall, the Ink Deeps, the wide
traverse and the Magma Halls gallery. Follows `play-perf.md` (towns + the first Delve pass), which was
measured before the Underhearth existed.

## How it was measured

The same harness, `e2e/perf-play.spec.ts`: 390×844 CSS px at DPR 3, touch, **CPU throttled 4×** for the
window only, software raster (SwiftShader, the worst case), the Keeper walking in 3 s slices, 30 s windows.

- **Base and change were measured back to back, alternating builds** (`base, new, base, new, base, new`),
  3 runs each, same machine state; the table shows **medians** (per-run values in brackets where they move).
  The machine was shared with other agents, so a single run can be off by a vsync step.
- The rAF probe is quantised to vsync: 16.7 = 60 fps, 33.3 = 30 fps, 50 = 20 fps. Task ms per frame
  (main-thread time from `Performance.getMetrics`) is the finer signal.

New in the harness: `PLAY_PERF_TRACE=<dir>` writes a 6 s Chrome trace per scene. The CPU profile lumps
canvas raster into "(program)"; the trace names it (`Canvas2DResourceProviderSharedImage::ProduceCanvasResource`).

## Before / after on main `eb4cb8b6` (pixel creatures + NPCs with cached sheets), medians of 3 alternating runs

4× CPU, 390×844 @3, 30 s. Base = `origin/main` eb4cb8b6; after = this branch merged onto it.

| Scene | p50 ms before → after | p95 ms before → after | Frames in 30 s | Task ms/frame | Long tasks | Alloc KB/frame |
|---|---|---|---|---|---|---|
| Underhearth, beside the Umbral gate | 49.1 [49.1, 50, 34.1] → **16.7** | 65.0 → **33.2** | 688 → 1670 | 43.7 → 17.0 | 86 → 0 | 46.2 → 24.0 |
| Furnace Hall, Banked Furnace awake | 50.1 [35.3, 50.1, 50.6] → **18.6** [17.3, 31.8, 18.6] | 68.1 → **48.2** | 565 → 1160 | 53.1 → 25.6 | 350 → 0 | 40.7 → 25.9 |
| Ink Deeps, Gate Hollow | 16.8 → **16.7** | 33.7 → **18.6** | 1533 → 1729 | 19.0 → 16.7 | 0 → 0 | 29.4 → 27.4 |
| Wide traverse east (surface) | 33.4 → **16.7** | 50.1 → **18.5** | 844 → 1802 | 35.5 → 11.1 | 1 → 0 | 33.3 → 20.7 |
| Magma Halls gallery, 17 torches | 49.9 → **16.7** | 51.7 → **18.5** | 668 → 1798 | 45.0 → 13.9 | 35 → 0 | 33.5 → 18.3 |

Pixel sheets on main had already cut script time (13.5 → ~3.3 ms/frame in the Underhearth). The raster
passes below were untouched by them, and they remained the bottleneck.

## Before / after on af398f36 (before the pixel creatures), medians of 3 alternating runs

| Scene | p50 ms before → after | p95 ms before → after | Frames in 30 s | Task ms/frame | Long tasks | Alloc KB/frame |
|---|---|---|---|---|---|---|
| Underhearth, beside the Umbral gate | 66.8 → **16.7** | 99.7 → **17.6** | 434 → 1739 | 69.3 → 14.9 | 387 → 0 | 97.2 → 23.7 |
| Furnace Hall, Banked Furnace awake | 65.1 [66.6, 65.1, 34.3] → **32.6** | 100 → **50.0** | 495 → 1073 | 60.6 → 27.7 | 281 → 7 | 74.1 → 26.5 |
| Ink Deeps, Gate Hollow | 17.1 → **16.7** | 34.5 → **17.6** | 1364 → 1739 | 21.0 → 15.0 | 0 → 0 | 32.4 → 27.7 |
| Wide traverse east (surface) | 33.3 → **16.7** | 50.0 → **17.6** | 945 → 1784 | 31.7 → 12.3 | 10 → 0 | 41.5 → 29.9 |
| Magma Halls gallery, 17 torches | 33.9 → **16.7** | 51.7 → **18.6** | 783 → 1762 | 38.3 → 15.0 | 18 → 0 | 31.1 → 18.5 |

The target was ≤ 33 p50 / ≤ 50 p95 in every deep scene, and it is met on both bases. The Furnace Hall has
the least slack (~26–28 ms of a 33 ms budget), so it is the scene the new guard watches. Standalone runs of it on this build
gave 17.0 / 34.1 (guard) and 16.8 / 33.7 (trace run): the walk path decides how much of the open hall
is in view. Script ms/frame fell 13.5 → 5.3 in both Underhearth scenes.

## What was slow

Per draw call raster cost was measured by flushing the canvas around each call (`getImageData(0,0,1,1)`,
unthrottled, 30 frames) in the Underhearth scene. Before:

| Draw | ms/frame (unthrottled) |
|---|---|
| Four heat columns (`GlowHalos.band`, a stretched gradient, full height) | 5.0 |
| Glow halos (cached discs, ~4 a frame, up to 288 px) | 2.7 |
| Distant cave, two pattern fills over the whole band | 2.7 |
| Creature rigs (`RigSprite.render` + blit) — **for creatures off screen** | 1.4–2.7 |
| Darkness overlay blit | 0.9 |
| Terrain chunks | 0.7 |

×4 throttle, that is ~55 ms of raster a frame. JS was small and diffuse; the rig was the only real JS item.
On the wide traverse it was the sky: the town painting scaled live (1.9 ms) and the dusk shade gradient
over the whole frame (2.4 ms).

## What changed

Desktop draws exactly as before except fix 1 (a pure cull). Phone changes are gated on the render budget.

1. **Creatures on another floor are not drawn** (all tiers). The monster loop culled by x only. The
   Underhearth stacks halls, so creatures one or two floors above or below — in x range, out of view —
   had their rig deformed and blitted every frame. Now a delve also skips a creature whose floor is above
   the view or more than 720 world px below it (the tallest figure, the Banked Furnace, fits).
2. **Heat columns and halos ride inside the darkness overlay** (phone). On the phone tier they are plain
   source-over, drawn right after the darkness. Source-over is associative: drawing them into the half-res
   overlay after its dark, then laying the overlay, gives the same pixels on a ninth of the fill.
   `DarknessLayer.draw(…, over)` calls back into `drawHeat` with the overlay's transform. Desktop keeps
   them additive (`lighter`) on the frame.
3. **The distant cave is drawn only where it can show** (phone, `RenderBudget.maskBackdrop`). Solid rock
   tiles are opaque, so the two parallax pattern fills are limited to row runs of non-solid cells in view,
   plus one cell of margin for rounded tile edges, with edges snapped to device pixels. Under solid rock
   one flat fill of the far layer's colour stays, for the hairline seams between terrain chunks. Columns
   outside the loaded span stay filled.
4. **The Delve sky is baked** (phone, `cacheBackdrop`). With the surface in view, the painting at 50% is
   pre-scaled once to device pixels and laid at the parallax offset snapped to a device pixel. The
   screen-fixed dusk shade is baked at the frame's size and laid 1:1. The cost drops from 4.2 ms to 0.9 ms
   a frame, unthrottled. It is rebuilt when the painting, the view or the pixel scale changes.

**Pixel check.** Screenshots at 390×844 @3 under reduced motion, base against change:

- Underhearth, Furnace Hall, Magma Halls: max channel difference 4–6/255, none over 8. That is the heat
  and halos at overlay resolution.
- Wide traverse: max 18/255 on 0.11% of pixels, at edges in the 50%-alpha sky painting. That is the
  sub-pixel parallax snap.

## Guards

- `scripts/seamworks-engine.test.cjs`, 4 new tests:
  - a phone lays the heat columns inside the darkness overlay (no gradient fill reaches the frame), and
    desktop keeps them on the frame;
  - a creature on a floor above or below the view is neither drawn nor posed;
  - a phone bakes the Delve sky once and copies it every frame, and desktop draws it live;
  - `CaveBackdrop` with the mask draws one flat fill under all-rock, and three row runs round one open
    cell. Unloaded columns stay filled.
  - The existing render-budget, hot-draw-path and light-grid tests still pass.
- `e2e/perf-play.spec.ts` guard: **Delve Furnace Hall p95 < 70 ms and p50 < 45 ms** at 4× throttle.
  Override with `PLAY_PERF_DELVE_P95_CEILING` / `PLAY_PERF_DELVE_P50_CEILING`. Like the town guard, it is
  skipped on CI and skipped unless `PLAY_PERF=1`. Base measured 65 / 100 here, so it fails on that build.

```bash
npx ng build
PLAY_PERF=1 PLAY_PERF_SECONDS=30 PW_PORT=4351 npx playwright test e2e/perf-play.spec.ts --project=chromium -g "perf guard"
```

## Not done / next

- **The Furnace Hall has the least headroom.** What is left there is raster:
  - the two cave pattern fills over the open hall: ~2.5 ms unthrottled;
  - the darkness overlay, with the heat inside it: ~1.9 ms;
  - the terrain chunks: ~0.9 ms.

  Shrinking the cave further would change its look: half resolution makes uneven texels. The far layer
  cannot be cached either, because its snapped offset moves every few px of camera.
- **Creature rigs** still deform every frame when on screen. The pixel-art migration (sprites through the
  keeper painter) replaces them; this pass did not touch sprite drawing.
- **No real-device number.** As in `play-perf.md`, software raster at 4× is a proxy: compare runs of
  the harness with each other, not with a phone.
