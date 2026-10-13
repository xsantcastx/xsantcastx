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

**Fixed** (`ecfe303`): the current town is saved in `eclipse-play-world-v1` (written only when it changes) and restored before the engine mounts; a `?at=` link still resolves afterwards and wins. The spec is un-fixme'd and passes.

**Repro:** go to Umbral by the Waystone and open the Exchange. The URL is now `/play?at=exchange`. Reload, or open that URL in a new tab.

**Expected:** the Exchange opens, in Umbral.

**Actual:** the game boots in Infernal (Basalt Seamworks). `applyAt` looks for `exchange` among Infernal's stations, finds nothing, and silently ignores the link. The same happens for every Luminous, Umbral, Celestial and Verdant station.

**Suspect:** `SideScrollerComponent.town` always starts as `TOWNS.infernal`. `travel()` neither persists the town nor writes it to the URL. `applyAt()` only searches `this.town.stations` (`src/app/play/side-scroller.component.ts`).

**Spec:** `play-world.spec.ts`, "a deep link copied in another town reopens that place after a reload".

### P-3 · Medium · Kills train nothing: no Hunting XP, no Mining XP for ore drops

**Fixed** (`ecfe303`): Hunting XP per kill (`round(hp/5)`, keyed `hunt:<kill id>`) was already on main and the spec confirms it. Ore drops (any Mining-tier ore) now go through `SkillActionService.act` with skill `mining`, 2 XP, keyed by the drop id, so the ore and the XP land in one idempotent write. The spec now also asserts the Mining XP and passes.

**Repro:** with the beacon lit, take the East Passage to Ember Quarry. Kill a Rivet Maw with J and walk over its coins and Cinder Ore.

**Expected:** Hunting XP rises; Hunting has a skill and an unlock ladder in `skill-unlocks.ts`.

**Actual:** `godforge-activity` is never even created. There is no Hunting or Mining XP.

**Suspect:** no code path grants a kill. The engine's `onLoot` reaches `SideScrollerComponent.collectMaterial`, which only calls `inventory.grantStack`. A kill should go through `SkillActionService.act({ skill: 'hunting', … })` with an idempotent id per kill, the same way Delve swings do. The Hunting skill is currently untrainable.

**Spec:** `play-hunting.spec.ts`, "a kill trains Hunting".

### P-4 · Medium · Coins from monsters are never kept

**Fixed** (`ecfe303`): `onLoot` credits a coin drop through `EconomyService.earnGold` once per drop id, and the satchel's Coins count is the saved running total (`eclipse-play-world-v1.coins`), so it survives a reload. The spec is un-fixme'd and passes.

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

### P-7 · Low · A Smithing-gated recipe's refusal names the crafting ladder — **FIXED** (button now reads "Reach Smithing N first", progress meter reads Smithing; spec un-fixme'd)

**Repro:** with Smithing 9 (forge XP one short of level 10) and the inputs in the satchel, open the Crafting Bench, search "Blasting" and pick Blasting charge.

**Expected:** the button says what the gate is: Smithing 10, as the card's blurb does ("Needs Smithing 10").

