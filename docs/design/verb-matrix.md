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
| Runes | Drop | — | — (no use from the belt) | socket (drag onto gear) | yes (room if online, a pile ×N) | yes (stack ×N, how many) | yes | yes | is the socket filler | **gap** (T2) | bank Drop |
| Spellstones | Use, Put on belt, Drop | never | F slot (drag or card) | Use | yes (room if tradeable) | yes (a pile ×N, how many) | — | yes | — | — | — |
| Potions | Put on belt, Put on hotkey, Drop | — | Q / R (drag or card), or an item hotkey 9 / 0 / - (drinks that potion) | drink from the belt | yes (room if online, a pile ×N) | yes (stack ×N, how many) | Edrin never buys them back | yes (Deposit all keeps belt ones) | — | **gap** (T2) | bank Drop |
| Food / meals (S8: Thundercake, Cold Miner's Pasty also start a 10-min buff on Eat) | Eat, Put on hotkey, Drop | — | item hotkey 9 / 0 / - (eats one) | Eat | yes (room if online, a pile ×N) | yes (stack ×N, how many) | per shop | yes | — | **gap** (T2) | bank Drop |
| Raw fish | Cook (at a fire), Put on hotkey, Drop | — | item hotkey (cooks at the fire in reach) | Cook | yes (room if online, a pile ×N) | yes (stack ×N, how many) | per shop | yes | — | **gap** (T2) | bank Drop |
| Logs | Light, Put on hotkey, Drop | — | item hotkey (lights one at your feet) | Light | yes (room if online, a pile ×N) | yes (stack ×N, how many) | per shop | yes | — | **gap** (T2) | bank Drop |
| Town Portal scrolls | Read, Put on hotkey, Drop | — | V, or an item hotkey (reads one) | Read | yes (room if online, a pile ×N) | yes (stack ×N, how many) | per shop | yes | — | **gap** (T2) | bank Drop |
| Crates | Open, Put on hotkey, Drop | — | item hotkey (opens one) | Open | yes (room if online, a pile ×N) | yes (stack ×N, how many) | per shop | yes | — | **gap** (T2) | bank Drop |
| Materials, Blanks | Drop | — | — (no use from the belt) | benches read the satchel | yes (room if online, a pile ×N) | yes (stack ×N, how many) | buyback floor | yes | — | **gap** (T2) | bank Drop |
| Night scraps (S8: Margin Note Scrap; S11: Copy-Seed, Keyhole Rubbing) | Drop (its card is the read: what it says, Found in, the thread) | — | — (nothing to use) | read on its card | yes (room if online, a pile ×N) | yes (stack ×N, how many) | never (no buyback) | yes | — | **gap** (T2) | bank Drop |
| Quest items | — | — | — | the quest | never dropped | yes (tagged Quest; the quest follows possession) | never | stay (no cell) | — | — | never |
| Gold | — | — | — | — | picked up by walking over it | yes (an amount, the window's Gold field) | — | — | — | — | — |

- **Belt / hotkey** (2026-11-02, branch `quickwins`): besides Q / R (potions) and F (the Spellstone), the belt has three
  item hotkeys (keys `quick1`–`quick3`, by default 9, 0 and -, rebindable). Any stack with a use goes on one: drag it
  from the satchel onto a slot (the bar's on a desktop, the satchel's belt anywhere), tap it then tap a slot (a phone),
  or press the card's **Put on hotkey** (the first free slot; **Off the hotkey** takes it back). The key does exactly
  what the card's one action does (`shared/belt/quick-belt.model.ts` `BELT_MATRIX`). The count is on the glass; at none
  the slot keeps the kind, greyed, and fills again by itself when more arrive. The slots ride the settings blob (they
  follow the account to every device). A phone's HUD shows only the slots that hold something.
- **Drop a stack** (2026-11-02, `quickwins`): more than one held opens "How many … to drop?" (−, amount, +, All N,
  **Drop**; starts at the cell's count). Online (signed in, a room that trades) the amount lies on the room's ground as
  one pile "Name ×N" for everyone; the server re-counts what the dropper's save holds and takes it out as one consume op;
  anyone may take the pile whole (the first allowed take wins; a full satchel refuses). Otherwise it lies on this screen.

## Tickets
- **T1 (online builder):** DONE 2026-11-02 (`quickwins`): the ground half — a stack drops to the room's ground as one
  pile ×N (`trade-core dropItem` takes a stack offer with a press name `n`; `landGround` grants the pile as one op). The
  trade half was done 2026-10-27 (`tradefix`: `OfferItem.sk/qty`). Not built: taking part of a pile (it is taken whole).
- **T2 (grid builder):** no Split for a stack pile (take part of a pile into a free cell).
- **T3 (gather builder):** DONE 2026-11-02 (`quickwins`): meals (and every usable stack) go on an item hotkey.

## Tests that walk it
- Karma: `quick-belt.spec.ts` (walks `BELT_MATRIX`: every usable kind on a slot, its count, greyed at none, filled
  again; every kind without a use refused), `inventory-grid-1x1.spec.ts` (1×1, no reshuffle, Sort, full refusal), `td-ground-pile.spec.ts`,
  `trade-flow.spec.ts`, `trade-stacks.spec.ts` (the whole satchel grouped ×N, offered amounts off, quest listed; a stack
  trades by amount through the real trade-core and merges; a quest find, a soulbound piece and worn gear trade; more
  than held / a Vault key refused; a once-only grant comes back under a fresh id), `fishing.service.spec.ts` (a Worn Rod
  traded away comes back), `slate.service.spec.ts` (Kael binds another tier II), `sexton-count.service.spec.ts` (a cowl
  traded in lays the chain to rest).
- e2e: `td-quick-belt.spec.ts` (a meal dragged onto a hotkey and eaten with 9, greyed, refilled, kept over a reload; a
  potion and a scroll by the card; ore has none; a phone's tap-assign and tap-use), `td-ground-stacks.spec.ts` (two
  Keepers: 3 of 5 potions through "How many?", one pile ×3 on the other screen, taken whole), `td-trade-satchel.spec.ts` (two Keepers, desktop + 390×844: whole satchel listed, ×N, bound greyed, 2 of 5
  potions and all 30 Ironwood change hands, the phone reaches its last entry; a quest item, a soulbound piece and worn
  gear change hands, the cowl coming off as it is offered), `td-loot-ground.spec.ts` (piles, pickup, labels, full satchel, Spellstone and potion cards, tap-to-move,
  Deposit all, Sort, 360×640 touch), `td-grid-online.spec.ts` (two browsers, one pile), `td-grid.spec.ts`.
- A data-driven matrix spec for the other columns is the next QA deliverable (the Belt / hotkey column has one).

## World verbs (2026-11-03, S7, branch `s7reach`)
- **Walk a seam:** an act's section ends at a road gate or a pass in the land's rock or sea (never an invisible wall).
  Walking two tiles past the gate crosses; so does E (or a tap, or the Map's way pin) at the gate. A 0.4 s veil (at once
  under reduced motion), then the Keeper stands 6 tiles inside the far gate, on its road, with no creature within 8.
  Tests: `td-sections.spec.ts`, `e2e/td-reach.spec.ts`.
- **Take a connector:** a connector cave's far mouth (E, a tap, the Map) opens onto the next section, whichever section
  the Keeper came in from. Tests: the same.
- **Touch a Waystone:** E (a tap, the Map's pin) at a section's stone records it (once: +15 Delving XP, receipt first,
  `godforge-waystones`) and opens the Atlas: every stone of the land, the touched ones lit. One button: Travel (free) to
  the picked touched stone; Esc or × closes. Busy states are the engine's (the veil). Tests: the same, and
  `e2e/menus-reach.spec.ts` (the Atlas at 390×844, 360×640, 844×390).
- **Read / sealed:** E at a plaque, sign or altar reads its line (the toast); at a sealed door, cage or arch, says why it
  is shut. Every section has one of each (td-sections REACH_BIBLE). Tests: `td-sections.spec.ts`, `e2e/td-reach.spec.ts`.

## World verbs (2026-11-04, S11, branch `s11wilds`)
- The Verdant Wilds' sections walk, connect, touch and read exactly as the Reach's (the verbs above); their bible is
  td-sections WILDS_BIBLE, their edge the wood's own wall of vine and root. The Root Hollows are a connector: in by the
  Greenwood's root-hole, out up floor 3's root-ramp into the Deep Wilds (E, a tap, the Map). The thorn hedge is a sealed
  thing (E says why it is shut and where the way on is); it blocks its road from wall to wall. Tests: `td-wilds.spec.ts`,
  `e2e/td-wilds.spec.ts`.
- **Strike the Walking Tree:** at night (or in the Greenwood's fog) the copied tree in the glade moves while unseen; after
  its third move Glim dims beside it, and in reach (2.5 tiles) the prompt says **Strike the tree** (E, a tap). One blow:
  it is a plain tree for the rest of the night and a Copy-Seed lies at its foot, once a night (`night:walking-tree:<n>`).
  Before that, E near it does what E does anywhere else. Tests: the same.

