# The satchel grid (D2 / PoE2 inventory), 2026-10-26

Spec, footprint table and rules: `docs/design/inventory-grid.md`. Screenshots: `docs/handoff/grid/`.

## What a player gets
- **The satchel is one 10 × 6 grid**, plus a row per bought satchel row. A staff stands 1×4, armour is 2×3, rings are
  1×1. Identical pieces pile in one cell, up to 20. A new find lands where it fits and glows twice there.
- **Drag and drop everywhere**:
  - inside the grid;
  - onto the doll to wear, and off the doll into a chosen cell;
  - onto the belt in the satchel: Q and R take a potion, F a Spellstone;
  - onto the world, to drop it for the room;
  - onto the trade window, to offer it;
  - between the satchel and the stash, only at a Vault.
- **Phones:** long-press to pick up, then tap where it goes. "Holding … · Put back" shows meanwhile.
- **Hover and click:** hover shows the item card; a click or right-click opens its options.
- **A full satchel refuses a pickup** and says so. The item stays on the ground.
- **The Vault station** is two grids side by side: the stash (tabs, plus Overflow while it holds anything) and the
  satchel. Nothing goes into the Vault by itself. "Send to Vault" and the whole routing layer are gone.
- **Spellstones are satchel items.** Each is a 1×1 stone recording spell, rank, marks and charges, piled by identical
  recipe. They are tradeable, droppable and storable. The belt's F slot draws on the satchel's stones.

## Where it lives
- **Grid logic:**
  - `shared/rpg/inventory-grid.ts`: layout, `dropFits`, landings, `migrateGrid`, Vault stack keys;
  - `shared/rpg/item-footprint.ts`.
- **Service** (`InventoryService`):
  - `moveTo`, `unequipTo`, `canPickUp`, `canTakeStack`;
  - `setAtVault`, `spendCharge`, `addMigrated`;
  - `snapshot.grid` / `held` / `vaultStacks`;
  - `add()` and the crafts write the landing cell.
- **UI:**
  - `shared/inventory-grid/`: `ItemDragService` (the reusable drag API), `appDropTarget`, `<app-item-grid>`,
    `pieceLookOf`;
  - the satchel book in `play/side-scroller.component.*`;
  - the Vault station in `shared/vault/`;
  - the trade window, which is a drop target.
- **Spellstones:**
  - `spellstones.model.ts`: `recipeKey`, `stoneDefId`, v2 save;
  - `spellstone.service.ts`: `cut`, the satchel `use`, the pouch migration.
- **Server:** `functions-game/src/trade-core.ts`. It packs `pos` and `charges`, `giveItem` strips `pos`, and offers
  carry `ch`. `scripts/social-server.mjs` accepts `ch`. The rule is `firestore.rules` `inventoryGridHolds`.

## Deployed (server first, as asked)
- **functions:game**, 2026-10-26: `tradeApi` and `groundSweep` updated.
- **The Hearth**: revision `eclipse-hearth-00017-lbm`, with `world-sim-build` run first and all four
  `SOCIAL_ORIGINS` + `SOCIAL_FIREBASE_PROJECT` (read from the live env first). `/health` reports protocol 9 and
  `every` 51. No billing flags changed.
- **firestore.rules**: `inventoryGridHolds` refuses an inventory write without `grid` over a saved one that has it, so
  an old tab cannot strip the stones' charges. The live ruleset was diffed against HEAD first (identical but a trailing
  newline).
- **The client is not deployed.** The branch is not pushed.

## Integration notes
- **The book's S2 hook.** `book` has not landed on main. When it does, its "create Spellstone" button (`S2 HOOK` in the
  book component) should call `SpellstoneService.cut(skill, rank, marks, mana)` with the row's 6-bit node mask. The
  result codes:
  - `'room'` (satchel full: show `play.grid.full`);
  - `'blank'`, `'soul'`, `'rank'`.

  The Stones tab reads `SpellstoneService.stones()` and `chargesOf(recipe)`. The cast passes the marks as
  `castStone(skill, rank, marks)`'s third argument, which the engine ignores until the book's nodes land.
- **Shops.** A shelf is a drag source with `ref: { kind: 'shop', offerId }`. `<app-item-grid [extraDrop]>` handles it,
  and the shelf registers as a target to sell.
- **Benches read the satchel only.** Vault stacks are their own keys (`v:<tab>:<key>`). The station's Details says
  so: "take materials out before you craft."

## Removed
- `inventory-layout.ts`: `layoutOf`, `routeFor`, `stowPlan`, `takeOutPlan`, `tabHasRoomFor`, `settle`.
- `InventoryService`: `stow`, `stowMany`, `takeOut*`, `vaultLayout`, and the stack routing announcements.
- The satchel's pockets, tabs and pager, and the vault list, search and sort.
- Specs: `inventory-group-slots.spec.ts` and `e2e/play-vault.spec.ts`, which encoded the auto-vault behaviour.
- The vault part of `inventory-layout.spec.ts`. `td-grid.spec.ts` and `inventory-grid.spec.ts` replace them.
