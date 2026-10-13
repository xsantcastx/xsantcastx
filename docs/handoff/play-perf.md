# /play on a mid-range phone — measurements and fixes

2026-10-13. Covers the five towns (with keepers, townsfolk and per-realm particles),
a hunt, and the Delve (Magma Halls with torches, lighting, supports, charges).

## How it was measured

`e2e/perf-play.spec.ts` is the harness. It is skipped unless `PLAY_PERF=1`, so it
is not part of the `play-*` suite.

```bash
npx ng build
PLAY_PERF=1 PW_PORT=4298 PLAY_PERF_OUT=perf.json \
  npx playwright test e2e/perf-play.spec.ts --project=chromium -g "throttled phone"
# + PLAY_PERF_GPU=1        Metal GPU (canvas 2D GPU-rasterised, like a real phone)
# + PLAY_PERF_SECONDS=20   shorter window (default 60)
# + PLAY_PERF_PROFILE=dir  .cpuprofile + .heapprofile + screenshot per scene
```

- Emulation: 390×844 CSS px, DPR 3, `isMobile`, touch, through CDP; **CPU throttled 4×**
  for the measured window only (seeding, walking and descending run unthrottled).
- Each scene runs for **60 s** with the Keeper walking left and right in 3 s slices,
  so the camera moves.
- Frame time comes from a rAF probe. Long tasks come from `PerformanceObserver`.
  Heap is `JSHeapUsedSize` after a forced GC, before and after the window. Allocation
  per frame comes from the sampling heap profiler with collected objects kept
  (an estimate). Main-thread ms per frame come from `Performance.getMetrics`
  (`TaskDuration`, `ScriptDuration`).
- Scenes: each town (seeded through `eclipse-play-world-v1`); the hunt Reflection
  Channels (Places → East Stair); the Delve: a 3-row gallery under the Magma Halls
  ceiling, 17 torches along it, a camp at the west end, reached through
  "Descend to your camp". The fixture is built with the game's own code
  (`play-delve-fixtures.ts`).

**Two raster modes, and why both matter.** Headless Chromium has no GPU by default.
It rasterises every canvas with SwiftShader on the main thread, so pixel fill
dominates. That is the worst case: a phone whose GPU canvas is blocklisted, or a
weak GPU. With `PLAY_PERF_GPU=1` (Metal) canvas 2D is GPU-rasterised as on a
real phone. The Mac's GPU, though, is far stronger than a phone's, so frame time
saturates at 60 fps in that mode, and its signal is main-thread time and
allocation. A phone GPU's fill rate sits between the two modes. That is why the
fixes cut pixels and blend-mode passes, not only JS.

Run-to-run noise on this shared machine is roughly ±10% on p95. A single-scene
hitch (for example one long task from an image decode) can move `longTasks`.

## Before / after (4× CPU, 390×844 @3, 60 s per scene)

Software raster (SwiftShader, the worst case). Frame time is p50 / p95 in ms; long tasks
are count (total ms); allocation is KB per frame.

| Scene | Frame time before | Frame time after | Long tasks before | Long tasks after | Alloc before | Alloc after | Frames in 60 s |
|---|---|---|---|---|---|---|---|
| Infernal (Basalt Seamworks) | 33.4 / 50.2 | **17.9 / 35.3** | 0 | 28 (1821)¹ | 74.0 | **34.9** | 1671 → 2422 |
| Luminous (Heliograph Court) | 33.4 / 50.2 | **16.8 / 34.7** | 0 | 0 | 68.9 | **30.5** | 1681 → 2749 |
| Umbral (Nocturne Archive) | 33.4 / 50.1 | **16.8 / 34.8** | 0 | 0 | 68.6 | **30.3** | 1686 → 2722 |
| Celestial (Meridian Orrery) | 33.4 / 50.2 | **16.8 / 34.6** | 0 | 0 | 71.7 | **31.4** | 1650 → 2745 |
| Verdant (Rootglass Canopy) | 33.7 / 51.0 | **16.8 / 34.4** | 33 (1719) | **0** | 71.6 | **30.7** | 1592 → 2755 |
| Hunt: Reflection Channels | 35.0 / 51.8 | **16.7 / 34.3** | 102 (5600) | **0** | 86.5 | **39.5** | 1489 → 2649 |
| Delve: Magma Halls + 17 torches | 83.3 / 116.6 | **50.0 / 66.7** | 676 (56626) | **470 (25194)** | 112.6 | **40.9** | 738 → 1188 |

¹ In this run, one Infernal stretch had a burst of long tasks. The previous run of the same build
(`after1`, shorter work) had none (p95 35.4, 0 long tasks), so treat it as noise.

