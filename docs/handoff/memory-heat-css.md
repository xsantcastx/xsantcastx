# /play: the phone crash, heat, and what runs behind the world

2026-10-13. Owner reports: "On the phone it crashed when I tried to open a menu
from the city like crafting"; "PC gets hot while using the game"; "a lot of old
CSS in the background".

Scope note: removing the legacy website (tools pages, cosmic engine in
`index.html`, dead global CSS) moved to a separate agent mid-task. This branch
fixes the crash and the heat. It only touches global CSS where that changes what
runs on `/play` (two scoped rules in `styles.css`), and it does not touch
`index.html` or `cosmic-engine.js`.

## The crash: the Crafting Bench recursed until the stack overflowed

Every time the Crafting Bench opened (in-world or on `/forge/crafting`):

```
CraftingBench refresh() → buildCta() → get blocker → CraftingGateway.blocker()
  → gateway.init() → CraftingService.init() → publish() → snapshot$.next()
  → the bench's crafting.snapshot$ subscriber → refresh() → …
```

`CraftingService.init()` published on every call. It is the same
"init() publish loop" pattern as the earlier tab crash (memory note). Each turn
of the loop rebuilt all ~80 recipe cards, the journal and the CTA, until
"Maximum call stack size exceeded". Angular's ErrorHandler caught it and logged
one `[GODFORGE ERROR]` line, so the bench still rendered on desktop. WebKit
(Safari) has a smaller stack and logged it too. On a phone the burst of CPU and
allocation, on top of the next two problems, is what froze and killed the tab.

Fix: `CraftingService.init()` is idempotent (an `initialised` flag; later
changes still publish through the writes that make them and through
`rehydrate`). Other `init()`s checked: every other service that publishes
from `init()` already has a guard. `ExchangeService.init()` still publishes on
each call. It is not called from any subscriber path, and re-publishing there
refreshes the day roll-over on open, so it was left alone.

Two more things made opening a place on a phone heavier than it needed to be:

1. **A hidden three.js scene ran on /play at 60 fps for the whole session.**
   `<app-forge-scene>` is rendered for the first hydration pass (before
   `isPlayMode` settles) and destroyed as soon as the router does. That is
   while `ForgeSceneService.mount()` is still awaiting `import('three')`.
   `unmount()` ran first, with nothing to tear down. The import then
   resolved, and `mount()` built a WebGL renderer on the **detached** canvas and
   started its rAF loop. The result was a full-viewport WebGL context drawing
   additive particles nobody could see, plus its mouse/scroll listeners, on
   every visit to /play. Fix: `unmount()` bumps a generation counter.
   `mount()` gives up after the import if the generation moved or the canvas
   is no longer connected.
2. **The world kept drawing at 60 fps behind an opaque place panel.**
   `setPaused(true)` stopped the simulation but not `render()`. Fix: a paused
   engine draws one more frame and parks its rAF loop. `setPaused(false)`
   resumes it with a zero first delta, so no simulation time leaks out of the
   minutes spent in a menu. If the canvas is resized while parked, it repaints
   once (resizing clears a canvas).

## Heat

- **Frame pacing** (`engine.ts`, `MAX_FPS` / `QUIET_FPS` / `QUIET_AFTER_MS`). The
  engine draws at most 60 frames a second; a 120 Hz display used to get 120.
  In a town, after 2.5 s with nothing the player drives moving, it draws 30.
  "Moving" means held input, a walk, a swing, a dodge, hitstop or shake, a loot
  flight, or the Keeper's position changing. Hunts and the Delve always get 60.
  The fixed 60 Hz simulation step is unchanged. Townsfolk and motes keep moving,
  just at 30 fps while you stand still. The first input brings 60 back on the
  next frame.
- **Hidden tab:** browsers already stop rAF; nothing extra was needed.
- **Site layers on /play** (`styles.css`, scoped to `body.gf-world-route`):
  - `body::before` (a 130%-viewport `blur(55px)` nebula with an infinite drift and
    `will-change`) and `body::after` (the starfield) are hidden, like the
    `.matrix-background` / `.cosmic-canvas` rules that already were. The
    canvas covers them completely.
  - The routed host's `routeFadeIn` is off on /play. Its `forwards` fill kept
    an "active transform animation" forever, which held the whole world in its
    own full-viewport compositor layer above the root one.
- Still running on /play, and left as is: the HUD's `guide-glow` pulse (a
  small button), `cosmic-engine.js`'s 500 ms interval (parked loops; owned
  by the legacy-removal agent), and the side-scroller's 200 ms HUD timer.

## Numbers

### Memory: 20 open/close cycles (Crafting Bench, Rune Forge, Enchanting Table, Vault, Material Vendor)

Chromium, 390×844 @3, touch, 4× CPU throttle, Infernal town, measured after one
warm-up open of each station. Everything is read through CDP after a forced GC
(`e2e/play-memory.spec.ts` with `PLAY_MEMORY_PROBE=1`).

