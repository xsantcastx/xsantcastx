# Eclipse Realms — Roadmap

The one-page answer to "what's next?". Detail lives in `docs/roadmap/world-plan.md` (the build
tracker); design lives in `docs/world/` and `docs/inventory/`, `docs/economy/`, `docs/art/`.
Reviewed daily; newest review on top of the log at the bottom.

## What's next (in order)

1. **Stability on phones** — fix the crash when opening a station from town; cut idle heat on laptops. *(in flight)*
2. **Delve navigation, Terraria-style** — smart cursor + reach, hold-to-mine/drag-to-build, auto-step,
   drop-through platforms, fast ladders, minimap + full map. *(in flight)*
3. **Cleanup leftovers** — remove the daily tool pipeline, Pro Pack, Codex Solarii; Karma back to 0 failures. *(in flight)*
4. **The rest of the casino** on the Reels kit — Rune Drop (Plinko), Seam Sweeper (Mines), Eclipse Ascent (Crash). Gold only. *(built, awaiting merge: `docs/handoff/casino.md`)*
5. **Delve & Beyond, slice 1** — liquids v1 (water/lava), a lake biome, Fishing v1. *(design in flight: `docs/world/delve-and-beyond.md`)*
6. **World & cast, slice 1** — story Act 1 and the lantern companion as the onboarding guide. *(design in flight: `docs/world/world-and-cast.md`)*
7. **Art test set** — produce the 21 first-test-set files (`docs/art-commissions/00-first-test-set.md`); the importer drops them straight in. *(owner / image generator)*

## Milestones

| Milestone | Player gets | Status |
|---|---|---|
| **M1 World** | Every page a place; five towns; Waystones; Places | ✅ shipped |
| **M2 Living Delve** | Persistent diggable Delve, four biomes, building, missions, supports/charges | ✅ shipped |
| **M3 Economy & inventory** | Cookie-Clicker curve, stacking satchel (20/slot), the Vault, nothing ever deleted | ✅ shipped |
| **M4 Phone-first & Terraria look** | Terraria-mobile HUD, pixel-art terrain pass 1+2, update prompt, consent bar | ✅ shipped |
| **M5 Meaning & cleanup** | Everything has a source/use/lore (CI-checked); legacy website removed | ✅ shipped (leftovers in flight) |
| **M6 Feel & stability** | No phone crash, cool idle, Delve navigation, minimap | 🔨 in progress |
| **M7 Fun loops** | Casino (Reels + 3 games), Fishing, liquids & lakes | 🔨 Reels + Rune Drop / Seam Sweeper / Eclipse Ascent built; Fishing next |
| **M8 The deep** | Infinite chunked Delve; the first galactic dimension; Delve events & bosses | 📐 designing |
| **M9 Story & cast** | Act 1, the lantern companion, NPC depth, quest chains, reputation | 📐 designing |
| **M10 The art pass** | Pixel sprites for Keeper, creatures, NPCs; parallax towns; pixel icons | ⏳ needs art |
| **M11 Players** | Player market live (owner deploy), real-device QA, launch | ⏳ owner |

## Waiting on the owner

- Player market deploy (Java for the emulator → rules/indexes → functions → flags).
- The art test set (21 files).
- Review new lore in `docs/world/lore-addendum.md`.
- Daily tool-generation workflow's API credit — moot once the pipeline is deleted.

## Daily review log

- **2026-10-14** — Roadmap created. Shipped yesterday/today: Vault + stacking, Terraria terrain ×2,
  tool tiers + level scaling, meaning audit, phone HUD, update prompt, legacy site removed.
