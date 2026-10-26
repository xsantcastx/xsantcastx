# Runes, runewords and the district shops (2026-10-26)

The specs are `docs/design/runewords.md` and `docs/design/shops.md`. Canon is `docs/world/canon.md` §5, §6.2 and §6.5;
the DM reviewed it. Screenshots are in `docs/handoff/runes/`.

## What a player gets
- **Runes drop from monsters only**, by zone level:
  - common 1+, uncommon 8+, rare 15+, epic 26+, legendary 35+, mythic 45+;
  - the Void only in Hell.
  - Each rune is a 1×1 satchel pile. Hovering it shows its weapon line and its armour line.
- **White drops can come up socketed**, about one in three. How many sockets depends on the base and the item level.
  A socketed base has a grey name.
- **Runes are set at an Enchanting Table.** Drag a rune onto a socketed piece; on a phone, long-press the rune and
  tap the piece.
  - The right runes, in order, in a plain base of the right type, make a **runeword**. Its name turns gold, and it
    gains fixed stats and often an aura.
  - There are 18 runewords.
  - Runes never come out.
  - A piece with no sockets, a full piece or a worn piece refuses the rune. Away from a table, the satchel refuses
    too.
- **Kael's Anvil** replaces the Rune Forge's stall: everything that is smithed.
- **The Enchanting Table** has a second counter, **Charms and Brews**: charms, elixirs, oils and scrolls. The crafting
  bench is gone; every recipe found a home.
- **Five shops**: General, Fishing, Woodcutting, Smith's and Alchemist. Each has its own stock, buys the goods that
  fit it, and stands in its district.
  - A shop is a shelf grid beside the satchel. Drag to buy, drag back to sell, click for the card.
  - Prices come off the hunt curve. Gold only.

## Where it lives
- **Runes:**
  - `shared/rune-forge/rune-stack.ts` holds the stack keys `rune-<id>`.
  - `rune-forge.service.ts` is the ledger: first-found dates, the migration, `grant` (drops only) and `payInstead`.
  - `loot/drop-tables.ts` has `RUNE_LEVEL`, and `difficulty.model.ts` has `runeCap`.
  - `LootService.grantDrop` rolls a white's sockets and grants a rune pile.
- **Sockets:**
  - `enchanting/socket.model.ts`: the count is the array's length, plus `rollSockets` and `BASE_SOCKET_MAX`.
  - `socketing.service.ts`: the table flag and the drop.
  - `InventoryService.socketRune`: one write.
  - `inventory-ops.ts`: the socket union in the merge, and `socketRefunds`.
  - `inventory-grid/item-grid.component.ts` handles a rune dropped onto a piece; its `(socketed)` output carries the
    line.
- **Runewords:** `enchanting/socket-words.ts` (`SOCKET_WORDS`, `matchSocketWord`) and `runewords.i18n.ts`.
  - Names come from `inventory-grid/piece-look.ts itemNameTone`.
  - Colours are `--cozy-loot-socketed`, `--cozy-loot-runeword` and `--cozy-loot-rune`.
- **Stations:**
  - `crafting.model.ts recipeStation`;
  - the `crafting` panel is Kael's Anvil;
  - the `brews` panel is `enchant-craft.component.ts`, the same journal with `CRAFT_STATION` set to `'enchanting'`.
- **Shops:**
  - `shared/shops/*` and the `shop` panel;
  - `IN_WORLD_STATION` tells the panel which shop and which keeper;
  - `StationDef.keeper`;
  - `td/town-builder.ts shopStation` builds a stall for another city.

## Removed
- The Rune Forge: its component, strike, reel, library, unseen, the Forge's Runeword crafting, the `runes` panel and
  the stalls.
  - The Sanctum ember's anvil mode is gone too, and so are the Rune Forge hint and tab.
- The crafting bench station (Mara's stall).
- The Material Vendor: its component, service, i18n and the `vendor` panel. Its buyback model stays as the floor
  price.
- Unsocketing.
- 88 orphaned `forge.*` and `vendor.*` keys from the eager table.
- `forge-flame.component.spec.ts`, which tested the anvil face, and `rune-forge.service.spec.ts`. They are replaced
  by `rune-ledger.spec.ts`.

## Server and deploys
- **No server change.** trade-core already packs `sockets` (`so`) with empty wells and accepts up to 8 in an offer.
  A rune pile is a plain stack key. `scripts/trade-core.test.mjs` pins the round trip. functions:game was **not**
  redeployed.
- **The Hearth.** The room rolls loot with `drop-tables.ts`, so the new ladder needs a Hearth rebuild: run
  `world-sim-build`, then the protocol 9 deploy. See the report for whether it was deployed.
- **Rules:** unchanged.

## Notes for the next builder
- **The Rune Forge's old caps contradicted the ladder.** They were Normal rare and Nightmare legendary, and are now
  mythic on both; Hell keeps the Void. The DM was told.
- **A runeword's stats** are base + runes + the word's fixed stats. There is no multiplier any more.
- **Retired rune sources** pay the rune's sell value in Gold: thralls, explorers, Reels prizes, the streak chest and
  NPC missions.
- **The Smith's and the Alchemist** stand only in Pyrehold, so `?at=shop-smith` does not resolve. The Seamworks has
  General, Fishing and Woodcutting.
- **Not built yet:**
  - Eclipse Words;
  - the Seamwright's repair counter;
  - trading rune piles (stacks are not tradeable yet).
