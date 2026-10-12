# Handoff: building in the Delve (Phase 2.6)

## What works now

**Finale fixes**
- The Rune-Warden falls once per player. `MonsterDef.once` names a flag (`warden-defeated`). The flag goes into the delve save's `claimed` list when the warden dies. A felled guardian never respawns. A restarted hunt or a new session skips it.
- The Godforge fragment is sealed until then. `TerrainNodeDef.guard` makes every hit clang with "The Rune-Warden still stands" until the flag is set.
- Kael's Hammer comes from a `kaels-cache` node at (85, 18), the east end of the Maws' cavern in the Basalt Caverns. The cache breaks with any tool and is paid once per player (`ONCE_PER_PLAYER` + `claimed`). It sits in a cell that every seed already carves to air, so no saved diff can name it. `terrain.version` stays at 2.

**Building.** One hotbar under the vitals shows every placeable with a count. Keys 1-7 choose a slot (or tap it). Controls:
- **B** places the chosen thing in front of you. Hold **S** to place it under your feet.
- **X** takes back a placed thing.
- Hold a tap (or right-click) on a cell in reach to place there, or to take back what is there.
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
