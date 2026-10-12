# Economy rebalance: Cookie-Clicker curve (design and simulation only)

Status: **approved by the owner and implemented** (economy save version 3). Every number below comes from `scripts/economy-sim.mjs` (run with `node scripts/economy-sim.mjs --days=30 --stages`), which now reads the shipped numbers from `src/app/shared/economy/economy-curve.ts` — the single source of truth the game's catalogues are built from. The former **TODO**s are resolved in §6, "Implementation decisions".

## 1. Inventory: current Gold and Essence sources and sinks (origin/main a0c9efe)

Paths are relative to `src/app/shared/`.

| System | file:line | Current value |
|---|---|---|
| Strike | economy/economy.model.ts:255 `BASE_GOLD_PER_CLICK` | 1 |
| Strike cooldown | economy/economy.service.ts:135 `CLICK_COOLDOWN_MS` | 500 ms, so **at most 2 strikes/s** |
| Century strike | economy.service.ts `strike()` / model:259 | +10 flat on every 100th strike |
| Idle floor | economy.model.ts:253 `BASE_IDLE_PER_SECOND` | 0.1/s |
| Price escalator | economy.model.ts:285 `PRICE_SCALE` | 1.25 (some comments still say 15%) |
| Furnace ladder | economy.model.ts:343-436 | 5k/0.5 (first level free), 20k/1, 50k/2, 200k/5, 1M/10, 5M/25, 20M/50, 50M/100, 200M/250, 1B/1000 |
| Hammers (repeatable) | economy.model.ts:457-511 | 10k/+2, 50k/+5, 200k/+10, 500k/+20, 2M/+50 per strike |
| Multipliers (buy once) | economy.model.ts:532-569 | 100k/+10%, 1M/+25%, 10M/+50%, 100M/+100% |
| Automatons | economy.model.ts:599-627 | 500k/+1 strike/s, 5M/+5, 50M/+20; each pays the bare strike value |
| Explorer slot | economy.model.ts:658-665, cap 4 | 250k |
| Thrall slot | economy.model.ts:696-703, cap 5 | 2M |
| Offline | economy.service.ts:115 | cap 8 h, full rate; a hidden tab earns 0 unless the `obsidian-heart` artifact is owned (model:1357) |
| Prestige | economy.model.ts:1060-1096 | opens at 1B all-time or rank 10; shards = floor(sqrt(total/1e5)); each shard +5% |
| Rune strike | rune-forge/rune.model.ts:157 | `STRIKE_COST` 10,000 (flat); bulk 10 = 100k; ALL = floor(gold/10k) |
| Rune worth | rune.model.ts:104-135 | 10k / 50k / 200k / 1M / 5M / 20M / 100M; each sells for half its worth |
| Thrall pull | thralls/thrall.model.ts:55 | STRIKE_COST × 100 = 1M |
| Thrall tiers | thrall.model.ts:108-132 | 50k / 200k / 1M / 5M / 25M |
| Gambler boxes | gambler/mystery-box.ts:78 | 5k / 25k / 100k / 500k / 5M |
| Material vendor | vendor/material-vendor.model.ts:67 | 6k / 9k / 12k per unit; must stay under 4.75× the Exchange base |
| Crafting `goldCost` | crafting/crafting.model.ts:183-396 | uncommon 4-19k, rare 22-72k, epic 120-245k, legendary 560-950k, mythic 2.4-3.2M. Basalt Edge costs no Gold |
| Unsocket | enchanting/socket.model.ts:260 | 25% of the rune's forgeCost |
| Temper | rpg/item-upgrade.ts:50,183 | 50k × 1.65^level, scaled by rarity 0.85-1.2; uniques use 40k-750k bases (unique-items.ts:405) |
| Reforge | rpg/item-reforge.ts:76 | 500 / 2k / 10k / 50k / 200k / 1M / 5M; locking a stat costs 2× |
| Respec | rpg/player-stats.model.ts:136 | 100k |
| Market explorer hire | rpg/explorer-archetypes.ts:504 | 500k |
| Item sell value | rpg/item.model.ts:407, item-definition.ts:142 | scrap 600 / 2.5k / 12k / 60k / 300k / 1.5M / 8M; quality 0.5-1.5×, Perfect 3×, Flawless 5× |
| Grand Exchange | exchange/exchange.model.ts:454,563,603 | base prices 260 to 95k; 5% sale tax; price clamped to 0.1-5× base |
| Expeditions | explorer/explorer.model.ts:184-290 | Scout 2 m 5-10k free; Delve 10 m 20-50k fee 500; Expedition 1 h 100-300k fee 2k; Deep Dive 4 h 0.5-1.4M fee 10k; Grand 24 h 3-9M fee 50k; Abyss 72 h 20-60M fee 200k (rank 5+). All flat, then multiplied by realm (0.9-1.15), site, archetype and roster |
| Wandering trader | live/forge-view.component.ts:549-551,1580 | every 90-240 s on the Forge View only; pays max(50, 60 s of income) |
| Quest Gold | economy.model.ts:280 | clamp(xp/3×100, 1k, 5k) |
| Tool action | economy.model.ts:257 | 5 |
| Daily / weekly challenges | challenges/challenge-pools.ts:44-386 | daily 1k-15k; weekly 25k-250k |
| NPC chains | npc/npc-quest.model.ts:146-501 | 5k / 15k / 50k / 100k / 500k; the "counted" chain pays 66.6k to 666k |
| Collection | collection/collection.model.ts:856-882 | 10k / 50k / 200k / 1M |
| Arena win | arena/arena.model.ts:102-150 | 2.5k / 9k / 32k / 120k / 420k, × streak (up to 2×); arena purse 50k for 20 points |
| Pro pack | pro/pro.service.ts:52 | 500 Gold + 50 Essence |
| RPG flat Gold/s | rpg/rpg-wiring.service.ts:96 | 2/s per Forge Power point plus roughly 0.4-1.1/s per item |
| Charisma discount | economy.service.ts `setPriceMultiplier` | price × 0.05-1 |
| Essence sources | economy.model.ts:262-268, rune-forge.service.ts:66 | 5 per rank, 10 per weekly, 50 per mythic, 25 per streak week, 1 per strike with the Bridge |
| Essence sinks | economy.model.ts:796-1036 | enchantments 500-10k, artifacts 10k-500k, cosmetics 50k-1M |
| Homestead | none on main | n/a |

