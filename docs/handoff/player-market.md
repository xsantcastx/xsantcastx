# Player market (Grand Exchange): handoff

Owner decision: **players run the economy**. The Grand Exchange becomes a shared
auction house. Players post buy and sell orders, prices come from supply and
demand, and the **server** matches trades, holds escrow, and takes a 2% seller
tax as a Gold sink. NPCs only sink Gold; they don't trade.

Status: **built, tested, not deployed, switched off.** The simulated Exchange
(`src/app/shared/exchange/`) stays live until the owner turns this on.

---

## 1. What exists

| Piece | Where |
|---|---|
| Callable functions `market-placeOrder`, `market-cancelOrder`, `market-collect` | `functions/src/market/index.ts` (exported from `functions/src/index.ts`) |
| Transactional engine (escrow, matching, settlement) | `functions/src/market/engine.ts` |
| Matching: price-time priority, partial fills, tax | `functions/src/market/matching.ts` |
| Reference price, sanity band, price history | `functions/src/market/pricing.ts` |
| The Exchange list's summary doc (folded in each transaction) | `functions/src/market/summary.ts` |
| Rate limiter | `functions/src/market/rate-limit.ts` |
| Edits to the player's cloud save | `functions/src/market/save-ops.ts` |
| Every limit and constant | `functions/src/market/config.ts` |
| Base worth per item (generated) | `functions/src/market/reference.generated.ts` ← `node scripts/generate-market-reference.mjs` |
| Client service the UI binds to | `src/app/shared/market/player-market.service.ts` |
| Client types and pure helpers | `src/app/shared/market/player-market.model.ts` |
| Firebase edge (lazy SDK imports) | `src/app/shared/market/player-market.backend.ts` |
| Rules | `firestore.rules` → `match /market/{version}` |
| Indexes | `firestore.indexes.json` (4 composite) |
| CSP | `firebase.json` `connect-src` + `https://us-central1-xsantcastx-1694b.cloudfunctions.net` |

### Data model (`market/v1/...`)

Firestore paths alternate collection and document, so the brief's
`market/orders/{id}` is `market/v1/orders/{id}`. `v1` also leaves room for a
clean schema change later.

| Path | Contents | Client access |
|---|---|---|
| `market/v1` | `{ enabled, haltNewOrders }` (server feature flag) | read: everyone. Write: owner only |
| `market/v1/orders/{orderId}` | side, itemKey, kind, qty, filledQty, unitPrice, ownerUid, createdAt, status, `instance` roll snapshot (equipment sells), clientRequestId | read: everyone |
| `market/v1/trades/{tradeId}` | itemKey, qty, unitPrice, tax, buy/sell order ids, buyer/seller uid, maker side, executedAt | read: everyone |
| `market/v1/prices/{itemKey}` | lastPrice, lastTradeAt, volume24h, vwap24h, trades24h, 30 days of hourly OHLC/volume buckets | read: everyone |
| `market/v1/escrow/{uid}` | heldGold, claimableGold, claims[], marks[], seq counters, rate stamps, request ids, taxPaid | read: that player only |
| `market/v1/listed/{itemId}` | burned instance ids (`{uid, orderId, at}`) | none |
| `market/v1/summary/board` | `rows[itemKey]`: bestBid, bestAsk, bidQty, askQty, lastPrice, lastTradeAt, volume24h, vwap24h (see "Read cost" below) | get: everyone |

`itemKey` is the Exchange catalogue id: `mat:<stackKey>` for materials, or
`eq:<definitionId>:<rarity>` for equipment. Soulbound items, uniques, runes and
quest items have no market, same as the simulated Exchange.

---

## 2. What the functions guarantee

All three functions need a signed-in, non-anonymous Firebase user and an App
Check token (global `enforceAppCheck`). All three refuse unless
`market/v1.enabled == true`, and they refuse banned accounts
(`users/{uid}/meta/ban`). Each call is **one Firestore transaction**: it reads
everything first, writes last, and retries as a whole on contention.

