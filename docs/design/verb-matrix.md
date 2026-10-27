# The player verb matrix

Owner rule: if a player does the natural thing, it works, the same way for every kind of thing. Owned by the QA Lead
(`~/.claude/agents/qa-lead.md`). A branch that adds an item kind or a verb extends this table and its tests in the
same branch.

First cut: the loot hotfix (2026-10-26, `docs/handoff/loot.md`). Cells marked **gap** are known not to work yet; each
names its ticket. Everything else is expected to work as written.

## Verbs everywhere
- **Inspect:** hover (mouse) shows the card; a tap or click pins it with its actions.
- **Move in grid:** drag (mouse), or tap the piece then tap the cell (any device), or long-press then tap (touch).
  Every piece is one cell; nothing else moves; Sort is a button.
- **Drop to world:** the card's Drop, or a drag onto the world. It lands on the tile at the Keeper's feet; many things
  pile on one tile. Online and tradeable: on the room's ground; otherwise on this screen's ground.
- **Pick up:** never by walking over it, except Gold. A click or tap on one walks there and takes it; a right-click,
  long-press or tap on a tile of several lists it (Take, Take all); N takes the nearest in reach.
- **Full satchel:** refused, the thing stays where it was. Line: "Too much baggage — your satchel is full. It stays on
  the ground until you make room." (`play.grid.full`; trade: `trade.satchelFull`.)
- **Vault:** only at a Vault: drag or tap-to-move, Deposit all (keeps the belt's potions and Spellstone), Take all,
  Sort.

## Kind × verb

| Kind | Card actions | Equip | Belt / hotkey | Use from satchel | Drop / pick up | Trade | Sell | Vault | Socket | Split | Destroy |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Gear (each slot), 1H/2H weapons | Wear / Stow, Drop | yes (doll well, drag or tap) | — | — | yes (room if tradeable) | yes | yes (shops) | yes | runes onto it at an Enchanting Table | — | bank Drop |
| Runes | Drop | — | — | socket (drag onto gear) | yes (own ground) | stack: **gap** (T1) | yes | yes | is the socket filler | **gap** (T2) | bank Drop |
| Spellstones | Use, Put on belt, Drop | never | F slot (drag or card) | Use | yes (room if tradeable) | yes | — | yes | — | — | — |
| Potions | Put on belt, Drop | — | Q / R (drag or card) | drink from the belt | yes (own ground) | **gap** (T1) | Edrin never buys them back | yes (Deposit all keeps belt ones) | — | **gap** (T2) | bank Drop |
| Food / meals | Eat, Drop | — | **gap** (T3: no food hotkey yet) | Eat | yes (own ground) | **gap** (T1) | per shop | yes | — | **gap** (T2) | bank Drop |
| Raw fish | Cook (at a fire), Drop | — | — | Cook | yes (own ground) | **gap** (T1) | per shop | yes | — | **gap** (T2) | bank Drop |
| Logs | Light, Drop | — | — | Light | yes (own ground) | **gap** (T1) | per shop | yes | — | **gap** (T2) | bank Drop |
| Materials, Blanks | Drop | — | — | benches read the satchel | yes (own ground) | **gap** (T1) | buyback floor | yes | — | **gap** (T2) | bank Drop |
| Quest items | — | — | — | the quest | never dropped | never | never | stay (no cell) | — | — | never |
| Gold | — | — | — | — | picked up by walking over it | yes (trade window) | — | — | — | — | — |

## Tickets
- **T1 (online builder):** stacks cannot be traded or dropped to the room's ground: `OfferItem` carries instances only
  (`functions-game/src/trade-core.ts`). Online, a dropped stack lies on the dropper's screen only.
- **T2 (grid builder):** no Split for a stack pile (take part of a pile into a free cell).
- **T3 (gather builder):** a meal cannot go on a hotkey (the owner's original example); the belt has Q / R potions and
  F Spellstones only.

## Tests that walk it
- Karma: `inventory-grid-1x1.spec.ts` (1×1, no reshuffle, Sort, full refusal), `td-ground-pile.spec.ts`,
  `trade-flow.spec.ts`.
- e2e: `td-loot-ground.spec.ts` (piles, pickup, labels, full satchel, Spellstone and potion cards, tap-to-move,
  Deposit all, Sort, 360×640 touch), `td-grid-online.spec.ts` (two browsers, one pile), `td-grid.spec.ts`.
- A data-driven matrix spec that walks every cell is the next QA deliverable.