| | Before | After |
|---|---|---|
| Errors on each Crafting Bench open | "Maximum call stack size exceeded" (Chromium and WebKit) | **none** |
| JS heap, baseline → after 20 cycles | 21.49 → 22.41 MB | 20.53 → 21.34 MB |
| DOM nodes (detached included), baseline → after | 618 → 618 | 614 → 614 |
| JS listeners | 122 | 116 |
| Canvases alive (attached) | 6 (2): a detached WebGL canvas among them | 5 (2) |
| Decoded images (natural px) | 1.95 MP | 1.95 MP |
| Compositor layers, town | 9 layers, 1.73 MP (CSS px) | **5 layers, 0.71 MP** |
| Compositor layers, Crafting Bench open | 13 layers, 3.34 MP | **8 layers, 2.30 MP** |
| rAF callbacks/s with a place open | ~60 (engine and hidden three.js scene) | **0** |
| WebKit process RSS after 20 cycles (renderer / GPU)¹ | ~410 / ~310 MB | ~336 / ~126 MB |

¹ `ps` over the Playwright WebKit processes. Other sessions on this machine share
the browser binary, so treat this as indicative only.

No open/close leak was found. Heap, nodes, listeners, canvases and images come
back to the same values after every close: the lazy page component is
destroyed by `panelHost.clear()`. The crash was the recursion plus the
always-on GPU work, not accumulation.

### Idle CPU: all browser processes, % of one core

Chromium with the Metal GPU (`--enable-gpu --use-angle=metal`), Infernal town,
10 s windows, mean of 2 runs each, before and after interleaved
(`SystemInfo.getProcessInfo`, so only this browser is counted).

| Scene | Before | After |
|---|---|---|
| Desktop 1280×800 @2, standing in town | 55.4% | **33.4%** (−40%) |
| Desktop, Crafting Bench open | 56.0% | **24.9%** (−56%) |
| Phone 390×844 @3, standing in town | 43.2% | **30.8%** (−29%) |
| Phone, Crafting Bench open | 40.4% | **21.3%** (−47%) |
| World frames drawn, standing in town | 60/s | 30/s |
| World frames drawn, place open | 60/s | 0 |

Software raster (headless SwiftShader) is not a good heat proxy here. Removing
the blurred nebula layers lets the throttled main thread draw *more* frames
(they were compositor-bound), so main-thread % rises while the GPU process
falls. Use the GPU-mode numbers.

### CSS and bundle

- `styles.css`: +2 scoped rules (no removal on this branch; the CSS diet moved
  to the legacy-removal agent).
- Initial bundle: this change adds ~20 bytes of transfer (measured on the
  pre-rebase base: 1.75 MB / 452.27 kB before, 1.75 MB / 452.29 kB after).
  Rebased onto the legacy-site removal, the build is 1.67 MB / 434.19 kB.

### Visual parity

Screenshots of `/play` and `/play?at=crafting` under reduced motion, 1280×800 @2
and 390×844 @3, before vs after. Desktop is **pixel-identical** in both scenes.
Phone town is identical. Phone with the bench open differs in 892 px, all in the
10 px strip of world visible around the panel, which is now a frozen frame
instead of a live one.

## Guards

- `e2e/play-memory.spec.ts` (Chromium, skipped on CI): 20 open/close cycles of
  four Infernal stations. Asserts:
  - no `call stack` or `GODFORGE ERROR` console errors;
  - heap growth < 6 MB, DOM node growth < 1500, listener growth < 300;
  - at most +2 canvases and < 8 MP of new decoded images;
  - rAF callbacks with a place open fall below half of idle.
- With `PLAY_MEMORY_PROBE=1` it prints one JSON line per step for all five towns
  (`PLAY_MEMORY_OUT=file` appends them), under 4× CPU throttling.
- `scripts/seamworks-engine.test.cjs`: two new tests.
  - A paused world draws one frame, parks, resumes with a zero delta, and a
    destroyed engine never restarts.
  - Frames are capped at 60 on a 120 Hz clock, drop to 30 in a still town, and
    return to 60 on input.

- `e2e/play-delve-extras.spec.ts`: `digOverhead` now reads the Keeper's x only
  once it has settled (two equal reads 150 ms apart), and the loose-rock
  describe allows 5 min. With the hidden layers gone, headless Chromium draws
  more frames. The old one-shot read of the 100 ms-stale `data-player-x` then
  passed the "stands under" check a step early: 3 of 3 runs failed before the
  fix, 3 of 3 passed after. "Each new carving reads with E… 12 of 12" failed on the base build as well; main has
  since fixed it (it reads the lore save now).

## Not done / next

- **The Vault is the slowest place to open**: ~7 s of main thread at 4× (≈1.8 s
  real), against 2–4 s for the other stations. The inventory-grouping agent owns
  `vault-station`. Profile it there.
- `ExchangeService.init()` still publishes on every call (see above). It is
  harmless today, but it is the same shape as the crash.
- The `guide-glow` HUD pulse is an infinite CSS animation on /play. It is small,
  but it keeps one layer animating.
- No real-device number yet. Re-check on an iPhone (Safari Web Inspector →
  Timelines → Memory/CPU) by opening and closing the Crafting Bench 20 times.