**placeOrder** `{side, itemKey, qty, unitPrice, instanceId?, clientRequestId?}`
1. Validates the input: whole numbers, qty 1–10,000, one equipment piece per sell, at most 50 per equipment buy.
2. Checks the rate limit (12 trade actions a minute, 150 a day), the open-order cap (40), and the pending-claims cap (120, so players must "collect first").
3. **Sanity band:** the price must be within ×4 of the reference price. The reference is the 24h VWAP (needs at least 3 trades), else the last trade, else the catalogue base worth. It must also be between 0.1× and 8× the base worth.
4. **Provenance:** it reads the seller's cloud save `users/{uid}/progress/inventory`. The item must exist there, be an inventory instance in the bag (not equipped, not on an expedition), not soulbound, and not tombstoned. Its `definitionId:rarity` must match `itemKey`. Its id must never have been listed before (`listed/{id}`). For stacks, the derived quantity must cover `qty`. A buy must be covered by the cloud Gold, and that check uses the smaller of the stored balance and the op-log replay.
5. **Escrow** happens in the same transaction. The item leaves the save, or `qty × unitPrice` Gold is debited (see §3).
6. **Matching** walks the opposite side in price-time priority: best price first, then oldest. Fills are partial on both sides. Each trade prints at the resting order's price. Self-trades are skipped. One placement fills against at most 25 resting orders, and any remainder rests on the book.
7. **Settlement:** the seller's escrow gets `gross − ceil(2% × gross)`. The buyer gets the item as a claim, plus a refund of `(limit − price) × qty`. Trades and price buckets are written, and the item's row in `summary/board` is updated in the same commit (cancels update it too).
8. **Idempotent:** if a `clientRequestId` repeats (the last 50 per account are remembered), the call returns the original order with `replayed: true` and moves nothing.

**cancelOrder** `{orderId}`: owner-only and open orders only. The unfilled
remainder goes back as a claim (items) or as claimable Gold (buys). An order
that's already filled or cancelled is refused.

**collect** `{}`: moves claimable Gold and item claims into the player's save
in one transaction, and clears those claims in the same commit. Each claim is
delivered exactly once. Instances are minted under a fresh id
(`mkt-<claimId>`) with the exact roll from the snapshot. Stacks are granted with
the op id `mkt:claim:<claimId>`. When the bag is full (250), instance claims
wait. Nothing is evicted.

**Conservation (tested):** Gold that leaves a buyer equals the seller's net,
plus tax, plus the buyer's refund. Items leave a seller exactly once.

---

## 3. Escrow vs. the save merge: the protocol

The save is two client-merged ledgers:
`progress/inventory` (records, tombstones, idempotent stack ops) and
`economy/state` (an op log replayed from `origin`). Players write them directly,
and any device may merge a stale copy back. The server therefore never rewrites
a ledger wholesale. It only makes edits that the client's own merge keeps:

| Market action | Edit to the save | Why a client re-sync keeps it |
|---|---|---|
| List an instance | Remove the record and add a **tombstone** with revision `hlc = max(record.hlc, now) + 1 year`, `deviceId: "market-server"` | `mergeInventoryLedgers` drops any record whose revision ≤ the tombstone's. Client revisions use the wall clock, so a device that hasn't synced and edits the item later still loses. |
| List a stack | Append a **consume** stack op with the id `mkt:escrow:<orderId>`, stamped above every op, record and checkpoint watermark | Stack ops are unioned by id. An op at or below a checkpoint watermark would be treated as "already folded", which is why it's stamped above all of them. |
| Buy-order escrow | Append the economy op `spend-gold` with the id `market-server:<seq>` and lower `gold` by the same amount. If the ledger has no `origin`, the pre-op snapshot is pinned as `origin`. | Ops are unioned by id and replayed. Pinning the origin stops the client from replaying the op on top of a balance that already includes it. |
| Collect | `credit-gold` op, a stack `grant` op (`mkt:claim:<id>`), or a new instance record (`mkt-<id>`) | Same union rules. A new id can't collide. |

Every edit is also stored as a **mark** on `market/v1/escrow/{uid}`. Marks are
kept for 7 days, up to 400. **Every later market call by that player re-applies
its marks** (idempotently) before doing anything else. That repairs the two
known ways a client can overwrite the server's edit:

1. The inventory flush in `GameStateGateway.pushDirty` is a read-merge-write,
   **not a transaction**, so a flush racing a market call can write back a copy
   from before the call.
2. "Keep this device" in the sign-in merge dialog takes the local copy wholesale.

Instances also have a hard stop: a listed id is **burned** (`listed/{id}`). An
instance that comes back from the dead can still be used in single-player play,
but it can't be sold again, so duplicates never reach other players.