**Findings from the inventory**
1. **The early game today is the Scout, not the forge.** A free 2-minute Scout pays 7.5k (about 62 Gold/s) while the forge pays 0.6 Gold/s. Without expeditions, the first paid purchase takes **8 hours**.
2. **The current late game is a quadratic engine.** Repeatable hammers multiplied by repeatable automatons explode on day 3: Gold/s goes from 24 to 3.75M. By day 30 that would pay **19,130 shards (×957)**.
3. **Strikes are capped at 2/s** by the 500 ms cooldown.

## 2. Headline: simulator before and after

These are greedy runs: 4 click attempts/s for the first 5 minutes, then 10 clicks/min, one Scout loop and realistic offline gaps.

| Metric | CURRENT | PROPOSED | Target |
|---|---|---|---|
| First furnace bought | 1 s (free) / first paid purchase 2m01s | **4 s** (paid, 15 Gold) | ≤ 15 s |
| Paid purchases in first 10 min | 3 | **44** (median gap 9 s) | one every 30-90 s |
| New items unlocked in first 10 min | 1 | **6** (longest wait 3 min) | |
| First rune strike affordable | 8m01s | **4m20s** | 3-5 min |
| First Gold-fee craft | 6m01s | **6m01s** | 5-10 min |
| Gold/s at 10 min / 1 h / 1 d / 7 d | 2.1 / 7.1 / 24 / 13.8M | 67 / 20.7k / 887k / 167M | smooth exponential |
| First Eclipse threshold | 2.4 d (1B) | **3.4 d** (10T) | days |
| Shards on offer at 30 d | 19,130 | 36 | bounded |

