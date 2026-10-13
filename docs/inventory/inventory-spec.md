# Inventory: stacks, a satchel with limits, and the Vault

Status: **design spec, not built.** Written 2026-10-13 against `origin/main` `60da5dc`.
No app code changed in this branch. The only code change is a new
`--inventory` scenario in `scripts/economy-sim.mjs`, which produces every
price and pile-up number below:

```
node scripts/economy-sim.mjs --inventory --days=7
node scripts/economy-sim.mjs --inventory --days=1
```

The owner asked for this on 2026-10-13: *"the inventory manager needs to be
improved, we need to add limits to it, and things need to stack, because when
forging, like the runes, they pile up and can't even find an item; we need
inventory management like POE2 does with the inventory slots they sell."*

The manager had already decided these points, and this spec designs within them:

- Identical stackables stack up to a cap per type. Items with their own rolled
  stats stack only when they are truly identical; otherwise they're grouped and sorted.
- The satchel has a fixed number of slots. Overflow is never destroyed.
- The stash has POE2-style affinity tabs, with sort and search on every tab.
- Extra satchel slots and stash tabs cost in-game Gold, never real money.
- Slots, not Tetris shapes. Stations follow the "for dummies" rule with the
  MapleStory-journal layout.

**Deviation, flagged.** Stackables (materials, sigils, supplies) are **placed
by rule, not dragged by hand**. Each stackable has one account-wide quantity,
the same number the ledger already stores. Whether it shows in the satchel, a
Vault tab or Overflow is *computed*. §2.4 explains why. In short, it needs no
new stack data, no migration and no move ops, so a cloud merge can't duplicate
or lose anything. Every bench already reads the total, so nothing has to be
"taken out" before crafting. Instances (gear and charms) do move by hand,
POE2-style.

---

## 1. Current state, measured

### 1.1 Where items live today

| Store | Blob (synced) | Writer | Shape |
|---|---|---|---|
| **Inventory ledger** | `godforge-inventory` → `users/{uid}/progress/inventory` (one Firestore doc) | `InventoryService` (`src/app/shared/rpg/inventory.service.ts`) | `InventoryLedger` v2, `era 55` (`inventory.model.ts`): `records[]` (instances and stack rows), `tombstones[]` (max 256), `stackOps[]` (max 256, compacted into `stackCheckpoints`), `hlc` |
| Instance record | n/a | n/a | `OwnedItemInstance`: rolled `stats`, frozen `rollQuality`, `sellValue` + `econ` marker, `sockets`, temper/reforge fields, and `location` |
| Stack row + ops | n/a | n/a | `OwnedItemStack` (`stack:<key>`, location always `bag`). The quantity is **derived** from grant/consume ops, which are unioned by op id |
| **Rune ledger** | `godforge-runes` | `RuneForgeService` | `runes: Record<runeId, count>`. This is already a count and it never piles up |
| Runewords, artifacts, cosmetics | `godforge-economy` | `EconomyService` | id lists, which are projected read-only |
| Delve chest contents | `godforge-delve` (chests) | `DelveChestService` | Material counts per chest (moved by consume/grant on the ledger). Gear stays in the ledger at holder `delve-chest:<born>` |
| Market escrow | `market/v1/escrow/{uid}` (server, **not deployed**) | `functions/src/market` | A listing removes the item from the save (a tombstone with a one-year lead, or a consume op). Claims come back through `collect` |

An instance's `location`:

| `location` | Meaning | Counts toward the 250 today? |
|---|---|---|
| `{kind:'bag'}` | in the satchel | yes |
| `{kind:'equipped', slotId}` | worn by the Keeper | **yes** |
| `{kind:'explorer', explorerId:'exp-…'}` | worn by an explorer | **yes** |
| `{kind:'explorer', explorerId:'thr-…'}` | worn by a Thrall (the memory note "item owner ids are not all explorers") | **yes** |
| `{kind:'explorer', explorerId:'delve-chest:<born>'}` | gear stored in a Delve chest | **yes** |

The cap is `INVENTORY_BAG_CAP = 250` **records with `source:'inventory'`**,
counted across all of those locations and stack rows together (`usedRows`).

### 1.2 Why runes pile up, and why it's worse than clutter

Every rune find mints a **second object**. `RuneForgeService.mintFor`
(`rune-forge.service.ts:398`) runs on every strike and every expedition rune
grant. It adds a `"<Rune> Sigil"` instance to the satchel (`mintRuneItem`,
`item.model.ts:746`), or a charm 0.24% of the time. The sigil has **empty
stats, no roll and no sockets**. The only difference between two Ash Sigils is
their id and timestamp, yet each one takes a satchel row. The Rune Forge sells
Strike ×10 / ×100 / ×1000 (`rune-reel.ts BULK_ROLLS`), at 600 Gold a strike,
which is under a minute of income from about 30 minutes in.

When the 250th record lands, `InventoryService.add()` **destroys** the
lowest-sell-value unequipped item to make room (`lowestValueUnequipped`,
`inventory.service.ts:1170`). `mergeInventoryLedgers` does the same on every
cloud merge (`evictRecordsToCap`, `inventory-ops.ts:547`). A Common Sigil sells
for 300. Common and Uncommon gear scrap sells for 36–150 (×0.5–1.5 for
quality). **So the low-value gear is destroyed first, and the sigils survive.**
Nothing tells the player. Losses elsewhere today:

- **Expedition materials** are silently dropped when a new stack row hits the
  cap (`explorer.service.ts:617`).
- **Delve blocks** "crumble" (`side-scroller.component.ts:1406`).
- **Seamworks pickups** are refused (`pickupFull`).
- The Gambler / Exchange / Arena refund or refuse correctly.

### 1.3 Magnitude (simulator, v3 curve)

A session is one `active` segment of the sim's play schedule: 3 a day. The
profiles are how many strikes a session (the bulk buttons). `today` is the
current behaviour. `proposed` is §2.

| 7 days of play | finds | sigils | charms | today: rows / **destroyed** | proposed: sigil slots (cap 999) |
|---|---|---|---|---|---|
| light (×10 a session) | 210 | 209 | 1 | 210 / 0 | 6 slots |
| typical (×100) | 2,100 | 2,095 | 5 | 250 / **1,850** | 10 slots |
| heavy (×1000) | 21,000 | 20,950 | 50 | 250 / **20,750** | 34 slots |
| grinder (×1000 ×5) | 105,000 | 104,748 | 252 | 250 / **104,750** | 120 slots |

After **day 1**, a typical player (×100) is already at the 250 ceiling with 50
evictions. A heavy player (×1000) is at 250 with 2,750 evictions. In practice,
any save that has pressed ×100 or ×1000 a few times is a satchel of about 230
sigils plus whatever gear survived. That is the owner's "can't even find an
item", and it explains reports of gear disappearing.

No real player saves are available to this session. The sim plus the code path
above is the measurement. Slice S2 adds an opt-in console probe
(`inventoryCensus()`, see §6) so the owner can read his own save.

### 1.4 Every surface that lists items

