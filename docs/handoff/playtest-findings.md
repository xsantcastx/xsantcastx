# Playtest findings: today's mechanics, played in a real browser

The `e2e/play-*.spec.ts` specs play the new mechanics against a production build (`npm run build`, served by `scripts/serve-preview.js`). They use the real inputs: keys on the canvas, the Places list, the Waystone, and the panel buttons. Save blobs are seeded only from `/robots.txt`. Every bug below has a `test.fixme` that fails today. To see it fail, remove `.fixme`. When a fix lands, un-fixme the test.

Run: `PW_PORT=4291 npx playwright test e2e/play-*.spec.ts --project=chromium` (pick a port no other worktree uses).

## Bugs

### P-1 · Critical · The Exchange round trip prints Gold

**Status: fixed** by `8bbe142` (orders priced along their own impact; buys round up, sales down). Re-played on current main: 10 in pays 131 and 10 out returns 123; a Max lot of 999 takes the purse 100,000 → 99,041. The spec is un-fixme'd and passes. `exchange.model.spec.ts` now also checks the pure quotes for every material, at 20 sizes up to 999, at three instants and from a market already pushed either way, plus a Max buy sold back in pieces.

**Repro:** start with a 100,000 Gold purse. Go to Umbral by the Waystone, open the Exchange, and pick Cinder Ore. Buy with **Max** (999), then go to Sell and sell with **Max**.

**Expected:** the purse ends no higher than it started (the 5% sale tax is the sink).

**Actual:** the purse goes 100,003 → **111,691**, a profit of +11,688 (about +11.7%) per loop, and the loop can be repeated. Even a 10-unit lot profits: it pays 130 and receives 133.

**Why:** `ExchangeService.buy` (`src/app/shared/exchange/exchange.service.ts`, around lines 257–262) charges every unit of the lot at the pre-trade `price(good, now)`. The buy then adds the player's own pressure (`applyPressure`), so the quote rises (cap e^0.65 ≈ ×1.9 at liquidity). `sell` (around lines 295–305) then pays every unit at that raised price. At ≤20 Gold unit prices, whole-Gold rounding alone also lets a 10-lot gain 1 Gold per unit.

**Fix direction:**
- Price a lot along its own pressure curve (integrate or average across the lot).
- Or exclude the player's own unexpired buy pressure from the price they sell at.
- Or charge the post-trade price on buys.

**Spec:** `play-economy.spec.ts`, "buying N and selling the same N back on the Exchange is never a profit".

### P-2 · Medium · A `?at=` deep link from any town but Infernal is dropped on reload

**Repro:** go to Umbral by the Waystone and open the Exchange. The URL is now `/play?at=exchange`. Reload, or open that URL in a new tab.

**Expected:** the Exchange opens, in Umbral.

**Actual:** the game boots in Infernal (Basalt Seamworks). `applyAt` looks for `exchange` among Infernal's stations, finds nothing, and silently ignores the link. The same happens for every Luminous, Umbral, Celestial and Verdant station.

**Suspect:** `SideScrollerComponent.town` always starts as `TOWNS.infernal`. `travel()` neither persists the town nor writes it to the URL. `applyAt()` only searches `this.town.stations` (`src/app/play/side-scroller.component.ts`).

**Spec:** `play-world.spec.ts`, "a deep link copied in another town reopens that place after a reload".

### P-3 · Medium · Kills train nothing: no Hunting XP, no Mining XP for ore drops

**Repro:** with the beacon lit, take the East Passage to Ember Quarry. Kill a Rivet Maw with J and walk over its coins and Cinder Ore.

**Expected:** Hunting XP rises; Hunting has a skill and an unlock ladder in `skill-unlocks.ts`.

**Actual:** `godforge-activity` is never even created. There is no Hunting or Mining XP.

