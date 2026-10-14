# Handoff: water, lava and Fishing v1 (Phase 6, slice 1) — 2026-10-14

Spec: [docs/world/delve-and-beyond.md](../world/delve-and-beyond.md) §4 (liquids), §5 (Fishing), §7.1/§7.4
(the Drowned Lamp), §9 Phase 6. Lore: [lore-addendum.md](../world/lore-addendum.md), "The Delve and beyond".
All four slices shipped together: 6.1 liquids, 6.2 lakes in the core, 6.3 Fishing, 6.4 the fishing economy sim.

## What a player can do now

| | Desktop | Phone |
|---|---|---|
| **Wade and swim** | Water slows the Keeper to ×0.6, they sink slowly, and holding Jump swims up. A Breath bar shows under the HP while the head is under water: 8 s, then 6% max HP a second (the shipped defeat flow at 0). | Jump button |
| **Lava** | 15% max HP a second while in it and a 2 s after-burn. An **Ember Elixir worn as a charm** wards 10 s of lava (an "Ember ward" bar), recharging out of it. | same |
| **Seam Bucket** | Smithing 5: 2 Slag + 1 Cinder + 40 Gold. Choose it on the hotbar (past key 0: `-` / `=`; slots show only while held), right-click a liquid within reach to scoop one full cell, then right-click where to pour. **Water poured on lava sets obsidian.** B scoops in front / pours ahead. | tap the slot, tap the cell |
| **Obsidian** | Where water meets lava, the smaller volume's cell sets into obsidian; it digs back as an **Obsidian block** (a placeable, hotbar `-`/`=` while held) and **pays no XP** (a made cell). | same |
| **Wood and lava** | Lava reaching a torch, ladder, platform, timber support, chest or camp chars it after 3 s and **returns it to the satchel** with a line. A chest with things in it holds the lava back instead. Wooden things cannot be placed into lava. | same |
| **Fish** | Every Keeper is handed a **Worn Rod** (once, like the Worn Pickaxe). Face water within 6 cells: the prompt offers "Fish here". E casts; when the bob dips (3–9 s, faster with bait, level and rod) E hooks it inside 0.6 s (a tap just after is forgiven as a late hook, never a reel-in). The **Line Tension** reel opens: hold (Space, E, the bar or the Hold button) to lift the window, let go to drop it; the fish is **always landed**, the grade only adds (Perfect +50% XP and a crate step, Good +20%). **Holding E is auto-fish**: hooked and landed at the Off grade, recast after the reel it skipped (so auto never outpaces playing). Walking reels the line in. | the prompt's Fish button (hold for auto); the reel sits over the touch row |
| **Catch** | Toast `Blindfin ×1 · +8 Fishing XP`; the stack is in the satchel (its slip shows the lore line and what it is for); crates have **Open** in the slip. | same |
| **Ledger Catch** | The Skills panel (Skills Lodge, Rootglass Canopy) shows **Kesh Arbo, Lodge Warden**: today's one fish (one of 20 Ledger species, by date and seed, swimming only on its day in one water), one **Hand it in** button: 10 min of income, Fishing XP, and the 5th / 10th / 25th turn-in's gift (Tackle Box, Angler's Patience, Lodge Reel). | same |
| **Missions** | The Archivist's **The Drowned Lamp** (3 Glowcap Minnows) → **What the Water Keeps** (read the drowned carving at (87, 36), now under water) → **The Lamp's Keeper** (fish the Mere at night, 20:00–05:59 local, with Glowcap bait: the Drowned Lamp rises, dims every light, and can only be hit while a placed torch burns within 4 cells of it; falls once). Verrin's **Toward the Crack** (5 Rootling Eels), the Merchant's standing **Fish Orders** (5 Mere Perch + 5 Slagjaw Eels) and **The Unpaid Debt** (the legendary), the Archivist's standing **Waterlogged Ledger** (a page → Delving XP). | Quest Board → Delve |
| **Codex** | Lore tab: the **Catalogue of Strange Fish**, every catch (32) as "???" with where it swims until landed, then its lore, Found-in and Used-for lines and the count. | same |

## The lakes (6.2): no cell changed, no `version` bump

`EMBER_DELVE.terrain.liquids` (`towns/infernal.ts`, `liquidVersion: 1`) lays liquid only into cells the stamps
already carve to air for every seed; each body is at rest as generated (a level step of 2 or less never spreads),
so the engine test proves every lake sleeps on load for four seeds with nothing moving.

| Body | Where | Liquid |
|---|---|---|
| **Grotto Mere** | glowcap cavern, cols 20–44, rows 33–34 (the caps glow under it) | water, full |
| The drowned lamp's alcove | (87–88, 36–37): the `grotto-drowned-lamp` carving is under the surface | water |
| Kael's flooded seam | the sealed pocket's floor (101–105, 23–24), round the cache | water |
| A rain seep | the Root Hollows alcove floor (69–70, 10) | water, level 4 |
| Two lava pools | the Bailiffs' hall floor, cols 31–35 and 54–58, row 48 ([2,4,4,4,2]) | lava |

The Cinder Bailiffs' loose-rock engine test now looks for hall ceiling cells clear of the pools (cols 37–52) and
clears the Bailiffs (it is about the ceiling). Fishable waters: `seep` (Root Hollows / Basalt water, tier 1),
`mere` (Grotto and below, tier 1), `magma` (lava, tier 2, a Seam Rod from Fishing 10).

## How it works

### Liquids (`play/engine/liquids.ts`, pure)

- `Terrain` gained `liqType` / `liqLevel` (0..8; a level is 2 art px) and their generated copies
  `baseLiqType` / `baseLiqLevel`; `Terrain.set` with a solid node displaces that cell's liquid.
- `LiquidSim` ticks at **10 Hz of game time** (`step(dt)` from the engine's fixed step; lava every 3rd tick),
  bottom-up with the row direction alternating per tick: fall (as much as fits; a different liquid reacts), then
  spread `floor((a − b) / 3)` toward the lower side; a cell unchanged for 2 ticks with no neighbour changing
  **sleeps**. Any change wakes its 3 × 3; the engine wakes the 3 × 3 round every recorded cell change
  (`recordCell`: digs, placements, take-backs, blasts, reactions), and `wakeAll()` on load so saved water finds
  tunnels dug since it settled. At most **256 cell updates a tick** (`TICK_BUDGET`).
- Integer arithmetic in a fixed order: the same terrain and number of ticks give the same water on any device.
  **A parked loop** (the phone-crash fix: the engine parks behind a panel) runs no `update`, so no liquid time
  passes; it resumes exactly where it stopped (engine test: parked vs never parked, identical arrays).
- **Reactions**: the smaller volume's cell sets into `obsidian` (a tie: the cell the flow arrived in), the other
  loses that volume; if that cell overlaps the Keeper the volumes hiss away as steam instead.
- **Only generated cells pay** (spec §4.2): `hitCell` and `blastCell` now pay XP and yield only when
  `t.base[i] === t.kind[i]`; a placed or made cell pays its `block` only. Obsidian is `xp: 3` so the generated
  obsidian of Phase 8 will pay; the reaction's never does.
- **Buckets**: `scoop` takes a full cell from the joined liquid within 3 cells (top rows first; refuses under 8
  levels); `pour` fills an open cell (overflow goes up a cell) or, onto the other liquid, sets it into obsidian.
  The engine dry-runs, asks the host to swap the stack (`onBucket`, one consume + one grant keyed by the
  action), then changes the world.
- **Saving** (`delve-save.model.ts`): per area, `wet` (= `liquidLayout(spec, seed)`, the terrain layout plus
  `:l<liquidVersion>`) and `liquids` (encodeCells pairs, value = type × 16 + level, only cells unlike the
  generated lakes). Written when the sim **settles**, and also at once after a reaction or a bucket (spec says
  "only when settled"; a reaction saved only at the next settle could be reload-scummed into extra obsidian).
  Merge: same `wet` → per-cell union, local wins; else the side that has one. A new `liquidVersion` drops the
  liquid diff, never a cell.
- **Rendering** (`liquid-render.ts`): after the figures and before the darkness, per row in runs (a lake is a
  handful of fills), three body bands, a 1-art-px lip and a 2-frame shimmer on surface pixels (reduced motion:
  frame 0). **Lava lights itself**: one emitter per pair of visible surface cells goes into
  `lightGrid` as extra sources (`DarknessLayer.draw(…, extra, extraCount)`), never one of the 24 capped slots.
  The only lighting change: that optional parameter (Glim's lantern work merged clean around it).
- **Swimming** (`stepTerrainBody(…, medium)`): gravity ×0.32 (water) / ×0.4 (lava), drag down to a slow sink,
  jump held swims up; `immersion()` reads feet, middle and head against each cell's surface height.

### Fishing (`shared/fishing/`)

| File | What |
|---|---|
| `fishing.model.ts` | Pure tables: waters, 8 fish, 2 junk, 2 crates, 20 Ledger species, bait, rods, the Lodge's charms, perks by level, `catchTable` (sums to 1; empty rarities fold upward), `rollCatch`, `catchXp` (the water's tier, never the level), crates, `ledgerCatch(day, seed)` |
| `fishing-save.ts` | `godforge-fishing`: `{ caught, turnIns, lastTurnIn, opened }`, coerce + commutative merge; registered in `SYNCED_BLOBS` (`progress/fishing`, no rules change) |
| `fishing-reel.ts` | Line Tension, pure: the fish's seeded path, the window's lift/fall, `reelResult` always `landed: true` |
| `fishing.service.ts` | The blob, the rod and bite speed, `hooked` (roll) → `land` (one `SkillActionService.act` keyed by the cast: XP + stack together; bait used after), the Ledger Catch turn-in (receipt, then pay), crate opening, the Worn Rod grant, the Drowned Lamp's condition |
| `line-tension.component.ts` | The reel (rAF outside the zone, CSS custom properties, pointerdown/up, Space/E; reduced motion: one Reel button at the Off grade) |
| `ledger-catch.component.ts` | Kesh Arbo's card in the Skills panel |
| `fishing.i18n.ts` | Lazy EN + ES (play view, Skills panel, Codex, the level-up banner on a Fishing level) |

Engine: `setFishing({ tier, liquids, bite })`, `cast()`, `hook()`, `landFish(recastIn)`, `setUseHeld()`,
`summon(creature, x)`; `onFish(FishEvent)`; state `fishing` / `canFish` / `liquid`; the canvas carries
`data-fishing` (`can:water`, `wait`, `bite`, `hooked`), `data-liquid` and `data-last-catch` for e2e.
The skill: `DisciplineId 'fishing'` (activity ops and the gateway's lists), `SkillId 'fishing'`,
`SKILL_UNLOCKS.fishing` (rods at 1/10/25, lava at 10, bite +5% per 10 levels, crates, double catch at
25/50/75, the reel window at 30/60/90, Mastery 99). Recipes (`FISHING_RECIPES`, `skill: 'fishing'` gates the
rods — a new `CraftingRecipe.skill` value read by `CraftingService.meetsLevel` and the bench's "Reach Fishing N"):
Root / Seam / Glowline Rods, Seam Bucket, Lampfish Oil (3 minnows, or The Kept Morning → 5), Lamp torch
(oil + bark → 5 torches), smelt 3 Rusted Rivets → 1 Slag, and a second Ember Elixir (Emberling + Ember
Residue). Infusion: **Gill Draught** (2 Blindfin, ×3 breath for 3 minutes; a new `breath` channel the play
view reads). Ember Grubs: dirt and root-loam yield one 5% of the time (generated cells only).

Meaning: every catch, bait, rod, crate, charm, bucket and the oil has a source, a use, lore (`SEED_LORE`,
the addendum's lines), a display row (procedural pixel icons, `shared/art/pixel-icons.ts`, picked up by
`artFor()` only when no painting exists) and Found-in lines (`found-in.data.ts`); `check-meaning.js` reads
the fishing tables (and knows obsidian is made by liquids). `drowned-lamp` has a Bestiary page and a
`play.creature.*` name.

## Economy (`node scripts/economy-sim.mjs --fishing`; in `--check`)

| stage | Fishing | forge G/min | sell G/min | order G/min | share | Ledger (daily) | XP/min |
|---|---|---|---|---|---|---|---|
| 10m | 5 | 4,026 | 30 | 0 | 0.7% | 40.3k | 72 |
| 1h | 12 | 1.24M | 67 | 86.4k | 6.9% | 12.45M | 138 |
| 1d | 30 | 53.2M | 73 | 4.11M | 7.7% | 532M | 149 |
| 7d | 60 | 10.0B | 77 | 841M | 8.4% | 100B | 157 |

All four checks pass: share ≤ 10% after 10 min (selling everything at the vendor floor plus the Merchant's
order; the order was raised to 5 + 5 because 2 + 2 measured 17–21%); every crate's vendor value is far
below the forge's Gold in the ~40 minutes a crate takes; each rod's recipe is gated at the Fishing level that
wears it; **99 Fishing in 186 active hours** at the Good grade (221 h on auto, which waits out the reel it
skips). The Ledger Catch is a daily (10 min of income once a day), reported but not in the per-minute share:
the spec's check names "selling everything plus orders". Assumed levels per stage are in the table.

## Perf (opt-in harness, 390×844 @3, 4× CPU, 30 s, software raster)

`PLAY_PERF=1 PLAY_PERF_SECONDS=30 npx playwright test e2e/perf-play.spec.ts -g delve`, two new scenes: the
Keeper wading the Grotto Mere (`delve:grotto-mere`) and walking beside a Magma lava pool (`delve:lava-pool`).
`before` is main (`25a51a4`, no liquids: the same caves dry), alternated with `after`, two rounds each on a
shared, busy machine. Task / script are ms per frame; alloc KB per frame.

| Scene | before #1 | after #1 | before #2 | after #2 |
|---|---|---|---|---|
| Magma Halls gallery (17 torches) | 796 fr · p50/p95 33.8/51.2 · task 37.7 · script 8.2 · alloc 40 | 847 · 33.4/50.2 · 35.4 · 7.8 · 41.5 | 1018 · 33.2/35.1 · 29.5 · 6.4 · 38.6 | 868 · 33.4/50.3 · 34.6 · 7.6 · 43 |
| Grotto Mere (wading) | 1166 · 31.5/35.1 · 25.7 · 11.7 · 53.5 | 1176 · 31.5/35.1 · 25.5 · 11.6 · 57.2 | 1369 · 17.4/34.5 · 21.9 · 10.0 · 52.7 | 1346 · 17.6/34.9 · 22.3 · 10.1 · 55.4 |
| Magma lava pool | 629 · 50.0/66.6 · 47.7 · 13.3 · 66.2 | 726 · 35.2/51.7 · 41.3 · 11.6 · 67.7 | 646 · 49.4/68.2 · 46.5 · 12.9 · 69.8 | 678 · 48.6/66.1 · 44.3 · 12.5 · 68 |

Within the run-to-run noise in every scene (the machine was busiest in the gallery's before #2): the liquid
pass is a few fills per row, the sim sleeps once the lakes settle (0 cell updates a tick), and the lava's
light rides the existing grid. Allocation is up 2–4 KB a frame in the liquid scenes (the per-frame run scan).

## Tests

- `scripts/seamworks-engine.test.cjs` (+16): flow determinism across frame chunkings, volume conservation,
  sleep and wake on a dig, water + lava → obsidian and the made cell paying its block only, every core lake at
  rest as generated for four seeds, the liquid diff's save round-trip / merge / layout drop, buckets, swim /
  breath / lava / ward, wooden things charred back (and a refused chest holding), a parked loop resuming to the
  identical result, the tick budget; fishing cast / bite timing / hook / miss / auto / lava rod / the water
  draining, the Drowned Lamp (summoned, veiled, felled once), buckets through the engine.
- Karma: `fishing.model.spec.ts` (tables sum to 1, the ladder, XP by tier, grades only add, rods gate,
  perks, Line Tension always lands for every rarity and hold pattern, crates, the Ledger Catch, the save
  merge, the Drowned Lamp chain), `fishing.service.spec.ts` (landing pays once, a replay pays nothing, Perfect
  > Off, bait, the Ledger turn-in once a day, crates, the Worn Rod).
- e2e `play-fishing.spec.ts` and `play-liquids.spec.ts` at 1280×800 and 390×844 (chromium and webkit).

## Not done / next

- **Rods and bait choice**: the strongest bait held is used automatically (one per landed catch); no bait
  slot UI. "Hold to throw further" is not built: a cast lands on the nearest fishable surface within 6 cells.
- **Obsidian Rod / Starline / Hollow Line**, Hearth/Star/Void crates, Echo fish, starlight and void liquids,
  the Seam Siphon and the Oil Lantern are later phases (8–11). Lampfish Oil's use today is the Lamp torch.
- **Crates do not grant a Forge rune yet** (spec: "a rare Forge rune from the stratum's rune").
- The Drowned Lamp wears the leech rig; its own sprite is briefed (`docs/art-commissions/world-sprites/12-fishing-liquids.md`).
- Liquids do not flow through placed blocks or under platforms (they ignore non-solid placed things, except lava
  and wood). A Keeper standing where a reaction would set obsidian gets steam instead.
- Kesh Arbo is named on the Ledger Catch card; the town keeper figure keeps its role title until the cast slice.
