# Loot hotfix: ground piles, manual pickup, 1×1 satchel, tap-to-move (2026-10-26)

Owner hotfix (branch `loot`). Builds on the paused `dropui` branch (gold-only pickup, click-to-loot, the Pick-up key N,
Alt labels, the escrow-hide fix), which is folded in here.

## What a player gets
- **Piles, RuneScape-style.** Any number of things lie on one tile, solo and online. A tile of several is drawn as a
  heap with a `×N` badge. A right-click (desktop), a long-press, or a tap on a tile of several (phone) opens "On the
  ground": a row takes one (the Keeper walks there), **Take all** takes the lot until the satchel says no.
- **Only Gold comes by itself.** Walking over anything else never picks it up. A click or tap on a single piece walks
  there and takes it; N (or E with nothing else in reach) takes the nearest piece in reach. Pets still fetch what the
  loot filter shows, but never a Keeper's own drop.
- **Too much baggage.** A full satchel refuses with "Too much baggage — your satchel is full…" (EN + ES) and the thing
  stays on the ground.
- **Labels.** Alt held shows every ground label (stacked over a pile, D2's column); phones have a toggle on the belt.
- **Dropping.** The card's Drop (now for stacks too) or a drag onto the world. Online and tradeable: the room's ground
  (escrow, as before) at the tile centre at the Keeper's feet. Otherwise (solo, soulbound, a stack): this screen's own
  ground, same tile, taken back by hand as the very same item (a fresh id, roll and charges kept). Own drops never
  despawn and stay on their floor when the Keeper leaves and comes back (memory only: a reload clears them, as a D2
  game's floor does).
- **1×1 satchel.** Every piece is one cell; 10 × 6 plus bought rows (decision and reasoning: inventory-grid.md §1).
  Nothing ever moves by itself: every write pins loose pieces where they are drawn; a new thing takes the first free
  cell; **Sort** is a button (satchel purse row, each Vault tab).
- **Tap-to-move.** Tap a piece (brass highlight + its card), tap a cell / the Vault / a well / the belt; tap it again to
  let go. Desktop clicks do the same, beside drag and drop. Long-press still works.
- **Vault.** Deposit all (keeps the belt's potions and Spellstone), Take all, Sort tab, Sort satchel.
- **Cards.** A Spellstone shows its stone picture and **Use** / **Put on belt** (never Equip). A potion has **Put on
  belt**. Every satchel piece has **Drop** in the world.

## Bugs fixed (cause → fix)
- Inventory "auto-sorting" after a drop: pieces with no stored `pos` were re-laid by the rule on every layout, so one
  removal shifted the rest (`inventory-grid.ts` layContainer). → `pinLoose` on every save + the v1→v2 pinning migration.
- Dropped item "pops back": the escrowed item stayed in the local ledger when the re-read could not adopt the server
  copy, and a stale merge could revive it. → `GroundFlow` `forget` tombstones it once the room says escrowed
  (`trade-flow.ts`), and `noted` keeps it hidden until then (dropui).
- Hidden piece left in the grid after a drop: same path (pending cleared before the save re-read). → dropui fix.
- Pets returning a Keeper's own drop to the satchel ("comes back out of nowhere"). → own drops excluded from fetch.
- Spellstone card said Equip with no image: `itemSlip` treated the stone as gear (`itemFitsSlot`) and `itemArt` has no
  stone icon. → a Spellstone branch.

## Where
- Pure: `play/td/td-ground-pile.ts` (+spec), `shared/rpg/inventory-grid.ts` (`pinLoose`, `sortContainer`, v2
  migration), `shared/rpg/item-footprint.ts` (`footprintOf` 1×1, `legacyFootprintOf`).
- Engine: `td-engine.ts` piles (`pileAtPoint`, `openPile`, `takeFromPile`, `takePileAll`, `layOwn`, `dropSpot`,
  `setLootLabels`, badge, stacked plates, right-click / long-press), hook `window.__tdGround` (webdriver only).
  `td-mobs.ts` `Drop.own` / `Drop.art`, gold-only walk-over.
- HUD: `side-scroller` `dropToGround`, `dropStackToGround`, `reclaimOwn`, pile window, labels toggle, card buttons,
  Sort. Drag: `item-drag.service.ts` `select`, `item-grid.component.ts` `tapPiece`. Vault: `vault-station.*`.
- Room: **no change needed.** Protocol 8's `groundLay` already keeps a drop where the client asks (within 48 px of the
  Keeper) and holds up to 60 per area; piles are grouped by tile on each screen.

## Tests
Karma: `inventory-grid-1x1.spec.ts`, `td-ground-pile.spec.ts`, `trade-flow.spec.ts` (forget), `inventory-grid.spec.ts`
(v1 table). e2e: `td-loot-ground.spec.ts` (solo, 390×844 and 360×640 touch), `td-grid-online.spec.ts` (two browsers,
one pile), `td-grid.spec.ts` (1×1), `td-corpse.spec.ts` (click-to-loot, N).

## Open
- Online stacks and soulbound items drop to this screen's own ground only (the trade Function carries instances, not
  stacks). Ticket for the online builder: a stack drop through `groundLay` needs `OfferItem` stack support in
  `functions-game/src/trade-core.ts` and the room.
