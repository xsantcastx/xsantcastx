# Eclipse Realms — Roadmap

The one-page answer to "what's next?". Detail lives in `docs/roadmap/world-plan.md` (the build
tracker); design lives in `docs/world/` and `docs/inventory/`, `docs/economy/`, `docs/art/`.
Reviewed daily; newest review on top of the log at the bottom.

## What's next (in order)

1. **The Underhearth** (Phase 8) — the layer below the Magma Halls, the Banked Furnace, tool tier V, rope/grapple/rails/cart, Rift Anchors. *(in flight)*
2. **The Mirror Slate** (owner idea, 2026-10-14) — a carried device of the Archive's moon-mirror glass in Kael's brass. Sold/awarded by Lune Coyne (Croupier) after you've played her tables; Kael upgrades it. Tier I: **play the casino anywhere** (Reels, Rune Drop, Seam Sweeper, Eclipse Ascent — same odds, Gold only) and **manage the Homestead factory** (collect, buy the next building, explorers/expeditions, ready-notifications). Tier II (Kael): map pins and bounty tracking; a Hearth tab later. Places stay places. *(built 2026-10-14, `docs/handoff/mirror-slate.md`)*
3. **Starfall Deep** (Phase 9) — low gravity, rising starlight, Aureth's chain.
4. **Story Act II** — the Five Witnesses (world & cast).
5. **Art test set** — 21 files (`docs/art-commissions/00-first-test-set.md`). *(owner / image generator)*

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

- **2026-10-14 (Mirror Slate)** — Built item 2: the Mirror Slate (Lune's gift at ten plays or 500k Gold; P anywhere; her four tables embedded on the same ledger; the Homestead at a glance; Kael's tier II adds map pins + Pim's bounties). Handoff `docs/handoff/mirror-slate.md`.

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
