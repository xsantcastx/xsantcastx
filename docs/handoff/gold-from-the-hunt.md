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

## Not done / follow-ups
- Systems still written in "seconds of income" (bounties, heights, cabinets, eclipse marks, fishing lodge, expeditions,
  collection, challenges) now pay their floors; their sim bands still grade the legacy forge model.
- The casino bet cap now sits at its 50-Gold floor (`gamesBetCap(0)`), and the respec cost at its floor.
- Old prices across the item economy were set against forge income; only the Mirror Slate was re-priced.
