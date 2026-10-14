# Eclipse Realms — Roadmap

The one-page answer to "what's next?". Detail lives in `docs/roadmap/world-plan.md` (the build
tracker); design lives in `docs/world/` and `docs/inventory/`, `docs/economy/`, `docs/art/`.
Reviewed daily; newest review on top of the log at the bottom.

## What's next (in order)

0. **Delves in every realm** (owner, 2026-10-14 — "we are in Eclipse Realms") — each of the five realms gets its own Delve: Luminous light-mines, Umbral ink-caves, Celestial star-wells, Verdant root-depths (Infernal's Ember Delve exists). Own biomes, creatures, keeper missions, story. **Top item after the weekly budget resets (Mon).**
1. **The Underhearth** (Phase 8). *(in flight)*
2. **The Mirror Slate** — casino anywhere + Homestead management. *(in flight)*
3. **Uncapped levels, Tibia-style** (owner, 2026-10-14) — skills past 99 forever on a steepening curve; tool bonuses keep growing with diminishing returns; swing floor and reward rate caps stay; titles at milestone levels. *(in flight)*
4. **Glim bond** (owner) — the more you explore with Glim the closer you get: bond levels unlock Glim's story, conversations and small abilities (sensing hidden rooms, remembering routes). *(in flight)*
5. **A surface with height** (owner) — climbable trees, ledges, floating ruins, parkour routes with rewards at the top, wall-jump/ledge-grab, NPCs and creatures up there. *(in flight)*
6. **The sound of the world** (owner, 2026-10-14 — "the peaceful stuff Minecraft has") — the game is silent today: only synthesized blips (forge, level-up, rarity, celebration), no music, no ambience, no footsteps. Build an audio director: sparse generative score per realm/biome (soft piano + pads, long silences between phrases, C418-style), ambience beds (surface wind/birds by day, crickets at night, Delve drips/rumble, lava hiss, water lap, city murmur), and world SFX (footsteps by block, mining by material, splash, pickup, door, chest). Music/ambience/SFX volume sliders + mute, starts on first tap (phone autoplay), pauses when the tab hides, low CPU. Built in Web Audio with no audio files, so nothing is licensed and the bundle doesn't grow; a slot for recorded tracks later.
7. **Catch & craft feel** (owner, 2026-10-14 — "where are the fish? where do crafted items go?") — visible fish shadows in water and lava, splash + the fish arcing to you on a land; Terraria-style "+1 item" pickup popups for catch/craft/mine/loot with the bag icon pulsing; a crafted item pops above the bench with a tap to open the Satchel on it.
8. **Lost Cabinets** (owner) — rare unique slot machines hidden in the Delve; scan one with the Mirror Slate (scan animation) to download its game; collectible. Needs the Slate.
9. **A living, mysterious Delve** (owner) — per-biome/region backgrounds and assets, hidden rooms, environmental storytelling, ambient life, events (ambushes, rift storms, cave-in chases), more creatures.
10. **Pets** (owner) — rare befriendable creatures that follow you, each with a trait and lore.
11. **Tibia-inspired loops** — research pass: hunting grounds, rare drops, open quests, houses → ideas that fit the world.
12. **Starfall Deep** (Phase 9) · **Story Act II** · **Art test set** *(owner)*.

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