Client side, `PlayerMarketService` calls `gateway.flushNow()` before a sell or
collect (so the server sees the latest save) and `gateway.attach(uid, fs)`
afterwards (so the bag and Gold rail adopt the server's edit right away).
`attach` without an `ask` callback always merges and never opens the dialog.

Server edits are refused when the inventory save isn't v2 at the current
`INVENTORY_ERA`. The client throws away a lower-era copy wholesale, so writing
into one would lose the edit.

---

## 4. Deploy order (nothing has been deployed)

> **CI trap:** `ci-cd.yml` deploys rules
> and indexes *before* hosting, in the same job, and the CI service account gets
> a 403 on rules. **A push to `main` that touches `firestore.rules` or
> `firestore.indexes.json` will block hosting for that release.** Either grant
> the service account `roles/firebaserules.admin`, or deploy rules and indexes
> by hand (step 1) and make sure the merge that reaches `main` is not the push
> that first changes them. Note that the merge of this branch *does* change them.

1. **Rules and indexes** (by hand):
   `firebase deploy --only firestore:rules,firestore:indexes --project xsantcastx-1694b`
   Wait until the 4 indexes show "Enabled" in the console. Until then, the
   matching query fails with `FAILED_PRECONDITION` and placements return the
   internal error message.
2. **Functions:** `firebase deploy --only functions:market --project xsantcastx-1694b`
   (predeploy runs `npm --prefix functions run build`). They stay dormant because
   `market/v1` doesn't exist yet, so every call returns "The player market isn't open yet."
3. **Hosting** (the normal release): ships the CSP `connect-src` entry for
   `us-central1-xsantcastx-1694b.cloudfunctions.net`. Without it, the browser
   blocks every callable before it leaves the page. The Stripe checkout
   callable was missing this host too.
4. **Server flag:** in the Firestore console, create `market/v1` with
   `{ enabled: true }`. Set `haltNewOrders: true` to pause new orders while
   still allowing cancels and collects. Set `enabled: false` to stop
   everything; open orders and escrow are kept.
5. **Client flag:** set `PLAYER_MARKET_CLIENT_ENABLED = true` in
   `src/app/shared/market/player-market.model.ts`, and have the redesigned
   Exchange render from `PlayerMarketService` when `access$` isn't `disabled`.
   Ship it.

Rollback order is the reverse: client flag off, then `enabled: false`. Leave
the functions deployed so players can still cancel and collect. Set
`enabled: true, haltNewOrders: true` if you want that without new trades.

---

## 5. Binding the redesigned Exchange UI

```ts
const market = inject(PlayerMarketService);

market.access$          // {state:'disabled'} → render the simulated Exchange (current behaviour)
                        // {state:'closed', reason} → banner with reason
                        // {state:'signed-out'} → "Sign in to trade" + CloudSaveService sign-in button
                        // {state:'ready', uid, haltNewOrders} → full ticket (grey it out if halted)
market.book$(itemKey)   // OrderBook: bids/asks price levels, askOrders (one row per equipment roll), bestBid/bestAsk, loading
market.price$(itemKey)  // MarketPrice: lastPrice, vwap24h, volume24h, buckets[] (hourly OHLC/volume, 30 days) → chart
market.trades$(itemKey) // recent trades, newest first
market.myOrders$        // the player's orders (open, filled, cancelled), newest first
market.escrow$          // heldGold, claimableGold, claims[] → "Collect" badge when either is non-zero
market.pending$         // in-flight actions → optimistic rows (input) / greyed rows (orderId)

await market.placeOrder({side, itemKey, qty, unitPrice, instanceId?}, {requestId?})
await market.cancelOrder(orderId)
await market.collect()
// All three resolve to {ok:true, value} | {ok:false, error, reason}. They never reject.
// `error` is a finished sentence. `reason` is a stable code to branch on:
// price-band, rate-limited, not-owned, in-use, soulbound, already-listed,
// not-enough, not-enough-gold, collect-first, too-many-orders, market-closed,
// market-halted, banned, save-era, save-unreadable, save-missing, save-syncing,
// not-open, signed-out, offline, internal, precheck.
```

- **Retry:** if a placement fails with `offline` or `internal`, retry with
  `{requestId: pendingAction.id}`. If the first attempt actually committed, the
  server answers `replayed: true` and nothing doubles.
- **Equipment sells** need `instanceId`, the `GameItem.id` from
  `InventoryService`. Only offer bag items that aren't soulbound and whose
  `eq:${definitionId}:${rarity}` is in `EXCHANGE_CATALOGUE`.
- **Equipment buys** match any roll. Show `book.askOrders[i].instance` so
  buyers can see what they'd get, and suggest a limit at that order's price.
- **Price hints:** pre-fill from `price$.vwap24h || lastPrice`, falling back to
  `goodById(itemKey).basePrice`. If the band refuses a price, the error already
  names the accepted range.
- **Fees:** show `sellerTax(gross)` and `netProceeds(price, qty)` from the model.
- The service and backend are `providedIn: 'root'` but nothing eager imports
  them, so they land in the Exchange's lazy chunk. The Firestore and Functions
  SDKs are dynamic imports.

---

## 6. Abuse limits (all in `functions/src/market/config.ts`)

| Limit | Value |
|---|---|
| Seller tax | 2%, rounded up |
| Trade actions (place + cancel) | 12 a minute, 150 a day, per uid |
| Collects | 10 a minute, 400 a day, per uid |
| Open orders | 40 per uid |
| Pending claims before new orders are refused | 120 |
| Order size | 1–10,000 units. Equipment: sells 1, buys at most 50 |
| Unit price | 1–50,000,000 |
| Sanity band | ×4 around the reference price, and 0.1×–8× the base worth |
| Fills per placement | 25 resting orders |
| Who can trade | signed-in, non-anonymous, App Check passed, not banned |
| Relisting | a given instance id can be listed once, ever |

---

## 7. What is still client-trusted (honest list)

The market is only as sound as the cloud save it checks, and **the cloud save
is written by the client**. The `progress` and `economy` rules let a signed-in
player write their own documents freely, apart from monotonic XP.

1. **Minting:** a player who edits their own save documents can give themselves
   stacks, items or Gold, then sell them on the market. Provenance proves an
   item is *in the save*. It can't prove the item was *earned*. The real fix is
   server-authoritative grants (drops, crafting, Gold income), which is out of
   scope here. Until then, the sanity band and the daily caps limit how fast
   minted goods can drain other players' Gold, and `market/v1/trades` gives an
   audit trail per uid.
2. **Undoing an escrow locally:** a hostile client can write back a save from
   before a listing. The instance can't be listed again (its id is burned), and
   stack and Gold edits are re-applied on that player's next market call. In
   between, the player can still use the restored copy in single-player play,
   and a player who never calls the market again keeps it.
3. **Skipped Gold debit:** the client replay skips any spend it can't afford at
   its place in the op order. If a device that's been offline syncs spends with
   a lower HLC than the market's `spend-gold`, the replay can skip the market's
   debit. The order is still escrowed server-side, so that's a mint worth up to
   the order's value. Re-assertion doesn't re-append a spend that's become
   unaffordable. Detecting it needs a server-side ledger replay on every call,
   which is noted as follow-up work.
4. **Marks expire:** after 7 days (or past 400 marks) a stack or Gold edit that
   was overwritten and never repaired becomes permanent. Instance tombstones
   don't depend on marks; their one-year lead covers them.
5. **Concurrent client flush:** the inventory flush isn't transactional (point
   1 in §3). Re-assertion repairs it on the next market call. Making that flush
   a transaction, as the economy flush already is, would close the window and
   is a small follow-up in `game-state.gateway.ts`.
