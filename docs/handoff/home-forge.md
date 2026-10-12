# Home forge: Your Anvil + Your Enchanting Circle (Homestead)

Two stations at the east end of the Homestead plot (the plot is now 2900 wide):
**Your Anvil** (`hs-anvil`, x 2400) and **Your Enchanting Circle** (`hs-circle`, x 2700).
Walking up and pressing E (or clicking them) opens the SAME Crafting Bench and
Enchanting Table panels as town, with the same Smithing and Enchanting mini-games.
Each station has four tiers (I to IV), bought with Gold from the Homestead buildings column.

## Tiers

All numbers live in ONE object: `HOME_FORGE_CONFIG` in `src/app/shared/minigames/home-forge.model.ts`.

| Tier | Price (Gold) | Your Anvil | Your Enchanting Circle |
|---|---|---|---|
| I | free (stands on the plot) | today's game: Perfect 0.12, Good 0.36, 4 strikes | today's ritual: window 0.14 |
| II | 750K | Perfect 0.16 | window 0.18 |
| III | 6M | Perfect 0.16 + a spare strike (5 strikes, best 4 count) | window 0.22 + rarest rune first |
| IV | 250M | Perfect 0.20, Good 0.40 + the spare strike | window 0.26 + rarest rune first |

- **Prices are on the NEW economy curve** (`docs/economy/rebalance-spec.md`, rule S: about 5 minutes of income where the
  player meets it, stages 30 m / 1 h / 1 d). On today's curve they are out of reach. Retune `price` in the config when the
  rebalance lands or moves.
- **Ceiling proof still holds.** Quality is the mean of the best `counted` strike scores (each in [0, 1]), so q stays in
  [0, 1] and the bias `r^(1-0.2q)` is unchanged. Proven by `anvil.model.spec.ts` (Karma) and
  `scripts/home-forge.test.cjs` (node, which mints every rolled recipe at every tier with a perfect game and the best RNG).
- **Ritual window** is capped at `PULSE_WINDOW_MAX` (0.3), the same cap a miss already widens to.
- **"A rarer rune" is a convenience only.** The enchanting rules let any held rune go into any well; nothing gates runes by
  tier. Gating them would take something away from town, so tier III+ only sorts the rune picker rarest-first (and so
  pre-selects the rarest). Any rune can still be picked.

## Home-only context

- `HOME_FORGE` injection token + `injectHomeForge()` in `src/app/shared/in-world-panel.ts`: `{ anvilTier(), circleTier() }`,
  read live.
- The side-scroller (`openStation`) sees `homeStationOf(station.id)` and hosts the bench with `homeInjector`
  (IN_WORLD_PANEL + HOME_FORGE). Title is "Your Anvil" / "Your Enchanting Circle", there is no "Open full page" link
  (the routed bench would drop the tier).
- `CraftingBenchComponent` passes `[tier]` to `<app-anvil-game>`; `EnchantingBenchComponent` passes `[tier]` to
  `<app-rune-ritual>` and applies rarest-first. Both default to 1 when the token is absent, so town benches, the Delve
  camp and the routed pages are unchanged. The `anvil.model` / `ritual.model` functions only gained optional parameters
  whose defaults are today's constants (`gradeStrike(pos, zones = ANVIL_ZONES)`,
  `pulseWindow(misses, base = PULSE_WINDOW)`, `gradePulse(scale, misses, firstWindow = PULSE_WINDOW)`).

## Save format

- New blob `godforge-home-forge` = `{ version: 1, anvil: 1..4, circle: 1..4 }`, owned by
  `src/app/play/homestead/home-forge.service.ts` (lazy, /play chunk), written through `GameStateGateway`, registered with
  `LocalSaveRegistry` (rehydrate), and added to `SYNCED_BLOBS` as `progress/home-forge` with NO hand-written merge:
  tiers only go up, so the structural "higher wins" is exact (and the model stays out of the eager bundle).
- **Spend:** `HomeForgeService.upgrade(station, tier)` refuses on maxed / skipped tier / funds, then writes the new tier,
  then `EconomyService.spendGold(cost, 'home-forge:<station>:<tier>')` in the same tick (the crafting gateway's order:
  a crash in between is a free upgrade, never a charged player). The tier is the replay record: a retry or double tap
  for a tier already held returns `replayed` and spends nothing. Known edge: two devices both buying the same tier
  offline each spend once (the economy op log keeps both debits); the merged save holds the tier once.

## Plot visuals (`engine/homestead-render.ts`, code-drawn)

- Anvil: stone block + anvil, `anvilLook(tier)` scales it 1.0 to 1.42 and from II adds an ember glow, a hot face and
  drifting sparks (one per tier). A gold "I..IV" plaque floats above.
- Circle: a floor ring with ten standing runes; `circleLook(tier)` lights 4/6/8/10 runes, brighter each tier; from III a
  rune hovers over the centre. A violet plaque shows the tier.
- An upgrade flashes the station and floats "Tier N" (`HomesteadScene.homeGrew`).
- Column (`homestead-column`): a "Your crafting corner" group at the top with one row per station: name, tier, what the
  next tier gives, and ONE full-width button "Upgrade Anvil II · 750K Gold" (or "Fully upgraded"), with "Need N more"
  when short.

## Strings

`src/app/shared/minigames/home-forge.i18n.ts` (`homeForge.*`, EN + ES), registered by the mini-games, the column and
HomeForgeService. Station labels on the canvas ("YOUR ANVIL") are English like every other /play station label.

## Tests

- `node --test scripts/home-forge.test.cjs` (7): tier I identical to today, monotonic tiers, q in [0, 1] for every possible
  game, prices/replay/one-step upgrades, save coercion + merge, SYNCED_BLOBS entry, and the mint-ceiling proof per tier.
- `scripts/homestead.test.cjs` (+1: stations, painting, looks), `scripts/seamworks-engine.test.cjs` (61, unchanged).
- Karma specs updated but not run (suite hangs): `anvil.model.spec.ts` (home tiers + ceiling), `ritual.model.spec.ts`
  (home windows), `cloud-save.model.spec.ts` (key list).

## Check by playing

1. /play → walk east through the Homestead gate → keep walking past the Thrall Workshop. A plain anvil (plaque I) and a
   dim ring (plaque I) stand at the end.
2. Press E at the anvil: "Your Anvil" opens the Crafting Bench. Craft one piece of gear: the game is today's.
3. Give yourself Gold (or wait for the rebalance), press "Upgrade Anvil II" in the column: the anvil flashes, grows, glows.
   Craft again: a line "Your Anvil II: a wider Perfect zone." shows and the bright middle is wider. At III there are
   5 pips and the worst strike is dropped.
4. Same for the circle: the gold socket ring thickens per tier, the runes on the plot brighten; at III your rarest rune
   is picked first.
5. Open the town Crafting Bench / Enchanting Table and the Delve camp: no home line, base zones and window.
6. Reload and sign in on a second device: tiers persist and merge.