GPU raster (Metal, the realistic phone path):

| Scene | Frame time before | Frame time after | Alloc before | Alloc after | Main thread after (ms/frame) | JS after (ms/frame) |
|---|---|---|---|---|---|---|
| Infernal | 16.7 / 18.5 | 16.7 / 18.5 | 67.1 | **31.3** | 3.83 | 2.45 |
| Luminous | 16.7 / 18.5 | 16.7 / 18.5 | 63.5 | **31.7** | 3.39 | 2.17 |
| Umbral | 16.7 / 18.5 | 16.7 / 18.5 | 63.7 | **30.8** | 3.57 | 2.27 |
| Celestial | 16.7 / 18.4 | 16.7 / 18.5 | 64.3 | **29.4** | 3.43 | 2.19 |
| Verdant | 16.7 / 18.5 | 16.7 / 18.4 | 64.4 | **31.7** | 3.42 | 2.18 |
| Hunt: Reflection Channels | 16.7 / 18.5 | 16.7 / 18.5 | 73.9 | **38.6** | 2.95 | 2.10 |
| Delve: Magma Halls | 16.7 / 18.5 | 16.7 / 18.5 | 67.1 | **27.3** | 2.51 | 1.75 |

The baseline run predates the main-thread metric. A profiled 15 s GPU sample of the
baseline build measured 4.05 ms per frame in Verdant, 4.00 in the hunt and 3.52 in the
Delve, with the profiler adding overhead.

Other measurements, before → after:

- **Canvases in device pixels (every scene):** before, the game canvas was 780×1192
  (0.93 MP) and the site's `.cosmic-canvas` starfield 585×1266 (0.74 MP) ran behind it
  at 60 fps, 1.67 MP drawn per frame in all. After, the game canvas is 585×894 (0.52 MP)
  and the starfield is `display: none` with its loop parked: **−69% pixels**.
  On desktop (1280×800 @2) the game canvas is unchanged at 2×, and the parked starfield
  saves a second 2560×1600 canvas.
- **JS heap growth over 60 s:** ~0.9–1.4 MB in every scene, before and after. It is
  the same garbage that survives a minor GC, and nothing leaks. The forced-GC heap
  is flat at about 18–19 MB.
- **Engine tests:** 95 → 102 (all pass).

## What was slow (baseline profile)

- **Pixel fill, not JS.** In software mode, 78–87% of samples are `(program)`, which is
  native raster. JS was 10–17%. The biggest single item was the Keeper's
  `drawImage` with `shadowBlur` set: a Gaussian blur of the whole rig buffer,
  every frame.
- **Two full-viewport canvases.** The site-wide constellation canvas
  (`assets/js/cosmic-engine.js`) kept drawing 30–70 particles plus link lines at
  60 fps behind an opaque game. It was 14% of all JS allocation on /play. The
  pulsar loop also wrote two CSS custom properties per frame.
- **Delve full-screen passes** (measured one at a time on a 585×894 software canvas
  at 4×): the `soft-light` biome wash took ~9–11 ms, the four `lighter` heat columns
  ~11–14 ms, the darkness overlay ~6–9 ms, and eight `lighter` torch halos
  ~5–8 ms.
- **Town backdrop:** the scaled scene painting took ~4–8 ms and the full-screen
  shade gradient ~6 ms, every frame.
- **Allocation** (~70 KB per frame) came from:
  - `RigSprite.render` (~27%: per-triangle canvas calls);
  - the cosmic starfield (14%);
  - `AppComponent.isPlayMode` (9%: the template reads it about twenty times per
    change-detection pass, and every read serialised the router URL);
  - the engine's `report()`/`onState` (8%);
  - per-frame gradients: the scene shade, the hanging-lantern glows and the
    hearth;
  - `Atmosphere` re-copying its mote list (`slice`/`filter`) sixty times a second;
  - `drops.filter` on every step;
  - a fresh object from `keeperMotion` per Keeper per frame.

Already in good shape: terrain is chunk-cached, and darkness is one half-res
offscreen canvas. Keepers, townsfolk, stations, sites, monsters and peers are
already culled off-screen, and debris and motes are typed-array pools.

## What changed

**Desktop looks the same.** Everything that changes pixels is gated on the new
render budget (`src/app/play/engine/render-budget.ts`): `full` on desktop, `lite`
on a touch-first device (`(hover: none) and (pointer: coarse)`, overridable with
`EngineOptions.lite`).

