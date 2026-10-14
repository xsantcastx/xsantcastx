# Handoff: building in the Delve (Phase 2.6)

## What works now

**Finale fixes**
- The Rune-Warden falls once per player. `MonsterDef.once` names a flag (`warden-defeated`). The flag goes into the delve save's `claimed` list when the warden dies. A felled guardian never respawns. A restarted hunt or a new session skips it.
- The Godforge fragment is sealed until then. `TerrainNodeDef.guard` makes every hit clang with "The Rune-Warden still stands" until the flag is set.
- Kael's Hammer comes from a `kaels-cache` node at (85, 18), the east end of the Maws' cavern in the Basalt Caverns. The cache breaks with any tool and is paid once per player (`ONCE_PER_PLAYER` + `claimed`). It sits in a cell that every seed already carves to air, so no saved diff can name it. `terrain.version` stays at 2.

**Building.** One hotbar under the vitals shows every placeable with a count. Keys 1-7 choose a slot (or tap it). Controls:
- **B** places the chosen thing in front of you. Hold **S** to place it under your feet.
- **X** takes back a placed thing.
- Hold a tap (or right-click) on a cell in reach to place there, or to take back what is there. *(2026-10-14: a held right button or a held finger with a placeable chosen now drags a row; a held finger with the pick mines. See `delve-navigation.md`.)*
- **E** or a tap uses a chest or a camp.

| Placeable | Comes from | Behaviour |
|---|---|---|
| Dirt block | digging dirt or loam | Solid. Fills the hole ahead first, so walking and placing bridges a gap. Digs back out as a block, with no XP. |
| Basalt block | digging basalt, hard basalt, grotto stone or scorched basalt | Same as the dirt block. |
| Torch | recipe (3 per craft) | Placed beside you, never in a floor. You walk through it. Always lit, at 0.9 lift, radius 120. |
| Ladder | recipe (4) | Placed where you stand. Up climbs and Down descends, with no gravity. The top is a one-way floor. Up never jumps off a ladder. |
| Platform | recipe (4) | A one-way floor that bridges the gap ahead. Hold Down to drop through. |
| Chest | recipe (1) | Needs ground under it. Holds 4 kinds of material, any quantity of each. Only an empty chest can be taken back. |
| Camp | recipe (1) | Needs ground, and you can have one per Delve. Using it opens the Crafting Bench on "Ready now". From town, the Delve shaft offers "Descend to your camp" (button or C). |

## New materials and recipes

- New stack ids: `kaels-hammer`, `dirt-block`, `basalt-block`, `torch`, `ladder`, `platform`, `chest`, `camp`. They are named in `material-catalog.ts`. Their art is stand-ins, set through `ART_ALIAS`.
- The new Crafting Bench category `delve` ("Delve kit") holds stack-output recipes: `CraftingRecipe.output.stack`. `CraftingGateway` runs them through the new `InventoryService.craftStack`, which consumes the inputs and grants the stack in one ledger write. It is idempotent; `stackCraftedFor` is the replay check.

| Recipe | Inputs | Gold |
|---|---|---|
| Torch ×3 | 1 Cinder Ore + 1 World-Root Bark | 30 |
| Ladder ×4 | 2 World-Root Bark | 20 |
| Platform ×4 | 1 World-Root Bark + 1 Thornroot | 20 |
| Chest | 4 World-Root Bark + 2 Cinder Ore | 150 |
| Camp | 6 World-Root Bark + 4 Cinder Ore + 1 Ember Residue | 500 |

## Save format (`godforge-delve`, version still 1)

- Placed things are ordinary cells in the per-player diff. New node bytes were appended: `packed-dirt`, `basalt-block`, `torch`, `ladder`, `platform`, `chest`, `camp`, `kaels-cache`.
- `claimed` now also holds `warden-defeated`.
- New optional field `chests`: `{ 'ember-delve:<index base36>': { layout, born, n, slots: { stackKey: qty } } }`.
  - Stacks move through the inventory ledger: `consumeStacks` puts them in and `grantStack` takes them out. Each move's id is `delve-chest:<born>:<n>`. There is no second inventory.
  - Merge keeps the copy with the higher `n`. A chest placed again in the same cell is a new chest, and the later `born` wins.
  - On Delve entry, a chest whose layout changed (or whose cell no longer holds a chest) is refunded to the satchel.
- Engine seams:
  - `onPlace` and `onTakeBack` consume or grant one stack, keyed per placement.
  - `onUse` opens a chest or a camp.
  - `WorldActionEvent.block` grants a block after the break is accepted.
  - `DelvePersistence` gains the optional `isClaimed` and `claim`.
  - `IN_WORLD_FOCUS` (in `shared/in-world-panel.ts`) opens the bench on "Ready now".

