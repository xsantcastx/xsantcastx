# Gold from the hunt (2026-10-21)

Owner: "remove the forge where gold is being generated, thats to much gold … monsters drop more gold like in d2";
"tibia we could add the higher level the faster they move"; "remove current gold to start from 0".

## What a player gets
- **No passive Gold.** `economy-curve IDLE_INCOME = false`: `EconomyService.settleIdle` advances the clock and pays
  nothing (no furnace/automaton income, no offline settlement); the snapshot publishes `perSecond: 0`, so every reward
  priced max(floor, N s of income) pays its floor. The Mirror Slate's **Homestead (factory) face and its badge are
  gone** (no "Making N Gold/s", no Collect/Build); the side view's Homestead still draws (`?td=0` only).
- **Gold piles on the ground** (D2): every kill drops `rollHuntGold(level, rank)` —
  `(4 + 2.5·L·(1 + L/100)) × {normal 1, champion 4, unique 6, boss 15} × U(0.6, 1.4)`. L1 4–9, L10 19–44, L20 38–90,
  L40 86–202; a level-20 boss 576–1,344. Drawn as a pixel coin mound (`td-engine drawGoldPile`, 3 sizes, glint) with
  an "N Gold" plate; the pull/pet fetch bring it in; pickup floats "+N Gold" and credits `earnGold(n, 'hunt')`.
  The Bestiary's Gold range reads the same formula (`MobDef.coins` is gone).
- **Fixed rewards**: town tasks/dailies and level milestones are N minutes of a steady hunt at their own level
  (`huntGold(level, seconds)`, 240 kills/h): e.g. level-5 milestone 206 Gold, level-100 121k; Edrin's first
  task (L1, 3 min) 78 Gold. Mirror Slate price 500k → 4,000 (~32 min of a level-10 hunt).
- **Speed by level** (Tibia): `levelSpeedBonus(L) = 0.6·(1 − e^(−(L−1)/400))` — +1.3% at 10, +13% at 100, +55% at
  1,000, cap +60%. Multiplies Agility/Move Speed/Haste (never inside their 40% cap); pets and raised skeletons use the
  same factor. The sheet's Speed row shows the total.
- **Gold wipe** (`GOLD_ERA = 1`): every ledger without the stamp has its balance set to 0 once, in
  `EconomyService.load` and on BOTH sides of `mergeEconomyLedgers` (`enterGoldEra`: old log folded under a per-device
  watermark, origin purse 0, so neither `unexplainedGold` nor old credits can restore it; across the era the origins
  merge conservatively). Corpse-run purses without the era stamp read as none. Items, levels, XP, Essence, upgrades
  untouched. Spec: `economy-gold-era.spec.ts` (local 500T + cloud 500T → 0; later Gold kept; through SYNCED_BLOBS).
  Bump `GOLD_ERA` to wipe again. e2e seeds that give Gold now carry `goldEra: 1`.

## Checks
`node scripts/economy-sim.mjs --hunt` (piles, ranks, potions per hour, milestones); `--town-tasks` re-based to hunt
time; `--check` asserts IDLE_INCOME off. e2e `td-gold-drop.spec.ts` (`?fxgold=1` lays three real piles) →
`docs/handoff/cozy-ui/gold-drop.jpg`, `gold-drop-pickup.jpg`.

## Re-priced on the hunt (2026-10-21, follow-up)
Everything that was "N seconds of income" now reads the hunt at the Keeper's level: `economy-curve huntRate(L)` (Gold/s
of a steady level-L hunt). `EconomyWiringService` feeds the Keeper's level (Hunting XP) into `EconomyService.setHuntLevel`;
the snapshot publishes `huntLevel` and `rewardPerSecond`, and `economy.model rewardRate(snap)` is what every reward and
price reads (`incomeRewardBase`, bounties, the Fishing Lodge, expeditions, NPC missions, the bet cap, the respec, the
Golden Spark). So a reward of N seconds pays max(floor, huntGold(level, N)).
- Bet cap: 50 at L1, 200 at L10, 1,000 at L40, 2,000 at L100 (plus the 1%-of-purse rule, capped at an hour of the hunt).
- Respec: max(250, 10 min of the hunt): ~1.3k at L10, ~5.8k at L40, ~20k at L100 (was a flat 20k floor).
- Expeditions (`EXPEDITION_CURVE`): floors 8–43k at a flat 600 Gold/h of mission, income share 6–25% of the hunt,
  fees 20–10k (were 90–6M floors and fees up to 5M).
- Bounties trimmed to 5/8/10 min (a day of chores ≤ 2 h of hunting); the collection's floor is capped at what its
  minutes pay a level-1 Keeper.
- Item economy: craft fee floors are `CRAFT_FEE_HUNT` minutes of a hunt at the tier's level (uncommon 340 … mythic
  230k, were 1k … 60M); gear's till price (`EQUIPMENT_SCRAP`) is a fifth of before so an hour's drops sell for ≤ 50%
  of the hour's piles; vendor and market material prices were already on the hunt's scale and are now graded.
- The side view's furnace and automatons are retired (`isRetiredIncomeUpgrade`): the ledger refuses them, the
  Homestead shows "Retired: …", the Market stops listing them; old levels still load.
- `economy-sim --reprice` prints forge-era vs now at L10/40/100; `--check` runs it, and every side-line band
  (fishing, living, pets, heights, cabinets, eclipse, bounties, loot, reels/cascade caps) is graded against the hunt.

## Not done / follow-ups
- Still forge-era prices, not re-based: STORAGE_CURVE (satchel rows / vault tabs, 200k–25T), HOME_FORGE_PRICES
  (5M/1B/1T), THRALL_SLOT_COST, mystery-box prices, gear `goldPerSec` stats (a dead Forge Power line).
