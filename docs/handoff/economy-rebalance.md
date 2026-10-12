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

- **Exchange:** base worths are now ρ-scaled (`itemScaled` from economy-curve.ts), and `functions/src/market/reference.generated.ts` was regenerated (`node scripts/generate-market-reference.mjs`). Re-run that script after any catalogue change.
- **Objectives and Home forge:** "Earn N Gold" targets and the Home Anvil/Circle prices were placed with the simulator (spec §6; `--place`).
- **Veteran shard cap (owner to confirm):** `VETERAN_SHARD_CAP = 40` in economy-curve.ts (held + claimable). It is the one constant the migration reads.
- **Unchanged prices:** cosmetic Gold prices and the arena purse (50k) are unchanged. Neither was in the approved table.
- **Homestead spark visual:** while a spark waits, the Forge flares with the `goldenSpark()` burst every 2.5 s; striking catches it.
- **Forge Frenzy:** it lives in memory only and is lost on reload.
