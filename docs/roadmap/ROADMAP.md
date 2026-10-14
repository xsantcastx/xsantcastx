# Eclipse Realms — Roadmap

The one-page answer to "what's next?". Detail lives in `docs/roadmap/world-plan.md` (the build
tracker); design lives in `docs/world/` and `docs/inventory/`, `docs/economy/`, `docs/art/`.
Reviewed daily; newest review on top of the log at the bottom.

## What's next (in order)

1. **Water, lava, lakes, Fishing v1** — Delve & Beyond slice 1. *(built, awaiting merge: `docs/handoff/liquids-fishing.md`)*
2. **UX follow-ups** — Material Vendor on the kit, Homestead + six surfaces in Spanish. *(in flight)*
3. ~~**Story Act I framing**~~ (world & cast S2) — ✅ shipped: Prologue tab on the goals, the Act I card, keeper lines on the missions, the fresh mark, the act break, the Story tab (`docs/handoff/story-act1.md`).
4. **The endless Delve** (Phase 7) — horizontal sectors, save v2, structures, map v2 *(built, awaiting merge: `docs/handoff/endless-delve.md`)*; map pins + waypoints, the compass and the fragment, Glim's mark, and Pim Larkin's daily bounties (7.4–7.5) *(built, awaiting merge: `docs/handoff/bounties-map-v2.md`)*.
4b. **The Underhearth** (Phase 8) — the stratum under the Magma Halls behind the Banked seal, the Banked Furnace, Kael's and Verrin's chains ("The Four Who Went Down"), tool tier V, rope, grapple, Kael's rails + the Seam Cart, Rift Anchors *(built, awaiting merge: `docs/handoff/underhearth.md`)*. Next: Phase 9, Starfall Deep.
5. ~~**NPC depth pass**~~ (world & cast S3) — ✅ built: names with role-title subtitles, four new keepers, act-aware lines, People of the Realms (`docs/handoff/npc-depth.md`).
6. **Art test set** — 21 files (`docs/art-commissions/00-first-test-set.md`). *(owner / image generator)*

## Milestones

| Milestone | Player gets | Status |
|---|---|---|
| **M1 World** | Every page a place; five towns; Waystones; Places | ✅ shipped |
| **M2 Living Delve** | Persistent diggable Delve, four biomes, building, missions, supports/charges | ✅ shipped |
| **M3 Economy & inventory** | Cookie-Clicker curve, stacking satchel (20/slot), the Vault, nothing ever deleted | ✅ shipped |
| **M4 Phone-first & Terraria look** | Terraria-mobile HUD, pixel-art terrain pass 1+2, update prompt, consent bar | ✅ shipped |
| **M5 Meaning & cleanup** | Everything has a source/use/lore (CI-checked); legacy website removed | ✅ shipped |
| **M6 Feel & stability** | No phone crash, cool idle, Delve navigation, minimap, Glim | ✅ shipped |
| **M7 Fun loops** | Casino (Reels + 3 games), Fishing, liquids & lakes | 🔨 Reels + Rune Drop / Seam Sweeper / Eclipse Ascent built; liquids + Fishing v1 built |
| **M8 The deep** | Infinite chunked Delve; the first galactic dimension; Delve events & bosses | 📐 designing |
| **M9 Story & cast** | Act 1, the lantern companion, NPC depth, quest chains, reputation | 🔨 Glim ✅ · Act I ✅ · NPC depth ✅ · Atlas next |
| **M10 The art pass** | Pixel sprites for Keeper, creatures, NPCs; parallax towns; pixel icons | ⏳ needs art |
| **M11 Players** | Player market live (owner deploy), real-device QA, launch | ⏳ owner |

## Waiting on the owner

- Player market deploy (Java for the emulator → rules/indexes → functions → flags).
- The art test set (21 files).
- Review new lore in `docs/world/lore-addendum.md`.

## Daily review log

- **2026-10-14 (the Underhearth)** — Phase 8 built: rows 56–117 under every column (iron-black basalt over banked
  obsidian, vertical shafts, lava lakes with obsidian shores, emberheart / pyrite / cold coal / furnace slag,
  ironwood pillars, fracture seams), the Banked seal in the fragment chamber's floor (Pickaxe IV, Delving 15, The
  Fracture claimed), the Banked Door and Kael's rail down over the Furnace Hall's trestles, the Banked Furnace
  (vents, breath, embers, core), the Four's outposts and hammer-marks, Banked Embers and Ironwood Sentinels;
  Kael's Flooded Seams and The Four Who Went Down, Verrin's Let It End and Endings Kept Warm, Act II's first three
  beats; Bark Rope, the Thornroot Grapple, Seam Rails + the Seam Cart, Rift Anchors (travel sheet, the shaft's
  "Descend to an anchor"); Pickaxe V / Axe V; the Underhearth's lava fishing. Next: Phase 9 (Starfall Deep).

- **2026-10-14 (bounties + map v2)** — Phase 7 finished: Pim Larkin's three daily Delve bounties at the Quest Board
  (drawn per player per day, 5–15 min of income, days counted never a streak, `economy-sim --bounties`), map pins
  and a tracked way, the Broken Astral Compass and the Rift Map Fragment as map tools, Glim's hint step 3 (a mark on
  the map). Next: Phase 8, the Underhearth.

- **2026-10-14 (endless Delve)** — Phase 7 built (7.1–7.3, most of 7.4): the Delve goes on east and west of the
  untouched core in streamed sector columns, structures (waycaches, flooded shafts, ruins, dens, halls, lakes,
  lava basins, rift shrines, field notes), save v2 (IndexedDB + 16 cloud region slots, regrowth), the world map.
  Next: map pins + bounties, then Phase 8 (the Underhearth).
- **2026-10-14 (cast)** — Built: **NPC depth** (S3): Mara Voss, Edrin Kade, Ilyra Venn, Tomas Rill, Sera Quill, Nox Aster, Rook Sable, Amina Thorne, Kesh Arbo and Siv Moss at their stations; every keeper's lines follow the story and what you've done there. Next: Glim's Atlas (S4).
- **2026-10-14 (story)** — Shipped: **Act I framing** (Prologue + Act I, the fresh mark, the Story tab, `godforge-story`). Next: NPC depth (S3) reads the beats.
- **2026-10-14 (later)** — Phase 6 slice 1 built: water and lava (10 Hz cellular flow, obsidian, buckets,
  swimming, breath, lava burn), the Grotto Mere and lava pools in the core, Fishing 1–99 (rods, bait,
  Line Tension, catch tables, crates, junk, legendaries, the Ledger Catch, the Drowned Lamp chain and
  mini-boss, the Catalogue of Strange Fish), `economy-sim --fishing` in `--check`.

- **2026-10-14 (overnight)** — Shipped: the Reels, legacy-site removal, cleanup leftovers (Karma 2082/2082), Delve navigation + minimap, phone crash + heat fix, Rune Drop / Seam Sweeper / Eclipse Ascent, **Glim**, UX consistency pass. Next: liquids + fishing, then Act I.
- **2026-10-14** — Roadmap created. Shipped yesterday/today: Vault + stacking, Terraria terrain ×2,
  tool tiers + level scaling, meaning audit, phone HUD, update prompt, legacy site removed.