6. **Credits count as earned:** `credit-gold` raises `totalGoldEarned` and
   `runGoldEarned` exactly as client income does. Achievements keyed on those
   counters will count market proceeds.

---

## 8. Tests

- `npm --prefix functions test`: 33 node:test cases that run the real engine
  against an in-memory transactional store. They cover matching (priority,
  partial fills, self-trade), tax and conservation, sanity bands, rate limits
  and caps, provenance refusals, burned ids, the flag and bans, placement
  idempotency, exactly-once collect, rollback on refusal, bag-full, the
  tombstone lead, re-assertion after a "keep this device" overwrite, and
  legacy-ledger origin pinning. The **Firestore emulator wasn't used**: it
  needs a JVM, which the build machine doesn't have. Queries, indexes and real
  transaction retries are therefore untested until the first emulator or
  staging run (`firebase emulators:exec --only firestore,functions "npm --prefix functions test"`
  would need a store adapter pointed at the emulator).
- `src/app/shared/market/*.spec.ts` (Karma):
  - `market-protocol.spec.ts` feeds every server save edit through the client's real `mergeInventoryLedgers` / `mergeEconomyLedgers`, in both argument orders.
  - `market-reference.spec.ts` checks the generated base-worth table against `EXCHANGE_CATALOGUE` and `INVENTORY_ERA`.
  - The model spec and the service spec use a fake backend.

