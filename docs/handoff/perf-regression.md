# The "phone perf regression" after the world clock, menus and the Living World — measured, and the one real cost fixed

2026-10-16. Reported: on 3231e4fb the `PLAY_PERF=1` guards read town 32.5–32.9 / 35–49.5 ms (p50 / p95) and the
Furnace Hall 33–50 / 50–83 with hundreds of long tasks, against 16.7 / 18.5 and 16.7 / 33.0 after the game-only
shell (f3717279). Method as in `delve-perf.md`: `e2e/perf-play.spec.ts`, 390×844 @3, 4× CPU, 30 s windows, builds
measured back to back alternating, 3 runs each, medians.

## Finding 1: most of the "regression" was the machine, not the build

The first bisect round ran at a load average of 12–20 (other agents' Chromes): **f3717279 itself** read 33.8 / 67.6
in the Furnace Hall and 33.1 / 49 in the wilds; 3231e4fb read 16.7 / 33.3 in town. Re-run on a quiet machine (load
1–4), alternating, every build sits on the same vsync steps at noon:

| Noon (12:00 pinned) | f3717279 p50 / p95 | main 7c2fe4c5 p50 / p95 | task ms/frame base → main |
|---|---|---|---|
| Town (Infernal) | 16.7 / 18.5 | 16.7 / 18.5 | 9.8 → 9.5 |
| Furnace Hall, Banked Furnace awake | 16.7 / 33.3 | 16.8 / 34.2 | 16.6 → 18.7 |
| Settlement (Basalt Seamworks) | 16.7 / 18.5 | 16.7 / 18.4 | 9.3 → 9.1 |
| Wilds (Quarry Head → east) | 16.7 / 18.4 | 16.7 / 18.4 | 7.2 → 8.2 |

A Chrome trace of the Furnace Hall on both builds (`PLAY_PERF_TRACE`) has the same main-thread time per frame
(6.10 vs 6.16 ms, raster 4.11 vs 4.06, rAF 1.38 vs 1.48, style 0.08 vs 0.10): the +2 task ms there is not one
pass; the per-pass timing below agrees.

**Lesson:** the harness numbers are only comparable back to back. Check `uptime` first; above ~6, do not measure.

## Finding 2: the world clock's sky made the hour part of the measurement

The clock runs at real time (a day every 24 min), so a guard run at night measured a different frame from one at
noon. `PLAY_PERF_HOUR=<0-23>` now pins the clock (its test skew, sessionStorage) to that hour of a day without an
eclipse; a build without the clock ignores it.

## Finding 3 (the real cost): the night's lamps in a town

Per-pass raster time (each pass flushed with `getImageData`, unthrottled, 600 frames, a temporary instrumented
build) in the Infernal town at 22:00: everything matched the base except **lamps: 1.22 ms/frame** — five or so
lamps (the stalls', the hanging lanterns', the Keeper's), each a 64 px glow **resampled** up to ~525 device px
across, together twice the frame's pixels. Sky tint 0.09 ms, night shade + Keeper ~0.17 ms: not worth caching.

Fix (`sky-light.ts`, phones only — render budget `cacheBackdrop`): the glow is pre-scaled once per size to device
pixels and laid with an identity transform at a whole device pixel, so the blit is a copy, not a resample. Lamps
1.36 → 0.29 ms/frame. Desktop draws exactly as before. Pixel check (Karma, `sky-light.spec.ts`): a lamp on whole
device pixels matches the live path within 8/255; otherwise it can sit up to half a device pixel off.

| Night (22:00 pinned) | f3717279 | main 7c2fe4c5 | this branch | task ms/frame base → main → branch |
|---|---|---|---|---|
| Town (Infernal) | 16.7 / 18.5 | 16.7 / **33.3** | **16.7 / 18.5** | 10.3 → 17.5 → 13.8 |
| Furnace Hall | 16.8 / 33.8 | 16.9 / 34.3 | 16.9 / 34.6 | 17.6 → 19.2 → 19.1 |
| Settlement | 16.7 / 18.4 | 16.7 / 18.5 | 16.7 / 18.4 | 9.1 → 9.6 → 10.3 |
| Wilds | 16.7 / 18.4 | 16.7 / 18.4 | 16.7 / 18.4 | 7.8 → 8.2 → 9.2 |

On main d7aba0ef (frameless menus, Slate phone-only) against this branch merged onto it, 22:00, 3 alternating
runs each:

| Night (22:00) | d7aba0ef p50 / p95 [runs] | merged p50 / p95 [runs] | task ms/frame |
|---|---|---|---|
| Town (Infernal) | 16.7 / 18.4 | 16.7 / 18.4 | 14.5 → **11.0** |
| Furnace Hall | 16.7 / 18.6 [18.6, 32.2, 18.6] | 16.7 / 31.8 [31.8, 33.1, 18.6] | 15.2 → 15.8 |
| Settlement | 16.7 / 18.4 | 16.7 / 18.4 | 8.4 → 7.6 |
| Wilds | 16.7 / 18.4 | 16.7 / 18.4 | 7.6 → 7.0 |

The Furnace Hall's p95 flips between the 18.6 and 33 steps run to run on both builds (the walk decides how much
of the open hall is in view); this branch does not touch the Delve's draw path.

## Harness / guards

- `PLAY_PERF_HOUR` (above).
- Harness scenes `settlement: the Basalt Seamworks` and `wilds: east from the Quarry Head into the Living World`
  (One World gate on, a resume point one column west of the Quarry Head stone, walking east for the window into
  the wilds at column 256).
- Guard `wilds p95/p50 …` under the Settlement's ceilings (p95 < 50, p50 < 34).

```bash
PLAY_PERF=1 PLAY_PERF_SECONDS=30 PLAY_PERF_HOUR=22 PW_PORT=4581 npx playwright test e2e/perf-play.spec.ts --project=chromium -g "town: infernal|Furnace Hall, the Banked|settlement: the|wilds: east"
```

## Not done / next

- The Furnace Hall's p95 sits on the 33 ms step on every build (base included): its open hall is raster-bound
  (cave pattern fills, darkness overlay; `delve-perf.md` "Not done").
- Town night is still ~3 task ms/frame above the base (the shade, the sky tint and the baked lamps: ~0.45 ms
  unthrottled); frames stay on the 16.7 step.
