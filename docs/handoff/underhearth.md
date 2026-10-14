# Handoff: the Underhearth (Phase 8) — 2026-10-14

Spec: [docs/world/delve-and-beyond.md](../world/delve-and-beyond.md) §2.4, §4 (traversal), §5 (fast travel), §7.1
(the Banked Furnace), §9 Phase 8. Lore: [lore-addendum.md](../world/lore-addendum.md), "The Underhearth in the game
(Phase 8, shipped — owner reviews in play)". Built on Phase 7 (the endless Delve) and merged with origin/main's
map pins / waypoints / compass / fragment / daily bounties (7.4–7.5).

## What a player experiences

1. **The gate is earned.** Under the fragment chamber in the Magma Halls (col 99, rows 51–55) the floor is the
   **Banked seal**, the Four's masonry, warm to the touch. It opens to a **Pickaxe IV** and **Delving 15**, and only
   once **The Fracture** (`delve-fracture`) is claimed. Below Delving 15 a swing says "Needs Delving 15"; before
   The Fracture it says the seal is Kael's to open. Kael's **The Four Who Went Down** asks for exactly this.
2. **The drop.** Under the seal a shaft falls to **the Landing** (row 65): a brick floor, a field note ("a hearth
   for the fifth"), sleeping **Banked Embers** in the hall beyond. Reaching row 56 or deeper files
   `underhearth-reached` (mission objective kind `reach`) and Glim/the story mark it.
3. **The stratum** (rows 56–117 under every column, east and west forever): iron-black basalt over banked
   obsidian, vertical shafts and broad lava basins that grow with depth, **lava lakes** with obsidian shores (lava
   fishing: cold coalfish, pressure pike, the Fifth Ember, hearth crates), new ore (**emberheart**, **pyrite**,
   **cold coal** that only glows once struck, **furnace slag**), **ironwood pillars** (Axe V for their hearts),
   dashed violet **fracture seams**, and its own palette, wash and ember particles. Structures on the lattice:
   the Four's **outposts** (a lit forge corner, a hammer-mark, a hearth-cache that pays ironwood once), maw dens,
   **rail galleries** with a broken gap, **sentinel halls** (ironwood pillars + an Ironwood Sentinel that slams the
   ceiling down), ember dens, hearth lakes, rift shrines (a Waystone Shard + a map fragment).
4. **Kael's rail.** At the Landing an old rail runs east, then down a long diagonal over timber trestles into the
   **Furnace Hall**, ending on a brick gantry with a bumper. With the **Seam Cart** (Kael's *Flooded Seams*) E
   boards it: the cart accelerates down slopes, coasts, launches off open ends, stops at walls; Space jumps out.
   Players lay their own **Seam Rails** (a stack places as a run).
5. **Rope and grapple.** **Bark Rope** spools down from where it is placed (up to 24 cells) and is climbed like
   ladders. The **Thornroot Grapple** (hotbar tool) throws up to 10 cells at the aimed rock, pulls the Keeper in,
   and hangs there until Space/another throw; it releases on a stuck pull.
6. **Rift Anchors** (recipe from *Four Hammers*, a Waystone Shard each, up to 8): placed in the Delve, E on one
   opens the travel sheet listing every anchor; in town the shaft offers **"Descend to an anchor"**. Anchors are
   map markers (violet) next to the other agent's pins, waypoints and compass; the save never regrows them.
7. **The Banked Furnace.** With the **Four Hammer-Marks** (from rubbing the four marks at the outposts, two east,
   two west — *Four Hammers*) E at its hearth wakes it. It is readable and fair:
   - its face is masonry with eye-slits and a grate; it is **banked** (immune — "clang", "Douse its four vents
     with water") until all **four vents** are doused with a bucket of water from the Four's **trough** (the trough
     refills each wake);
   - every 6.5 s (4.6 s enraged) it **breathes**: a 0.9 s warning (the slits flare, a line in the HUD), then a 2.6 s
     inhale that pulls the Keeper toward the mouth; standing in the mouth burns 8% max HP per tick — step away;
   - it **spills embers** (3 minions, no drops) that hunt the Keeper;
   - when all four vents are doused it **opens** for 12 s: the core is the target; then it re-banks and the vents
     relight one by one. Under half HP it is enraged.
   - Defeat (900 HP): coins, emberheart ×3, ironwood ×2, sometimes godforge slag; files `banked-furnace-defeated`,
     completes Verrin's *Let It End* (Pickaxe V / Axe V recipes, a Nox rune). After that it can be woken **once a
     day** (UTC) for its drops.
8. **Missions** (`shared/npc/delve-missions.model.ts`, all on the economy curve, `economy-sim --underhearth`):
   | Mission | Giver | Asks | Pays (floor) |
   |---|---|---|---|
   | Flooded Seams | Kael | 3 Rusted Rivets | 1,500 Gold, 120 Delving XP, Seam Rail + Seam Cart recipes |
   | The Four Who Went Down | Kael | reach the Underhearth | 3,600 Gold, 400 Delving XP |
   | Four Hammers | Kael | the four hammer-marks (new objective kind `flags`) | 4,800 Gold, 500 XP, Four Hammer-Marks, Rift Anchor recipe |
   | Let It End | Verrin (also Kael) | defeat the Banked Furnace | 12,000 Gold, 1000 XP, Nox rune, Pickaxe V + Axe V recipes |
   | Endings Kept Warm | Verrin | 5 rootling eels + 1 cold coalfish | 2,400 Gold, 300 Fishing XP, Hollow rune |
   Story Act II gains its first three beats (`a2.under`, `a2.marks`, `a2.furnace`); Glim has hint rows `u.*`.
9. **Tool tier V**: Pickaxe V (opens godforge slag) and Axe V (ironwood), Smithing 60, 320,000 Gold fee (×4 tier IV).

## How it works (code map)

- `shared/delve/underhearth.model.ts` — rows, flags, stack ids, limits (one place to read the numbers).
- `play/engine/gen-kit.ts` — the generation kit pulled out of `sector-gen.ts` (hashing, noise, `Builder`).
- `play/engine/underhearth-gen.ts` — `deepColumn` (caves, basins, band edge, veins, seams), the deep structure
  plans/stamps, and the fixed set piece (seal, drop, Landing, Furnace Hall, rail path `furnaceRailPath()`).
- `play/engine/sector-gen.ts` / `sector-world.ts` — world rows are now 120 (`TerrainSpec.depth`); the core stays the
  120 × 56 rectangle (`isCoreCell`); deep cells get stable ids in 64-row bands. **SECTOR_GV stays 1**: rows 0–55
  are byte-identical (golden hashes in `delve-endless.test.cjs` hash rows 0–55; `underhearth.test.cjs` pins rows
  56–119 with its own goldens).
- `play/engine/traversal.ts` — rope, grapple and cart physics (pure, node-tested).
- `play/engine/furnace.ts` — the boss state machine (`FURNACE_TUNING` holds every number).
- `play/engine/engine.ts` — gear, cart/grapple/climb in `update()`, creature traits (`dormant`, `shoulder`,
  `furnace`), minions, the seal's skill check (before the guard), drawing of rails, cart, grapple line, deep
  creatures and the furnace face/core; `report()` exposes `riding`, `grappling`, `furnace`.
- `play/side-scroller.component.*` — anchors sheet, wake/day-flag logic, hammer-mark discovery, data attributes
  for tests (`data-depth`, `data-biome`, `data-riding`, `data-grapple`, `data-furnace`).
- Saves: anchors and placed rails/rope are ordinary cells in the v2 region slots; `delve-save.service.ts` adds
  `rift-anchor` to the regrowth-proof set.
- i18n (EN + ES, lazy): `play/world/underhearth.i18n.ts`, `life.i18n.ts` (creatures), story/glim/field notes.

## Not built (follow-ups)

- **Camps per stratum** (one camp per Delve still; anchors cover fast travel).
- **The Seam Siphon** (pumping liquid along rails).
- **Rail junctions / switches** (rails are single polylines; a cart picks level, then up, then down).
- **Rod IV** (lava fishing uses the existing rods that already work lava).
- **The Breach crossing** to Starfall Deep (Phase 9).
- Hand-drawn art for the Underhearth figures/props (drawn in code on the 2 px grid; `docs/art/style-guide.md` §5.3
  lists colours and sizes).

## Tests

- Node: `scripts/underhearth.test.cjs` (23: determinism + goldens of rows 56–119, the set piece, the seal gate,
  rope/grapple/cart physics, the furnace state machine, anchors), `delve-endless.test.cjs` (upper rows
  unchanged), `seamworks-engine.test.cjs`.
- Karma: anchors save + merge + regrowth (`delve-save.service.spec`), new objective kinds and rewards
  (`delve-missions.model.spec`), Four Hammers' material grant (`npc-quest.service.spec`), Act II beats (`story.spec`).
- E2E `e2e/play-underhearth.spec.ts`, 1280×800 and 390×844: the gate refuses at Delving 14 then opens and drops
  to the Landing; ride the rail to the gantry and jump out; place an anchor, travel home and descend to it;
  summon and defeat the Banked Furnace from a seeded save (vents doused from the trough, breath dodged).
- `node scripts/economy-sim.mjs --underhearth` (and `--check`).

## Perf (phone, CDP 4× CPU throttle, `e2e/perf-play.spec.ts`)

PERF_TABLE

New scene `delve: the Furnace Hall, the Banked Furnace awake` (camp at (60,109), wakes the furnace, walks the hall).

## Screenshots

Taken with Playwright during QA (not committed): `output/underhearth/{desktop,phone}-{gate-refused,banked-door,
rail-trestles,rail-gantry,anchor-sheet,furnace-wakes,furnace-open,furnace-out}.png`.
