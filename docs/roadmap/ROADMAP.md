# Eclipse Realms — Roadmap

The one-page answer to "what's next?". Detail lives in `docs/roadmap/world-plan.md` (the build
tracker); design lives in `docs/world/` and `docs/inventory/`, `docs/economy/`, `docs/art/`.
Reviewed daily; newest review on top of the log at the bottom.

## What's next (in order)

1. **Clean & perfect what we have** (owner, 2026-10-14, top priority) — the UI feels crowded and not nice. Strip each surface back to its job, Diablo II-style: the inventory is a slot grid plus a worn-items paper doll and nothing else; the Mirror Slate opens straight to a few clear choices instead of a wall; every panel gets one primary action, details behind a tap. Audit every screen on a phone for clutter, overlap and dead chrome. *(first pass built 2026-10-14: Satchel as doll + grid with the item card on tap, Slate home face, station/Glim/anchor sweep; see `docs/handoff/ui-clean-pass.md`. Second pass built 2026-10-14: no figure behind the Keeper, the Satchel doll frames the Keeper itself, tally/clasp/hero-line/filler cells subtracted; see `docs/handoff/ui-polish-2.md`. Pass 2's four leftovers (Feet slot, Kael bubble over the Weapon well, Self-Aware toast every visit, doubled "no runes") fixed 2026-10-14, `docs/handoff/ui-bugs-4.md`.)* *(pass 2 shipped 2026-10-14, `docs/handoff/ui-polish-2.md`)*
   - **One art style** (owner, 2026-10-14): the whole game goes pixel (Terraria); every NPC, creature, prop, icon and portrait migrates to the Keeper's pixel scale and outline. *(in flight)*
2. **Make your Keeper** (owner, 2026-10-14) — a character creator (body, skin, hair, face, colours, name) saved to the account, and **worn gear that reads on the body**: every weapon held in the hand at the right angle and scale, armour/helm/cloak layered on the sprite, so equipping something visibly changes you (MapleStory-level readability as the floor). *(shipped 2026-10-14, `docs/handoff/make-your-keeper.md`)*
3. **Rift Gates** (owner, 2026-10-14) — portals deep in the Delve to other realms' Delves, each deeper and stranger. *(gate system + the Umbral Ink Deeps built 2026-10-14, `docs/handoff/rift-gates.md`)*
4. **Delves in every realm** — Luminous light-mines, Celestial star-wells, Verdant root-depths (Infernal's Ember Delve exists; Umbral shipped with Rift Gates — the others are content only, spec in `docs/handoff/rift-gates.md`), each with biomes, creatures, keeper missions and story.
5. **A surface with height** — ✅ shipped (`docs/handoff/surface-height.md`): the High Roads in all five hunts (ledge-grab, mantle, climbing, wall-jump; once-only caches, carvings, a look-out, a summit cairn + Ridgewalker title per realm; perched creatures, Hollis Fenn). Next: town outskirts, vine walls, painted props.
6. **World feel** — *the sound of the world*: a Web Audio director (sparse per-realm score, ambience beds, block-aware SFX, sliders + mute, first-tap start, no audio files); *catch & craft*: visible fish shadows, "+1 item" pickup popups, crafted items pop above the bench and open the Satchel.

Shipped 2026-10-14: The Underhearth (`docs/handoff/underhearth.md`) · The Mirror Slate (`docs/handoff/mirror-slate.md`) · Uncapped levels (`docs/handoff/uncapped-levels.md`) · Glim bond (`docs/handoff/glim-bond.md`).

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

- **2026-10-14 (late night)** — Shipped together: surface height (the High Roads), the UI clean pass (Diablo II satchel, calmer Slate), Rift Gates + the Umbral Ink Deeps, and Make your Keeper (creator + gear on the body); also the dependency security pass. Owner: one art style, everything pixel. In flight: UI polish pass 2, the pixel migration; next: phone perf of the deep Delve (Underhearth ~12 fps under 4× throttle).
- **2026-10-14 (late)** — UI clean pass built (roadmap #1, first pass). The Satchel opens on the paper doll and the slot grid only, with one item card on tap. The Mirror Slate opens on big tiles, so the Reels are one tap away. In-world station purpose lines, the phone full-page link, Glim's Close and the anchor rows are quieter. Gated, merging.
- **2026-10-14 (night)** — Shipped the Underhearth, uncapped levels + titles and the Glim bond together (24/24 related e2e green after a CSS merge fix). Owner: the UI feels crowded — cleaning and perfecting what exists is now #1, a custom Keeper with gear that shows on the body is #2; Rift Gates in flight.
- **2026-10-14 (night)** — Built: **a surface with height** (the High Roads): parkour routes in all five hunts with once-only caches and summit titles, ledge-grab, climbing, wall-jump; Hollis Fenn walks the high roads.
- **2026-10-14 (daily review)** — No app code shipped since the evening entry; docs only (agent brief, SYSTEMS.md, sound + catch & craft added). Trimmed "What's next" to seven (sound and catch & craft merged into World feel; the rest under Later). Risk: five features in flight at once on a shared repo — gate each merge and watch for release-version races.
- **2026-10-14 (deps)** — Dependency security pass: all critical alerts and every high alert with a fix are cleared (Angular 21.2.25/26 patches, overrides, in-range updates; functions lockfile too). Still open: node-forge, which needs firebase-admin 14 plus firebase-functions 7, an owner call; dev-only lhci/karma packages have no fix yet. See `docs/handoff/dependency-security.md`.
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