## Art needed

- Tiles: torch, ladder, platform, chest, camp, packed dirt and basalt block. They are drawn in code in `terrain-render.ts` for now.
- Item icons: the eight new stacks. The stand-ins are relic-dust, godforge-slag, ember-stoker, world-root-bark, rootwall-shield, quest-items, forge and iron-hammer.

## Check by playing

- **Bridging and walls:** dig dirt, then press B while walking toward a pit. The blocks bridge it. Press B against a wall to build stairs.
- **Ladders:** in a one-cell shaft, place a ladder, hold W, place again, and repeat. Hold S to come back down.
- **Torches:** place one in the Magma Halls dark. It stays lit after you leave and come back.
- **Chest:** put something in, reload the page, and take it out. X on a full chest should refuse.
- **Camp:** place a camp, press E to see the bench on "Ready now", then go back to town. At the shaft, "Descend to your camp" should land you beside it.
- **Warden and hammer:** fell the warden and check that the fragment comes free and the warden does not rise again. Break Kael's cache for the hammer.
- **Phone:** check the hotbar layout on a phone (it is a row under the vitals), and that a long-press does not also swing.

## Not done

- Supports and bombs.
- Chests hold materials only. Gear stays in the satchel.
- If a chest move crashes between the ledger write and the chest write, the next move can record the wrong quantity. Nothing is duplicated.
- The hotbar strings are English only, like the rest of /play.

## Tests

- `scripts/seamworks-engine.test.cjs` has 61 tests, 9 of them new: finale ×2, placeTarget, blocks, long-press, torches, ladders, platforms, chests ×2, camp.
- Karma: crafting, collection, art, cloud-save and world pass (237/237).
- tsc (app and spec), ds-adherence, i18n and audit-nav pass.
- `ng build` passes with an initial total of 1.72 MB.

---

# Delve extras: supports, blasting charges, twelve inscriptions, gear in chests

## Loose rock and supports
- **Loose rock** is in the Magma Halls only (`BiomeDef.loose`: `scorched-basalt`, share 0.2). It is picked by a fixed cell hash (`isLoose`) and is never generated. Nothing changes in the grid, so `terrain.version` stays at 2.
- A loose cell must still be its biome's band rock, exactly as generated. It is drawn with a pale fracture and a gap along its underside.
- Exposed loose rock near the Keeper sheds dust every 0.35 s. Under reduced motion it does not; the cracks still show. The first time loose rock is overhead, the Keeper is told what it means.
- **Digging a loose cell** with no support near it plays a 0.45 s groan, with dust and a message. Then a chunk falls straight down from that cell.
- On the Keeper, the chunk takes 8% of max HP (at least 4). It never takes HP below 1, so it is never lethal. A dodge or the post-hit grace avoids it. Digging sideways or down never hits the Keeper; digging upward does.
- **Supports** are placed things you can take back (X), and the Keeper walks through them. Each needs ground under it. A support holds any loose cell within its reach in both directions (Chebyshev distance):

  | Support | Reach | Hotbar key |
  |---|---|---|
  | `timber-support` | 3 cells | 8 |
  | `basalt-support` | 5 cells | 9 |

## Blasting charges
- `blast-charge` is hotbar key 0. Keys 1-9 then 0 now cover ten slots.
- Placing one needs a staff of any tier. Without one it is refused before the satchel is asked.
- The fuse burns for 1.6 s. While it burns, a spark, its light, and a dashed ring show the area that will be cleared. X beside a lit charge pinches it out and returns the charge.
- **The blast** clears cells within 2.3 cells, nearest first (up to 21). Its power is the staff tier + 1: Staff I breaks anything up to Pickaxe II, and Staff II reaches Heartstone. Skill `minLevel` still applies.
- **Never cleared:**
  - bedrock and unbreakable cells
  - non-solid placed things (torches, chests and the rest)
  - stamps marked `protect`: the fragment, both caches, and the sealed pocket's cracked walls
  - a guarded node
  - the spec's `sealed` rectangle round the fragment chamber, cols 90-109 and rows 44-51, until `warden-defeated` is set
- **Each cleared cell** goes through the host's `onWorldAction` with kind `'blast'`:
  - It uses the same mutation id as a dig, so a cell is paid once.
  - It pays at least 1 XP: Mining for rock, Delving for anything else. It also pays its yield.
  - A cell the player placed pays its block back and no XP.
  - Cleared cells are saved in the diff, like digging.
- Creatures in the blast take 60 damage. The Keeper is never hurt by their own charge.
- A charge still in the save after a reload is unlit. Take it back with X.

## Recipes (Delve kit, Smithing-gated; `skill: 'smithing'`, so the level is the Smithing skill)