**Suspect:** no code path grants a kill. The engine's `onLoot` reaches `SideScrollerComponent.collectMaterial`, which only calls `inventory.grantStack`. A kill should go through `SkillActionService.act({ skill: 'hunting', … })` with an idempotent id per kill, the same way Delve swings do. The Hunting skill is currently untrainable.

**Spec:** `play-hunting.spec.ts`, "a kill trains Hunting".

### P-4 · Medium · Coins from monsters are never kept

**Repro:** kill a Maw and walk over its coin drop. The satchel shows "Coins 9". Wait, then reload.

**Expected:** the coins reach the Gold purse, or at least survive a reload.

**Actual:** the purse is unchanged. After the reload the satchel shows Coins 0.

**Suspect:** the engine keeps coins in its private `coins` counter (`engine.ts`, around line 1078). The host's `onLoot` handler is `loot => loot.ore === 0 || this.collectMaterial(...)` (`side-scroller.component.ts`, around line 269), so a coin drop returns `true` without being credited anywhere.

**Spec:** `play-hunting.spec.ts`, "coins picked up from a kill are kept".

### P-5 · Low · The Vendor ties the Exchange's floor quote after tax

**Status: fixed.** `buybackPrice` is now `max(1, floor(worth × 8%) − 1)`. Cinder Ore pays 1 (the Exchange floor nets 2), and every other material is 1 to 2 Gold lower than before. `material-vendor.model.spec.ts` checks every board material, gathered and expedition-only, three ways: against the whole-Gold floor quote net of tax, against the floor rate on lots of 10, 50 and 99, and against the lowest ask. **One tie remains, and it cannot be removed:** Slag Fragment's floor quote nets 1 Gold, and the counter cannot pay less than its 1-Gold minimum. That is not a faucet, because the cheapest Slag on the Exchange costs 2. The spec pins it as the only tie. Both the e2e test and the unit spec allow exactly that case. To remove it, the Vendor would have to stop buying Slag; that is an owner call.

**Expected:** the comment in `material-vendor.model.ts` promises that 8% of base worth is "under even the Exchange's floor quote (10% of base)".

**Actual:** that holds for the gross price but not for what the player receives. For two materials, the Exchange floor price after its 5% sale tax equals the Vendor:

| Material | Vendor pays | Exchange floor, net of tax |
|---|---|---|
| Slag Fragment | 1 | 1 |
| Cinder Ore | 2 | 2 |

Both sides round to whole Gold, which eats the 2-point margin. In normal play the Exchange pays far more (12 versus 2 for Cinder Ore, asserted in the passing test). So this only matters at the floor.

**Spec:** `play-economy.spec.ts`, "the Vendor pays below the Exchange floor quote, after tax".

### P-6 · Medium · The Fracture's 600 Delving XP is silently lost

**Status: fixed** by splitting the grant. The per-action ceiling stays in place, so there is no bypass path. `WORLD_ACTION_MAX_XP` moved to the import-free `activity.model.ts`, and the gateway re-exports it. `xpGrantChunks` splits an amount into grants of at most 500. `missionXpGrants` gives each grant its own key. The first grant keeps the old key `npc-mission:<id>:<n>:xp`, so a claim that already paid replays and is never paid twice. Later grants add `:2`, `:3`. The Fracture now pays 500 + 100. `payMission` logs any refused grant or failed chunk load with `console.warn`, instead of dropping it. `delve-missions.model.spec.ts` asserts that every mission's reward is grantable: whole grants, each 1–500, summing exactly to the reward, with unique keys. The e2e chain is un-fixme'd and passes.

**Repro:** seed the deliveries. On the Quest Board's Delve tab, claim The Shadow Beneath, The Old Seam and Glowcap Orders. Delving XP reaches 350. Then claim The Fracture.

**Expected:** Delving XP rises by 600.

**Actual:** the fragment is consumed and the Gold is paid, but Delving XP stays at 350.

**Why:** `ActivityProgressionGateway.resolveWorldAction` returns `invalid` for any `xp > WORLD_ACTION_MAX_XP` (500). `NpcQuestService.payMission` (`src/app/shared/npc/npc-quest.service.ts`, around line 372) never looks at the result.

