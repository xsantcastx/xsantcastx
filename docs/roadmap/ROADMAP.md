# Eclipse Realms — Roadmap

The one-page answer to "what's next?". Detail lives in `docs/roadmap/world-plan.md` (the build
tracker); design lives in `docs/world/` and `docs/inventory/`, `docs/economy/`, `docs/art/`.
Reviewed daily; newest review on top of the log at the bottom.

## What's next (in order)

1. **Delves in every realm** (owner, 2026-10-14) — Luminous light-mines, Umbral ink-caves, Celestial star-wells, Verdant root-depths (Infernal's Ember Delve exists), each with its own biomes, creatures, keeper missions and story. **Top item after the weekly budget resets (Mon).**
2. **The Underhearth** (Phase 8). *(in flight)*
3. **The Mirror Slate** — casino anywhere + Homestead management. *(built 2026-10-14, `docs/handoff/mirror-slate.md`)*
4. **Uncapped levels, Tibia-style** — skills past 99 on a steepening curve; diminishing tool bonuses; swing floor and reward caps stay; milestone titles. *(in flight)*
5. **Glim bond** — bond levels unlock Glim's story, conversations and small abilities. *(in flight)*
6. **A surface with height** — climbable trees, ledges, floating ruins, parkour routes with rewards at the top. *(in flight)*
7. **World feel** (owner, 2026-10-14) — *the sound of the world*: a Web Audio director (sparse per-realm score, ambience beds, block-aware SFX, sliders + mute, first-tap start, no audio files); *catch & craft*: visible fish shadows, "+1 item" pickup popups, crafted items pop above the bench and open the Satchel.

Later: Lost Cabinets (needs the Slate) · a living, mysterious Delve · Pets · Tibia-inspired loops research · Starfall Deep (Phase 9) · Story Act II · Art test set *(owner)*.

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
| **M8 The deep** | Infinite chunked Delve; the first galactic dimension; Delve events & bosses | 🔨 endless Delve ✅ · Underhearth in flight |
| **M9 Story & cast** | Act 1, the lantern companion, NPC depth, quest chains, reputation | 🔨 Glim ✅ · Act I ✅ · NPC depth ✅ · Atlas next |
| **M10 The art pass** | Pixel sprites for Keeper, creatures, NPCs; parallax towns; pixel icons | ⏳ needs art |
| **M11 Players** | Player market live (owner deploy), real-device QA, launch | ⏳ owner |

## Waiting on the owner

- Player market deploy (Java for the emulator → rules/indexes → functions → flags).
- The art test set (21 files).
- Review new lore in `docs/world/lore-addendum.md`.

## Daily review log

- **2026-10-14 (daily review)** — No app code shipped since the evening entry; docs only (agent brief, SYSTEMS.md, sound + catch & craft added). Trimmed "What's next" to seven (sound and catch & craft merged into World feel; the rest under Later). Risk: five features in flight at once on a shared repo — gate each merge and watch for release-version races.
- **2026-10-14 (evening)** — Owner ideas folded in: Lost Cabinets (scan with the Slate), uncapped Tibia-style levels, Glim bond, a surface with height + parkour, pets, a more alive and mysterious Delve, Tibia inspiration.
- **2026-10-14 (afternoon)** — Shipped: fishing polish, NPC depth + six names, the endless Delve, daily bounties + map pins. Owner loved the casino and asked for a carried device → the Mirror Slate is #2.
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
