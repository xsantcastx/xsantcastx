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
- **Give in trade** (2026-10-27, branch `tradefix`; owner rule: everything a Keeper holds is tradable): the window's
  "From your satchel" lists the WHOLE satchel in grid order, grouped as the satchel groups it: one entry per stack kind
  with its total (`×N`), one per pile of identical pieces (`×N`); then what the Keeper wears (tag "Worn": offering it
  takes it off first, into the satchel); then the quest finds (tag "Quest"). Nothing is greyed: soulbound pieces, the
  starter tools and quest items trade like anything else. One thing offers at a tap (phone: the first tap shows its
  card, the second offers); a pile or a stack opens "How many …?" (−, amount, +, All N, **Offer**; starts at all of it)
  and offers that many (Split). Offered amounts come off the satchel entry; "You offer" shows one entry ×N; a tap on it
  takes the whole entry back. Up to 12 entries a window (a stack is one entry; a pile offers one entry per piece). Gold
  is the window's own amount field. Not listed: the Vault (its stacks and pieces are not in the satchel: take them out
  first) and kit lent to an explorer; the server refuses both. Server: `functions-game/src/trade-core.ts` (a stack moves
  as one consume op and one grant op; more than is held voids the trade: "<Keeper> no longer holds N <name>."). Receiving
  never refuses for space: a full satchel's arrivals wait on the "no room" strip.
- **Quests follow possession** (when a quest piece changes hands): the giver's step needs it again, and the receiver can
  use it if they are on that quest. What a Keeper must never lose for good comes back: the Worn Rod and the starter tools
  are given again under a fresh id; Kael's Hammer and the Godforge Fragment can be found again while their mission is
  open; the Four Hammer-Marks are given again at a hammer-mark once Kael's "Four Hammers" is done; Kael binds another
  Mirror Slate II; the Slate itself is bought again from Lune. The Sexton's cowl is checked by what it is, so one traded
  in lays the chain to rest; it is never minted twice (a Keeper who gave it away ends the chain "kept"). Curios, the
  Hatbox and the Loupe are trophies: their bonuses follow whoever holds them; the cabinets' progress is the opener's.

## Kind × verb

| Kind | Card actions | Equip | Belt / hotkey | Use from satchel | Drop / pick up | Trade | Sell | Vault | Socket | Split | Destroy |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Gear (each slot), 1H/2H weapons | Wear / Stow, Drop | yes (doll well, drag or tap) | — | — | yes (room if tradeable) | yes (worn tagged, comes off when offered; bound and starter too) | yes (shops) | yes | runes onto it at an Enchanting Table | — | bank Drop |
| Runes | Drop | — | — | socket (drag onto gear) | yes (own ground) | yes (stack ×N, how many) | yes | yes | is the socket filler | **gap** (T2) | bank Drop |
| Spellstones | Use, Put on belt, Drop | never | F slot (drag or card) | Use | yes (room if tradeable) | yes (a pile ×N, how many) | — | yes | — | — | — |
| Potions | Put on belt, Drop | — | Q / R (drag or card) | drink from the belt | yes (own ground) | yes (stack ×N, how many) | Edrin never buys them back | yes (Deposit all keeps belt ones) | — | **gap** (T2) | bank Drop |
| Food / meals | Eat, Drop | — | **gap** (T3: no food hotkey yet) | Eat | yes (own ground) | yes (stack ×N, how many) | per shop | yes | — | **gap** (T2) | bank Drop |
| Raw fish | Cook (at a fire), Drop | — | — | Cook | yes (own ground) | yes (stack ×N, how many) | per shop | yes | — | **gap** (T2) | bank Drop |
| Logs | Light, Drop | — | — | Light | yes (own ground) | yes (stack ×N, how many) | per shop | yes | — | **gap** (T2) | bank Drop |
| Materials, Blanks | Drop | — | — | benches read the satchel | yes (own ground) | yes (stack ×N, how many) | buyback floor | yes | — | **gap** (T2) | bank Drop |
| Quest items | — | — | — | the quest | never dropped | yes (tagged Quest; the quest follows possession) | never | stay (no cell) | — | — | never |
| Gold | — | — | — | — | picked up by walking over it | yes (an amount, the window's Gold field) | — | — | — | — | — |

## Tickets
- **T1 (online builder):** stacks cannot be dropped to the room's ground (`dropItem` refuses a stack offer). Online, a
  dropped stack lies on the dropper's screen only. The trade half is done (2026-10-27, `tradefix`: `OfferItem.sk/qty`).
- **T2 (grid builder):** no Split for a stack pile (take part of a pile into a free cell).
- **T3 (gather builder):** a meal cannot go on a hotkey (the owner's original example); the belt has Q / R potions and
  F Spellstones only.

## Tests that walk it
- Karma: `inventory-grid-1x1.spec.ts` (1×1, no reshuffle, Sort, full refusal), `td-ground-pile.spec.ts`,
  `trade-flow.spec.ts`, `trade-stacks.spec.ts` (the whole satchel grouped ×N, offered amounts off, quest listed; a stack
  trades by amount through the real trade-core and merges; a quest find, a soulbound piece and worn gear trade; more
  than held / a Vault key refused; a once-only grant comes back under a fresh id), `fishing.service.spec.ts` (a Worn Rod
  traded away comes back), `slate.service.spec.ts` (Kael binds another tier II), `sexton-count.service.spec.ts` (a cowl
  traded in lays the chain to rest).
- e2e: `td-trade-satchel.spec.ts` (two Keepers, desktop + 390×844: whole satchel listed, ×N, bound greyed, 2 of 5
  potions and all 30 Ironwood change hands, the phone reaches its last entry; a quest item, a soulbound piece and worn
  gear change hands, the cowl coming off as it is offered), `td-loot-ground.spec.ts` (piles, pickup, labels, full satchel, Spellstone and potion cards, tap-to-move,
  Deposit all, Sort, 360×640 touch), `td-grid-online.spec.ts` (two browsers, one pile), `td-grid.spec.ts`.
- A data-driven matrix spec that walks every cell is the next QA deliverable.
