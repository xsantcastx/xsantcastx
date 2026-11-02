# Trade window: the whole satchel, stacked (branch `tradefix`, 2026-10-27)

Owner reports (live main 84e22a7c): "when trading, it's not showing my inventory complete" and "all items are unstacked".

## Cause
- `src/app/play/trade/trade-hud.component.ts` `get satchel()` (was line 145) read `inventory.snapshot.bag`: gear
  INSTANCES only, one cell each. Everything the satchel keeps as a stack (potions, cooked fish and meals, raw fish, logs,
  runes, materials, Blanks) was never listed, and a pile of identical pieces (two Spellstones of one recipe) showed as
  loose singles. Quest finds (no cell) were silently absent.
- Server half: `functions-game/src/trade-core.ts` `OfferItem` carried instances only (verb-matrix ticket T1), and the
  room's own validator (`scripts/social-server.mjs` `offerItem`) refused any other key.

## Fix
- Client: `trade-items.ts satchelGroups()` reads the satchel GRID (`snapshot.grid.bag`, pieces then the no-room
  strip): one entry per stack kind (its total), one per pile of identical pieces, offered amounts taken off, quest finds
  listed greyed ("Quest"). `groupOffers()` groups "You offer" / "They offer" the same way (×N). A pile or a stack opens
  "How many …?" (−, amount, +, All N, Offer; Esc / × closes) and offers that many; a tap on an offered entry takes the
  whole entry back. Stack cards use the satchel's own stack card (`side-scroller tradeStackCard`).
- Server: `OfferItem.sk` + `qty` (id `stack:<sk>`). `swap` moves a stack as one consume op on the giver
  (`x<hash(trade:side:id)>`) and one grant op on the taker (`t<hash(trade:id)>`, the received id), re-counting the stack
  with folds (`stackHeld`, a copy of inventory-ops `stackQuantity`; `opIdHash` and `QUEST_STACK_KEYS` pinned to the
  client by `trade-stacks.spec.ts`). Quest keys and Vault keys are refused; more than held voids the trade. Both sides
  may offer the same stack kind. `dropItem` refuses a stack (the ground half of T1 is still open).

## Everything is tradable (owner rule, 2026-10-27; second commit on this branch)
- Server `trade-core.ts untradeable`: refuses only the Vault and kit lent to an explorer. Soulbound, the starter tools,
  quest pieces and worn gear trade (worn gear arrives loose in the satchel). Quest stack keys are no longer refused. A
  ground drop still refuses worn gear ("Take it off your Keeper first.").
- Client: nothing greyed. Worn gear is listed with a "Worn" tag and comes off when offered (`inventory.unequip`); quest
  stacks carry a "Quest" tag. `tradeBlock` became `tradeTag` (display) and `dropBlock` (ground only).
- Quests follow possession; nothing is lost for good (audit of every QUEST_STACKS key, the starter tools and the
  Sexton's cowl):
  - Worn Rod (`fishing.service ensureWornRod`) and the starter tools (`side-scroller ensureStarterTools`): given again
    under the next free id (`inventory-ops nextGrantId`); starter tools are "held" by definition, so never doubled.
  - Kael's Hammer, the Godforge Fragment: the once-per-player guard lets the find pay again while it is not in hand
    and its mission (`delve-kael-seam`, `delve-fracture`) is open.
  - The Four Hammer-Marks: a hammer-mark gives them again once "Four Hammers" (`kael-four-2`) is done and they are gone.
  - Mirror Slate II: Kael binds another under a fresh craft id (the Slate itself was already re-buyable from Lune).
  - Sexton's cowl: held by definition (a traded-in copy lays the chain to rest); never minted twice.
  - Curios, Hatbox, Loupe: trophies, bonuses follow the holder; cabinet progress is the opener's flag. No canon entry
    requires a quest piece to stay unique per Keeper (`docs/world/canon.md`).

## Deploy
Room and server code changed: **the hearth needs a redeploy** (`scripts/social-server.mjs` + the bundled trade-core),
and the **trade Function** (`functions-game`, protocol 6 path) too. Until then the live room refuses a stack offer
("No trade: …") and the window still lists everything.

## Tests
- Karma `src/app/play/trade/trade-stacks.spec.ts`; e2e `e2e/td-trade-satchel.spec.ts` (two Keepers, 1280×800 and
  390×844; `TRADE_SHOTS=before|after` writes the screenshots below).
- Screenshots: `docs/handoff/tradefix/{before,after}-window-{1280,390}.jpg`, `after-amount-{1280,390}.jpg`,
  `after-everything-1280.jpg` (Worn and Quest tags).
