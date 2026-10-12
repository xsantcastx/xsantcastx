# Handoff: economy rebalance (Cookie curve, economy v3)

Branch `worktree-agent-a0063fbcfa6039481`. Not pushed or merged. The design is `docs/economy/rebalance-spec.md`, and its §6 lists every decision taken while implementing it.

## Where the numbers live

- `src/app/shared/economy/economy-curve.ts` is the single source of truth. It holds the furnace, hammer, multiplier and automaton ladders, the slot costs, PRICE_SCALE 1.15, the 125 ms strike cooldown, the century multiplier, prestige (10T, cube root), the expedition curve, the Golden Spark, the reward bands, the vendor buyback fraction and the migration bounds. The file has no imports. `economy.model.ts` builds its catalogues from it, and `scripts/economy-sim.mjs` transpiles it.
- `economy-legacy-v2.ts` holds the frozen v2 rates. Only the migration and the simulator's CURRENT run read it.

## Save migration

- `economy-migration.ts` defines `migrateEconomyV3`. It is pure and idempotent: a ledger at version 3 or above comes back as the same object.
- It runs in four places:
  - `EconomyService.load()`, which flushes the converted copy straight away.
  - Both sides of `mergeEconomyLedgers`, through `coerceMigrated`. A v2 remote is never merged against a v3 local.
  - The gateway's economy transaction.
  - The GM console's `mutateLedger`.
- Only an explicit `version` below 3 is converted. Every v1/v2 build stamped one. A blob with no version is read as current.
- The v2 op log is folded into the converted state, and `applied` is cleared.
- At that one-time boundary, the side that was just migrated merges under the conservative max/union rule. This means a stale v2 device keeps its unsynced purchases.
- Inventory records carry an `econ: 3` marker. A pre-v3 sell value is scaled by ρ once per record.
- Fixtures: `economy-migration.spec.ts`.

## Other changes

- **Golden Spark:** `golden-spark.service.ts` runs one clock. The Forge View replaced the trader with it, and the Homestead catches a spark when you strike the Forge.
- **Material Vendor:** it is now a buyback counter. It sells nothing and pays 8% of base worth.
- **Market Buy max:** it calls `EconomyService.affordableLevels`, which walks the same `costAtLevel` that `nextCost` uses.
- **CI:** runs `node scripts/economy-sim.mjs --check`.

## Follow-ups and risks

- **One red spec, by design of the boundary:** `market-reference.spec.ts`. The auction house's generated reference (`functions/src/market/reference.generated.ts`, off-limits to this change) still has the v2 equipment base prices, while equipment scrap moved by ρ. The fix is to regenerate it after merge with `node scripts/generate-market-reference.mjs`. The server-side reference prices then follow the v3 item economy.

- **Exchange:** `src/app/shared/exchange/**` was out of scope. Its material and equipment base prices are still in v2 Gold. The Vendor reads them as v2 anchors × ρ, and its spec accepts either scale. The auction-house owner should rescale them by ρ, or retire them.
- **Veteran shard cap:** set to 40 (held + claimable). The owner should confirm it.
- **Objective thresholds:** the "Earn N Gold" objectives (challenge pools, NPC chains) are unchanged. On the new curve they fall in the first hour.
- **Unchanged prices:** cosmetic Gold prices and the arena purse (50k) are unchanged. Neither was in the approved table.
- **Homestead spark visual:** there is no "spark is lit" cue. `homestead-render.ts` is owned by the /play work. The spark only shows a burst once it is caught.
- **Forge Frenzy:** it lives in memory only and is lost on reload.