| Recipe | Makes | Inputs | Gold | Smithing |
|---|---|---|---|---|
| `craft-delve-timber-support` | 2 timber supports | 3 World-Root Bark + 1 Thornroot | 60 | 5 |
| `craft-delve-basalt-support` | 2 basalt supports | 3 Slag Fragment + 2 Cinder Ore + 1 World-Root Bark | 150 | 12 |
| `craft-delve-blast-charge` | 2 blasting charges | 3 Cinder Ore + 1 Ember Residue + 2 Slag Fragment | 200 | 10 |

New stack ids: `timber-support`, `basalt-support`, `blast-charge`. They are named in `material-catalog.ts` and use stand-in art through `ART_ALIAS`. The new node bytes are appended: `timber-support`, `basalt-support`, `blast-charge`.

## Inscriptions: 12 (three per biome)

| Inscription | Cell (col, row) | Where |
|---|---|---|
| `roots-cutting-mark` | 28, 7 | the old tunnel |
| `basalt-seam-ledger` | 78, 16 | the Maws' cavern |
| `grotto-tally-marks` | 40, 32 | the glowcap cavern |
| `magma-unsigned` | 102, 50 | the fragment chamber floor |

- Every one sits in a cell that a stamp carves to air for every seed, and the engine test pins this.
- The Archivist's "all" target now counts 12. Words III's brief reads "Copy all 12 inscriptions". The missions spec pins that the 12 placed ids equal the 12 canon texts.
- The in-world one-liners no longer say "Placeholder:".

## Gear in chests
- No parallel inventory. An item put in a chest keeps its row in the inventory ledger. Its location becomes `{ kind: 'explorer', explorerId: 'delve-chest:<born>' }`, through `equipOnExplorer`, the mechanism thralls use. Taking it out calls `unequip`, which returns it to the bag.
- While stored, the item cannot be worn, sold or dropped. A tool in a chest does not count toward `toolTiers`: the play view filters `isChestHolder` before calling it.
- A chest holds 6 pieces of gear (`CHEST_GEAR_SLOTS`), on top of its 4 kinds of material.
- "Take back only when empty" now means no material and no gear.
- The orphan sweep on Delve entry returns gear from refunded or stale chests. It also returns "stray" gear whose chest record no longer exists (`strayChestGear`), for example a record merged away by a newer chest.
- The chest panel has two new lists: "Gear in the chest" and "Gear in your satchel".
- Side effect: putting gear in a chest fires `equipped$`, which counts toward the "item-equipped" challenge. Equipping a thrall does the same.

## Importer
`scripts/import-assets.py` now passes `"pixelArt": true` from a sprite sidecar into the manifest entry. A non-boolean value is rejected. `SpriteEntry.pixelArt?` is in the generated header. The fixture tests are in `scripts/import-assets.test.py` and need Pillow on Python 3.10 or later.

## Also in this branch (playtest fixes P-2, P-3, P-4)
- **Town persistence.** The town the Keeper stands in is saved in `eclipse-play-world-v1`, a local blob written through the gateway only when it changes, and restored on load. A `?at=` link still wins.
- **Coins.** Monster coins are credited to the Gold purse once per drop. The satchel's Coins count is that blob's running total.
- **Ore drops.** An ore drop pays 2 Mining XP through `SkillActionService`.

## Check by playing
1. **Supports.** In the Magma Maws' hall, dig a cracked, dusting ceiling cell straight above you. You hear a groan, then get a small bruise. Then place a basalt support (key 9) on the floor nearby and dig another: nothing falls.
2. **Charges.** With a staff, press 0 then B. Watch the ring and the spark, step back, and the blast follows. Reload: the blasted cells stay open. Near the fragment chamber, a charge leaves its walls standing until the warden falls.
3. **Inscriptions.** The four new carvings are at the cells listed above. Archivist III should read 12.
4. **Gear.** Put a sword in a chest, reload, and take it out. X on that chest is refused while the sword is inside.

## Tests
- `seamworks-engine.test.cjs` passes 93/93. Five tests are new: loose model, rubble and supports, charges, sealed and power, chest gear helpers. The inscription and hotbar tests were updated.
- `import-assets.test.py` passes 9/9.
- Karma passes 238/238 for npc, crafting and cloud-save.
- The e2e specs for play-world, play-hunting and play-delve pass on chromium. The ladder spec flaked once on Delve entry, then passed twice on repeat.
- tsc, i18n, ds-adherence and audit-nav pass. `ng build` gives an initial total of 1.73 MB.

---

# Delve rock: digging is never blocked, only the reward is rate-limited (2026-10-13)

Owner-delegated call, answering the playtest observation about the seam's 2.5 s breath in the Delve (`docs/handoff/playtest-findings.md`).