**Actual:** "Reach crafting level 10 first". The gate itself is right (at exactly the Smithing 10 threshold the recipe opens and makes two), only the sentence points at the wrong ladder. Same for every `skill: 'smithing'` recipe (tools, the Delve kit's supports and charges).

**Suspect:** `CraftingBenchComponent.buildCta` (`src/app/shared/crafting/crafting-bench.component.ts`, around line 444) always uses `crafting.why.level`, and its progress meter reads `this.level.level` (the bench ladder) even for a Smithing recipe.

**Spec:** `play-delve-extras.spec.ts`, "a Smithing-gated recipe says which skill it waits for" (fixme).

## Observations (not asserted, low)

- **Keys pressed while a panel folds away are lost.** After a Waystone road or Escape there is a 160 ms fold during which the engine is still paused. A key already held, or pressed in that window, never registers until it is pressed again. The town and `data-area` switch before the fold ends.
- **Ladder top:** while the Keeper hangs on a ladder (climbing state), D alone never steps off onto a one-cell ledge, because `climbTerrainBody` has no step-up. Holding W+D gets off. A player who releases W on the top rung and presses D appears stuck.
- **Rock in the Delve breaks slower than four swings, silently.** A rock cell that pays Mining XP goes through the town seam's `selectCurrentWork` + `resolveMine` (`side-scroller.component.ts` `worldAction`, the `kind === 'mine'` branch), which refuses a break within `MINING_RECOVERY_MS` (2.5 s) of starting or of the last break. Measured on a fresh save: clicking one scorched-basalt ceiling cell every 0.65 s, it opened on the 7th swing (4.6 s), not the 4th (Pickaxe I does 1 of its 4 HP per swing), and the first Mining operation was booked at the same moment. While the breaks were refused the HUD line kept showing the previous message; no "seam needs a breath" was ever visible. The specs swing until the save shows the cell open. Owner call: is the town seam's breath meant to apply to Delve rock, and should the refusal show? **Resolved 2026-10-13:** digging is never blocked; only the reward is. See "Delve rock: digging is never blocked" in `docs/handoff/delve-building.md`.
- **X reaches less than E.** E (and the "Open the chest" prompt) uses `findInteractive`, which reaches half a cell past either side of the body. X (`takeTarget` in `terrain.ts`) takes only the column in front of the Keeper or the column under the Keeper's centre. A Keeper whose body overlaps a chest's column, centre in the next column and facing away, sees "Open the chest", presses X, and is told "Nothing placed here to take back". This was there before the 2026-10 merges, so it is not a regression. Owner call: should X use the same reach as E? Not changed here because other agents are in the engine.
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
| Delve supports | In a Magma Halls gallery (row 41 ceiling, generated loose cells), digging a loose cell overhead with no support groans and the rock hits for max(4, round(8% max HP)) = 8. A basalt support (key 9, B) placed under a loose cell holds it (no groan, no HP lost, cell open in the save); a loose cell more than 5 columns from it still falls. Thirteen falls in a row take 100 HP to exactly 1 and stop there. |
| Blasting charges | The recipe is refused at Smithing 9 and makes two at Smithing 10. Without a staff, B refuses ("You need a staff"). With a crafted Staff I, 0 then B lights it; after the fuse the cells `blastCells` names (all within 2.3) are open in the save, Mining XP rises by exactly their per-cell pay, the sealed pocket's protected cracked walls and cache stay. A reload keeps the same diff and pays nothing again, also after descending back. In the fragment chamber (warden felled), the bedrock floor and the protected fragment stand. |
| Inscriptions | The four new carvings (`roots-cutting-mark`, `basalt-seam-ledger`, `grotto-tally-marks`, `magma-unsigned`) each read with E ("New inscription." + their text) and land in `godforge-delve-lore`. With the eight older ones that is 12: Words I and II claim, Words III reads "Copy all 12 inscriptions", shows 12/12 and claims. With 11 it shows 11/12 and stays disabled. |
| Gear in chests | A crafted Briarvein Kris (there is no sword recipe; the Kris is the weapon the other specs craft) goes into a chest: its ledger row moves to `explorer: delve-chest:<born>`. X on that chest says "Empty the chest first". After a reload the chest record and the Kris's location are unchanged; "Take" returns it to the bag, and the now-empty chest comes back with X. |
| Keepers and townsfolk | In all five towns (read from what the engine draws, see below): every keeper's name tag is drawn at one fixed x, its body (±24) overlaps no station hit box, and it stands 0–100 px from its own stall. Walking west to east past them, each keeper says exactly one line (never its second). Standing by Kael for 7 s, stepping 210 px away and back does not re-greet. Every townsperson shadow drawn in the walk stands off every stall. With `preferred-language` es, every town draws exactly its keepers' Spanish name tags and every bubble is a Spanish keeper line. |
| Ritual | A miss says "Almost", stays in the pulse phase and spends no rune. A hit sockets `ash` into the Kris (rune count 2 → 1) and pays Enchanting XP. |

## How the October specs get there (play-delve-extras, play-life)

- **Deep Delve rows without a scripted dig.** The production build has no `ng` global, so the services cannot be driven from the page. `e2e/play-delve-fixtures.ts` builds the `godforge-delve` save in Node with the game's own pure code (`generateTerrain` for the pinned seed, `terrainDiff`, `encodeCells`, `terrainLayout`): "this player dug a gallery here and pitched a camp". The Keeper then takes the shaft's real "Descend to your camp" and everything after is keys and clicks. Smithing XP is seeded the same way, through `emptyActivityLedger()` and the skill curve (`xpForLevel`).
- **Clicking a cell.** Ceiling cells are dug by clicking them, mapped world → client with the engine's own camera rule and the Keeper's known feet. Rubble only lands on the Keeper from a cell dug straight overhead, which the keyboard cannot aim at.
- **Keepers and townsfolk without screenshots.** `play-life.spec.ts` wraps `fillText` and `ellipse` on the world canvas: name tags (tag font and colour at the tag's height) and bubbles (bubble font and ink) give each keeper's world x and every line spoken; the floor shadows (30 : 7) give where each figure stands. Station hit boxes are the town data `stationAt` reads.

**October run (chromium, PW_PORT 4291):** 48 passed, 1 fixme (P-7) across all `play-*` specs; a second full run matched. One flake in the first run: the Celestial life walk drew exactly 100 frames against a `> 100` floor (the walk there is short); the floor is now 30 and the town passed on rerun. WebKit was not run for the new specs.

**Two Delve specs red on main (2026-10-13): test drift from where walks stop, not an app regression.** The failing specs were "a pit dug before a reload is still open after it" and "a weapon goes into a chest…". Neither failed every run. On unchanged main, `--repeat-each=5` failed about 1 run in 5 per spec. All the failures came from the same thing: a keyboard walk stops somewhere other than where the spec assumes.
- **Why walks stop late.** A Delve walk is 191 px/s with no momentum, but a headless frame can last the engine's 0.1 s cap, about 19 px. The spec releases the key from a 50 ms poll, so the Keeper always walks on a little. When the machine is busy (several worktrees building or running suites at once), that poll can fire around 0.4 s late. The Keeper then walks on a further ~100 px: in town it stopped at x 694, at the Material Vendor instead of the shaft.
- **Pit.** The walk back to 260 stopped at 235–241. At 235 the pit was dug in columns 6–7. The reloaded Keeper arrives at x 260 (columns 7–8), stands on column 8's rock beside the pit, and walks out 245–296 px. The saved diff was identical; only the column was wrong. At 241 the 26 px body sits over column 7 alone, so the dig went one column wide and stalled at 11 blocks.
- **Chest.** The column was read from `data-player-x` right after the key-up. The frame after that still moves the Keeper. So the chest went into one column, and the Keeper ended in the next, facing away from it. E still reached the chest (see "X reaches less than E" above), but X did not.
- **Changes, specs only:**
  - `walkTo` waits out the trailing frame, checks where the Keeper stopped, and makes up to two best-effort walks back.
  - A new `settleBetween(lo, hi)` taps the Keeper into an x window, read from the engine's `data-player-x`. The pit spec digs at 246–266, which is exactly columns 7 and 8. The chest spec settles inside the chest's column before placing the chest and again after the reload.
- **Results:** both specs 10/10 under `--repeat-each=5`. No bisect was run, because a bisect cannot isolate this. A single commit (main at 692c7f1) both passes and fails, depending only on timing. The chest flake was already logged in `delve-building.md` ("flaked once in three runs") before the latest merges.
- **Full `play-*` run afterwards (chromium, PW_PORT 4283): 79 passed, 2 failed.** Neither failure walks in the Delve, and each passed 3/3 when rerun on its own:
  - "bedrock and the protected fragment stand through a blast": the blasted cells were not in the save within 6 s.
  - `play-update` "off /play it shows below the site nav too": the toast was not visible within 5 s.

  Both are logged here as load flakes still to watch.
- **Second full run: 80 passed, 1 failed.** Both of the first run's flakes passed. The failure was `play-minigames` "routed /forge/crafting at 390 px…" at `expect(hit).toBe(true)`: at the Skip button's centre, `elementFromPoint` found something other than Skip. It then failed 3/3 when rerun alone, yet it had passed in the first full run. A stripped-down repro (same bag, no wait for the NPC) hit Skip itself, inside `.mg--anvil.gf-reveal.gf-in-view`. The spec uses neither `walkTo` nor `settleBetween`, so this change cannot affect it. It looks timing-dependent, perhaps the reveal animation or the NPC fading out. Left to whoever owns the /forge phone layout.

## Untestable or not covered

- **Anvil quality changing the roll:** the bias is statistical (E[r] 0.5 → 0.556), so a single craft cannot show it. The ceiling proof is covered by unit and node tests. The specs assert the quality and XP the game reports instead.
- **Delve materials dug by hand** (shadow-root cuttings and the rest) are seeded for the mission specs. Reaching them takes long scripted digs through seed-dependent rock, which would make the specs slow and brittle.
- **Rune-Warden and Kael's cache:** not fought or broken. The fragment chamber is now reached by a camp (with the warden's `claimed` flag set), for the charge and inscription specs.
- **Timber support (reach 3):** not exercised; the basalt support (reach 5) is.
- **Sealed chamber before the warden falls:** the charge spec only covers it with the flag set (open).
- **WebKit:** the whole suite also passes on the `webkit` project (25 passed, 6 fixme). The canvas specs move in real time, so they assert ranges rather than exact positions.