1. **Site backdrop parked on /play** (all devices).
   - `SideScrollerComponent` puts `body.gf-world-route` on while the world is mounted.
   - `styles.css` hides `.matrix-background`, `.cosmic-canvas`, `.cosmic-pulsar`,
     `.rune-whisper` and `.particle-layer` under it, matching the existing
     `gf-art-route` rule.
   - `cosmic-engine.js` parks the constellation loop and the pulsar loop while either
     `gf-world-route` or `gf-art-route` is on. Before, art routes hid the canvas but
     still drew it every frame. A body-class `MutationObserver` restarts both loops
     when the class leaves.
   - Click ripples and touch spark bursts are also skipped while the backdrop is hidden.
     On /play every tap is a move, and each one used to append a DOM starburst over
     the game.
   - Checked: screenshots of /play at 1280×800 @2 and 390×844 @3 under reduced motion,
     with the backdrop hidden versus shown, differ only by a walking townsfolk figure.
     The game covers the backdrop completely, so nothing visible changed.
2. **Phone backing store capped at 1.5×** (`lite.maxPixelRatio`). Desktop stays at
   2×. Rig buffers and terrain chunks follow `pixelScale` down with it.
3. **No `shadowBlur` glows on phones** (`lite.glows = false`, via `engine.blur()`).
   This covers the Keeper and peers, drops, the strike arc, stalls, sites, the
   waystone and the beacon.
4. **Town backdrop baked once on phones** (`lite.cacheBackdrop`). The floor colour,
   the painting at 94% and the dusk shade are composed into one offscreen canvas
   at the device pixel scale. Each frame then lays it down as one unscaled blit at
   the parallax offset.
   - It is the same three operations in the same order, so the result is exact.
   - It is rebuilt only when the painting, view width or pixel scale changes.
   - The Delve keeps the live path, because its camera moves vertically.
   - Desktop keeps it live too, since the cache would be a 5–6 MP canvas there.
5. **Delve light passes on phones use plain alpha** (`lite.blendModes = false`).
   - The biome wash is a source-over tint at the biome's alpha instead of `soft-light`.
   - The torch halos and heat columns are source-over instead of `lighter`.
   - Halos are blitted from a cached 128 px disc per colour
     (`GlowHalos.halo(..., sprite)`).
   - Over the near-black of a delve the result reads almost the same. The darkness
     overlay is drawn after the wash, so blacks stay black.
6. **Zero per-frame gradients and fewer allocations** (all devices, no pixel change).
   - The scene shade is cached per context.
   - The hanging-lantern glow and hearth glow are cached unit radials scaled into
     place. The inner radius is a fixed fraction: 4/150, and 5/168 for the hearth,
     which pulses ±16 px, so its inner radius drifts by under 0.5 px.
   - The rug gradient is cached.
   - `Atmosphere` feedback motes are a pooled array, compacted in place, capped at
     100 as before.
   - `drops` is filtered in place.
   - `keeperMotion` fills one scratch object.
7. **`AppComponent.isPlayMode` memoised** on the router's committed `routerState`, or
   on the in-flight navigation. The router replaces `routerState` together with the
   URL tree it serialises, so the cache cannot go stale.

## Guards

- `scripts/seamworks-engine.test.cjs` gained 7 tests:
  - the budget tiers and the device query;
  - the backing store on a DPR-3 phone is 585×894 when lite and 780×1192 on desktop;
  - lite draws no `shadowBlur` anywhere in the five towns and their hunts, while
    desktop still does;
  - lite never uses `soft-light` in the Delve, while desktop still does;
  - lite bakes the backdrop once and blits it once per frame, while desktop draws
    the painting live;
  - **the hot draw path builds no gradient** across 90 walking and standing frames
    in all five towns, their hunts and the Delve, after a warm-up pass;
  - feedback motes are pooled, never reallocated, and capped.
- `e2e/perf-play.spec.ts` has a guard test: the Infernal town's p95 frame time at
  4× throttle must stay under `PLAY_PERF_P95_CEILING` (default 70 ms; it measures
  ~35 ms in software mode). It is skipped on CI, where shared runners make frame
  timing meaningless, and skipped unless `PLAY_PERF=1`.

## Delve, round 2 (2026-10-13): the darkness overlay on the phone tier

Same harness, Delve scene only, 30 s windows (`PLAY_PERF_SECONDS=30`). Baseline is
the build after the HUD fixes. The Hearth now starts folded, so the phone game
canvas is 585×1089 (0.64 MP), not the 585×894 of the table above. Read these
numbers against each other, not against round 1.

**Where the Delve frame went.** This was measured by switching each part off in a
throwaway build, software raster, 4× CPU, task ms per frame:

| Variant | Task ms/frame | Script ms/frame |
|---|---|---|
| As shipped | 37.1–37.7 | 7.4–7.6 |
| No darkness overlay at all | 31.1 | 5.8 |
| Overlay built but never blitted | 31.0 | 5.4 |
| No Keeper rig (painting drawn whole) | 32.7 | 3.0 |
| Neither | 26.4 | 1.2 |
| Overlay at 0.25 resolution instead of 0.5 | 36.2 | 6.4 |
| Overlay blitted nearest-neighbour | 34.0–36.5 | 7.6 |
| Nearest-neighbour + 0.25 resolution | 32.7 | 6.3 |

So the darkness costs about 6 ms. Almost all of that is the filtered full-frame
upscale blit, not punching the lights (a quarter of the overlay pixels saves only
~1 ms). The rig costs about 4.5 ms, and it is mostly JS: per-triangle
`save` / `clip` / `drawImage` / `restore`.

**What changed (phone tier only; desktop draws exactly as before):**

1. **Nearest-neighbour upscale of the darkness overlay** (`RenderBudget.smoothDarkness`,
   false on lite). One overlay texel is 2 CSS px, and the darkness is a slow
   gradient: a step at the lantern's edge is ~2/255 of alpha. Screenshots of the
   Magma Halls scene at 390×844 @3, smoothed and not, could not be told apart.
   0.25 resolution plus nearest-neighbour measured faster still, but showed
   4 CSS px blocks around small lights, so it was not shipped.
2. **The biome tint rides inside the overlay.** The phone's plain-alpha wash
   (round 1, item 5) is filled into the overlay *under* the darkness with
   `destination-over`, after the lights are punched. Premultiplied, that is exactly
   tint-then-darkness over the world, so the pixels are identical. The phone canvas
   loses one full-frame fill, and the extra fill runs on the small offscreen canvas.
   If the overlay canvas cannot be made, the tint is drawn on its own as before.

| Delve, 390×844 @3, 4× CPU, 30 s | Frames | p50 / p95 ms | Task ms/frame | Script ms/frame | Alloc KB/frame |
|---|---|---|---|---|---|
| Software raster, before (2 runs) | 804, 799 | 33.4 / 50.9–51.2 | 37.35, 37.56 | 7.36, 7.37 | 41.5, 42.9 |
| Software raster, after (3 runs) | 908, 882, 884 | 33.3 / 49.9–50.1 | 32.35, 32.83, 33.95 | 7.04–7.51 | 39.5–40.4 |
| GPU raster (Metal), before | 1801 | 16.7 / 18.4 | 2.63 | 1.44 | 31.9 |
| GPU raster (Metal), after | 1802 | 16.7 / 18.5 | 2.51 | 1.41 | 31.0 |

Main-thread time per frame fell **~12%** in software raster (37.4 → 33.0 ms), and
**+11% frames** were drawn in the same 30 s. The p50 and p95 do not move because the
rAF probe is quantised to vsync: 33.3 is two refreshes, 50 is three. A frame now has
more slack inside the same two refreshes. In GPU mode the frame was already at 60 fps.
The main-thread change there (2.63 → 2.51) is within noise. On a real phone GPU the
filtered blit is cheap anyway, so this mostly helps software-raster and weak-GPU phones.

Guard: the engine test `render budget: in the Delve a phone lays its tint inside the
darkness overlay and upscales it unsmoothed; desktop unchanged`.

**The rig was not changed, on purpose.** The two cheap ideas were:
- re-deform the Keeper no more than 30 times a second;
- deform into a smaller buffer.

The first saves nothing in this harness. The throttled phone already draws at
≤30 fps, so the cap only helps a phone that runs at 60, where the rig is ~1 ms of
JS. Re-deforming every other *drawn* frame would drop the pose to 15 Hz there.
The second blurs the one figure the eye follows. The real fix is still the sprite
sheets (`sprite.ts`), which replace the rig per figure as art lands.

## Not done / next

- **The Delve is still the heaviest scene in software raster.** Round 2 (above)
  took ~4.4 ms a frame off the darkness overlay on phones. What is left is the
  Keeper rig (~4.5 ms, JS) and the main canvas raster itself.
- **Throttling the lighting pass** (rebuilding darkness every other frame) was not
  done. The overlay is in screen space and the lantern follows the Keeper, so a
  stale frame visibly lags while walking.
- **Rig mesh rendering** (`RigSprite.render`) is the largest remaining allocator:
  per-triangle `clip` + `drawImage`, every figure, every frame. Sprite sheets
  (`sprite.ts`) replace it as art arrives. Until then, a phone could re-deform
  background townsfolk at 30 Hz.
- **No real-device number.** Both modes here are proxies. Check on a real
  mid-range Android with `chrome://inspect` and the same scenes.
- On a 390-wide phone the Hearth chat panel covers about a third of the game
  viewport (visible in the screenshots). That is a layout question, not a perf one.
