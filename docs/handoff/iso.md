# Isometric renderer (Beta) — handoff (branch `iso`, 2026-10-27)

The owner picked isometric B: Diablo II's angle, HD pixel art, cozy with real darkness. Plan and gate: memory
`art-direction-isometric-b.md`. This branch replaces the prototype (`ee9d5a32`) with a production renderer and ships it
as a player setting.

## What a player gets

- **Isometric is every player's default (Beta)** (owner, 2026-10-27). Menu → Sound → Graphics reads
  "Isometric (Beta) / Classic"; the choice is per device (`localStorage['eclipse-td-graphics']`, the same rule as
  Environment detail) and takes effect at once. A player who picks Classic keeps it, and Classic is live main's
  top-down look, unchanged.
- **Tests.** The e2e suite pins Classic (`playwright.config` storage state and `play-helpers` `seed`), so older specs
  keep testing the top-down view. The Karma unit specs default to Classic (`defaultGraphics`). `e2e/td-iso.spec.ts`
  removes the pin to prove a fresh player gets Isometric.
- **Isometric.** The same square world (collision, maps, paths and the room server are unchanged) drawn as 2:1
  diamonds:
  - organic ground edges
  - walls that stand up as two-faced blocks, with the room's camera-side walls cut to stubs while the Keeper is inside
  - depth-sorted figures, props, trees and buildings
  - warm pools of light in inns, dungeons and at night, with names and bars kept over the dark
- **Slow devices.** If Isometric averages over 22 ms for 4 s once the world has settled, a parchment card offers
  "Switch to Classic" in one tap. The check never runs under a test harness (`underTest()`).
- **Taps.** Anything standing is judged against its own projected foot: creatures, stalls and givers, corpses, other
  Keepers, shared drops, fires and trees. A tap on open ground walks to the floor point under it. Keys and the stick
  steer on the screen.

## How it works (files)