Robustness checks:
- At 2 clicks/s, the first furnace comes at 8 s.
- With expeditions off, PROPOSED is nearly unchanged (CURRENT stalls for 8 h).
- A patient buyer gets a rune strike at 2 min and the Eclipse at 3.0 d.

Stage table for PROPOSED, used for every "seconds of income" price:

| Time | 1 m | 5 m | 10 m | 30 m | 1 h | 1 d | 3 d | 7 d |
|---|---|---|---|---|---|---|---|---|
| Gold/s | 0.9 | 13 | 67 | 2.5k | 20.7k | 887k | 77M | 167M |

## 3. New numbers (old → new)

**Rules**
- **(L) Ladders:** the Cookie shape, with PRICE_SCALE 1.15.
- **(S) Progression gates:** priced as N seconds of income at the stage where the player meets them.
- **(R) Item economy:** runes, gear, materials, boxes, vendor and exchange all scale by one factor, **ρ = 0.06**, so their internal arbitrage guards still hold (box EV < cost, vendor < 4.75× exchange, sell < forge).
- **(I) Rewards:** become `max(old × ρ, N s × Gold/s)` so they stay meaningful at every stage.

| Item | Old | New | Rule |
|---|---|---|---|
| PRICE_SCALE | 1.25 | **1.15** | L |
| CLICK_COOLDOWN_MS | 500 | **125** (8/s ceiling) | so a human is never throttled |
| BASE_IDLE_PER_SECOND | 0.1 | 0 | the 15-Gold Bellows replaces it |
| Century strike | +10 | the 100th strike pays 10× a strike | scales with the strike |
| Furnaces (ids kept) | 5k/0.5 free … 1B/1000 | **15/0.1, 100/1, 1.1k/8, 12k/47, 130k/260, 1.4M/1.4k, 20M/7.8k, 330M/44k, 5.1B/260k, 75B/1.6M**; `firstFree` dropped | L, each rung ~10× output |
| Hammers | repeatable 10k/+2 … 2M/+50 | **buy once:** iron 100/+1, obsidian 500/+2, aether 10k/+1% of Gold/s per strike, nox 1M/+2%, eclipse 100M/+3% | Cookie's click upgrades; breaks the quadratic engine |
| Multipliers | 100k/1M/10M/100M | **5k / 250k / 25M / 2.5B** (same bonuses) | S, about 5 min of income when met |
| Automatons | 500k/5M/50M | **200 / 5k / 250k**; they strike at the flat value only | early hands-free rung that fades later |
| Explorer slot | 250k | **50k** ×1.15, cap 4 | S, about 18 min |
| Thrall slot | 2M | 2M | S, about 50 min |
| Rune STRIKE_COST | 10k | **600** | R; first strike at about 4 min |
| Rune worth / sell | 10k…100M | ×ρ: **600 / 3k / 12k / 60k / 300k / 1.2M / 6M**; sell stays half of worth | R |
| Thrall pull | 1M | 60k (still strike × 100) | R |
| Thrall tiers | 50k…25M | **25k / 400k / 8M / 150M / 3B** | S |
| Gambler boxes | 5k/25k/100k/500k/5M | **300 / 1.5k / 6k / 30k / 300k** | R |
| Vendor | sells 6k/9k/12k | **buys only** (owner amendment): pays 8% of base worth (v2 anchor × ρ), e.g. Cinder Ore 2, Pyrite Dust 28, Orichalcum 57 | NPCs are sinks; see §6 |
| Exchange bases, item scrap, unsocket | as listed above | ×ρ (scrap 36 / 150 / 720 / 3.6k / 18k / 90k / 480k) | R |
| Craft fees | 4k…3.2M | uncommon ≥1k, rare ≥10k, epic ≥150k, legendary ≥2.5M, mythic 60M; each tier's spread kept | S; always ≥ old × ρ, so no craft-and-sell arbitrage |
| Temper base | 50k ×1.65^L | **6k** ×1.65^L; unique bases ×0.12 | S |
| Reforge | 500…5M | **150 / 600 / 3k / 15k / 60k / 300k / 1.5M** | S |
| Respec | 100k | max(20k, 600 s of income) | I |
| Market hire | 500k | 60k | S |
| Expeditions | flat 5k…60M | payout = max(floor, k × duration × Gold/s at launch). Scout floor 90, k 0.5; Delve 600, k 0.4 (fee 300); Expedition 4k, k 0.33 (fee 2.5k); Deep Dive 30k, k 0.25 (fee 25k); Grand 300k, k 0.15 (fee 400k); Abyss 2M, k 0.12 (fee 5M) | I; a mission tops up the forge and never replaces it |
| Golden Spark (replaces the trader, sitewide) | 90-240 s, Forge View only, 60 s of income | **every 5-10 min while visible, 13 s to catch.** 85% Windfall: max(60 s, min(15% of bank, 900 s)) + 25. 15% Forge Frenzy: ×5 income for 60 s | about +4% of lifetime Gold in the sim |
| Quest / daily / weekly / NPC / collection / arena / pro / tool action | flat | I: quest 120-600 s; daily 5-20 min; weekly 1-4 h; NPC 2/5/10/20/60 min; collection 10/30/60/120 min; arena 1/3/8/20/60 min; tool action 5 s; pro pack 5 min | I |
| Prestige | 1B, sqrt(t/1e5) | **opens at 1e13 all-time**; shards = floor(cbrt(t/1e10)); SHARD_BONUS stays 0.05 | about 3 days to the first Eclipse, then a bounded tail |
| Essence | as listed | unchanged (it is not Gold) | n/a |
| Offline cap and rate | 8 h, full | unchanged (`--offlineRate=0.5` tests a cut) | n/a |
| RPG flat Gold/s | flat addend | Forge Power **+0.5% of the forge per point**; gear `goldPerSec` stays flat (see §6) | n/a |