## Coordinator note (merge to main, 2026-10-12)

`firestore.rules` and `firestore.indexes.json` were **not** merged into the repo root: CI deploys rules whenever those files change, and that step has 403'd and blocked the hosting deploy before. The market's versions are kept here as `player-market/firestore.rules.proposed` and `player-market/firestore.indexes.json.proposed`. At deploy time (owner approval), copy them over the root files and deploy rules + indexes **by hand** first, per the deploy order above. Until then the market stays off (server flag `market/v1.enabled` absent, client `PLAYER_MARKET_CLIENT_ENABLED = false`); the simulated Exchange remains live.

## UI binding (Exchange, 2026-10-13)

The redesigned Exchange now binds to `PlayerMarketService`. Nothing changes
while `PLAYER_MARKET_CLIENT_ENABLED = false`: the simulated board renders
exactly as before, and the player-market UI sits in a `@defer` block whose
chunk is never fetched.

### How the switch works

`PLAYER_MARKET_MODE` (`src/app/shared/market/player-market.mode.ts`) resolves
once per page from the client flag, `isDevMode()` and the query string:

| Mode | When | Exchange shows |
|---|---|---|
| `off` | flag false (default) | the simulated board (unchanged) |
| `live` | flag true | `PlayerExchangeComponent` on `FirebaseMarketBackend` |
| `fake` | **dev mode only** and `?market=fake…` | `PlayerExchangeComponent` on `FakeMarketBackend` |

When the mode isn't `off`, `ExchangeComponent` skips its own init and renders
`<app-player-exchange>` inside `@if (playerMarket) { @defer }`.
`PLAYER_MARKET_BACKEND` picks the fake only in `fake` mode. A production build
runs with dev mode off, so it ignores the query parameter.

### What the player sees (`src/app/shared/exchange/player-exchange.*`)

- **Tabs:** Buy · Sell · Your orders (the badge counts open orders). It uses
  the same station-kit journal as the simulated board.
