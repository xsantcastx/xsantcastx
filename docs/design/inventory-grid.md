# The satchel grid (D2 / PoE2)

Owner ask, 2026-10-26. The satchel is one grid. Things have footprints, move by drag and drop, and nothing reaches the
Vault by itself. Code: `shared/rpg/inventory-grid.ts` (pure), `shared/rpg/item-footprint.ts`,
`shared/inventory-grid/*` (the drag API, the grid component), `InventoryService.moveTo`.

## 1. Footprints

Width × height in cells. Every grid is 10 cells wide.

| Family (item-base `GearBase`) | Footprint |
|---|---|
| ring, amulet, trinket, charm | 1×1 |
| rune, potion, material, any stack, Spellstone, quest find, anything unknown | 1×1 |
| dagger, wand, sickle | 1×2 |
| belt | 2×1 |
| sword, mace, axe, pickaxe | 1×3 |
| staff, greatsword (two-handed blades) | 1×4 |
| spear (polearms) | 2×4 |
| hammer (mauls) | 2×3 |
| bow, crossbow | 2×3 |
| shield, tome | 2×2 |
| helm, hood, crown, circlet | 2×2 |
| gloves, boots, legs | 2×2 |
| plate, robe, coat (body armour) | 2×3 |

The base comes from `item-base.ts`, the same lookup the gear painter and the requirements read. A new piece gets the
right footprint when it gets the right icon. Axes and pickaxes are hand tools at 1×3 (Diablo II's hand axe), so the
three starter tools take 8 cells, not 14. `inventory-grid.spec.ts` pins the table.

**Grids.**
- Satchel: 10 × 6. Each bought satchel row adds a row, up to 10 × 11.
- Vault tab: 10 × 12.
- Overflow is a list with no grid: what the one-time migration could not fit, and any tab piece a merge left without
  room.

**Piles.** Some things share one cell:
- Mechanically identical pieces (item-groups `identityKeyOf`) pile up to 20 to a cell.
- Spellstones pile only with the identical recipe (`spell@rank#marks`), up to 20 stones a pile, each stone ≤ 100 charges.
- A stack takes one cell per pile of its cap: 999, or 99 for crafted supplies.

## 2. Where a thing sits

- **`pos`** on a record holds the grid `k` (`b` for the satchel, or a tab id), the top-left cells `c` (one per pile for
  a stack) and its own revision `r`. The merge treats it as its own last-writer-wins register: the newer `pos` wins,
  whichever copy of the record won. A move on one device and a temper on another both survive.
- A **move inside one grid** writes only `pos`. It never touches the record's revision.
- A **move between grids** also writes the location (an instance) or a consume plus a grant (a stack). A stack in the
  Vault lives under its own key, `v:<tab>:<key>`. Ops are idempotent, so no merge can make or lose ore. Benches,
  potions and the hotbar read the satchel's key only: you craft with what you carry.
- **Arrivals** (drops, crafts, buys, quest rewards) write their landing cell as they are minted: they join a pile with
  room, or take the first free spot, column by column from the top left (Diablo II's pickup order). With no room, they
  have no `pos` and wait on the satchel's **no room** strip. They are never sent anywhere by themselves.
- **Never-placed things** (list-era saves, a traded item: the server strips the giver's cell) are laid out by the rule:
  stored places first, newest first; then the rest biggest first, by id, into the first free spot. Every device draws
  the same grid from the same ledger.
- **A clash** happens when two devices filled one cell offline. The newer `pos` keeps the cell, and the other piece is
  laid out by the rule. Nothing overlaps and nothing is lost.

### 2.4 A full satchel refuses a pickup
- `LootService.grantDrop` asks `canPickUp` first, and so do the HUD's material pickups and the room's ground pickups.
- A refused pickup stays on the ground with the line "Your satchel is full. It stays on the ground until you make
  room."
- Non-ground arrivals still land, on the no-room strip, so nothing is lost:
  - mining and fishing grants;
  - quest rewards;
  - a trade.
- Cutting a Spellstone with no room is refused before anything is spent.

## 3. Drag and drop

One API, `shared/inventory-grid/item-drag.service.ts`:
- A **source** calls `press(ev, held)` on pointerdown.
- A **target** registers its element with the `appDropTarget` directive, with `accepts`, `over`, `leave` and `drop`.

**Gestures.**
- **Mouse:** move 4 px to drag. Release over a target to drop. A click without a drag opens the options card, and so
  does a right-click. Hovering shows the item card.
- **Touch:** a 400 ms still press picks the thing up and shows "Holding … · Put back". Tap a cell or a target to place
  it; tap anywhere else to put it back. There is no finger-dragging, so windows still scroll.
- **Esc** puts it back.

**Targets today.**

| Target | Takes | Does |
|---|---|---|
| Satchel grid | any grid piece, a worn piece | `moveTo` (a cell) / `unequipTo` |
| Vault tab grid (only inside the Vault station) | satchel pieces and stacks | `moveTo` (location or ops) |
| Doll wells | a satchel piece | `equip(id, slot)` with the Wear checks |
| Book belt Q / R | a potion stack | that key drinks it (`PotionService.pin`) |
| Book belt F | a Spellstone | its recipe goes on the slot |
| The world canvas (top-down, in a room) | a satchel piece | a ground drop (trade HUD `drop`, server escrow) |
| The trade window | a satchel piece | offered (`TradeHudComponent.add`) |

**Shops.** The shops rework plugs in with the same API, and the grid already accepts a `shop` source through
`extraDrop`:
- a shelf is a source with `ref: { kind: 'shop', offerId }`;
- the shelf registers as a target to buy back or sell.

**Moves are optimistic.** Every grid move is one local ledger write with no round trip. A ground drop or a trade offer
goes to the server in the background, and the UI never waits on it.

### 3.3 The Vault
- Standing at a Vault (the Vault station panel) opens a stash grid beside the satchel, with a tab per owned tab and
  Overflow while it holds anything. `InventoryService.setAtVault(true)` opens the stash for moves. Anywhere else a move
  into or out of a tab is refused (`vault-closed`).
- These are gone:
  - "Send to Vault" in the satchel's item card;
  - "Send all gear to the Vault";
  - the routing of arrivals to Gear or General tabs and to Overflow;
  - `settle` (the satchel held to its cap by moving the newest pieces to the Vault);
  - the delve-v3 chest migration's stow;
  - the computed "materials show in the Materials tab" layout.

## 4. The one-time migration (list → grid)

`migrateGrid` runs on load and after a merge, once per save (`ledger.grid = 1`, merged by max):
1. Lay the save out (§2). Nothing is written for what fits: its place is the rule's.
2. Satchel pieces with no room go to the Vault:
   - an instance goes to the first owned tab with a spot, else Overflow, as a location and `pos` write;
   - a stack pile becomes a consume and a grant into `v:<tab>:<key>`, with op ids `gridmig:<key>:<pile>:<qty>:out|in`.
     Two devices migrating the same save write the same ops, and the merge keeps one pair.
3. Vault pieces that outgrew their tab's new grid go to Overflow.
4. The satchel shows the note once: "Your satchel is a grid now. N things that did not fit wait in your Vault."
5. An empty save is not stamped. It may yet merge with a full cloud copy, which must migrate then.

This is the only automatic Vault move left. Property tests in `inventory-grid.spec.ts` run 300 random saves and check:
- nothing is lost (ids, and stack totals across satchel and Vault);
- the satchel and the tabs fit;
- the same moves on two devices;
- idempotence;
- both migrations merged, in either order, own the same things.

## 5. Spellstones are satchel items (skill-book.md §4, S2)

- **A stone** is a 1×1 instance. `definitionId` is `spellstone:<skill>@<rank>#<marks>`, where marks is the row's
  6-bit node mask. It carries `charges` (≤ 100).
- **Moving and selling.** It is tradeable, droppable and storable like any satchel item. It sells for half the
  cheapest blank's price a charge.
- **Cutting.** `SpellstoneService.cut(skill, rank, marks, mana)` takes 1 Basalt Blank (a satchel stack) and Soul, and
  mints the stone into the satchel. The first stone goes on the belt.
- **The belt.** The F slot holds a recipe. Casting spends a charge from the emptiest satchel stone of that recipe, and
  passes the marks to `castStone` as its third argument.
- **The pouch migration** turns `godforge-spellstones` v1 into v2:
  - Each pouch entry becomes stones of ≤ 100 charges. Their ids are `stone-mig-<skill>-<rank>-i<inscribed>-<n>`, at the
    old save's time.
  - The save is then written back as v2 with an empty pouch, in the same tick.
  - Two devices mint the same records, so the merge keeps one. A stone used up since stays used up: its tombstone
    wins. An id already present is skipped.
  - What does not fit the satchel goes to the Vault: the migration rule, once.

## 6. Saves and the server

- **Packed v3.** `pos` packs as `g: "<k>:<cells b36>:<hlc>.<dev>.<seq>"`, about 20 characters, with the device through
  the packed device table. `charges` packs as `ch`. Anything off-shape is kept verbatim (`$pos`).
- **`trade-core` (the Function and the Hearth).**
  - It unpacks and packs both fields.
  - `giveItem` strips the giver's `pos`.
  - Offers carry `ch`, and `sameItem` re-checks it, so a stone used since it was offered is refused.
  - The Hearth's offer validator accepts `ch`.
- **Deploy order.** The server goes first, since it reads and writes both formats:
  - `functions:game` (2026-10-26);
  - the Hearth (revision 00017, 2026-10-26).
  - Rules are unchanged: they never read record fields.
- **Old clients.** A pre-grid build drops `pos`, `charges` and `grid` when it parses a save. A save it writes back
  re-migrates on the next new client, idempotently, and its stones read as charge-less artifacts until then. This lasts
  only while an old tab stays open.