**Fix direction:** either raise or split the grant, or let mission XP bypass the per-action cap. Also surface failed XP grants instead of dropping them. Every other mission is ≤ 300 XP and pays correctly (verified for Verrin's 150 and the Archivist's 80).

**Spec:** `play-missions.spec.ts`, "the whole Delve chain … The Fracture pays its 600 Delving XP".

## Observations (not asserted, low)

- **Keys pressed while a panel folds away are lost.** After a Waystone road or Escape there is a 160 ms fold during which the engine is still paused. A key already held, or pressed in that window, never registers until it is pressed again. The town and `data-area` switch before the fold ends.
- **Ladder top:** while the Keeper hangs on a ladder (climbing state), D alone never steps off onto a one-cell ledge, because `climbTerrainBody` has no step-up. Holding W+D gets off. A player who releases W on the top rung and presses D appears stuck.
- **Doc drift:** `home-forge.md` prices Anvil II at 750K. The live column asks 5M, because the rebalance re-placed the prices; the doc is stale, not the game.

## What the passing specs prove (chromium)

| Area | Played and asserted |
|---|---|
| Economy pacing | A fresh save, striking the Homestead Forge with E at 5/s, can afford the first Forge Bellows in about 3.4 s (limit 15 s), then buys it. |
| Homestead | Hover finds the Forge and a canvas click strikes it (Gold rises). Ember Stoker bought from the column (owned, rate and purse move). Anvil I → II from the column (5M), kept over a reload. |
| Waystone | Walked to by keyboard. Travel to Luminous, Umbral, Celestial and Verdant and back to Infernal. Focus returns to the canvas. |
| Deep links | `?at=waystone` / `crafting` / `enchanting` / `runes` / `vendor` open the right panel. Escape closes it, focus is back on the canvas, and `?at` is cleared. |
| Delve | A dug pit survives a reload (same diff; the Keeper falls back in and is walled in). A dirt block is placed, persists, and digs back out as a block. A torch persists across a reload and X takes it back. Ladders climb out of a 7-deep shaft. A chest round-trips 5 Cinder Ore across a reload. A camp is placed; E opens "Your camp"; from town, "Descend to your camp" lands beside it. |
| Hunting | A Rivet Maw killed with J. Coins and Cinder Ore drop and reach the satchel (ledger +1 ore). |
| Missions | Verrin: 3 cuttings consumed, Gold paid, +150 Delving XP, and the Nullthorn bench lock ("A Delve mission teaches this pattern") is gone. A short delivery (2/3) cannot be claimed. Archivist I pays once 3 inscriptions are copied, and II then shows 3/6. |
| Vendor | It only buys. Selling 5 ore pays 5 × 2 Gold, and its price is below the Exchange's live net quote. |
| Anvil | 4 Perfect → 100% and +40 Smithing XP. 4 Off → ≤20% and a smaller bonus. Skip → today's timed craft, the item, no anvil bonus. |
| Ritual | A miss says "Almost", stays in the pulse phase and spends no rune. A hit sockets `ash` into the Kris (rune count 2 → 1) and pays Enchanting XP. |

## Untestable or not covered

- **Anvil quality changing the roll:** the bias is statistical (E[r] 0.5 → 0.556), so a single craft cannot show it. The ceiling proof is covered by unit and node tests. The specs assert the quality and XP the game reports instead.
- **Delve materials dug by hand** (shadow-root cuttings and the rest) are seeded for the mission specs. Reaching them takes long scripted digs through seed-dependent rock, which would make the specs slow and brittle.
- **Rune-Warden, Kael's cache and the fragment chamber:** too deep to reach reliably by keyboard in a spec.
- **WebKit:** the whole suite also passes on the `webkit` project (25 passed, 6 fixme). The canvas specs move in real time, so they assert ranges rather than exact positions.