| Surface | File | What it reads |
|---|---|---|
| Satchel book (in-world, `I`) | `play/side-scroller.component.{html,ts}` (`pockets`, `usedRows`, `.capacity`) | bag instances + stacks |
| HUD tally (ore / ember / edge) and Delve hotbar | `side-scroller.component.*` | `stackOf`, `snapshot.stacks` |
| Character → Bank tab | `shared/character/hub-bank.component.*` (search, sort, multi-select, Drop) | instances + stacks + rune ledger |
| Character → paper doll picker / charms | `shared/rpg/equipment-panel.component.ts` | `snap.bag` filtered by slot |
| Explorer / Thrall kit | `rpg/explorer-roster-panel`, `thralls/thrall.service.ts` | bag → owner id |
| Delve chest panel | `delve/delve-chest.service.ts`, chest view in the side-scroller | `snapshot.stacks`, `snapshot.bag` |
| Crafting Bench (have/need) | `crafting/crafting.gateway.ts`, `crafting-bench.component.ts` | `stackOf` |
| Enchanting Table (your gear) | `enchanting/enchanting-bench.component.ts` | bag + equipped |
| Temper / Reforge | `entity/temper-feedback.ts`, `rpg/item-reforge.ts` | items |
| Rune Forge (library, reveal) | `rune-forge/*` | rune ledger + the minted item |
| Gambler Sell tab / Till | `gambler/gambler.component.ts` | bag, `sellMany` |
| Exchange (sim) + player market | `exchange/exchange.service.ts`, `player-exchange.component.ts` | stacks + `sellableInstances` |
| Material Vendor (buyback) | `vendor/*` | `stackOf` |
| The four catalogues, from one definition | Collection Log, Gambler pool, Exchange board, art gate (the memory note "one definition fans out to four catalogues") | `ITEM_DEFINITIONS` (catalogue, not owned) |
| Header bag badge | `header/header.component.ts` (`bagCount` = `usedRows`) | count |
| Codex, Leaderboards (best roll), NPC dialogue | `codex.component.ts:361`, `leaderboard.service.ts:92`, `npc-dialogue.service.ts:181` | `snapshot.items` |
| "Carried by" names | `entity/entity-resolver.service.ts:416` | owner id → name |
| Admin | `admin/gm-data.service.ts` (`resetInventory`) | the whole ledger |
| Market server provenance | `functions/src/market/save-ops.ts` (`bagRoom`, `findListableInstance`) | cloud doc |

---

## 2. Model

### 2.1 Two kinds of thing

**Stackables** have no identity of their own. Two of them are the same thing.
- **Stack keys:** the existing op-derived stacks (`stackKey` = the material id),
  plus the new `sigil:<runeId>` keys.
- **Identical legacy instances:** these are treated as stackables by *identity
  key* (§2.2). They aren't converted.

**Instances** carry their own frozen roll: gear, charms and runeword items. Two
instances never merge. They're grouped and sorted.

### 2.2 What makes two things identical

```
identityKey(record):
  stack row                 → its stackKey
  instance, and ALL of:     → `sigil:<runeId>` when type === 'rune' and the definitionId is `rune:<Name> Sigil`
    stats is {} (no keys)        (resolves via RUNES by name); otherwise
    no rollQuality               `same:<definitionId>|<rarity>|<type>|<sellValue>`
    upgradeLevel 0 / absent
    reforgeCount 0 / absent
    no sockets (or all null)
    soulbound false
  anything else             → null (a unique instance: one slot, never merged)
```

Today the only things that pass the instance branch are legacy Sigils. The
rule is generic and safe: it never merges anything with a roll, a temper, a
reforge or a socket, and the memory note "item rolls carry a frozen grade" says
a grade is never recomputed. Merging is **display-only**. A legacy record is
never rewritten (§4).

### 2.3 Stack caps and slot classes

| Class | Which keys | Cap per slot | Vault affinity |
|---|---|---|---|
| **Material** | catalogued gathered and dropped materials (`material-catalog.ts`, `family:'material'`), elixirs | **999** | Materials |
| **Supply** | placeables in `terrain.ts PLACEABLES` (dirt and basalt blocks, torch, ladder, platform, chest, camp, supports, blast charge) | blocks **999**, crafted supplies **99** | Supplies |
| **Sigil** | `sigil:<runeId>` + legacy identical sigils | **999** | Runes |
| **Quest** | `kaels-hammer`, `godforge-fragment`, `shadow-root-cutting`, `rift-key` (a `QUEST_STACKS` set) | **takes no slot** (POE2's quest items don't either). Shown in a "Quest" strip | none |
| **Entitlement** | `storage:*` (§3) | hidden, no slot | none |
| **Instance** | gear (`eq()` → type `artifact`), charms, runeword items | 1 per slot | Gear |

The class comes from a pure `slotClassOf(key)`. Gear is classified by
`definitionFor(id).family` or by `type`, **never by `record.category`**:
`categoryOf` files every `eq()` wearable as `'artifacts'` (the memory note
"equipment was never sellable").

### 2.4 Slot counting and where things show

Capacity:
- **Satchel:** `40 + 8 × rows` (0–5 rows bought, max 80).
- **Vault:** the tabs in §2.5.
- **Overflow:** unlimited.

Slots are counted **only in the satchel and the Vault**. Equipped, explorer,
Thrall, Delve chest and market escrow hold items that **take no satchel slot**
(today they all count toward the 250).

**Instances are placed by their `location`** (moved by hand, or routed on
arrival, §2.6). The Vault reuses the existing opaque owner-id location (the
same mechanism as Thralls and Delve chests), so **there's no schema change**:

```
{kind:'explorer', explorerId:'vault:<tabId>'}     tabId ∈ general-1..4 | gear | supplies | overflow
```

**Stackables are placed by a pure function of the ledger**, so no data moves:

```
layoutOf(ledger, capacity) → { satchel: Cell[], tabs: Record<TabId, Cell[]>, overflow: Cell[], quest: Cell[] }
  1. satchelFree = satchelCap − (instances located 'bag' that aren't identical-grouped)
  2. for each stackable kind (stack-op quantity + count of its identical legacy instances in 'bag'),
     in this fixed order — Supplies, Sigils, Materials, then catalogue order, then key:
       a. affinity tab owned          → that tab (Runes / Materials: one cell per kind, no cap;
                                                  Supplies: needs ceil(qty/cap) of its 60 slots)
       b. else needs ceil(qty/cap) ≤ satchelFree → satchel (whole kind, never split)
       c. else a General tab with room → that tab
       d. else                         → Overflow
  3. quest keys → quest strip; storage:* → hidden
```

Two consequences, both deliberate:

1. **Benches, the Rune Forge, the Vendor, the Delve hotbar and the market read
   the total**, exactly as `stackOf` does today. Owning the Materials tab never
   strands ore away from the Bench. "Take out" doesn't exist for stackables.
2. **There's nothing to merge wrongly.** A stack kind can't be in two places,
   can't be double-moved by two offline devices, and has no op to compact. The
   placement is recomputed after every publish.

### 2.5 The Vault: tabs, affinities and routing

