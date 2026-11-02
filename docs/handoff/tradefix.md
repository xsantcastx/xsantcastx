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

## Deploy
Room and server code changed: **the hearth needs a redeploy** (`scripts/social-server.mjs` + the bundled trade-core),
and the **trade Function** (`functions-game`, protocol 6 path) too. Until then the live room refuses a stack offer
("No trade: …") and the window still lists everything.

## Tests
- Karma `src/app/play/trade/trade-stacks.spec.ts`; e2e `e2e/td-trade-satchel.spec.ts` (two Keepers, 1280×800 and
  390×844; `TRADE_SHOTS=before|after` writes the screenshots below).
- Screenshots: `docs/handoff/tradefix/{before,after}-window-{1280,390}.jpg`, `after-amount-{1280,390}.jpg`.
