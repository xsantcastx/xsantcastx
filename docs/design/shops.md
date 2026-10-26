# The district shops (RuneScape-style)

Owner ask, 2026-10-26; canon §6.5 (the DM placed and named the keepers). Code: `shared/shops/{shops.model,shop.service,
shop.component,shop.i18n}.ts`, the `shop` panel, `td/town-builder.ts shopStation`.

The Material Vendor is gone. In its place stand separate shops, each with its own stock, buying only the goods that
fit it, each in its district of a city. Gold only, never real money.

## How a shop works
- One panel (`shop`) serves every stall; the stall's station names the shop (`shop-general`, `shop-fishing`,
  `shop-wood`, `shop-smith`, `shop-alchemist`) and its keeper (`StationDef.keeper`). The same shop in another city is
  the same station id with that town's label and keeper.
- The window is two grids, like the Vault: the **shelf** and the **satchel**.
  - **Buy**: drag an offer from the shelf into the satchel (the grid's `extraDrop`, `ref: { kind: 'shop', offerId }`),
    or click / right-click it for its card and its Buy button (Buy 5 for a stack).
  - **Sell**: drag a satchel piece back onto the shelf, or click it for its card (Sell / Sell all). A shop that does
    not buy a thing says so.
  - **Hover** shows the card (name in its colour, price, stats, sockets, a level gate). A phone long-presses to pick
    up and taps where it goes.
- Every buy is replay-safe on its press (`shop:buy:<press>` grants; items minted as `shop-<press>`); a sale is one
  consume op (`shop:sell:<press>`) then the Gold, or `InventoryService.sell` for an item.

## Prices (economy-sim --check, the Shops line)
- A thing costs `huntGold(level, seconds)`: so many seconds of a steady hunt at the level it is meant for. Torches
  15 s at level 1 (7 Gold), a Seam Rod 5 min at level 10 (630), a three-well base 6½ min at level 15 (1,225).
- Potions keep their pinned shelf prices (2–12 kills of their tier); the Basalt Blank and the Waygate Scroll keep
  their level-priced rules.
- Shops buy back at the vendor floor (`buybackPrice`, 8% of a thing's worth): no shop buys anything for as much as
  any shop sells it, and no shop buys potions. The sim fails on a loop.

## The shops and their stock
| Shop | Sells | Buys |
|---|---|---|
| General Store | torches, ladders, platforms, bark rope, seam rail, Basalt Blanks, Waygate Scrolls, Minor and Lesser potions | every material the old Material Vendor bought, and gear |
| Fishing Store | Root Rod (Fishing 1), Seam Rod (Fishing 10), Ember Grubs, the Seam Bucket | the catch: fish, junk and crates (not the Ledger Catch) |
| Woodcutting Store | Axe I, Axe II, timber supports | bark, root, sap and silk |
| The Smith's | normal bases with empty sockets: two-well (item level 10) longblade, staff, buckler, cowl, mantle; three-well (12–15) buckler, mace, crossbow, helm, mantle | ore and metal, and gear |
| The Alchemist | every potion on the shelf (not the Rejuvenations) | herbs and inks |

## Placement (by district)
| City | Shop | Where | Keeper |
|---|---|---|---|
| Basalt Seamworks | General Store | the market south of the fountain (22, 22) | Edrin Kade (and his potion shelf) |
| | Tackle shed (Fishing) | the river bank west of the bridge (13, 24) | Davy Tarn, Odd Tarn's nephew |
| | Woodcutting Store | the north orchard (40, 5) | Forester Abe Thatch |
| Pyrehold | General Store | the plaza of stalls (23, 22) | Garrick Dross |
| | The Alchemist | the plaza (15, 20) | Apothecary Juno Marl |
| | The Smith's | the forge district north of the lava channel (27, 3) | Forgewife Ysolde Marr |
| | Fishing stall | the harbour (31, 27) | Old Netter Pell |
| Cinderport | Fishing Store | dockside by the pier (23, 11) | Old Netter Pell |
| Ashgrove | Woodcutting Store | the Charwood's edge by the lodge (2, 10) | Woodward Hesk Ashby |
| Rootglass | General Store (boardwalk market); Herb and Seed (the Bole, an Alchemist) | (4, 16); (18, 8) | Provisioner Teo Alder; Seedwife Rue Hazel |
| Gloamhaven | the Chandlery, a General Store (the square); Fishmonger and Tackle (west jetty) | (18, 9); (10, 11) | Chandler Odo Murk; Fishmonger Dace Morrow |

Kael's Anvil took the Rune Forge's stall in each city; the Enchanting Table got a second counter beside it,
**Charms and Brews** (Idris Calder's recipes).
