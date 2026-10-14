# Handoff: the endless Delve, horizontal first (Phase 7) — 2026-10-14

Spec: [docs/world/delve-and-beyond.md](../world/delve-and-beyond.md) §2.3, §3 (generation, the loaded window,
persistence, budgets, structures), §6.1 (map v2), §9 Phase 7. Lore: [lore-addendum.md](../world/lore-addendum.md),
"What the Delve Keeps" and "The wings: structures and field notes" (shipped — owner reviews in play).
Built on main after Phase 6 (liquids + fishing), Story Act I and the fishing phone polish.

## What a player can do now

- **Walk out of the core, east or west, forever.** The shipped 120 × 56 Ember Delve is untouched (same cells,
  same seed, same `version: 2` layout, same diff). Past its walls the Delve goes on in 32-cell sector columns,
  the same four depth bands all the way down (Root Hollows 0–11, Basalt Caverns 12–25, Glowcap Grotto 26–39,
  Magma Halls 40–55, bedrock 54–55). The surface (rows 0–1) is always solid, so the shaft's ledge is a road.
- **Caves with a character per stratum**: narrow winding root tunnels, long horizontal basalt galleries, round
  grotto caverns, broad low magma halls. Band edges wander (and ease into the core's own edges at its borders).
  Ore by depth from the core's own vein tables (Cinder in the Hollows and Caverns, Slag and hard basalt deeper,
  Heartstone only in the Magma Halls, Ember-veined basalt throughout), rolled per sector, only into rock, so a
  cave's walls show ore.
- **Structures** on a lattice (one per stratum per 64 columns at most, never in the core):
  | Structure | Stratum | What is in it |
  |---|---|---|
  | Keepers' ruin | Root Hollows | a low room, trunk posts, a shadow-root knot, a cinder seam, a field note |
  | Kael's waycache | Basalt | a hard-rock niche, **a waycache (3 torches, once: the dug cell is the receipt)**, a field note (60%) |
  | Flooded shaft | Basalt | an adit, a water-filled shaft, a waycache drowned at the bottom |
  | Maw den | Basalt | a hall on a bedrock floor with 2–3 **Rivet Maws** |
  | Grotto lake | Grotto | a basin with shores, water to fish (the `mere` water), glowcaps in the roof, a field note |
  | Lava basin | Magma | a single-row lava pool between scorched-basalt shores |
  | Bailiff hall | Magma | a hall with 2 **Cinder Bailiffs**, heartstone in the roof, a field note (40%) |
  | Rift shrine | Grotto / Magma (rare) | a standing stone: **E shows the tunnels round it on the map** (+15 Delving XP once per shrine) |
- **Field notes**: 8 short lines (`shared/delve/field-notes.model.ts`), carved as `field:<id>` walls. E reads one;
  the first reading of each id pays 8 Delving XP (ledger mutation `delve-fieldnote:<id>`). They are a second
  set: the Archivist's twelve inscriptions and their missions are untouched.
- **Everything works across sector borders**: digging, held digging, placing and dragging, take-back, chests,
  the camp (one per Delve, found anywhere; "Descend to your camp" loads the ring round it), torches and lights,
  supports (their reach crosses borders), blasting charges, loose rock, liquids (water flows across a border and
  is saved per sector), buckets, fishing, the fog of war and the map.
- **Map v2**: the minimap and the full map draw the whole explored world, column by column (only what is on
  screen is painted; a never-loaded explored column is generated from the save, at most 4 per HUD tick). The
  fitted full map spans the explored sectors and the core. New marker: the rift shrine (legend, EN + ES).
  Regrown sectors are drawn muted. The full map's canvas carries `data-explored="<sector columns>"`.
- **Regrowth** ("the Delve keeps what is held"): a sector outside the core with nothing placed in it, unchanged
  for 14 days, more than 4 sectors from every camp and chest, drops its diff on load: the rock grows back with
  fresh ore. Receipts (dug waycaches) stay dug, the map stays explored (muted). The first time the Keeper walks
  into a regrown sector the engine says the addendum's inscription (`play.delve.regrown`, once per player: the
  `delve-regrowth-seen` flag in `claimed`).

## How it works

### Generation (`play/engine/sector-gen.ts`, pure)

- `sectorContext(spec, seed)` once per Delve: the core as `generateTerrain` makes it, the core's band edges at
  its two borders (its RNG stream replayed exactly), per-band noise salts.
- `generateSectorColumn(ctx, sx)`: 32 × 56 cells. Inside the core's columns the core is copied cell for cell
  (stamps, inscriptions, lakes, caches, `protect`); elsewhere band rock → caves → veins (per sector `sectorSeed`)
  → structures (lattice cell `floor(sx / 2)`; a structure never leaves its lattice cell, so both sector columns it
  straddles stamp exactly their half) → the bedrock floor.