## 4. Migration for existing saves

One-shot, versioned, idempotent. It runs in `EconomyService.load()` (economy.service.ts:1346) when `parsed.version < 3`, and it stamps `version: 3`. Cloud copies go through the same function inside the economy merge path (`coerceLedger`, economy-ops.ts:756, and the gateway `attach()` at save/game-state.gateway.ts:709) **before** they are merged. A v2 remote is never merged against a v3 local.

The function:

```
migrateEconomyV3(e):
  if e.version >= 3: return e
  r_old = goldPerSecond_old(e)                    // with the old tables, all multipliers applied
  e.upgrades = grandfather(e.upgrades)            // keep every furnace / automaton / slot level;
                                                  // a hammer level of 1 or more becomes 1, and the
                                                  // extra levels are refunded at new Σcost
  r_new = goldPerSecond_new(e)
  f = clamp(r_new / max(r_old, 0.6), ρ, 1000)     // the "income-seconds" factor
  e.gold            = e.gold * f + hammerRefund   // keeps the same number of seconds of income in the bank
  e.runGoldEarned   = e.runGoldEarned * f
  e.totalGoldEarned = cbrtInverse(shardsFor_old(e.totalGoldEarned))  // keeps shard progress:
  e.shardsGranted   = min(e.shardsGranted, shardsFor_new(e.totalGoldEarned))
  e.eclipseShards   = min(e.eclipseShards, 60)    // stops the ×957 quadratic-era stacks; TODO: confirm the cap with the owner
  e.version = 3
```

Gear and runes the player already owns keep their stored `sellValue`. It is multiplied by ρ the first time it is read, which the inventory's v3 migration step does (inventory-ops.ts `migrateV1` pattern). Exchange and vendor prices are not stored, because they come from the tables.

Essence held is unchanged (decided). The fixtures live in `src/app/shared/economy/economy-migration.spec.ts`: fresh, mid-game, quadratic-era veteran with prestige, a veteran under the cap, already-migrated (no double conversion), plus the v2-remote/v3-local merge in both orders and the inventory sell-value marker.

As implemented (`economy-migration.ts`), two details sharpen the rule above:
- `totalGoldEarned = max(total × f, S³ × 1e10)` with S the v2 shard count, so shard parity holds and small accounts scale like everything else.
- The shard cap applies to **held + still claimable**, otherwise an unclaimed v2 curve would pay the veteran's stack straight back on the next Eclipse.
- The op log is folded (ops, origin and the `applied` watermark cleared). At the merge boundary a just-migrated side merges under the conservative max/union rule, so a stale v2 device keeps its unsynced purchases.