| Tab | Holds | Size | How you get it |
|---|---|---|---|
| **General I** | anything | 60 slots | free, from the start |
| **Runes** | every sigil kind (and shows the Rune Pouch: the rune ledger's counts, read-only) | one cell per kind, no cap | bought |
| **Materials** | every material kind | one cell per kind, no cap | bought |
| **Supplies** | placeables and elixirs (they **stay on the hotbar**, since that reads totals) | 60 slots | bought |
| **Gear** | gear, charms, runeword items | 120 slots | bought |
| **General II / III / IV** | anything | 60 slots each | bought |
| **Overflow** | anything that had nowhere else to go | unlimited, **take-out only** | always there; hidden while empty |

Affinity routing, POE2-style. An item sent to the Vault goes to the first one of these that applies:

1. its affinity tab, if owned and it has room;
2. else the first General tab with room;
3. else Overflow.

Sort and search work on every tab and in the satchel.

### 2.6 Arrival routing: no acquisition path can lose an item

One routine, `InventoryService.place(item, reason)`, used by every path that
creates or frees an instance:

```
place(instance):
  if satchel has a free slot → 'bag'
  else                       → vault route (§2.5) → toast "Satchel full — <name> went to your Vault (<tab>)."
                                                     or "… is waiting in Overflow."
```

Stack grants never route and never refuse for space. They only refuse on a
failed save, which is today's semantics, so a refused grant is retried by its
caller's idempotent id.

| Path | Today | Proposed |
|---|---|---|
| Monster / zone drops (materials) | refused at the 250 cap | `grantStack` always lands; placement is derived |
| Mining, gathering, Delve dig (blocks) | blocks "crumble" when full | always lands |
| Crafting outputs (bench, forge-craft, refine) | `add()`, can evict | `place()` |
| Rune strikes and expedition rune finds | sigil **instance** via `add()`, evicts | **`grantStack(sigil:<runeId>, 1)`, op id = the find's mutation id**; a charm uses `place()` |
| Expedition / mission rewards | materials silently dropped at the cap | stacks always land; items use `place()` |
| NPC quest and Collection rewards | `add()`, result ignored | `place()` |
| Gambler / Exchange buy / Arena shop | `add()`, can evict; refunded if refused | `place()`. Refused **before** the Gold is spent only at the record budget (§2.8) |
| Market collect (server, not deployed) | server waits when 250 records | server keeps writing `location: bag`; the client **settle** pass (§2.7) routes the excess. Server follow-up in §4.4 |
| Delve chest take (gear) | `unequip` → bag | `place()` |
| Unequip; explorer dismiss; Thrall release (they strip their kit) | → bag | `place()` |
| Admin | no item grants exist; `resetInventory` | entitlements are granted with `grantStack('storage:…', n, 'gm:<auditId>')`; `resetInventory` **skips `storage:*`** |
| Cloud merge (union of two bags) | `evictRecordsToCap` destroys | union, **no eviction**, then settle |
| v1 legacy load, `restoreDeviceSnapshot` | n/a | settle |

**Stowing isn't equipping.** Vault moves must **not** go through
`equipOnExplorer`, because that emits `equipped$`, and the Contract Board pays
"item equipped" for it. The world plan already notes this as a quirk of Delve
chests. Add a `stow(itemId, holder)` that writes the location without the
event.

### 2.7 Settle: the safety net that enforces the satchel cap

```
settle(ledger, capacity):   // pure; runs on load, on rehydrate (after every merge) and after place()
  over = bagInstances − satchelFreeForInstances
  if over ≤ 0: return ledger                                  // idempotent no-op
  move the `over` bag instances with the HIGHEST revision (the most recently written:
    a just-collected market claim, a just-unequipped helm, the newest of a merged bag)
    to the vault route, writing location + a stepped revision (the same write as equip)
```

This is merge-safe because it's the same single-field location write that
equip and unequip already make. Two devices settling different sets move
different items into the Vault. Nothing is lost or copied. It's the only
automatic write in the whole design.

### 2.8 Size budget (one Firestore document)

`users/{uid}/progress/inventory` is a single document, with a 1 MiB limit.
Measured record sizes:
- a tempered Rare gear record: **829 B**
- a sigil record: **525 B**
- a tombstone: about 110 B
- a stack op: about 160 B

| Part | Budget | Bytes |
|---|---|---|
| Instance records (all locations, Overflow included) | `INSTANCE_RECORD_BUDGET = 700` | about 580 KB |
| Tombstones | `INVENTORY_TOMBSTONE_MAX` **256 → 512** | about 56 KB |
| Stack ops + checkpoints | 256 + about 100 | about 47 KB |
| **Total** | n/a | **about 690 KB** |

Instance capacity at maximum is 80 satchel + 240 General + 120 Gear = 440, plus
Overflow. At the budget, Gold purchases that create an instance are refused
**before** the spend: "Your Overflow is very full. Sell or take things out
first." Non-purchase arrivals still land. They're rare: charms at 0.24% of
finds, quest and collection rewards, market collects.

Optional, not required: stop persisting `lore` on records, since it's derivable
from the definition. That saves about 20%.

---

## 3. Prices (on the v3 Gold curve)

Rule (S) from the rebalance spec: price each purchase as N seconds of income at
the stage where the player first needs it. Run `node scripts/economy-sim.mjs
--inventory --days=7`. Stage income: 30 m 2.5k/s, 1 h 20.7k/s, 1 d 887k/s,
3 d 77M/s, 7 d 167M/s.

| Purchase | Gold | First affordable (sim) | Seconds of income at 30m / 1h / 1d / 3d / 7d |
|---|---|---|---|
| Satchel +8 (41–48) | **200,000** | 26 m | 1m20s / 10s / <1s / · / · |
| Satchel +8 (49–56) | **5,000,000** | 8.0 h | 33m / 4m / 6s / · / · |
| Satchel +8 (57–64) | **1,000,000,000** | 13 h | · / 13.4h / 19m / 13s / 6s |
| Satchel +8 (65–72) | **100,000,000,000** | 1.4 d | · / · / 1.3d / 22m / 10m |
| Satchel +8 (73–80) | **5,000,000,000,000** | saving: 17.9 h of 3-d income, 8.3 h of 7-d income | late sink |
| Vault: Runes tab | **1,000,000** | 43 m | 6m42s / 48s / 1s |
| Vault: Materials tab | **1,000,000** | 43 m | 6m42s / 48s / 1s |
| Vault: Supplies tab | **25,000,000** | 8.0 h | · / 20m / 28s |
| Vault: Gear tab | **250,000,000** | 8.0 h | · / 3.3h / 4m42s |
| Vault: General II | **2,500,000,000** | 13 h | · / · / 47m / 32s |
| Vault: General III | **250,000,000,000** | 2.0 d | · / · / 3.3d / 54m / 25m |
| Vault: General IV | **25,000,000,000,000** | saving: 3.7 d of 3-d income, 1.7 d of 7-d income | the top sink, deliberately past the first Eclipse |

"First affordable" uses the simulator's own rule: banked, or ≤ 60 s of income.
The sim player is greedy and spends everything on income, so a player who saves
gets each one sooner.

How the numbers line up with existing gates:
- **Row 1 / Runes / Materials** sit beside the explorer slot (50k, 18 m) and the Thrall slot (2M, 53 m). They're the end of the first session.
- **Rows 2–3 / Supplies / Gear / General II** sit with the Home Anvil tiers II–III (5M at 8 h, 1B at 13 h). That's day one.
- **Row 4 / General III** fall on days 1.4–2.
- **Row 5 / General IV** are the late sink beside Home Anvil IV (1T at 2.4 d) and the Eclipse (10T at 3.4 d).

The whole ladder costs about 30.4T, about two days of 7-day income.

**Purchases are permanent.** They survive the Eclipse, which clears
`economy.upgrades`. Otherwise every prestige would dump the satchel into
Overflow. That's why they **aren't** Market upgrades.

**Storage.** Each purchase writes two things: a `spend-gold` op (an existing
kind, which old clients replay correctly) and a `grantStack('storage:<id>', 1,
'<mutationId>')` entitlement in the inventory ledger. The entitlements are
`storage:satchel-row` (quantity = rows, read as `min(5, qty)`) and
`storage:tab:<tabId>` (owned when qty ≥ 1).

Both are idempotent by id and union-merge. If the grant fails to save, the
spend is refunded with `credit-gold`, which is the Gambler's pattern.

There's one rare edge: two devices offline both buy the same tab. Both spend,
and the tab is granted once. That's the same class as any concurrent offline
spend, and it's accepted.

**First-hour check.** A player who follows the four goals (forge + equip the
Basalt Edge, the Torch craft, a Rivet Maw, a dig) holds about:
- 2 materials (ore, ember)
- 2–3 supplies (torches, dirt and basalt blocks)
- 0–6 sigil cells, if they press ×10–×100 (5 common rune kinds; the sim's
  typical player has 6 cells after 300 finds and 10 after 2,100)
- 0–3 zone materials
- a handful of Gambler pieces

That's **12–25 of 40**. Equipped items and quest items take no slot. Hitting
40 in the first hour means opening Gambler chests nonstop. At that point the
200k row (26 m) or the "Sell junk" button is the intended answer, and nothing
is lost. Slice S5 pins this with an e2e: after the four goals, satchel used ≤ 20.

---

## 4. Migration

### 4.1 What changes in stored data

**Nothing is converted.** That's how this design meets "versioned, idempotent,
merge-safe": the version is in the code, not the data.

| Data | Change |
|---|---|
| Inventory ledger schema | unchanged: still `version: 2`, **`era` unchanged at 55** (bumping era makes the merge discard the lower side *whole*, and the market server refuses any other era) |
| Legacy sigil instances | **left as they are**. Shown as stacks by identity key (§2.2). New finds go to `sigil:<runeId>` ops. Selling or using from a sigil stack spends legacy records first (through the existing `sell` path, which writes tombstones), then ops |
| Satchel over capacity | **settle** (§2.7) moves the excess bag instances to the Vault (General I) and then Overflow. It's a location write with a revision step: exactly an "equip", merge-safe, deterministic on each device, and convergent across devices |
| Stackables over capacity | nothing to move. Placement is derived, and the excess shows in a General tab or Overflow |
| Purchases | new `storage:*` stack ops; absent means base capacity |
| `INVENTORY_LAYOUT = 1` | a code constant naming the rule set (`inventory-layout.ts`). A future change to placement rules bumps it. Since placement is recomputed, nothing on disk needs converting |

Every save that's over the new cap is grandfathered. No item is deleted. Settle
only ever writes `location`. A save with 250 records (about 230 sigils plus
gear) loads as:
- about 6 sigil cells (grouped)
- its gear: if more than 40 minus the stack slots, the newest-written go to General I and then Overflow
- a one-time notice: "Your satchel now has 40 slots. We moved 37 things to your Vault. Nothing was lost."

### 4.2 Both sides of the cloud merge

- `mergeInventoryLedgers` stays a pure union. **`evictRecordsToCap` is
  deleted**, so a merge never tombstones a live record again.
- Settle runs in `InventoryService` on load and in the registered `rehydrate`,
  the same place `restoreCharms` runs. It runs after the gateway has merged and
  written, so it acts on the merged ledger and pushes its location writes
  through the normal dirty-flush.
- Tests run the merge in both argument orders, followed by settle, and the
  result must match.

### 4.3 The mixed-version window (main risk)

A client from before S2 still has two eviction paths: in `add()` and in the
merge. Two things make it destroy items:
- the record total goes past 250 (Vault and Overflow records count for it, and
  they're location `explorer`, so they're protected; the loose **bag**
  instances are the victims);
- it mints sigil instances.

Mitigations:
1. **S2 ships first and soaks for at least one release before S4.** S2 stops
   all eviction and stops minting sigil instances. S4 is the slice that lets
   total records pass 250.
2. The service-worker "new version — Reload" prompt (in flight per the world
   plan) must be live before S4, so long-open tabs and the installed PWA update.
3. Old clients ignore the `storage:*` keys and the `vault:*` owner ids
   harmlessly. They show `storage:*` as raw-id rows, which is cosmetic and
   transient.

### 4.4 Player market (server follow-ups, **not changed here**)

The market functions read the cloud save. They need three changes **before the
market is deployed** (it's flagged off today):

1. `bagRoom()` (`functions/src/market/save-ops.ts:162`) counts every record
   against 250. With the Vault, records can pass 250 and **instance claims
   would wait forever**. Change it to "always deliver at `location: bag`". The
   client settles the excess. Keep the record budget (700) as the only refusal.
2. `findListableInstance` requires `location.kind === 'bag'`. Also accept
   `explorer` holders that start with `vault:` (idle storage), or the client
   shows "Take it out of the Vault to sell it". The client does the latter
   until the server changes.
3. Regenerate `reference.generated.ts` when `INVENTORY_BAG_CAP` is retired
   (`scripts/generate-market-reference.mjs` exports it).

What stays the same:
- Provenance on stacks is unchanged, since stack keys are unchanged.
- `storage:*` keys have no market (they aren't in `REFERENCE_GOODS`).
- `sigil:*` keys have no market (runes never did).
- Escrow tombstones (one-year lead) and consume ops are untouched by settle.
  Settle never writes stack ops, and never resurrects or moves a tombstoned id.
- `market-protocol.spec.ts` gains one case: after a listing tombstone and a
  collect, settle plus a merge in both orders keeps conservation.

### 4.5 Other blobs

No new localStorage key, so `SYNCED_BLOBS` is unchanged (see the memory note
"Godforge state lives in many blobs"). Every write goes through `InventoryService`
and the gateway. Settle runs inside `rehydrate` in the same tick as the read,
so the memory note "pagehide flush clobbers fresh writes" doesn't apply.

---

## 5. UI

The rule is the memory note "stations must be dummy-simple": one sentence, one
big button with its cost, and a plain reason when it's off. Everything else
goes behind **Details**. The layout follows the MapleStory journal.

### 5.1 Satchel (the existing book, `side-scroller` + Character → Bank)

**Desktop (≥ 901 px), the book beside the HUD strip:**

```
┌ SATCHEL ─────────────────────────────── [Close] ┐
│ 23 / 40 slots  ▓▓▓▓▓▓▓▓░░░░░   Overflow 3 ●     │  ← bar; amber dot when Overflow has things
│ [All] [Gear] [Materials] [Supplies] [Runes]  🔍  │  ← filter chips + search (type to filter)
│ Sort: Newest ▾                                   │
│ ┌──┬──┬──┬──┬──┬──┬──┬──┐                         │  8 columns
│ │⚔ │⛏ │🔥│▒ │ ✦│ ✦│  │  │  stack cells show 1.2k │
│ └──┴──┴──┴──┴──┴──┴──┴──┘                         │
│ Worn ▸ (wells, as today)    Quest: Kael's Hammer │
│ ── slip ─────────────────────────────────────── │
│ [art] Iron Helm · Rare · grade 71%               │
│ [ Wear ]   (Details: Send to Vault · Sell · Drop) │
└──────────────────────────────────────────────────┘
```

- Grouping comes from the sort. Same-definition gear sits together (name →
  rarity → grade). Identical items are already one cell.
- One primary action per item:
  - gear: **Wear**
  - supply: **Place** (hotbar)
  - sigil: **Sell 999 · 299,700 Gold**
  - material: **Used by the Bench** (no button)
- Secondary actions (Send to Vault, Sell, Drop) go behind Details.
- "Send to Vault" works **from anywhere**. You deposit anywhere and pick up at
  the Vault.

**Phone (≤ 900 px, Terraria HUD, `docs/handoff/mobile-hud.md`):** the existing
44 px satchel button in the top band. Its badge shows `used/cap`, plus an amber
dot when Overflow has things. Tapping it opens the book as a sheet between the
top band and the touch row:
- **6 columns**, cells ≥ 52 px
- filter chips scroll horizontally
- 🔍 expands to a search field
- the slip docks at the bottom, with its one button at full width

### 5.2 The Vault station: Infernal, Basalt Seamworks

Why the Seamworks (the world plan's "each page lives in exactly one town"):
- The Rune Forge, Crafting Bench, Enchanting Table and the Delve shaft are all
  here, which is where sigils, ore and blocks pile up.
- The first-hour loop runs here.

Placement: a `StationDef` `{ id: 'vault', kind: 'panel', panel: 'vault' }` at
x ≈ 1075, between the Seamworks Forge (930) and the Crafting Bench (1220).
Check the spacing against `play-life.spec`'s keeper placement.

It's world-only like the Vendor: a `PanelId` `'vault'` plus a `PANEL_REGISTRY`
row with **no standalone route**, so no nav-audit or prerender surface. The
`?at=vault` deep link and the Places list come for free. Character → Bank gets
a read-only "Vault" view: "Visit the Vault in the Seamworks to take things out."

Layout (station-ui kit):

```
app-station-shell  title "Vault"  purpose "Keep what you don't carry. Benches use what's stored here."
 [stationWallet]  1,234,567 Gold
 [stationTabs]    Satchel · General I · Runes 🔒 · Materials 🔒 · Supplies 🔒 · Gear 🔒 · General II 🔒 … · Overflow (3)
 [stationSkill]   VAULT  37 / 60 slots ▓▓▓▓▓░░          (Satchel tab: SATCHEL 23 / 40)
 [stationHero]    journal: list (grid of cells, search + sort on top) | detail
                    detail head: big icon, name, count/grade
                    ONE button:
                      instance in a tab      → "Take out"           | blocked: "Satchel full — make room first"
                      instance in Satchel tab→ "Send to Vault"
                      stack anywhere         → "Sell 999 · 299,700 Gold"  + line "Benches use these from here."
                      locked tab selected    → "Buy Runes tab · 1,000,000 Gold" | "Need 300,000 more Gold"
                      Satchel tab, no pick   → "Add 8 slots · 200,000 Gold"     | "Satchel is at its largest"
 [stationDetails] Send all gear to Vault · Send all from satchel by type · sort options ·
                  how routing works · Overflow explainer · prices of every row/tab
```

- A locked tab shows only its price button and one line: "Runes you find go
  straight here, and stop filling your satchel."
- The Overflow tab is hidden while empty. When it has things: "Things wait here
  when your satchel and Vault are full. They're safe. Take them out when you
  have room."

### 5.3 Auto-route feedback

- Loot flights still fly to the satchel button. When the item was routed, a
  0.6 s "→ Vault" chip pops beside the button.
- One message line (a phone toast, the desktop objective line). It's throttled:
  the first routed item names itself, and the rest of a burst is summed ("+12
  more sent to your Vault").
- A Rune Forge reveal with a sigil routed to the Runes tab says nothing extra.
  It's the normal place.
- The settle notice appears once per settle that moved anything.

### 5.4 Copy (EN / ES)

New lazy table `src/app/shared/vault/vault-station.i18n.ts`, namespace
**`vault.*`**. Satchel additions go in the existing lazy `hud.i18n.ts` under
`play.hud.book.*`.

Don't add an `inventory.*` namespace. With one, every backticked
`inventory.service.ts` in the code comments becomes a missing key, and that
fails the build (see the memory note "i18n check reads backticked filenames").
Name files `vault-station.*`, never `vault.*.ts`.

| Key | EN | ES |
|---|---|---|
| `vault.title` | Vault | Bóveda |
| `vault.purpose` | Keep what you don't carry. Benches use what's stored here. | Guarda lo que no llevas. Los bancos de trabajo usan lo que hay aquí. |
| `vault.tab.satchel` | Satchel | Morral |
| `vault.tab.general` | General {n} | General {n} |
| `vault.tab.runes` | Runes | Runas |
| `vault.tab.materials` | Materials | Materiales |
| `vault.tab.supplies` | Supplies | Suministros |
| `vault.tab.gear` | Gear | Equipo |
| `vault.tab.overflow` | Overflow | Desborde |
| `vault.strip.vault` | Vault | Bóveda |
| `vault.strip.satchel` | Satchel | Morral |
| `vault.slots` | {used} / {cap} slots | {used} / {cap} huecos |
| `vault.act.takeOut` | Take out | Sacar |
| `vault.act.send` | Send to Vault | Enviar a la Bóveda |
| `vault.act.sendAllGear` | Send all gear to the Vault | Enviar todo el equipo a la Bóveda |
| `vault.act.sell` | Sell {n} · {gold} Gold | Vender {n} · {gold} de oro |
| `vault.act.buyTab` | Buy {tab} tab · {gold} Gold | Comprar pestaña {tab} · {gold} de oro |
| `vault.act.buyRow` | Add 8 slots · {gold} Gold | Añadir 8 huecos · {gold} de oro |
| `vault.why.needGold` | Need {gold} more Gold | Te faltan {gold} de oro |
| `vault.why.satchelFull` | Satchel full — make room first | Morral lleno: haz sitio primero |
| `vault.why.maxRows` | Your satchel is at its largest | Tu morral ya es del tamaño máximo |
| `vault.why.budget` | Your Overflow is very full. Sell or take things out first. | Tu Desborde está muy lleno. Vende o saca cosas primero. |
| `vault.line.benches` | Benches use these straight from here. | Los bancos los usan directamente desde aquí. |
| `vault.line.locked.runes` | Runes you find go straight here and stop filling your satchel. | Las runas que encuentres vendrán aquí y dejarán de llenar tu morral. |
| `vault.line.locked.materials` | Materials go straight here and stop filling your satchel. | Los materiales vendrán aquí y dejarán de llenar tu morral. |
| `vault.line.locked.supplies` | Blocks and torches stay on your hotbar but stop taking satchel slots. | Los bloques y antorchas siguen en tu barra, pero ya no ocupan huecos del morral. |
| `vault.line.locked.gear` | 120 slots just for gear and charms. | 120 huecos solo para equipo y amuletos. |
| `vault.line.locked.general` | 60 more slots for anything. | 60 huecos más para lo que sea. |
| `vault.line.overflow` | Things wait here when your satchel and Vault are full. They're safe. Take them out when you have room. | Aquí esperan las cosas cuando tu morral y la Bóveda están llenos. Están a salvo. Sácalas cuando tengas sitio. |
| `vault.line.readOnly` | Visit the Vault in the Seamworks to take things out. | Visita la Bóveda en los Talleres de Basalto para sacar cosas. |
| `vault.pouch.title` | Rune Pouch | Bolsa de runas |
| `vault.pouch.line` | Runes for Runewords and sockets. | Runas para palabras rúnicas y engarces. |
| `play.hud.book.slots` | {used} / {cap} slots | {used} / {cap} huecos |
| `play.hud.book.filter.all` | All | Todo |
| `play.hud.book.filter.gear` | Gear | Equipo |
| `play.hud.book.filter.materials` | Materials | Materiales |
| `play.hud.book.filter.supplies` | Supplies | Suministros |
| `play.hud.book.filter.runes` | Runes | Runas |
| `play.hud.book.search` | Search your satchel | Buscar en el morral |
| `play.hud.book.sort.newest` | Newest | Más nuevo |
| `play.hud.book.sort.name` | Name | Nombre |
| `play.hud.book.sort.rarity` | Rarity | Rareza |
| `play.hud.book.sort.value` | Value | Valor |
| `play.hud.book.quest` | Quest | Misión |
| `play.hud.book.overflowDot` | {n} waiting in Overflow | {n} esperando en el Desborde |
| `play.hud.msg.routedVault` | Satchel full — {name} went to your Vault ({tab}). | Morral lleno: {name} fue a tu Bóveda ({tab}). |
| `play.hud.msg.routedOverflow` | Satchel and Vault full — {name} is waiting in Overflow. | Morral y Bóveda llenos: {name} espera en el Desborde. |
| `play.hud.msg.routedMore` | +{n} more sent to your Vault | +{n} más enviados a tu Bóveda |
| `play.hud.msg.settled` | Your satchel now has {cap} slots. We moved {n} things to your Vault. Nothing was lost. | Tu morral ahora tiene {cap} huecos. Movimos {n} cosas a tu Bóveda. No se perdió nada. |
| `play.hud.chip.toVault` | → Vault | → Bóveda |

The Spanish is machine-written. It needs the same native review the HUD copy
is waiting on. Retire `play.hud.msg.crumbles` and `play.delve.bagFullTake`
(the Delve take-back now always lands). Keep `pickupFailed` for a failed save.

---

## 6. Build plan

Each slice merges on its own. It runs the world plan's gate (engine tests,
`check-ds-adherence`, `check-i18n-keys`, `audit-nav`, `ng build`), gets a look
in a production build, and ticks its line in `docs/roadmap/world-plan.md`.

| # | Slice | Owns (files) | Tests | Est. |
|---|---|---|---|---|
| **S1** | **Pure layout model.** `inventory-layout.ts`: `identityKey`, `slotClassOf`, caps, `capacityOf(entitlements)`, `layoutOf`, `routeFor`, `settle` (pure, ledger in → ledger out), `INVENTORY_LAYOUT`, `INSTANCE_RECORD_BUDGET`. No caller changes | `src/app/shared/rpg/inventory-layout.ts` (+ spec) | Karma: identity never merges a rolled, tempered, reforged or socketed item. The placement is deterministic and order-free. Settle is idempotent, only writes `location`, and moves the highest revision first. **Property test:** random ledgers + merge both orders + settle conserve the multiset of (id, stackKey qty) | 1 d |
| **S2** | **Stop destroying things; runes stack** (ship first; soak ≥ 1 release before S4). Remove eviction from `add()` and the merge. `grantStack` never refuses for space. Tombstone max 512. Rune finds → `grantStack('sigil:<runeId>', 1, findMutationId)`. Legacy sigils are grouped by identity key in `snapshot` (new `cells` view). `sellStack(key, n)` spends legacy records first, then ops. The Collection wiring maps `sigil:*` → the rune's discovery (or skips it), never a raw key. Satchel book and Bank render grouped cells. Add the `inventoryCensus()` dev probe | `inventory.service.ts`, `inventory-ops.ts`, `inventory.model.ts` (constants only), `rune-forge.service.ts` (`mintFor`), `collection-wiring.service.ts`, `explorer.service.ts` (no silent drop), `side-scroller.component.ts` (block grant and pickup copy), `hub-bank.component.*` | Karma: 300 adds keep 300 records; merge of 2×250 keeps 500; a strike adds no record; a ×1000 strike → ≤ 5 new stack rows; selling a legacy-sigil cell. Existing `inventory-*`, `rune-forge*`, `market-protocol` specs green. e2e: update `inventory-ux`, `play-delve` (no crumble) | 1.5 d |
| **S3** | **Entitlements + prices.** `STORAGE_CURVE` in `economy-curve.ts`. `StorageService.buy(id)` = `spendGold` → `grantStack('storage:…')`, refunded with `credit-gold` on failure. `storage:*` is already hidden by S1's `entitlement` class; its `dropStack` refusal lands in S2 (which owns the service); `resetInventory` skips it. The sim reads `STORAGE_CURVE` (delete its local table) | `economy-curve.ts`, `shared/vault/storage.service.ts`, `admin/gm-data.service.ts`, `scripts/economy-sim.mjs` | Karma: buy is idempotent per mutation id; a refund on a failed grant; a replay on a second device; it survives `prestige()`. node: `economy-sim --check` + `--inventory` | 1 d |
| **S4** | **The satchel limit + Vault data.** Capacity from entitlements. `place()` routing in every path of the §2.6 table. `stow()` with no `equipped$`. Settle on load and rehydrate. Purchases refused at the budget. `vault:*` owner ids resolve to names ("In your Vault · Gear") | `inventory.service.ts`, `gambler.service.ts`, `exchange.service.ts`, `arena.gateway.ts`, `npc-quest.service.ts`, `collection.service.ts`, `crafting.gateway.ts` / `forge-craft.gateway.ts`, `delve-chest.service.ts`, `thrall.service.ts`, `explorer-roster.service.ts`, `entity-resolver.service.ts` | Karma: each path routes when full; settle after merge (both orders); the "item equipped" challenge is not paid for a stow; `init()` publish-loop guard spec (see the memory note "init() publish loops crash the tab"). e2e: seeded full satchel → a drop lands in the Vault with a toast | 2 d |
| **S5** | **Vault station + satchel UI.** `PanelId 'vault'` + registry row; the Seamworks `StationDef`; `VaultStationComponent` on the station kit; satchel book filters, search, sort, slot bar, Overflow dot, phone sheet; buy buttons; `vault-station.i18n.ts` + `hud.i18n.ts` keys | `play/world/world.model.ts`, `panel-registry.ts`, `towns/infernal.ts`, `shared/vault/vault-station.component.*`, `side-scroller.component.{html,css,ts}`, `hud.i18n.ts` | e2e (chromium + webkit, 375×812 and 1280×800): **first session ≤ 20 slots used after the four goals**; a legacy 250-record save loads with nothing lost and the settle notice; buy the Runes tab → sigils leave the satchel; Take out / Send; search filters; every control ≥ 44 px; primary button on the first phone screen; word count ≤ 60. `play-life` keeper spacing; `audit-nav` (Places list) | 2.5 d |
| **S6** | **Surface sweep.** Gambler Sell / Till, Exchange sell (bag only + "Take it out of the Vault to sell it"), Enchanting / Temper / Reforge lists (bag + equipped; Vault items show a hint), Character Bank read-only Vault view, Delve chest panel, header badge `used/cap` | listed components | Karma + `gambler-exchange-journal`, `c4-character`, `play-delve-extras` e2e updates | 1.5 d |
| **S7** | **Server follow-ups** (separate approval; ships with the market deploy): §4.4 items 1–3 | `functions/src/market/save-ops.ts`, `reference.generated.ts` | `npm --prefix functions test` + new cases: collect past 250 records, list from `vault:` | 0.5 d |

**Order:** S1 → S2 → (soak) → S3 → S4 → S5 → S6. S7 must land before the market
is turned on. S3 can go in parallel with S2 because its files don't overlap.
Total is about 10 days.

**Risks:**

1. **Old clients evict** (§4.3). This is the reason S2 soaks first and why the
   service-worker reload prompt is a prerequisite for S4.
2. **The Firestore 1 MiB document limit** (§2.8). The record budget and the
   tombstone max are sized for it. Add a Karma size test on a maxed fixture.
3. **Silent catalogue drift** (the memory note "one definition fans out to four
   catalogues"). A new material or placeable with no `slotClassOf` entry
   defaults to Material. A spec walks `MATERIAL_NAMES` + `PLACEABLES` +
   `ITEM_DEFINITIONS` and asserts each class.
4. **The i18n namespace trap** (§5.4).
5. **Stows paying "item equipped"** (§2.6).
6. **The pane can't advance transitions**, so the slide-in sheet must be checked
   in a real build (the memory note "browser pane transitions never advance").
7. **Fixed-corner collisions.** The Overflow dot lives *inside* the satchel
   button, never as a new fixed widget (the memory note "fixed corner widgets collide").
8. **Two offline devices buying the same tab** pay twice (§3). Accepted.

---

## 7. Open question for the owner (one)

- **The Vault's keeper role title.** Proposed: **"Vault Clerk"** (ES "Empleado
  de la Bóveda"). Role titles have gone through the owner (11 were approved on
  2026-10-13). The station can ship without a keeper if this waits.

Everything else above is a manager decision already taken: the prices, the tab
set, the Seamworks location, derived placement and the sigil stacking.

---

## Shipped (2026-10-13): S1–S4, with two manager changes

Branch `worktree-agent-aa2feecccbf275e26`. Two decisions arrived mid-build and
override the text above:

- **Zero players, so no back-compat.** The S2 soak, the grandfathering notice
  and the "display old Sigils as stacks" rules (§4.1, §4.3) were dropped, and
  S3 + S4 shipped in the same branch.
- **Sigils are gone, not stacked** (meaning audit). A rune find mints no item
  at all. The rune is the find, and it lands in the Rune Forge ledger, which
  the reveal, library, Runewords and sockets already read. The 0.24% charm
  still lands.
  - **Legacy Sigil records are tombstoned on load** (`dropLegacySigils`). A
    legacy Sigil is a record with `type 'rune'`, named `<Rune> Sigil`, with no
    stats, no roll grade, no temper or reforge, and no socket. Anything that
    carries a grade is never touched.
  - **Removed with them:** the `sigil` slot class, the `sigil:*` keys, the
    **Runes Vault tab** and its 1M price, `mintRuneItem`, and the Sigil sell
    path.
  - **One consumer depended on Sigil records:** the NPC objective "hold an item
    of epic / mythic quality" (`verrin-3`, `merchant-5`). A rune's Sigil met
    it, so it now also counts a held rune of that tier from the Forge ledger.

**S1: `src/app/shared/rpg/inventory-layout.ts`.** All pure functions:
`slotClassOf`, `stackCapOf`, `capacityOf(entitlements)`, `layoutOf`,
`routeFor` and `settle`, plus the constants `INVENTORY_LAYOUT = 1`,
`INSTANCE_RECORD_BUDGET = 700` and `VAULT_LIVE`. Departures from §2:

- **Instances outrank stacks for space everywhere** (a simplification of §2.4).
  A stack is placed only after every instance, so routing counts instances only,
  and `settle` holds bag instances to `capacity.satchel`.
- **The §2.2 identity key was not built.** Nothing is left for it to group.
- **Supply keys are a copied list,** pinned to `PLACEABLES` by the spec. A copy
  keeps the bag from pulling the Delve engine into the initial bundle.

Property test: 40 random device pairs are merged in both orders and settled.
Every instance id and every stack total is conserved.

**S2: nothing is deleted for space.**

- `evictRecordsToCap` and `lowestValueUnequipped` are gone. `add()` and
  `mergeInventoryLedgers` never tombstone for space.
- `grantStack` never refuses for space; it refuses only on a failed save. So the
  Delve "crumble", the explorer material drop and `pickupFull` can no longer
  trigger. Their copy is left for S5, because those files are being edited
  elsewhere.
- `INVENTORY_TOMBSTONE_MAX` is now 512.
- The local stack-op log is compacted on every write (`compactStackOps`, the
  same fold a merge does).
- `inventoryCensus()` is on `window` for reading a real save.

The only tombstone writers left are explicit player actions (sell, drop, a
shattering temper), the GM reset, and the one-time Sigil purge. No other path
deletes an item.

**S3: prices.**

- `STORAGE_CURVE` lives in `economy-curve.ts`, and `economy-sim --inventory`
  reads it.
- `StorageService.buy(id, mutationId)` spends the Gold, then grants
  `storage:satchel-row` or `storage:tab:<id>` under the mutation id. It refunds
  if the grant fails to save. It replays without charging when the grant op is
  already there, including one synced from another device.
- The GM bag reset keeps `storage:*`. Entitlements are hidden from the bag and
  can't be dropped.

**S4: the satchel and the Vault (gated).**

- Capacity comes from entitlements.
- `add`, crafts, `unequip`, `clearExplorer` and an equip-displace all call
  `settle`. An item arriving into a full satchel goes to Gear, then General,
  then Overflow. Load and rehydrate settle too.
- `stow(id, tab?)` and `takeOut(id)` write the location without emitting
  `equipped$`.
- Gold purchases (Gambler, Exchange, Arena gear, the crafting bench) are refused
  **before** the spend, and only at the 700-record budget.
- `vault:*` owners read "In your Vault" in Inspect.
- `snapshot.usedRows` now counts satchel slots used, not records.
  `snapshot.satchelCap` and `snapshot.overflow` are new.

**The gate: `VAULT_LIVE = false`.** There is no UI to take an item out of the
Vault until the S5 station exists. So for now live capacity is unbounded and
nothing is routed. Flip the flag with S5.

**Where the spec was wrong or underspecified**

1. §4.3 says S4 is "the slice that lets total records pass 250". S2's own tests
   (300 adds, a 2 × 250 merge) already pass 250. This no longer matters with
   zero players.
2. §2.3 puts elixirs in the Material class, but §2.5 lists them on the Supplies
   tab. Built per §2.3: elixirs are Materials.
3. §2.8 sizes stack ops at "256 + about 100" but doesn't say who compacts them.
   Only the merge did, so a device that never synced grew its op log without
   bound. The log is now folded on write. The fold keeps the old known limits:
   - An op one device never saw, from before another device's compaction
     watermark passed it, can't be recovered.
   - A replayed grant whose op was already folded counts a second time.

   Removing Sigils removed most of the op churn that would have exposed this.
4. §4.4's market follow-ups (S7) still stand. `INVENTORY_BAG_CAP` is kept only
   for `generate-market-reference.mjs`. `functions/` was not touched.

## Shipped (2026-10-13): S5, S6 and the compaction fix

Branch `worktree-agent-a2575ec9d43a353f8` (on top of S1–S4). `VAULT_LIVE` is
now `true`: the satchel holds 40 slots (+8 per bought row).

**S5: the Vault station.**

- **Where:** in-world only, like the Material Vendor. It has a `PanelId`
  `'vault'` and a `PANEL_REGISTRY` row, with no route. It stands at
  **x = 330, west of the Cinder Ore seam**. §5.2's x ≈ 1075 is taken by the
  Homestead gate, and no gap between the forge and the bench fits a station
  and its keeper. `?at=vault` and the Places list work as for any panel
  station.
- **Keeper:** the **Vault Clerk** ("Empleado de la Bóveda", approved), drawn
  with the role-keeper placeholder figure (`npc-vault-clerk-figure`,
  unpainted). It has no personal name. Its two lines give its role: a full
  satchel never drops anything, and the benches still reach what is stored.
- **Tabs:** Satchel · General I · Materials · Supplies · Gear · General II–IV ·
  Overflow. Overflow shows only while it holds something, with a count badge.
  There is no Runes tab, because Sigils are gone (see S1–S4). Every tab has
  search and sort (Newest, Name, Rarity, Value). Stacks always lead the list.
- **One button per view:**
  - an item in a Vault tab: **Take out**, or "Satchel full — make room first"
  - an item in the satchel: **Send to Vault**
  - the Satchel tab with nothing picked: **Add 8 slots · Gold**, or "Your
    satchel is at its largest"
  - a tab you don't own: **Buy the <tab> tab · Gold**
  - a stack: no button, and the line "Benches use these straight from here."
- **Details:** every price as a secondary buy chip, "Send all gear to the
  Vault", the routing rule, and "purchases are permanent". Prices come from
  `STORAGE_CURVE` through `StorageService`. Moves use `stow` / `takeOut`, so
  the Contract Board never pays "item equipped" for one.
- **Satchel count:**
  - the clasp shows "23/40", with an aria label "Satchel, 23 of 40 slots"
  - the phone badge shows the same
  - the book's capacity line reads "23 / 40 slots", with a bar
  - the header pill and the keeper panel read the same count
  - an amber dot *inside* the satchel button means Overflow holds things (no
    new fixed widget; see the memory note "fixed corner widgets collide")
  - the book notes "N more in your Vault", and its slip has a secondary
    **Send to Vault** for any loose item
  - the book lists only the stacks the satchel shows
- **Routing feedback:**
  - `InventoryService.routed$` fires once for each arrival that a full satchel
    turned away: an item that `settle` moved, or a stack that landed outside
    the satchel and outside its own affinity tab. It never fires on load or
    on a merge.
  - `/play` shows "Satchel full — Cinder Ore sent to the Vault: General I
    tab." The line is written after the caller's own message, and further
    arrivals within 4 s add "(+n more)" to it.
- **Retired copy:** `play.hud.msg.crumbles`, `play.hud.msg.pickupFull` and
  `play.delve.bagFullTake`. A pickup can now fail only on a failed save, which
  shows `pickupFailed`.

**S6: every surface that lists items.**

- **Exchange:**
  - The strip reads the satchel's used/cap (it used to read the old 250).
  - A full satchel no longer blocks a buy. Only the record budget does, and
    bought gear routes to the Vault.
  - Gear in the Vault isn't for sale. Asking to sell more than you carry says
    "N more in your Vault. Take it out of the Vault to sell it."
- **Enchanting:** lists carried and worn gear, not Vault gear.
- **Character → Bank:** shows "N more rest in your Vault. Visit the Vault in
  the Basalt Seamworks…" as read-only. Its stack rows are account totals, as
  the benches read them.
- **Delve chest panel:** its satchel side lists the satchel's stacks.
- **No change needed:** the Gambler's Sell and Till, the paper doll, Thrall
  and explorer kit, and chest gear already read `snapshot.bag`, which excludes
  the Vault. Codex, Leaderboards and NPC checks read `snapshot.items`, which
  counts everything you own once.

**The compaction weakness (point 3 above), fixed with per-device folds.**

- `stackCheckpoints` (one global watermark per stack) is replaced by
  `stackFolds`: one fold per device `{deviceId, upToHlc, net, ids}`.
  - Each device folds **only its own** oldest ops, past 64 live and down to 32.
  - A merge keeps each device's highest-`upToHlc` fold whole, and never folds
    anything itself.
  - `net` may go negative (one device spends what another granted). Only the
    total clamps at zero.
- **Defect 1 (an op lost under another device's watermark) is gone.** An op is
  folded only by the device that wrote it, which is the one device certain to
  hold it.
- **Defect 2 (a folded grant replayed counts twice) is gone.** A fold keeps
  53-bit hashes of the newest 2,048 op ids it folded. `ledgerKnowsOp` reads
  them, and every replay guard uses it (`grantStack`, `hasStackOp`,
  `stackCraftedFor`, `consumeStacks`, `refineStack`).
- **Known bounds:**
  - A replay older than a device's last 2,048 folded ops is not recognised.
  - Two devices that each issue the *same* new id while offline **and** each
    fold it before they sync count it twice. That needs 32+ further ops on
    both devices.
  - A device without a stable id (`unknown`) never folds.
- **Old saves:** an old save's `stackCheckpoints` are read as a `legacy` fold
  with the same totals.
- **Property test** (`inventory-stack-folds.spec.ts`): 48 seeds, 2–3 devices,
  220 random steps each. Steps are grants, spends, replays of seen ids, folds
  every 2–7 ops, and syncs in random direction and argument order. After every
  step, every device's every total equals the ground truth over the ids it has
  seen. After a full sync, all devices agree.
- **Market server (S7):** `functions/src/market/save-ops.ts` still reads
  `stackCheckpoints`. Point it at `stackFolds` before the market deploys.

**Tests:**
- Karma: `vault-station.component.spec.ts` covers the panel, routing and
  purchases. `inventory-stack-folds.spec.ts` covers the compaction fix.
  `inventory.service.spec.ts` was updated for the 40-slot satchel.
- e2e: `play-vault.spec.ts`, at 1280×800 and 390×844, runs: fill the satchel,
  mine (the ore routes, with the message), open the Vault at its station, see
  Take out refused while full, Send to Vault, Take out, buy a row, sort,
  search, and check 44 px controls.
- e2e: `play-inventory-stacks` now checks the 40-slot count.
  `rune-forge-all` seeds the current v3 economy.

## Shipped (2026-10-13): identical items as one ×N row

Branch `worktree-agent-ae993023d5dfbea84`. The owner: *"look at my inventory —
so many of the same items, they should be stacked to easily put in stash."*
This is the §2.2 identity key S1 skipped, rebuilt for gear and display only.

- **The key** (`src/app/shared/rpg/item-groups.ts`, `groupKeyOf`): definition
  id, name, type, rarity, sell value, soulbound, the rolled stats **and** the
  frozen roll grade (key order ignored, values exact), and the place (bag or a
  holder id). A piece is one of a kind (key `null`) when it is worn, tempered
  (or has a failed temper attempt on record), reforged, or has a rune set in a
  socket. Empty socket wells read as no sockets. Nothing is rewritten; the
  grade is never recomputed.
- **Where:** every Vault tab (Satchel included), the satchel book's cells
  (the badge shows the count, the slip's kicker reads "Common · ×7 · 7 slots"),
  and the Delve chest panel (both gear lists). Variants of one definition sort
  side by side in every order (`clusterBy`).
- **Buttons:** a ×N row's one button moves the group: "Send 7 to Vault",
  "Take out 7" (or as many as the satchel has room for, with that number on
  the button), the book's "Send 7 to Vault", the chest's "Put in 7" / "Take 7".
  The Vault's Details has "Move just one". `InventoryService.stowMany` /
  `takeOutMany` are one save each, skip ids already moved (a replayed press
  moves nothing) and never emit `equipped$`. "Send all gear to the Vault" now
  uses the same single write. The chest still moves gear one save per piece,
  because each move bumps the chest's own counter.
- **Slots are unchanged:** each instance still takes one slot, and the row
  says so ("×7 · 7 slots"; "7 alike. Each still takes its own slot.").