- Integer hashing (murmur3 finaliser) and value noise with only + − × ÷: the same bytes on every device. The
  noise is sampled per column with the lattice hashed once per lattice row and reused across the columns that
  share it: **~1.4 ms per column (two sectors) in node, cold-ish; well inside the 2 ms/sector phone budget**.
- `SECTOR_GV = 1` is saved with every sector diff. Bump it when the output for a seed changes: a diff dug under
  another version re-applies only its air and placed cells (tunnels and builds survive, ore may move).
- Golden hashes for seed 424242 (sector columns −5, −1, 4, 6, 11) are pinned in the node test.

### The loaded ring (`play/engine/sector-world.ts`, pure; `Terrain.ring`)

- The engine still works on one `Terrain`. In the endless Delve it is a **ring of 128 world columns** (four
  sector columns; a power of two): world column `c` lives in slot `c & 127`, so a cell's index is stable while it
  is loaded and every cell API takes world columns (negative west of the core). `colOf(i)` / `rowOf(i)`,
  `colLo` / `colHi`, `inside`, `chunkKey`, `clampX` and `touchColumns` are the only additions; the plain grid is
  `colLo = 0, colHi = cols` and behaves exactly as before (all 168 engine tests unchanged and green).
- `follow(col)` shifts the span one sector column when the Keeper comes within **40 cells** of an edge
  (hysteresis: the next shift is ≥ 32 cells of walking away), and **prefetches** the next column when within 56,
  at most one per fixed step. A shift copies the leaving column out (to an LRU of 16 columns = 32 sectors; the
  core's four pinned), copies the arriving one into the same slots and bumps only its chunks; the renderer
  repaints them as they scroll into view. Teleports (the camp, a reload) `center` the ring.
- Engine hooks per column: hall creatures spawn when a column loads and leave with it (≤ 3 per hall, two halls
  at most in a ring: under the 12-creature cap); liquid state for leaving columns is forgotten (their liquid was
  saved first) and arriving ones are woken; fuses, chars, drag queues and the line in leaving columns drop.
- Liquids: `LiquidSim` walks world columns (`colOf`), sorts by world column (the same water flows the same way
  wherever the ring sits) and treats the ring's edge as rock (the world past it is frozen, spec §3.3).
- Rendering: chunk keys are ring slots; lighting's rock shade carries `col0`; the surface painting tiles; the
  camera clamps to the ring (always wider than the view) instead of x = 0.
- Stable cell ids (`SectorWorld.cellId`): a core cell keeps its v1 index (chests filed under it are unchanged);
  a wing cell gets `0x1000000 + zigzag(col) × 64 + row`. Events (`PlaceEvent`, `UseEvent`, buckets, charring)
  carry it; `nodeIdAt` reads it.

### Save v2 (`shared/delve/delve-region.model.ts`, `delve-region-store.ts`, `delve-save.service.ts`)

- `godforge-delve` (`progress/delve`) is now `version: 2`. The core stays exactly where v1 put it
  (`areas['ember-delve']`: the spec's `core`, same layout key, same core indices, same `seen`/`liquids`); a v1
  save reads as is. Chests and `claimed` are unchanged.
- Sector diffs live in **regions** of 8 × 8 sectors: `{ v, seed, rx, ry, t, sectors: { 'sx,sy': { g, t, c, l, f, k, h } } }`.
  `c`/`l` are runs of (gap, length, value) varints, base64url (a 30-cell tunnel is 4 characters); `f` is the
  64 explored 4 × 4 blocks as 16 hex digits; `k` the receipts; `h` the regrowth stamp. The absurd case — all 64
  sectors of a region with every cell, every liquid level and every receipt different and random — is 779 kB,
  still under the 1 MiB document budget (the test pins it); the horizontal world only fills 16 of a region's
  sectors (rows 0–55), so its worst is about a quarter of that, and a tunnelled sector is tens of bytes.
- **Locally** every region is in IndexedDB (`eclipse-delve` / `regions`, key `seed:rx_ry`), written on the 1.5 s
  debounce. No IndexedDB (private modes, a refused or blocked open, 3 s timeout): a device-only localStorage key
  `godforge-delve-far` through the gateway, capped at 750 k characters (the oldest regions not in a slot go
  first; `deviceStore.degraded` says so). SSR: nothing.
- **Cloud (owner decision)**: the 16 regions changed most recently ride in 16 fixed slot blobs
  `godforge-delve-r0..15` → `progress/delve-r0..15` (SYNCED_BLOBS, merged by `mergeRegionSlots`; the existing
  `progress/{docId}` rule matches them: **no rules change**, verified by reading `firestore.rules`). A slot is
  written at most once per 30 s while play goes on; `flush()` (pagehide, `settleForReload`, the registry) writes
  every changed slot at once. Past 16, the region changed longest ago gives up its slot and stays on its device.
  The gateway reads the `progress` collection whole on attach, so 16 slots cost at most 16 reads per load.
- **Merge**: per sector, cells and liquid are unioned with local winning a disagreeing cell, fog OR'd, `t` the
  later, a regrowth wins over every change older than it (a later change on another device survives it); a
  different generator version: the newer one's copy. A slot holding two different regions keeps the later one.
  Regions under another seed are never read (the index's earliest-seed rule stands).
- IndexedDB answers asynchronously: until then the service knows the slots' regions; when it answers, its copy is
  merged in (the device wins a cell over the slot), far sectors regrow, and `reloaded$` fires so the engine
  rebuilds (the same path as a cloud merge). Every slot key is registered with `LocalSaveRegistry`
  (flush + rehydrate), so a cloud merge of one slot lands in memory in the same tick.
- Loading an unknown or junk save never throws: junk slots, junk regions and junk sector keys are dropped.

### Structures, lore and meaning

- New terrain nodes (appended): `waycache` (any tool, Exploration 6 XP, yields 3 torches, `receipt`) and
  `rift-shrine` (walk-through, violet light, `use: 'shrine'`). `TerrainNodeDef.receipt` and `use: 'shrine'` are
  new fields; `TerrainSpec.endless` turns the generator on (EMBER_DELVE sets it).
- `scripts/check-meaning.js` reads `SECTOR_NODES` (what the generator lays) and knows the shrine's purpose:
  **no new violations** (4 in the baseline, unchanged). Found-in: torches now name "Ember Delve: Kael's
  waycaches". Lore: the addendum's new section, shipped (owner reviews in play).
- i18n (EN + ES, `delve.i18n.ts`): `play.delve.action.shrine`, `play.delve.fieldNoteTrace`,
  `play.delve.fieldNote.new`, `play.delve.shrine.touched`, `play.delve.shrine.first`, `play.delve.regrown`,
  `play.map.legend.shrine`.

## Not done (next slices)

- **7.5 Board Herald bounties**: not built. They live on the Quest Board (NPC / quests surfaces, another
  agent's area this round); the spec makes them their own slice.
- **Map v2 pins and waypoints**, the Broken Astral Compass and the Rift Map Fragment: not built (the world map,
  fog per sector, thumbnails and the regrown tint are). Way-to-camp runs through the loaded ring only; a camp
  outside it gets the dotted straight line.
- **Echo regions** (Phase 10): the wings wear the Infernal strata's palettes everywhere.
- No Web Worker: generation is under budget on the main thread, time-sliced by the prefetch.
- Visits do not count as recency for the 16 cloud slots (changes do): a region only walked through is not synced.
- Loose rock in the wings follows the Magma Halls' `loose` rule like the core (no new tuning).

## Tests

- `node --test scripts/delve-endless.test.cjs` — **23 tests**: determinism in any order and across seeds, golden
  hashes, the core copied cell for cell, no seam at sector borders (open/closed steps at borders vs inside),
  hand-made-looking wings (cave share, ore by depth, all 8 structures, halls), structures straddling borders,
  every generated lake and lava basin at rest, generation time, streaming (shifts, prefetch: no cold shift, worst
  shift time, the span always ≥ 40 cells round the Keeper), real walking across borders, dig/place across a
  border with reload and cache eviction, west of the core, liquids across a border (flow, conservation, settle,
  per-sector save, reload), fog per sector and the world map, a wing camp found from town, stable chest ids,
  supports and charges across a border, waycache receipt / field note / shrine, hall creatures, RLE and the
  1 MiB budget, merge, regrowth.
- `node --test scripts/seamworks-engine.test.cjs scripts/homestead.test.cjs scripts/home-forge.test.cjs` — 185
  pass, unchanged (the plain grid is the same code path as before).
- Karma: `delve-save.service.spec.ts` (10): sector round-trip through the device store and a fresh service,
  version 2 index, v1 read, junk never crashes, slot timing (30 s, flush), eviction past 16 (stays on device and
  after reload), cross-device slot rehydrate, regrowth on load, the IndexedDB fallback (missing and refusing
  factories → localStorage), a real IndexedDB round trip. `cloud-save.model.spec.ts` pins the 16 slot keys.
- e2e `e2e/play-delve-endless.spec.ts` at 1280×800 (mouse) and 390×844 (touch), chromium and webkit: from a
  camp at the core's east end walk three sector borders east, dig cols 223 | 224 (sectors 6 | 7) and build a
  block back, both sectors' cells in IndexedDB (and the region's first change in its cloud slot), the full map
  lists sector columns 3–6, reload: the map still lists them, a block goes into the dug cell and the built one
  digs back out. `play-delve-nav`, `play-delve-extras` and `play-liquids` compute the camera without the old
  x = 0 clamp (the endless Delve has no wall there).
- Perf harness: `PLAY_PERF=1 … e2e/perf-play.spec.ts -g "wide traverse"` (new scene, below).

Screenshots (not committed): `output/endless/{desktop,phone}-{east,border,map,reloaded}.png`.