## 5. Rollout

1. Land `economy.model.ts` tables, `PRICE_SCALE` and the cooldown together with `migrateEconomyV3` and its spec (`economy-migration.spec.ts`: idempotent, and v2+v3 merge order).
2. Item-economy ρ (rune.model, mystery-box, vendor, exchange, item-definition, socket), reusing the existing `boxScrapExpectation` and vendor < 4.75× exchange specs as guards.
3. Income-second rewards (wiring, challenges, NPC, collection, arena, explorer payout).
4. Golden Spark: replace the Forge View trader.
5. Prestige constants.

Shipped one-shot behind `ECONOMY_VERSION = 3` (economy-curve.ts). No runtime flag, because two economies cannot share a cloud save. CI runs `node scripts/economy-sim.mjs --check` (fails when the first purchase is later than 15 s or fewer than 20 purchases land in the first 10 minutes).

**Risks**
- Veterans of the quadratic era lose relative power. The shard cap is the hard call.
- The 125 ms cooldown makes the 100-clicks/min Click Frenzy achievement trivial.
- Version races between cloud and local saves.
- Hidden flat literals: the version-history copy still cites old strike costs.

## 6. Implementation decisions

Decisions taken while implementing; each is a constant in `economy-curve.ts` unless noted.

| Topic | Decision | Why |
|---|---|---|
| **Veteran shard cap** (flagged for the owner) | `VETERAN_SHARD_CAP = 40` shards held + claimable (×3 income) | The v3 curve pays about 36 shards after 30 days of play; 40 keeps a veteran ahead of a fresh month-one account without importing the quadratic-era stack. Accounts under the cap are untouched. |
| **RPG / item Gold/s** | Forge Power becomes +0.5% of the furnace + automaton rate per point (new ledger field `rpgForgePercent`). Gear `goldPerSec` stays a flat addend. | The spec assumed items pay ~0.4-1.1/s; the real mint ranges run 0.2/s (Common) to 1,400/s (Singular), so gear keeps pace through the mid game. As a percentage, a full Legendary kit would be ×20 income. Revisit with a gear rebalance. |
| **NPCs are sinks** (owner amendment) | The Material Vendor only buys: `price = max(1, floor(worth × 0.08))`, `worth = v2 anchor × ρ` (Exchange base for gathered materials, the old shelf price for expedition materials). It sells nothing. | 8% is under the Exchange's own floor quote (10% of base), so even a ρ-scaled NPC Exchange cannot be bought from and sold back here at a profit. The player auction house is the market. |
| **Merchant glowcap order** | Floor buyer: max(180 Gold, 90 s of income) per 5 Glowcaps (was 3,000 floor). | Rule I with the floor at v2 × ρ. |
| **Pro pack Gold** | max(500, 5 min of income); the floor is kept at 500. | It is a paid product and its page promises 500 Gold. |
| **Respec** | max(20,000, 600 s of income), read live by the stat panel. | As specified. |
| **Golden Spark** | `GoldenSparkService` owns one clock shared by the Forge View (replacing the trader) and the Homestead (caught by striking the Forge). The kind is rolled when the spark appears, so the offer can name it. Frenzy is in memory and multiplies furnaces, automatons and strikes. | One reward rule everywhere; no new fixed-position widget. |
| **Click Frenzy achievement** | 300 strikes in a minute (was 100). | The cooldown fell to 125 ms (480/min ceiling). |
| **Owned item sell values** | Scaled by ρ once per inventory record, marked `econ: 3`. | A per-record marker stays consistent whichever copy a merge keeps. |
| **Unchanged** | Essence, Essence prices, cosmetics' Gold prices, the arena purse (50k), quest/NPC "earn N Gold" objective thresholds, offline cap and rate. | Not in the approved table. Objective thresholds now fall much sooner (the new curve banks ~26M all-time in the first hour) — a follow-up. |