| File | Part |
|---|---|
| `td-iso-ground.ts` | Diamond tiles. Each tile is painted by the ground's own painters (the HD square) and laid through a precomputed pixel map into **iso-space chunks** of 512×256 HD px (opaque, no diamond waste). Chunks bake a tile at a time inside a budget. The ring's first frames come first; the budget grows on quiet frames (`ISO_FRAME_MS`). The **atlas** covers open deep water (8×8 pattern × 4 frames). Water chunks keep 4 frames; frames 1–3 copy frame 0 and repaint only the tiles that move. Wall blocks are planned once per chunk. |
| `td-iso-walls.ts` | Cached block sprites per material (plaster, rock, vine, drowned, bark) and shape. `IsoCutaway` handles the rules. In a room (a flood fill under 900 tiles) the walls bounding it on the camera's side become stubs. In the open, a short wedge in front of the Keeper becomes stubs. The room is recomputed only when the Keeper changes tile. |
| `td-iso.ts` | The projection; the inn's furniture sculpted at this angle; `IsoQueue` (the depth queue: a typed-array pool and one sort of packed keys, with no allocation per frame); `isoFlat` (a ground decal or shadow projected once and drawn axis-aligned). |
| `td-engine.ts` (`drawIso`, the iso section) | Frame order: ground; then the floor plane (decals, shadows, ground effects, puddles, fish shadows); then the depth queue (wide objects split into 16-px strips, each sorted at its footprint's front edge); then the air; then fog; then the light map; then the UI. `at(x, y)` anchors upright drawing at a projected foot and does nothing top-down. `plane()` draws world coordinates flat on the floor. `clientOf` gives the DOM anchors. `tapRel` makes per-foot taps. |
| `td-artopt.ts` | `graphics()`, `setGraphics()`, `onGraphics()`, `offerClassic()`, `onIsoSlow()`. The dev `?artopt=` parameter still overrides (webdriver or localhost only). The prototype tavern stays dev-only (`artOptParam`). |

**The light map** is one low-resolution canvas laid over the world as a **DOM layer**, which the compositor scales
(the GPU on a phone). In the dungeon this cut the canvas's composite from about 6.4 ms to about 1 ms of main-thread
raster per frame. While it is up, the passes that belong over the dark (night eyes, the dark layer's shapes, weather,
names, bars, effects, plates, the veil) draw on a second, transparent **UI layer** above it. Neither layer takes
pointer events.

## Numbers — phone profile (390×844, DPR 3, CPU ×6): mean ms / frames over 33 ms

| Scene | Prototype | Production (quiet run) |
|---|---|---|
| Road walking | 24.9 / 27 of 201 | 16.6 / 0 of 301 |
| Town standing | 16.7 / 0 | 16.6 / 0 |
| Town walking | 33.6 / 36 of 149 | 17.0 / 4 of 295 (1.4 %) |
| Harbour walking | 50.4 / 67 of 103 | 16.6 / 0 |
| Dungeon standing | 41.7 / 67 of 96 | 16.6 / 0 |
| Hot spot, 18 walkers fighting | 16.7 / 0 | 16.6 / 0 |

Every scene was at or under 17 ms with 0–1.4 % of frames over 33 ms on a run at load average about 7. Desktop at
1280×800 DPR 2, CPU ×1, held 16.6–16.7 ms with 0 frames over 33 ms everywhere. The build machine is shared: at load
average 12 the same build reads 18–24 ms, and so does top-down B. Take the median of a few runs.

**Tools:**
- `TD_PERF=1 ARTOPT=iso [TD_VIEW=desktop TD_CPU=1] PW_PORT=… npx playwright test e2e/td-perf-phone` prints the iso
  section timings and the bake breakdown.
- `ISO_PROBE=1 ISO_PROBE_SCENE=town|road|harbour|dungeon|hot … e2e/td-iso-probe` flushes the canvas after each
  section, so each figure includes its raster.
- `ISO_SHOTS=1 … e2e/td-iso-shots` saves photographs to `output/iso/`.
- `e2e/td-iso.spec.ts` covers the setting, a tap that targets, a tap that walks, the layers, and four places with no
  frame error.

## Effects: projected, anchored, left

- **Flat on the projected floor:**
  - the aura's disc and rings, and the look waves
  - pulses, the nova's ring and scorch, the raise sigil
  - loot rings
  - boss tells (cone, lane, charge ring), summon sigils
  - elite ground, hazards, pack sigils, cast tells, ability rings, burst tells
  - Lanternwright and Thornstrider zones; the Ashguard, lamp and thorn ground effects
  - puddles, fish shadows, floats and the line
  - the Nightroad planks, nails and prints
  - Glim's trail, the way's chevrons
- **Upright at the projected foot (anchored):**
  - every air effect in `drawEffects`; the drain's far end is remapped
  - the class state painters (per creature, per wisp), pack motes, falling bursts, smoke
  - Glim and its sparks; bolts, shots and spears at their own lift; arrows
  - the ward hex, bone armour, doom and curse marks
  - loot pops and beams; corpses, flies and the bag
  - hearths, shrines, chalk, the purse, gates, beacons, beasts, pals, peers, campfires
  - figure shadows, night eyes; the dark layer's chests, shapes and whisper; the ledger page
  - all plates, task marks, Waves, speech, status, floaters, bars, names, elite plates and pips
- **Light, fog, weather:** light-map holes sit at projected feet as 2:1 pools, with the aura and nova rings as
  ellipses. Fog is pinned to the iso plane. Fireflies are projected. Rain, the Hush edge and the veil are screen-space.
- **Left (they degrade to "about right", never broken):**
  - Short motion trails (bolts, shots, spears, arrows, kindle) point along the world direction, not the screen.
  - The meteor's tail comes from the top-down upper left.
  - The thorn bond line is anchored at the Keeper's end.
  - The way's stair mark lies flat.
  - A light's height is approximate (pools are drawn at the foot, lifted).
  - Top-down art stood upright (buildings, trees, folk) is the art rollout's job.

## Not done / risks

- **Art:**
  - Figures are the prototype's: the HD Ashguard, Bone Walker and shade-kit; everyone else in the top-down art. That
    is mixed styles until the `hdchar` branch merges.
  - Buildings and stalls are top-down sprites stood up; the art rollout replaces them family by family.
- **No map editor in the repo:** maps are ASCII, so there is no editor preview. The shots spec is the preview.
- **Bake cost.** Ground paint costs about 0.4 ms a tile on the phone profile, about 2–3 ms a frame while walking.
  Painters that think in iso, or a cheaper organic-edge painter, would cut it.
- **The light map's raster has moved to the compositor.** On a real phone that is the GPU, but it is not measured on a
  device yet.
- **Switching graphics** rebakes the view's ground; on a slow phone that costs a few frames.
- Measured only in headless Chromium. WebKit is not yet checked for the DOM light layer's alignment.
