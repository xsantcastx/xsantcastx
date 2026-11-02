# Iso-native ground, water and decks — handoff (branch `isoground`, 2026-11-02)

The isometric view's ground used to be the top-down HD painters (td-ground `paintRichGroundHd`, td-terrain's organic
edges) painted as a square tile, read back from a canvas and resampled into its diamond — about 0.34 ms a tile on the
phone profile. It is now painted straight into the diamond, a pixel at a time into the chunk's pixels.

## What a player gets

- **Ground, every kind** (grass, flower beds, moss, dirt, sand, bog, cave floor, cobble, temple slabs, wet slabs, boards,
  boardwalks, rugs, the canopy far below). Textures sample the ground's own calm ramp-index textures at the screen pixel,
  so clumps stand upright and nothing shows the grid; a slow patch map breaks the repeat. Cobble is its own screen-space
  sett texture, low contrast so figures read. Slabs, boards and rugs lie on the tile's axes (joints along the diamond).
- **Organic blends** between grounds: the four nearest tile centres weighed (smoothstep), each ground nudged by its own
  two noises (td-terrain's rule, in the diamond) — rounded corners both ways, a wandering line. The edge dresses itself:
  the overgrowing ground's dark foot or lit lip, shade on a road under grass, wet sand at the sea, a shaded lip on snow.
  Floors darken under the walls up the screen (N, W).
- **Water:** depth from the distance to land at the tile corners, foam lapping on every shore over the four water
  frames, an outer broken foam line, short wavelets lighting in turn. **Lava** dark with sparse crust and a glowing bank
  (ash and cave floor warm beside it). **Black water** still, the odd lily pad.
- **Decks:** piers, bridges and boardwalks have a beam face on their camera sides (lit lower-left, shaded lower-right),
  posts into the water with a ring of foam, and a shadow on the water. Over land a deck only lips.
- **The Nightroad** (td-dark NIGHTROADS) is a violet ghost deck with faces and posts, still night-only; its nails are
  the deck's own violet in iso. `e2e/td-iso.spec.ts` (the floor pass on the projected ground) passes.
- **Ash and snow:** the cave floor under the open sky reads as ash (the Ashfields, the Molten Fields). Snow is ready (a
  `snow` look) but no map lays it yet; `__tdArt.isoLand('snow')` (webdriver only) previews the meadows as snow.
- **Low** (Environment detail): hard diamond edges, no patches, no dressing, a straight foam line, lava keeps a 1 px
  glowing rim, decks keep faces and posts without the water shadow. **Classic is unchanged.**

## Files

| File | Part |
|---|---|
| `td-iso-tiles.ts` (new) | `IsoTiles`: the looks (ramp, rank, class), the blend, water, the dressing, deck faces, the Nightroad's deck sprite, the plain-tile cache (a tile with no edge is a pure function of its place in the textures' 512 × 256 repeat: packed 4 KB, 512 kept). |
| `td-iso-ground.ts` | Uses `IsoTiles` when the source's `native()` says so (else the old square painters). Plans each chunk's deck faces (tiles up to two rows above it) and lays them after every frame. Chunk buffers are pooled; water frames 1–3 lay only the moving tiles on a clear buffer, put over a copy of frame 0's canvas (no per-chunk pixel copy is kept: that, and a fresh 512 KB buffer per chunk frame, was the heap growth). |
| `td-engine.ts` | `isoSource.native()` (surface → ash, Low), the `isoLand` preview hook, the Nightroad deck callback. |
| `td-dark-layer.ts` | `drawGround(…, deck?)`: the iso deck per tile, back to front; violet nails in iso. |
| `td-iso-tiles.spec.ts` | Every ground paints its whole diamond; cache = fresh; grass grows into a road; foam laps; a pier hangs a face; Low has hard edges. |
| `e2e/td-iso-ground-shots.spec.ts` | `ISO_GROUND_SHOTS=1 [ISO_GROUND_TAG] [ISO_GROUND_DETAIL=low]`: town, forest, harbour, dungeon, night bridge, ash, snow at 1280×800 and 390×844 into `output/iso-ground/`. |

## Numbers

Phone profile (`TD_PERF=1 ARTOPT=iso`, 390×844 DPR 3, CPU ×6), walking, main `8b0938ea` against this branch, run back to
back three times (the game clock follows the real one, so only interleaved runs compare). Median of the three; frame
mean ms · bake ms per 5 s · heap MB. The shared machine was busy (load 2–8): main itself reads 19–41 ms here since the
walls/buildings and props landed, so the 16.6 ms target is out of the ground's reach — the ground is now a small part of
the frame.

| Scene | main frame | branch frame | main bake | branch bake | main heap | branch heap |
|---|---|---|---|---|---|---|
| Road | 23.7 | 23.5 | 746 | 554 | 65 | 82 |
| Town | 39.0 | 38.8 | 124 | 124 | 61 | 82 |
| Harbour | 19.6 | 19.9 | 900 | 478 | 54 | 82 |
| Dungeon | 23.0 | 21.3 | 63 | 54 | 78 | 48 |
| Hot spot | 24.6 | 24.9 | 683 | 527 | 87 | 54 |
| Many kinds | 31.7 | 23.7 | 468 | 538 | 93 | 69 |

No regression in frame time (all within the machine's noise). A tile costs 0.02–0.07 ms against ~0.34 ms (painted, not
read back), so the ring is baked further ahead in less time. Heap: the WIP read 65–125 MB; pooling the chunk buffers and
dropping the per-chunk pixel copy brought it to 48–82 MB. The water scenes still read higher than main, which a last fix
targets (open water's cache key was 1 024 wide and churned; now 64) — measured only by the unit spec, the machine was
saturated by then (re-measure).

## Not done / risks

- Lava crust reuses the dirt pock texture; a sparser crack pattern would read hotter (Director: optional).
- No map lays snow; the snow look is untested in a real Celestial map.
- The faces of a deck tile can overlap a diagonal deck neighbour by a few pixels (only where a deck runs diagonally).
- Frame time on the phone profile is now dominated by the standing objects and the light map (other builders' layers),
  not the ground.

Screenshots (before = main 8b0938ea, after = this branch; 1280×800 and 390×844; `-after-low` is Environment detail Low):
`docs/handoff/isoground/`. Art & UX Director: PASS after two rounds (lava darker than the imps with a glowing bank,
the warm step on ash, a violet night deck with a lit lip, smooth snow drifts with a shaded lip, ash a step darker, a
1 px lava rim on Low).