## Before
A Delve rock cell that pays Mining XP (every mining-discipline cell, including plain scorched basalt) went through the town seam's `selectCurrentWork` + `resolveMine`. Within `MINING_RECOVERY_MS` (2.5 s) of the last booked Mining operation, the host refused the break. The cell stood fully cracked and every later swing asked again. A Pickaxe I scorched-basalt cell took **7 swings at 0.65 s instead of 4**. The HUD kept showing the previous message.

## Now
- **The cell breaks on tool tier, strength and swings alone.** Scorched basalt with Pickaxe I always opens on swing 4. The crack stages, the dug state and the save diff are unchanged.
- **The reward follows the action economy.** The decision lives in `src/app/play/delve-reward.ts` (`settleDelveMine`, pure, with no Angular):
  - `paid`: the seam was due. One `resolveMine` operation books the Mining XP **and** the ore it grants, exactly as before.
  - `resting`: the seam is recovering. The pre-check reads the selected Current Work, and a `'recovering'` answer from the gateway counts the same. The cell breaks and pays **no XP and no ore**. The host returns `WORLD_ACTION_UNPAID` (`'unpaid'`, new in `engine.model.ts`), so the engine skips its "+1 ore" burst and its "gathered" line. The cell is gone, so its mutation id can never pay later. There is no farming past the per-action cap, and nothing is paid twice.
  - `refused`: any other reason (a full satchel, a failed save, a locked tier, Current Work not selectable). The cell still stands, cracked, so nothing is lost. These are not the breath; making room and swinging again pays.
- **Material yield.** The ore was always part of the same `resolveMine` operation, so the recovery gated it implicitly. It stays gated the same way: reward-limited, not dig-limited. A rock cell with no ore yield of its own (scorched basalt) still books a default Cinder Ore operation when the seam is due, as before. The **block** (`basalt-block`, etc.) still drops on an unpaid break. It is the rock itself, building material, not a reward. Dirt and placed blocks pay nothing and never asked the seam.
- **The cue.** An unpaid break shows a loot toast "+0 XP · the seam is catching its breath" (`play.delve.restingXp`, EN + ES in the lazy `delve.i18n.ts`). It shows at most once per `REST_CUE_GAP_MS` (6 s), so a run of cells in one breath does not stack toasts.
- The orphaned `play.hud.msg.seamBreath` and `seamBreathN` keys were removed from `hud.i18n.ts`.
- Blasts (`kind: 'blast'`) and non-mining cells (`SkillActionService.act`) are untouched. They never went through the seam's recovery.

## Swing counts (Pickaxe I, scorched basalt, 4 HP)
| | Fresh seam | During the 2.5 s breath |
|---|---|---|
| Before | 4 | 7 at 0.65 s per swing (refused until the breath ran out) |
| Now | 4 | 4 (unpaid) |

## Tests
- `scripts/seamworks-engine.test.cjs` adds 3 tests. They drive the real engine through the real `settleDelveMine` against a fake 2.5 s seam:
  - Swing counts are 4/4/3 for a fresh rock, a rock during the breath, and a vein during the breath.
  - XP is paid once, and a replay pays nothing.
  - A full satchel still refuses, and room made pays.
  - The cue throttle.
- `e2e/play-delve-extras.spec.ts`: `digOverhead` no longer "swings until open". It swings 3 times, asserts the cell still stands, then swings once more and asserts it opens. A new test cracks two firm ceiling cells to their last stage, breaks the first (paid, which starts the breath), and breaks the second a second later. It checks:
  - the second still opens on its 4th swing
  - the "+0 XP" toast shows
  - Mining XP is unchanged by the second cell
  - both basalt blocks drop

## Gotcha found on the way: clicks under the swing cooldown are dropped silently
- The swing cooldown (0.52 s) runs on **game** time, and the engine caps a frame at 0.1 s.
- A headless page under load measured 9.5-16.5 fps. At ~9 fps, game time runs slower than the wall clock, so clicks 0.62 s apart sometimes land inside the cooldown and do nothing.
- The specs now click every 1.0 s (`SWING_GAP`). Measured that way, all 13 cells in the rubble test opened on exactly swing 4.
- Part of the playtest's "7 swings" may have been this same effect. The refusal was real either way: the old code returned false during the breath.
- The gallery ceiling's first columns sit under the HUD at the default viewport. A click on col 6 never swung; col 10 did. The new test picks cells from col 12 on.
- A walk slides up to ~20 px past where it stops: velocity carries on after `walkDirection` reaches 0. Falling rock only hits within 23 px of the Keeper's centre, so the rubble tests flaked whenever the overshoot was large. `digOverhead` now clicks the open air at the column until the Keeper is within 8 px.
- The chest test's "X beside the chest" depends on the same overshoot and flaked once in three runs. It was not touched here.
