# World Plan — every page becomes a place

The working build tracker for turning Eclipse Realms into one walkable world.
Update it in the same commit that lands the work; an item is only `[x]` once it
is merged to `main` **and** checked in a production build.

Last updated: 2026-10-13

Legend: `[x]` shipped · `[~]` in progress (branch named) · `[ ]` next · `[-]` later / blocked

---

## The vision

Every page in the navbar is a **place in the game world**. You walk to the
Market to shop, to the Forge to craft, to the Waystone to travel. What you buy
visibly feeds your crafting; what you kill drops loot you can see fly into your
satchel; what you equip shows on your Keeper. One inventory, one economy, one
world — and every system visible while it works.

## Decisions (made 2026-10-12)

| Question | Decision | Consequence |
|---|---|---|
| Town layout | **Five realm towns** (Infernal, Luminous, Umbral, Celestial, Verdant), joined by Waystones | Each page lives in exactly one town; nothing is duplicated |
| Navbar | **World only**: shrinks to Play + Character at the end | Must keep URLs, SEO prerenders, nav audit and an accessible "Places" list working first |
| Monster loot | **Zone-specific drop tables**, hand-authored per hunting ground | More flavour; each table needs balancing |
| Translucent art | **Solidify at import** (`SOLIDIFY` in `scripts/import-assets.py`) | Keeper is solid; same treatment available for any future see-through export |
| Platform | **Browser-first**; installable PWA now; wrap the same web build for Steam / app stores later only if it gets traction. No engine rewrite (Unity / Godot) | Keeps zero-friction play, SEO traffic, cloud saves and instant updates; revisit only for 3D or real-time multiplayer combat |
| World interactions | **Tools are verbs; the world has things to use them on** (inspired by Subgloom's destructible underground). **Tile-grid terrain**, not per-pixel. Delve + Homestead built **in parallel** | Crafting gets a purpose: each tool tier opens new rock, veins, paths and rooms |
| New skills | **Smithing, Foraging/Woodcutting, Delving/Exploration, Enchanting ritual** (+ Mining, Hunting, Prospecting); one 1–99 curve with an unlock every ~10 levels | Extends the existing discipline ledger; no XP lost |
| Economy | **Full rebalance to a Cookie-Clicker curve** (owner's original inspiration): first building in ~15 s, a new affordable goal every 30–90 s early, ×1.15 price scaling, click upgrades, golden-spark bursts; the Homestead is the "cookie" | Every Gold price is retuned together (runes, gambler, vendor, recipes, expeditions); existing saves migrated; designed + simulated before any number changes |
| Who runs the economy | **Players, not NPCs** (owner, 2026-10-12): a **player auction house** (shared Grand Exchange, supply-and-demand prices) with **server escrow + limits** (signed-in only, rate limits, price sanity bands, provenance against the cloud save); **NPCs become sinks only** (buy junk at a low floor, charge fees/taxes; never sell what players make) | Trades become server-authoritative (Firestore + Cloud Functions); the simulated Exchange stays behind a flag until the real one is live; the Material Vendor turns into a buyback counter |
| Menu UX | **"For dummies" simple, MapleStory-crafting-journal anatomy**: tabs per skill, skill strip with XP bar, list → detail, requirement icon grids with have/need counts, one CRAFT / CRAFT ALL row; extras behind Details. Reference: `docs/design-references/` | Every station and panel is held to it; a shared station UI kit enforces it |
| Delve layout | **Your own persistent Delve**: one layout per player, carved out permanently; everything dug, placed or built stays (local save + cloud when signed in) | Persistence is the foundation for building in the Delve; layout seed is per player, stored with the save |
| Art direction | **Hybrid, Ragnarok-style**: stylised animated **sprites** in the world (characters, creatures, NPCs, buildings, props); existing **paintings** for menus (items, portraits, gambler, Codex, paper doll, town backdrops) | Needs sprite sheets + a sprite renderer in the engine; paintings stay where they shine. The deformation rig remains the fallback until sprites exist |

### Where each page lives (proposal; change here, then build)

| Town | Buildings / stations | Hunting ground drops |
|---|---|---|
| **Infernal**: Basalt Seamworks | Crafting Bench, Rune Forge, Enchanting Table, Material Vendor, quest stations (ore, forge, beacon, passage) | Cinder ore, ember residue |
| **Luminous** | Market (upgrades) | Light-touched materials |
| **Umbral** | Gambler, Exchange | Shadow materials, scrolls |
| **Celestial**: Meridian Orrery | Codex (observatory), Leaderboards board | Star fragments, runes |
| **Verdant**: Rootglass Canopy | Sanctum (expeditions), Quests board, Arena gate, Trials gate | Rootglass, seeds |
| *Everywhere* | Character + Satchel overlays, Waystone, Places list | |

---

## Shipped so far

- [x] Equip bug: unaimed equip picked the wrong slot (`05adf94`)
- [x] Seamworks game feel: hit flash, knockback, hitstop, shake, death dissolve, loot arcs, HUD damage chip (`2028bd6`)
- [x] Asset diet: WebP UI icons, 3.1 MB removed (`37ffbb2`)
- [x] Gambler altar reveal + history; overlay fixed to viewport; discovery card waits for the reveal (`9803216`, `8ec4647`)
- [x] Forge floor stations on crafting / enchanting / runes (`9803216`)
- [x] The Works board on /sanctum: explorers, treasury flow, from real timestamps (`9803216`)
- [x] Equip compare (green/red), stat chips, Keeper Stats sheet, Strike Power → damage, Ward → max HP (`9803216`)
- [x] Library art: 32 images, keeper avatars in header + leaderboards, Codex Bestiary (`9803216`)
- [x] Mesh-deformation rig for the Keeper and Rivet Maw (`729dd9e`)
- [x] Keeper painting solid instead of ghostly (`05e3910`)
- [x] Character build: worn gear in sockets on the doll (hood, hands), equip fly-in / unequip drop animation, Build archetype card (Vanguard, Treasure Seeker, Forgewright, Bulwark, Lorekeeper, Wanderer) (`b8ced0b`)

---

## Phase 1: World foundation `[x]` (`bf49c03`)

Sequential: everything after it plugs into its data model and panel host.

- [x] World data model: `TownDef` / `StationDef` / `HuntZoneDef` / `ZoneDropTable` in `src/app/play/world/`; engine reads stations, platforms, monsters and drops from data
- [x] Infernal town rebuilt on it (Seamworks widened): Crafting Bench, Rune Forge, Enchanting Table buildings + existing quest stations + Waystone
- [x] In-world panel host: opens the existing page components over the game (pause, focus trap, Escape); `IN_WORLD_PANEL` token suppresses page backdrops / heroes
- [x] Click / tap to move and interact (`engine.moveTo`)
- [x] Deep links: `/play?at=<place>`
- [x] Waystone travel panel (only Infernal open) + accessible Places list
- [x] Checked in a production build: `/play?at=crafting` opens the real Crafting Bench in-world (backdrop + hero suppressed, forge floor works); Escape closes and clears `?at`; Places lists all 8 stations; choosing the Waystone walks there and opens travel (4 towns "Not yet charted")
- How Phase 2 adds content (data only): a town = `src/app/play/world/towns/<realm>.ts` exporting a `TownDef`, registered in `TOWNS`; a station = a `StationDef` (`kind: 'panel'` + `panel` id opens a page; a new page needs a `PanelId` + `PANEL_REGISTRY` row); a hunt = a `HuntZoneDef` reached by a passage `to`; monsters and `ZoneDropTable`s are data on the area or monster

## Phase 2: Fan out `[x]` (2026-10-12)

- [x] Luminous town **Heliograph Court**: Market; hunt Reflection Channels (Prism Forager → Luminous Prism, Sunbloom, Solar Resin = Aurumleaf Pendant) (`1948b55`)
- [x] Umbral town **Nocturne Archive**: Gambler (reveal fills the panel), Exchange; hunt Unrecorded Corridors (Mirror Substitute → Umbral Ink, Nightbloom, Shadowthread Silk = Inkwell Talisman) (`1948b55`)
- [x] Celestial town **Meridian Orrery**: Codex, Leaderboards (tabs local in-world); hunt Orrery Rings (Ephemeris Leech → Celestial Alloy, Moonpetal Herb, Celestial Quartz) (`1948b55`)
- [x] Verdant town **Rootglass Canopy**: Sanctum, Quest Board, Arena gate, Trials gate (games fill the panel); hunt Rootglass Thicket (Rootglass Stag → Thornroot, Verdant Sap, World-Root Bark) (`1948b55`)
- [x] Zone drop tables: every drop is a catalogued material a recipe uses (enforced by a test)
- [x] Rarity beams, drop captions, pickup flights to the satchel (`378269a`)
- [x] Material Vendor in Infernal: 9 expedition-only materials (6–12k Gold, priced so Exchange arbitrage is impossible — spec-checked); one button "Buy 4 Pyrite Dust · 24,000 Gold"; crate flies to the forge stockpile; checked: purchase debits Gold and the hint advances (`3c35881`)
- [x] Per-creature rigs: Forager skitters, Leech undulates, Mirror Substitute sways in reflection, Stag lowers its head to charge (`378269a`); checked: Stags drawn with their own rig in Rootglass Thicket
- [x] Engine side of gear on the Keeper: `setLoadout`, `setSatchelTarget` (`378269a`)
- [x] Side-scroller wiring of `setLoadout` / satchel target / `clearPointer` (`3c35881`)
- [x] In-game UI polish: compact HUD + satchel tally, station name cards, content-only panel transitions, "+N material" loot toasts, focus returns to the canvas, enemy bar names the creature (`3c35881`)

## Phase 2.5: Living world — world, not menus `[~]` (started 2026-10-12)

The fun moves out of panels and into the world: you dig, chop, cut and blast
things with tools you crafted, and you see your economy working.

- [x] **World interactions + Ember Delve** (`102bc57`; dug state session-only, non-mining XP pending): diggable tile terrain with crack stages and crumble debris; generic tool-vs-node system (`pickaxe | axe | sickle | blade | staff`, tiers); lantern lighting in caves + staff blast beam; the Ember Delve slice under the Seamworks (Cinder → Slag → Heartstone veins by pickaxe tier, a staff-only cracked wall, roots for the blade/sickle)
- [x] **Skills + tool progression** (`102bc57`): new disciplines (Woodcutting, Enchanting; Smithing = forge, Delving = exploration); one 1–99 curve with migration-safe XP; unlock table every ~10 levels; craftable tool tiers I–IV from existing materials, gated by Smithing; generic `resolveWorldAction`; in-world Skills panel; a level-up moment for every skill
- [x] **Homestead** (`102bc57`): the idle economy as buildings you can see: forge automatons hammering, treasury, explorer camp (real expedition timestamps), thrall workshop; walk past to collect (visual only, no double credit); upgrade in-world with the existing Market upgrades
- [x] **Personal anvil + enchanting circle in the Homestead** (`47c3b5c`; tiers I–IV in `HOME_FORGE_CONFIG`: Perfect window 0.12→0.20, 5th strike at III, ritual window 0.14→0.26, rarest rune pre-selected at III+; home-only via a `HOME_FORGE` token; prices to retune on the new curve) (owner, 2026-10-12): your own crafting corner on the plot. It opens the same Crafting / Enchanting panels with the Smithing and Enchanting mini-games. Upgrade tiers for Gold: a better anvil widens the "perfect" window or adds a strike; a better circle makes the ritual check more forgiving and can seat a rarer rune. Upgrades are visible on the plot. **Starts after** the Delve-building and mini-games branches merge (they own `src/app/play/**` and the mini-games right now)
- [x] Gathering nodes in every realm's hunt (`cde77a2`): herbs/wood/ore with tool tier + skill-level gates; regrowth timers (**not yet persisted** — reload resets); Found-in lists them. Also: **Skills Lodge** station in Rootglass Canopy (`/play?at=skills`), **Hunting XP** round(hp/5) per kill, Smithing level-up banner on bench crafts, cross-town `?at=` via `findStation()`, lantern = 7 + Delving/10 tiles, Delve hotbar EN+ES. Was: (herbs, rootglass, bark), using the same tool system
- [x] **Smithing anvil mini-game** (`26218be`): 4 strikes graded Perfect/Good/Off → quality q; Smithing XP 8–40; roll bias r → r^(1−0.2q) stays inside today's band and ceiling (spec-proven), mean grade 0.5 → ≤0.556; Craft all / qty>1 / Skip = today's behaviour
- [x] **Enchanting ritual** (`26218be`): drag or tap the rune onto the circle, then tap when the shrinking ring meets the socket; a hit sockets and pays Enchanting XP 8–40; a miss costs nothing and widens the window
- [x] Tile and tool art in the commission pack (rock, dirt, ore veins, cracked wall, roots; pickaxe/axe/sickle/staff tiers; + support/charge icons and props, `6e329ea`, 229 entries)

## Economy rebalance (Cookie-Clicker start) `[x]`

- [x] **Owner approved the spec** (2026-10-12)
- [x] **Implementation** (`cf7ddce`): the numbers live in `economy-curve.ts`; `migrateEconomyV3` runs on load and on both sides of cloud merges; `VETERAN_SHARD_CAP = 40` (owner-confirmed); Exchange base prices on the same ×0.06 scale (a spec keeps vendor buyback below the lowest Exchange quote, so no faucet); "Earn N Gold" goals placed by the simulator (`--place`); homestead anvil/circle tiers at 5M / 1B / 1T; golden spark flares over the Forge; checked in a build: a mid-game save converted v2→v3 (356K → 237K Gold), Forge Bellows costs 15, a reload doesn't re-convert. Was: all number changes, versioned idempotent save migration with fixtures, simulator `--check` in CI, golden-spark reward, copy updated; NPC vendor → buyback counter at a low floor, Merchant orders rescaled
- [x] **Player auction house backend** (`a435266`, **flagged off**; rules/indexes held in `docs/handoff/player-market/*.proposed` for a manual deploy, since a CI rules change has 403'd and blocked hosting before; 28 functions tests on an in-memory store; the Firestore emulator didn't run because this machine has no Java): Firestore order book + trades + escrow + price history; callable Cloud Functions `placeOrder` / `cancelOrder` / `collect` with transactional matching (price-time, partial fills), seller tax, rate limits, sanity bands, provenance check; client-read-only rules; lazy `PlayerMarketService`; feature flag
- [x] Exchange UI bound to `PlayerMarketService` behind `PLAYER_MARKET_CLIENT_ENABLED` (`cde77a2`): Buy · Sell · Your orders, order-book depth, fee line, Collect bar, plain errors; dev-only fake backend at `/exchange?market=fake`. Remaining: flip the flag after an emulator + staging check
- [ ] **Owner-approved deploy**, by hand, in this order: rules + indexes (from `.proposed`) → `functions:market` → create `market/v1 {enabled: true}` → flip `PLAYER_MARKET_CLIENT_ENABLED` → bind the Exchange UI. Install Java so the Firestore emulator can test real queries and transactions first

- [x] Spec + simulator (`docs/economy/rebalance-spec.md`, `scripts/economy-sim.mjs`): inventory of every Gold source/sink, target pacing, new numbers table, save migration, rollout plan; before/after timings from the simulator
- [x] Homestead built Cookie-style: big clickable Forge + always-visible buildings column (current numbers; new ones flow through later)
- [x] **Owner:** spec approved; shard cap 40 confirmed
- [x] Implement the rebalance in one coordinated change (`cf7ddce`, see above)
- [x] Golden-spark burst event

## Phase 2.6: Build and craft in the Delve (owner idea, 2026-10-12) `[x]`

- [x] **Per-player persistent Delve** (`88cb159`): a seed per player stored in the save; dug, placed and built cells saved as a compact diff through the save gateway (local + Firestore when signed in), idempotent with the existing mutation ids. Owner decision 2026-10-12. Today the layout is one fixed seed for everyone and dug state is session-only
- [x] **Biomes by depth** (`88cb159`), each with its own palette, light, nodes and creatures: **Root Hollows** (roots, petrified trunks, mushrooms → Foraging/Woodcutting), **Basalt Caverns** (Cinder/Slag → Mining; today's Delve), **Glowcap Grotto** (glowing herbs, e.g. Moonpetal-type → Foraging), **Magma Halls** (Heartstone, Ember Residue, tough Maws → Mining/Delving)
- [x] **Delve lore and missions** (`88cb159`) (owner, 2026-10-12): the Delve is **the way down the Godforge's fracture beneath the Seamworks**; each biome is a lore layer, driven by the existing quest board / NPC quests (`src/app/shared/npc/npc-quest.service.ts`). Canon sources: `~/Documents/1. Projects/Eclipse Realms/docs/03-lore-and-design/` (narrative bible, creature atlas, item lore codex)
  - Root Hollows = **the World-Root's shadow** ("the inverse tree that grows downward beneath the Godforge", Nullthorn Staff lore) → **Verrin**: bring a shadow-root cutting → unlocks the Nullthorn Staff recipe (the staff opens cracked walls)
  - Basalt Caverns = **Kael's abandoned forge-mines** → **Kael**: reopen the old seam, recover his lost hammer → next Smithing tier
  - Glowcap Grotto = **light seeping through the fracture** → **The Merchant**: standing Glowcap orders (Gold; teaches where herbs are)
  - Magma Halls = **the fracture itself**, Godforge fragments / Godstone runes → **Kael + The Archivist**: recover a fragment guarded by a rune-warden (boss)
  - **Inscriptions** carved in walls everywhere → **The Archivist**: copy them → Codex lore entries + Delving XP
  - Deepest: **The Nameless**, the long-term mystery

- [x] **"Found in…"** (`88cb159`) for every material: a line in the Skills panel and the Codex ("Moonpetal — Ember Delve, Glowcap Grotto"), generated from the node and drop-table data so it can't drift. Today herbs only come from Foraging work and hunt drops, and nothing says where

Turn the mine from "dig and collect" into a place you shape. Foundation first:
- [x] **Persistent dug state** per delve (`88cb159`, see per-player persistent Delve above)
- [x] **Place blocks back** (`0f57c99`; B in front, S+B below, long-press/right-click a cell): mined dirt/rock go to the satchel as placeable blocks; place in front/below (bridge gaps, wall off monsters, stairs)
- [x] **Torches** (`0f57c99`; Torch ×3 = 1 Cinder Ore + 1 Bark + 30 Gold; X takes back): crafted (ore + wood); placed torches permanently light cleared areas (ties into lantern/darkness)
- [x] **Ladders and platforms** (`0f57c99`): traverse deep shafts back up
- [x] **Portable workbench / campfire** (`0f57c99`; one per Delve; opens Crafting on "Ready now"; "Descend to your camp" from town): craft inside the dungeon with the station-kit journal, filtered to what's craftable there; doubles as a waypoint back down
- [x] **Chests** (`0f57c99`; 4 material kinds each, through the satchel ledger) to stash finds underground; **gear in chests** (`5471a66`; up to 6 pieces, held through the inventory ledger like thrall gear)
- [x] **Supports** (`5471a66`): ~1 in 5 Magma Halls rock cells is loose (fixed hash, terrain v2 unchanged), cracks/dust/groan 0.45 s then falls, rubble 8% max HP (never below 1). Timber support reach 3 (Smithing 5), basalt reach 5 (Smithing 12)
- [x] **Blasting charges** (`5471a66`): Smithing 10, lit with a staff, 1.6 s fuse, ~2-cell radius, breaks rock up to one tier above the staff, never bedrock / protected stamps / the fragment chamber before the warden falls
- [x] **The four extra inscriptions placed** (`5471a66`; always-air cells); the Archivist's "all" is now 12
- [x] Tile, torch, ladder, platform and workbench art briefs → `docs/art-commissions/` second wave (`d9702b6`; 223 entries total; make-first list in `01-second-wave.md`)
- [x] (`9ec52e4`) Importer: add a `Sprites/Tiles` family that accepts **opaque** 32px tiles (today the cut-out corner guard would reject them)
- [x] (`9ec52e4`) Engine: spawn the Rune-Warden and Magma Maw under their own art keys (`rune-warden`, `magma-maw`); they currently borrow `mirror-substitute` / `rivet-maw`

## Phase 3: World only `[x]` (`6c94349`)

- [x] Every navbar page reachable by walking, the Places list, and a Waystone
- [x] Nav audit (`scripts/audit-nav.js`, which gates deploy) understands in-world places
- [x] Standalone URLs (`/market`, `/gambler`, …) keep their SEO prerender and open into the world
- [x] Navbar shrinks to Play + Character (Essence pill → `/play?at=market`; page links moved to a footer "Places" row + command palette; all 58 routes still prerender)

## Art direction: hybrid sprites

- [x] Commission pack `docs/art-commissions/`: 129 assets (61 world sprites, 68 menu paintings), prompt + negative + export spec + exact library path each; `00-first-test-set.md` = make these first (`ccb0de5`)
- [x] Importer: lossless `Sprites/*` path + sidecar JSON → `sprite-manifest.generated.ts` / `spriteFor()`; see-through figures rejected; `--commissions` lists what's still missing; `ART_PENDING` auto-clears when art lands (`ccb0de5`)
- [ ] **Owner:** approve names for 4 invented NPC roles (material vendor, croupier, exchange broker, expedition steward)
- [ ] **Owner:** produce the test set and drop it in the library
- [x] Engine sprite-sheet renderer (`403b706`): `SpriteRenderer` (frames, pivot, mirroring, hand anchors for `setLoadout`, cached hit-flash), used by Keeper/peers/creatures/keepers/townsfolk whenever `spriteFor(key)` has a loaded sheet; otherwise today's rig/placeholder. Owner steps in `docs/handoff/sprite-renderer.md`. Importer passes the `pixelArt` flag through (`5471a66`)
- [ ] A/B the test set in the Seamworks on a branch, then decide go / no-go for the full sprite pass
- [-] Full sprite pass for every town, creature and NPC (after the A/B)

## Distribution

- [x] **Installable app (PWA) polish** (`102bc57`): proper install prompt, full-screen standalone window, app icons and splash for iOS / Android / desktop, offline shell that opens straight into the game, save-sync on reconnect. Builds on the existing `service-worker.js` + `manifest.webmanifest`
- [-] **Desktop / Steam wrapper (later, on traction):** Tauri (or Electron) around the same web build; Steam overlay, achievements mapped to Collection eggs, cloud save via the existing Firestore account
- [-] **App-store wrapper (later, on traction):** Capacitor for iOS / Android from the same build; store review requirements (payments, sign-in) checked before starting

## Phase 4: Life

- [x] Shopkeepers at every station (`cea9d40`): canon NPCs where they fit (Kael at the Rune Forge, The Merchant at the Market, The Archivist at the Codex, Aureth in Luminous, Verrin in Umbral) speaking only canon `DIALOGUE` lines (test-enforced); role-titled keepers elsewhere; placeholder figures until `npc-*-figure` sprites exist; click a keeper → its station. **Not yet seen in a browser** (the pane was hidden overnight)
- [x] Townsfolk (2–4 per town) + per-realm atmosphere (Infernal embers/ash, Luminous light shafts/motes, Umbral ink motes, Celestial star glints, Verdant leaves/spores; reduced motion freezes) (`cea9d40`)
- [ ] True layered or frame animation once the art exists (`docs/animation/layered-art-spec.md`)

## Phase 5: Polish the first hour (started 2026-10-13) `[~]`

- [x] **Phase 4 seen in a real build** (2026-10-13, all five towns at 1280×800): keepers beside their stalls, canon lines, townsfolk off stalls; keepers and townsfolk are still placeholder figures until sprites exist
- [x] **In-world HUD fixes** (`eb065ee`): the Hearth chat folds to a 44px pill (top HUD strip on desktop, its own band on phones), remembers open/folded, folds when a station opens; the duplicate "[E] INTERACT" canvas hint is gone; no enemy bar on safe town ground; keeper name tags stay inside the canvas. `e2e/play-hud.spec.ts`; full `play-*` suite 58/58
- [~] **First-session audit**: a true first visit at phone and desktop sizes; fix what stops a new player reaching first buy → first hunt → first craft → first dig
- [~] **Phone performance of /play**: frame times at 4× CPU throttle in each town, a hunt and the Delve; includes pausing the site-wide cosmic canvas that keeps running behind the game
- Left over from the HUD fix: between 901 and ~1000px the open satchel book draws over the Hearth pill; the canvas "[ J / E ] GATHER" and "CLICK TO WALK HERE" cues share the line the old hint was clipped on

---

## ✅ Checkpoint merged (2026-10-12, `102bc57`)

All six checkpoint branches are on `main`: PWA, Station UI kit, Skills + tools, Ember Delve, Homestead, Economy spec (docs only). Handoff notes for each are in `docs/handoff/`. Initial bundle 1.70 MB. Nothing is in flight.

**Next session starts here:**
0. ~~Cache-bust the solid Keeper~~ done: SOLIDIFY outputs publish as `-solid` filenames, so every browser refetches
1. **Owner review of the economy spec** (`docs/economy/rebalance-spec.md`): price scaling ×1.25 → ×1.15, first paid purchase 2m01s → 4s, 3 → 44 purchases in the first 10 min, rune strike 10k → 600 (all sinks ×0.06), prestige at 10T with cube-root shards. Open TODOs: item Gold/s conversion, veteran shard cap, migration fixture specs. Then implement as one change with a versioned save migration.
2. ~~Convert the other 10 menus~~ **done**: Market, Gambler, Exchange (Menus A) + Character, Quest Board, Sanctum, Codex, Arena, Trials, Leaderboards (`944514d`); pages went from 3–11 screens to ~1.5, primary action on the first phone screen
3. Delve: persist dug state; ~~XP for roots/cache/walls~~ done: every node trains its own skill (rock Mining, roots Foraging, petrified trunks Woodcutting, walls/caches Delving); reconcile lantern-radius units (skills = tiles, engine = its own); header and enemy bar should say "Ember Delve".
4. Smithing anvil mini-game and Enchanting ritual (the kit and the skills hooks are both on main now).
5. A Skills station in the world (panel id `skills` exists, no station yet); Hunting XP; Smithing XP banner on bench crafts.
6. Tool art (`pickaxe/axe/sickle/staff-1..4`) and tile art → add to `docs/art-commissions/`.
7. PWA: real install tests on Android Chrome, iOS Safari, desktop Chrome (`docs/handoff/pwa.md`).

## Running in parallel right now

| Work | Branch | Status |
|---|---|---|
| First-session audit; phone performance of /play | agent worktrees | `[~]` |

## Art still missing (placeholders in game)

No image-generation tool is available in Claude sessions; the commission pack
(`docs/art-commissions/`, landing) turns each gap into a ready prompt and a
filename the importer picks up automatically.

- 23 unique items (`ART_PENDING` in `src/app/shared/art/art.ts`)
- 6 NPCs, 18 explorer archetypes, 6 Thralls
- 5 creatures with concept sheets only
- Town buildings / stations (anvil, stalls, waystone, …) and any missing realm backdrops
- Guild screen does not exist yet (crests, banners and ranks are imported, unused)

## Known issues / watch list

- **Playtests merged** (`13b3e7e`): `e2e/play-*.spec.ts` (run with `PW_PORT=4291`), 25 pass + 6 `fixme` = app bugs in `docs/handoff/playtest-findings.md`: P-1 Exchange buy→sell profit (likely already fixed by the exploit fix), P-2 `?at=` to another town lost on reload, P-3 no Hunting XP from kills / no Mining XP from ore pickup (Hunting partly fixed by the gathering merge), P-4 monster coins never reach the purse, P-5 vendor pays equal to (not below) the Exchange floor, P-6 The Fracture's 600 XP exceeds the 500 per-action cap and is lost. Fix round: **P-1 confirmed fixed, P-5 fixed (Slag Fragment ties at 1 Gold, not a loop), P-6 fixed (mission XP split ≤500 per grant)** (`0c1c50f`); **P-2 fixed** (current town saved in `eclipse-play-world-v1`, `?at=` still wins), **P-3 fixed** (ore pickup pays 2 Mining XP), **P-4 fixed** (coins reach the purse once per drop) (`5471a66`); all six playtest findings closed, fixme specs un-fixme'd. **Second playtest wave merged** (`87346a3`): `e2e/play-delve-extras.spec.ts` (supports, charges, inscriptions, chest gear) + `e2e/play-life.spec.ts` (keepers beside their stalls in all five towns, greet once, townsfolk never on a stall, ES name tags) — 49 pass on chromium; **P-7 fixed** (Smithing-gated recipes now say "Reach Smithing N first"). Open owner question: Delve rock that pays Mining XP inherits the town seam's 2.5 s recovery, so a fresh-save cell can take 7 swings instead of 4, with no "seam needs a breath" line shown — intended?
- **Owner: confirm 11 keeper role titles**: Buyback Clerk, Croupier, Exchange Broker, Expedition Steward (from the art pack) + Bench Smith, Enchanter, Chart Clerk, Board Herald, Arena Gatekeeper, Trials Warden, Lodge Warden (Phase 4). Titles only, no personal names until approved
- **Owner: look at Phase 4 in a browser** (placement, greet-once, townsfolk off stalls and ES tags are now covered by `play-life.spec.ts`; what's left is how it looks): realm particles, keeper art/feel
- Gathering regrowth now persisted (`9ec52e4`, blob `godforge-gathering`)
- Fixed (`8bbe142`): a live **Exchange Gold exploit** after the ×0.06 rescale: bulk buys were priced before their own price move and could be sold back unit by unit at a profit; orders now price across their own movement (buys round up, sells down). Karma 1933/1933
- Player market list now reads one summary doc `market/v1/summary/board` (`8bbe142`); it caps sustained market writes at ~1/s (shard it before heavy traffic)
- The Market's Buy-max count is computed from `EconomyService.nextCost`; keep it in sync with the economy rebalance. Fixed: 20 orphaned keys (16 `market.*` + 4 nav/hero) pruned from the eager table; `check-i18n-keys` reports 0 unreferenced (`docs/handoff/watchlist-cleanup-2.md`)
- **Market residual cheat risks** (the client still writes saves): a player can edit their own save then sell what they minted; a restored escrowed item stays usable single-player until their next market call; an offline device's earlier spends can make the client skip a server Gold debit; server repair marks expire after 7 days. See `docs/handoff/player-market.md`
- The CSP now allows `us-central1-xsantcastx-1694b.cloudfunctions.net`, which was missing and had also blocked Stripe's callable
- Fixed (`6e329ea`): the NPC bubble hides while a mini-game is open (`MinigamePresenceService`), so Skip is reachable at 390 px
- Delve finale gaps fixed (`0f57c99`): the warden falls once per player, the fragment stays sealed until then, Kael's cache is at (85,18)
- Delve text is EN+ES (`6e329ea`, lazy table `delve.i18n.ts`; item names and inscription lore stay English); 8 new item icons + 5 placeable tiles need art; supports and charges borrow existing item art
- Storing gear in a chest counts toward the "item equipped" challenge (same as equipping a thrall)
- Nullthorn Staff recipe is now locked behind Verrin's mission (players who crafted it keep it)
- New Delve materials use stand-in art (shadow-root-cutting, glowcap, godforge-fragment); no Rune-Warden painting/rig yet
- Fixed (`6e329ea`): the enemy bar uses the engine's `enemyId` (`play.creature.<id>`, EN+ES); a new creature needs a name key (engine test enforces it)
- Initial bundle fixed: 2.00 MB → **1.68 MB** (`92a3b68`): tools registry, lore corpus and character hub moved out of the initial chunk. Keep new code lazy; biggest eager modules now `translation.service` 92 kB, `art-manifest.generated` 64 kB, header 50 kB
- Checked, stale: engine visuals are on main (`378269a`). Each creature has its own rig in `creature-rigs.ts`, and unknown keys get the generic body, not the Maw. Only Magma Maw (Rivet Maw painting and rig) and Rune Warden (Mirror Substitute painting and rig) still borrow a body, on purpose, through `ART_ALIAS`, until their paintings land. The Rivet Maw also stands in for any creature until that creature's painting has loaded
- Fixed (`6e329ea`): closing a panel returns focus to the keyboard opener or the canvas; Places/satchel return focus too
- The Infernal town is 900px wider, so for a while after deploy, peers on an older client appear ~900px off east of the forge
- Gambler / rune-forge fixed overlays inside panels not yet exercised in-world (the gambler moves in-world with the Umbral town)
- Paper-doll sockets: a worn socket now opens its slot and has a ≥44px hit pad on phones; the art is unchanged (`e2e/loadout-socket-targets.spec.ts`). At 375–390px the NPC bubble and the forge-flame toggle can still sit over the doll, depending on scroll (seen in WebKit). Nobody has watched the equip/unequip flight and swap in motion yet
- Rig unverified in motion on mobile, high-DPR seams, Safari rim light (the test browser pane runs hidden, so the loop doesn't advance)
- "Daily Tool Generation Pipeline" has failed every day since 2026-03-26: the Anthropic API account behind `ANTHROPIC_API_KEY` is out of credit (400 "credit balance is too low"), and Reddit also returns 403 to the collector. This is not a code fix. **Owner:** top up the credit, or disable the workflow if the tools surface is retired for good

## How to work on this plan

- One owner per file area at a time; parallel agents get disjoint file lists.
- Every branch: `node --test scripts/seamworks-engine.test.cjs`, `check-ds-adherence`, `check-i18n-keys`, `audit-nav`, one `ng build`; then a look in a production build before merging to `main` and `dev`.
- Tick items here in the merge that ships them.