- **Buy list:** every item with a live player order or a trade in the last 24h
  (`board$`), busiest first, showing "From N Gold" (the best ask). **Sell
  list:** what you carry, with items that have a buyer first ("You have N ·
  buyers pay P").
- **Detail:**
  - Sellers and buyers depth: the top 5 price levels on each side. Tapping a
    level uses that price.
  - The last price and the 24h volume.
  - A price box. It defaults to the best ask (buy) or the best bid (sell). With
    nobody on the other side, it falls back to the 24h VWAP, then the last
    trade, then the base worth.
  - The quantity stepper with **Max**. For a buy, Max is the Gold you have
    divided by the price, capped at 10,000 (50 for equipment). For a sell, Max
    is what you carry (1 for equipment).
  - A plain fee line: "You pay N Gold now." or "2% tax · you receive N Gold",
    plus whether the order fills right away or waits.
- **Collect bar:** shown above the journal whenever escrow holds Gold or items.
- **Your orders:** each order reads "x of y done · price each · status", with
  Cancel on open orders.
- **Signed out:** one line, "Sign in to trade with other players", and a Sign
  in button (`PlayerMarketService.signIn()` → `CloudSaveService.signIn()`). The
  board stays browsable.
- **Closed or halted:** a banner, and the action button says why it's off.
- **Errors:** `marketErrorCopy(reason, message)` turns each server reason into
  one translated sentence. A price-band refusal shows the accepted range, read
  out of the server's message. A rate limit shows how long to wait, read the
  same way. Every save problem (`not-owned`, `not-enough`, `save-*`) reads
  "That is not in your cloud save yet…". An unknown reason shows the server's
  own sentence, never a code.
- **Equipment sells** list the oldest sellable instance
  (`ExchangeService.sellableInstances`).
- **Copy** lives in a lazy table, `player-exchange.i18n.ts` (`pmx.*`, EN and
  ES). The station-kit rule keeps one page's strings out of the eager table.

### Trying it locally (no backend, no deploy)

```
npm start
http://localhost:4200/exchange?market=fake            signed in, market open
http://localhost:4200/exchange?market=fake-guest      signed out (Sign in flips it on)
http://localhost:4200/exchange?market=fake-closed     server switch off
http://localhost:4200/exchange?market=fake&fail=price-band   every placement refused with that reason
```

`fail=` takes any server reason: `rate-limited`, `not-owned`,
`not-enough-gold`, `market-halted`, `collect-first`, `too-many-orders`,
`already-listed`, `in-use`, `soulbound`, `banned`, `save-syncing`, and so on.

The fake (`player-market.fake-backend.ts`) behaves like the server in these
ways:

- It seeds a dozen markets with bot orders and a day of trades.
- It matches in price-time order at the resting price and applies the 2% tax.
- It escrows buys and refunds the difference.
- It enforces the sanity band, 12 actions a minute and 40 open orders.
- About 8 seconds after you leave an order resting, a bot takes half of it, so
  Collect has something to show.

It **never touches your save**: no Gold or items move, and Collect only clears
the fake escrow. A ribbon on screen says so. Reload to reset.

### Read cost: the list is one document

`board$` reads **one** document, `market/v1/summary/board`, through
`MarketBackend.watchSummary()`. It used to hold two collection listeners
(every open order, limit 400, and every price doc, limit 200), so each order
or trade write was re-read by every open Exchange, and a fresh visitor paid up
to 600 reads on arrival. Now a visitor pays 1 read on arrival and 1 per market
write. Depth (`book$`: two listeners, 50 per side), `price$` and `trades$` are
opened only for the item the player selects.

How the server keeps it right (`functions/src/market/summary.ts`, called from
`placeOrder` and `cancelOrder` inside their transactions):

- **Best bid / ask** are recomputed from orders the transaction already reads.
  A placement reads the resting side 50 deep and consumes at most 25, so the
  next best is always in hand; it also reads the top order of its own side
  (one extra read). A cancel reads the top two of its side.
- **Depth** (`bidQty` / `askQty`) moves by the exact delta of the change.
  Whenever a read covers a whole side (fewer orders than the limit came back),
  that side is recomputed from the read instead, so any drift heals.
- **Last price, 24h volume and VWAP** are copied from the item's price doc when
  it trades. They are "as of the last trade": nothing rewrites a row when its
  trades age out, so `boardFromSummary` treats them as 0 once `lastTradeAt` is
  a day old.
- **Pruning:** every write drops rows with nothing resting and no trade in the
  last day. The catalogue has ~280 goods, so the doc stays far under 1 MB.

**Write cost:** one extra doc read and write per placement or cancel. The doc
is a deliberate hotspot: every market transaction touches it, so sustained
throughput is bounded by Firestore's per-document write rate (about one write
a second sustained; bursts are fine). If the market outgrows that, shard it by
itemKey hash into `summary/board-<n>` and have the client merge the shards.

**Rules:** `match /summary/{summaryId}` allows `get` on `board` only (proposed
rules, not deployed). **Indexes:** none; the two collection queries it replaced
were the only users of their automatic indexes.

The dev fake builds the same document from its in-memory book with
`summarizeMarket`, so `?market=fake` exercises the same code path.

### Tests

- `src/app/shared/exchange/player-exchange.model.spec.ts` (18 specs) covers:
  - fee math and rounding
  - default prices and their fallbacks
  - Max caps and book depth
  - the error copy for every reason
  - `boardFromSummary` / `summarizeMarket`, including stale 24h figures
  - `resolveMarketMode`, including "never fake outside dev mode"
- The service spec checks that the list opens only the summary listener and
  that depth listeners open only for the item opened.
- `npm --prefix functions test` (33 cases) adds the summary: best prices and
  depth held against a from-scratch recount through placements, sweeps,
  partial rests and cancels; no write on a refused placement; pruning; drift
  healing. The suite pins `mat:cinder-ore` and `eq:anchor-ring:rare` at their
  v2 base worths (420 / 12,000): the v3 economy regenerated the reference table
  (25 / 720) and every fixture price had fallen out of band.
