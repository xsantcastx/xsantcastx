# World Plan — every page becomes a place

The working build tracker for turning Eclipse Realms into one walkable world.
Update it in the same commit that lands the work; an item is only `[x]` once it
is merged to `main` **and** checked in a production build.

Last updated: 2026-10-14

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
| First-hour design calls (owner delegated "decide like a AAA game", 2026-10-13) | **Arm before the first fight** (forge the blade first, or a starter weapon); **a guaranteed first craft** at the Bench within ~2 min; **Rune Forge appears in context** once the first strike is affordable, not in the tutorial; **in the Delve the dig is never blocked**, only XP/yield is rate-limited, with a visible cue; **legal notices never cover gameplay** (compact consent bar in-world, same consent semantics); the **11 keeper role titles are approved** as written (personal names still owner's) | Implemented in Phase 5; the market deploy and the out-of-credit daily workflow stay with the owner |
| World meaning (owner, 2026-10-13) | **Nothing exists without a meaning**: every item, material, block, stat, NPC, creature and station has a **source**, a **use**, **world meaning** (lore or a canon tie) and **visibility** (Found in / Used for / description / tooltip). With zero players, a thing with no natural canon tie is **removed**, not given a forced use; no new canon names | `npm run check:meaning` ratchets against `scripts/meaning-baseline.json`; today's debt and fixes are in `docs/world/meaning-audit.md`; CI wiring after review |
| Art direction | **Terraria-style pixel art for the whole game** (owner, 2026-10-13; replaces the 2026-10-12 "hybrid, Ragnarok-style sprites + paintings"): 16×16 art-px tiles drawn at 2× on the 32 px Delve cells (4× in towns), auto-tiled terrain with outlines, bevels and top faces, saturated per-realm and per-biome palettes, parallax backgrounds, chunky outlined animated sprites, 32×32 pixel item icons, framed pixel slots/panels for the in-world HUD. Terraria is a style reference only; nothing is copied. **Paintings stay** only for the Codex Bestiary creature masters, boss concept sheets (review only) and realm town key art (menus/loading, never behind sprites); site chrome outside the game keeps the design system | Art bible `docs/art/style-guide.md`; all 229 briefs rewritten (+4 parallax). Retires, as replacements land: the Keeper mesh rig and creature rigs, painted in-world `bg-*` backdrops, painted bag icons (later re-icon wave), the paper-doll painting. Needs small pipeline follow-ups: auto-tile importer + renderer (IMP-1/RND-1), parallax family + renderer (IMP-2/RND-2), nearest-neighbour icon ladder (IMP-3), HUD frames (RND-3) |

### Where each page lives (proposal; change here, then build)

| Town | Buildings / stations | Hunting ground drops |
|---|---|---|
| **Infernal**: Basalt Seamworks | Crafting Bench, Rune Forge, Enchanting Table, Material Vendor, quest stations (ore, forge, beacon, passage) | Cinder ore, ember residue |
| **Luminous** | Market (upgrades) | Light-touched materials |
| **Umbral** | Gambler, Reels, Exchange | Shadow materials, scrolls |
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

## Art direction: Terraria-style pixel art (owner, 2026-10-13)

Replaces "hybrid sprites + paintings" (2026-10-12). Art bible: `docs/art/style-guide.md` (pixel scale and grid, sizes per class, outline and shading, realm and Delve-biome palettes, animation frames and fps, auto-tile layout, parallax, HUD slot/panel frames, export, sidecar). Briefs: `docs/art-commissions/`.

- [x] Commission pack `docs/art-commissions/`: 129 assets (61 world sprites, 68 menu paintings), prompt + negative + export spec + exact library path each; `00-first-test-set.md` = make these first (`ccb0de5`)
- [x] Importer: lossless `Sprites/*` path + sidecar JSON → `sprite-manifest.generated.ts` / `spriteFor()`; see-through figures rejected; `--commissions` lists what's still missing; `ART_PENDING` auto-clears when art lands (`ccb0de5`)
- [x] Role titles for the 4 invented NPC roles approved (2026-10-13); personal names still owner's
- [x] Engine sprite-sheet renderer (`403b706`): `SpriteRenderer` (frames, pivot, mirroring, hand anchors for `setLoadout`, cached hit-flash), used by Keeper/peers/creatures/keepers/townsfolk whenever `spriteFor(key)` has a loaded sheet; otherwise today's rig/placeholder. Owner steps in `docs/handoff/sprite-renderer.md`. Importer passes the `pixelArt` flag through (`5471a66`)
- [x] **Pixel-art pivot** (2026-10-13): art bible `docs/art/style-guide.md`; all 229 briefs rewritten to pixel art with ids and library paths unchanged (`--commissions` resolves all of them), +4 Basalt Seamworks parallax layers = 233 (217 pixel, 16 kept paintings: 6 Codex masters, 5 boss concept sheets, 5 realm key art). Existing cell sizes are whole art pixels (x8), so no sidecar or engine change; tiles move to W7a auto-tile sheets
- [ ] **Owner / AI:** produce the new first test set (`docs/art-commissions/00-first-test-set.md`, 21 files): Keeper idle/run/attack, Rivet Maw, Kael, 8 Delve tile sheets (dirt, basalt, hard basalt, bedrock, cinder vein, grotto stone, scorched basalt, basalt block), 6 icons (Pickaxe I, Torch, Dirt Block, Glowcap, Kael's Hammer, Tinder's Due), the Seamworks parallax set
- [x] Pipeline follow-ups so the A/B shows everything (terrain pass 2, `docs/handoff/terraria-terrain.md`): **IMP-1/RND-1** full W7a sheets import and the Delve picks the auto-tile piece per cell; **IMP-2/RND-2** `Sprites/Parallax` family + 4-layer town background (and the Delve cave per biome), painted/procedural fallback; **IMP-3** nearest-neighbour rungs for pixel icons/portraits (`menu-pixel` rows or a `-px` stem); **ENG-1** briefs, paths and CSV use the spawned keys `seam-eater` / `cinder-bailiff`, and `--commissions` checks creature ids (style guide §12). Still open: RND-3 HUD frames
- [ ] **A/B the test set in the Seamworks** on a branch (and the Delve below it): verdict go / no-go per class (characters, creatures, tiles, icons, parallax)
- [-] Full pixel pass after the A/B: every town, creature, NPC, tile, prop and icon in the pack; then the realm parallax sets for the other four realms, the HUD frame sheet (RND-3), and the re-icon wave for the ~160 already-painted items
- [-] Retire as replacements land: the Keeper mesh rig and per-creature rigs, the painted in-world `bg-*` backdrops (become key art), the paper-doll painting (Character panel gets a pixel equipment column)

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
- [x] **First-session pass** (`c9ffcd5`; audit in `docs/handoff/first-session-audit.md`): a "Goal n of 4" HUD line with **Show me** (buy a building → defeat a Rivet Maw → forge the Basalt Edge → dig in the Delve; read from the save, gone once done); phone Homestead Buy no longer covered by the Interact prompt; no "visitor number N" card on a first visit; the tutorial ends in the world and its doors open stations in-world. All four goals: 1m39s phone / 2m18s desktop. `e2e/play-first-session.spec.ts`
  - **Owner decisions:** restore the Rune Forge door in the tutorial? Maws before the blade (bare-handed kill 8–17 s, never fatal)? Nothing craftable at the Bench on a fresh save — add a cheap starter recipe? Cookie banner over the world on a first visit. HUD quest lines are English-only
- [x] **Phone performance of /play** (`c865d7c`; `docs/handoff/play-perf.md`): 390×844 DPR 3, 4× CPU, software raster: towns/hunt p50 33 → 17 ms, Delve 83 → 50 ms; per-frame allocation −55%; site backdrop (starfield, pulsar) hidden and paused on in-world routes; phone render tier (DPR cap 1.5, no shadowBlur, cached town backdrop, cheaper Delve light); `AppComponent.isPlayMode` cached. Opt-in harness `PLAY_PERF=1 e2e/perf-play.spec.ts`. Not yet on a real phone; the Delve's darkness overlay and `RigSprite.render` are what's left
- [x] **Phase 5 leftovers** (`57593a1`): HUD lines EN+ES (lazy `hud.i18n.ts`; engine non-Delve messages carry `messageKey` too; item/place/creature names stay English); the satchel book opens below the HUD strip and takes turns with the Hearth (it overlapped at every desktop width, not just 901–1000px); "CLICK TO WALK HERE" and gather cues draw above their stall/node, never under the action bar; Delve phone tier −12% main-thread (unsmoothed darkness upscale, tint folded into the overlay). Full `play-*` 65/65
- [x] **Goal line vs Hearth pill**: the desktop goal line is boxed between the health plate and the pill's widest extent (220px) from 1200px up, and drops to its own row under the pill (118px) from 901 to 1199px; beside the Homestead column it starts at 322px. `e2e/play-hud.spec.ts` checks goal line / pill / satchel / vitals / top bar pairwise apart, plus hit tests on the pill and Show me, at 905–1920px in the Seamworks, the Quarry (two-line goal) and the Homestead
- [x] **Onboarding owner calls, decided AAA-style** (`docs/handoff/onboarding-aaa.md`): goals reordered to buy → forge **and equip** the Basalt Edge → defeat a Rivet Maw → dig (the Edge needs only seam ore + the guaranteed ember, so no starter weapon); the Torch is the guaranteed first bench craft (2 Cinder Ore + 2 Gold, in "Ready now" as soon as the Edge is forged); a one-time "Next step" line points at the Rune Forge after the four goals once a strike is affordable (EN+ES). All four goals 64.5 s at 1280×800 (was 2m18s)
- [x] **Delve: the dig is never blocked** (AAA call): a Pickaxe I basalt cell opens on swing 4 every time; during the seam's 2.5 s recovery the break is unpaid (no XP, no ore) with a throttled "+0 XP · the seam is catching its breath" cue; a full satchel / locked tier / failed save still refuse so nothing is lost (`src/app/play/delve-reward.ts`). Test harness: clicks 1 s apart, walks nudged to ≤8 px so rubble specs are deterministic
- [x] **Consent bar in-world** (AAA call): docked under the game frame on `/play` (`--gf-consent-h`), Accept and Essential Only equal, no analytics before an answer, `e2e/play-consent.spec.ts`; the goal line moves beside the open Hearth or hides under 1180px
- [x] **Phone HUD, Terraria-mobile style** (owner, 2026-10-13: "not playable" on a real phone; `docs/handoff/mobile-hud.md`): hotbar top-left (Pick slot first) + satchel button with badge, area title + slim health + menu top-right; menu holds Places/Return/Restart/Keys; goal line folds to a chip; messages are 4 s toasts; one touch row (movement left, Blast/Dodge/Use/Jump right, ≥44px, fits 360px); tap a cell to dig (Pick) or place (block). Unobstructed world: Delve 37–50% → 71–77% portrait, 18.5% → 69% landscape; desktop identical. `e2e/play-mobile-hud.spec.ts` (chromium + webkit)
  - [x] Follow-ups: touch phones in landscape wider than 900px get the phone HUD (mouse users keep desktop, proven identical at 12 size/input combos); the Homestead Gold list is a bottom sheet / left drawer that never covers the centre; touch controls are SVG icons with EN+ES accessible names. 932×430 / 915×412: 37–59% → 71–72% unobstructed. Left: Hearth pill, Interact prompt, goal and health labels are still small text
- [x] **Tool tiers mean something** (owner: "I equipped a pickaxe and mining speed is the same"): the invisible free tool floor is gone — every Keeper holds real soulbound Worn Pickaxe/Axe/Sickle (0 Gold); forged tiers swing faster (Worn 0.52 → I 0.46 → II 0.40 → III 0.35 → IV 0.31 s) on top of today's power rule; item cards, Quick Inspect, the Crafting Bench and Character → Stats (new Tools block; "Character & stats" in the Places/☰ menu) show power, swing, what it opens and "works as tier N until <Skill> L"; rewards per minute unchanged (node tests). `docs/handoff/tool-tiers.md`, `e2e/play-tool-tiers.spec.ts`
  - [x] Skill level scales tools: swing ×(1 − 0.25·(L−1)/98), power ×(1 + 0.5·(L−1)/98) per family (Mining → pickaxe, Woodcutting → axe, Foraging → sickle; Enchanting → staff power only, its blast cooldown is fixed); cards and Stats show the tool/level split; level-up line names the gain; XP/ore per minute proven unchanged
- [x] **Meaning audit + fixes** (owner rule: everything needs meaning): `npm run check:meaning` (baseline-gated; knows HUD-opened panels and the Worn starter tools) — 51 → 4 violations (the 4 = atlas creatures that don't spawn yet). Ember-veined basalt yields Ember Residue; Found-in covers Delve biomes and expedition tables; Endurance says "expedition haul"; Loot quality folded into Magic Find; Rift Key removed; Clarity Elixir is a Magic Find charm; `craft-ember-elixir`; five duplicate artifact items removed (rewards grant the Essence-shop flags); lore for six Delve finds; townsfolk speak Found-in lines. **Atlas names**: Magma Maw → Cinder Bailiff, Rune-Warden → Seam Eater, own drop tables + Bestiary. **Runes**: Mote/Seam/Ledger removed (no unique effect), the ten "Rune of …" materials merged into Forge runes; decisions and new lore in `docs/world/lore-addendum.md` (pending owner review)
- [x] **Terraria-style Delve terrain, pass 1** (`docs/handoff/terraria-terrain.md`): 16×16 pixel tiles at 2× baked per node from its palette (3 variants), 8-neighbour auto-tiling with outlines/bevels and rounded corners, biome top faces (moss / ash / glowing lichen / ember crust), back walls in dug space + 2 procedural parallax layers per biome, grid lighting (bilinear desktop, nearest phone). Phone tier faster in software raster, flat on GPU; gameplay unchanged. Full `play-*` 89/89
  - [x] Pass 2: brighter saturated biome palettes (Root Hollows green/brown, Basalt grey+ember, Glowcap teal/cyan, Magma red/orange), outlines + lit edges, broader warmer light (floor 0.42–0.80, torch r150), pixel-art placed objects and per-realm town ground strip; importer: auto-tile sheets (IMP-1/RND-1), `Sprites/Parallax` + `parallax.ts` (IMP-2/RND-2), nearest-neighbour pixel icon ladders (IMP-3). Perf flat. Towns still use painted backdrops + placeholder figures until parallax/sprite art exists
- Footer no longer covers the Rune Forge reveal (`<main>` lifts above it while open; a routed host's leftover transform trapped the overlay's z-index)
- [x] Art briefs renamed to the atlas creatures: `seam-eater` (Sprites/Creatures/06, Creatures/Masters/11) and `cinder-bailiff` (Sprites/Creatures/07), with designs from the atlas (terrain pass 2)
- Watch: `play-minigames` "four Perfect strikes" scores 90 instead of 100 under CPU load (timing-based); passes 16/16 alone
- [x] **"New version — Reload" prompt**: `scripts/stamp-build-id.js` (postbuild) stamps a build id into `version.json`, every page's `<meta name="gf-build">` and `service-worker.js`; `AppUpdateService` checks on start, every 30 min, on return to the tab and on `online`; a top-centre toast (never over controls, waits while a panel/fight is open) flushes saves via `GameStateGateway.settleForReload()` before reloading; the worker no longer skip-waits. `e2e/play-update.spec.ts`. Real-device / iOS standalone check still owed
- [x] **Inventory: stacks, satchel limit, the Vault** (owner, 2026-10-13: runes pile up and items can't be found; POE2-style slots bought with Gold). Spec + sim: `docs/inventory/inventory-spec.md`, `node scripts/economy-sim.mjs --inventory`. Found: every rune find mints a stat-less Sigil record and the 250-record cap **destroys** the cheapest gear to make room (also on every cloud merge). Plan S1 pure layout → S2 stop eviction + sigils stack (soak a release) → S3 storage prices → S4 satchel limit 40 (+8 ×5) + Vault routing/Overflow → S5 Vault station in the Seamworks + satchel UI → S6 surfaces; S7 market server follow-ups before the market deploy. Owner: the Vault keeper's role title Manager calls (2026-10-13): stackables keep one account-wide quantity and the satchel/Vault/Overflow split is derived (no migration); Vault keeper role title **Vault Clerk** approved; S2 (stop deleting items) ships first
  - [x] S1–S4 shipped: nothing is ever deleted for space (both delete paths gone, incl. cloud merge); rune finds mint no Sigils (old ones cleaned on load; runes live in the Rune Forge record); deleted-record limit 512; storage prices in `STORAGE_CURVE` with refund-safe purchases; Vault routing built behind `VAULT_LIVE = false`. `e2e/play-inventory-stacks.spec.ts`
  - [x] S5+S6 shipped: the Vault station (Vault Clerk, Basalt Seamworks x=330; tabs Satchel/General/Materials/Supplies/Gear/General II–IV/Overflow, search + sort, one button per view, Gold rows/tabs from `STORAGE_CURVE`); `VAULT_LIVE` on: 40 (+8 per row) slot satchel with used/cap everywhere, routing to the Vault with a message ("Satchel full — Cinder Ore sent to the Vault: General I tab"); every item surface updated; per-device stack folds (`stackFolds`, 48-seed multi-device property test). `e2e/play-vault.spec.ts`. S7 (market server reads `stackFolds`, accepts Vault items) is owed before the market deploy
  - [~] Identical items as one ×N row (owner, 2026-10-13: "so many of the same items, they should be stacked"; branch `worktree-agent-ae993023d5dfbea84`): mechanically identical instances (same definition, rarity, stats + frozen grade, no temper/reforge/socketed rune, same place) show as ONE row in the Vault tabs, the satchel book and the Delve chest panel; variants sort side by side; "Send 7 to Vault" / "Take out 7" move the group in one write, Details has "Move just one"; identical pieces share slots, 20 to a slot ("×7 · 1 slot", "×25 · 2 slots"; manager decision 2026-10-13) in the satchel and the slot-limited Vault tabs, counted in one place (`inventory-layout.ts` occupancy; layout, routing, settle, take-out all read it; 48-seed multi-device property test). Each piece stays its own record. `e2e/play-vault.spec.ts`. S7: the market's `bagRoom` must use the same rule
- Watch: two Delve e2e tests (`play-delve-extras` rubble ≥1 HP, `play-delve` pit survives reload) fail under CPU load when several worktrees run Playwright at once; both pass 4/4 alone. Harden their fixed waits if they ever fail on a quiet machine
- Watch: Spanish HUD copy is machine-written, no native review. The Keeper rig's cost on phones waits for the pixel sprite sheets (the rig retires after the A/B)
- [~] **The Croupier's Reels** (owner, 2026-10-13: "slot machines… stake-style super bonus"; branch `worktree-agent-afd96296a31970cf4`): Umbral station between the Gambler and the Exchange, run by the Croupier (`/play?at=reels`); 3×3, 5 lines, world symbols, Eclipse Round (10 free spins, sticky ×2–×50 rune orbs, paid at the end), prizes through the rune/material gateways; Gold only, RTP 92.1% Gold + ~0.7% prizes (exact + simulated proof in `economy-sim.mjs --reels`, checked in `--check`), bet cap = two minutes of income. Shared kit `src/app/shared/games/` (seeded RNG, idempotent play ledger, bet tiers, RTP harness, win celebration) for Rune Drop / Seam Sweeper / Eclipse Ascent. Handoff `docs/handoff/reels.md`; lore line pending owner review; art briefs `world-sprites/10-reels.md`

## Phase 6+: The Delve and beyond `[ ]` (planned 2026-10-14)

Owner brief (2026-10-13): navigation in the Delve (minimap, missions), an infinite generated world, Fishing, lakes and lava, "Terraria with a galactic mix: universe, other dimensions, realms", better lore. **Design bible + full roadmap: [`docs/world/delve-and-beyond.md`](../world/delve-and-beyond.md)**; the new lore stories are in [`docs/world/lore-addendum.md`](../world/lore-addendum.md) ("The Delve and beyond", shipped — owner reviews in play). Owner, 2026-10-14: new layers, creatures and stories are approved to ship and reviewed in play; the bible lists only canon/cost questions (§10).

The layer cake: Root Hollows → Basalt Caverns → Glowcap Grotto → Magma Halls (shipped) → **the Underhearth** (the Infernal realm's banked furnace; Kael's four) → the Breach → **Starfall Deep** (the sky under the world) → **the Void Shore** (the Void sea and the shattered realm-islands) → **the Unmade** (no bottom; "One More"). The deep places are *Reaches*, never realms. Left and right of the shaft, the Delve is generated without end per player seed, with four realm **Echo regions** that finally spawn the atlas creatures of meaning audit #16.

- [ ] **Phase 6: Water, lava and Fishing v1** (fits today's engine; parallel with Phase 7)
  - [ ] 6.1 Liquids v1: water + lava, 10 Hz cellular flow with sleeping cells, water + lava → obsidian, lava chars wooden placeables back to the satchel, Seam Bucket, swim/breath/lava damage, Ember Elixir immunity, liquid diff in the save (L)
  - [ ] 6.2 Lakes in the core: Grotto Mere, Magma lava pools, flooded shafts, placed in already-carved air so no `version` bump (S)
  - [ ] 6.3 Fishing v1: skill 1–99, Worn/Root/Seam/Glowline rods, bait, catch tables, junk, crates, the Line Tension mini-game (always lands, grade only adds), auto-fish, Lampfish Oil + Gill Draught, Catalogue of Strange Fish, Lodge Warden Ledger Catch, Merchant fish order, the Drowned Lamp chain + mini-boss (L)
  - [ ] 6.4 `economy-sim.mjs --fishing --check` in CI: fishing ≤ 10% of forge Gold/min, crate EV, rod gates, 60–250 h to 99 (S)
- [ ] **Phase 7: The endless Delve** (horizontal first)
  - [ ] 7.1 Sector world: 32×32-cell sectors, sector-local deterministic generator (noise caves, clipped veins, structure lattice), loaded window, per-sector spawns; the core unchanged (XL, split a/b)
  - [ ] 7.2 Save v2: index doc + region docs (8×8 sectors) under `progress/` (no rules deploy), IndexedDB locally, RLE diffs, merge, healing of far unheld tunnels (L) — needs the save-gateway owners' review first
  - [ ] 7.3 Structures v1: Kael's waycaches, flooded shafts, lakes, field-note walls (M)
  - [ ] 7.4 Map v2 on top of minimap v1: fog per sector, full map, pins, waypoints, Broken Astral Compass, Rift Map Fragment (M)
  - [ ] 7.5 Board Herald's daily Delve bounties (S)
- [ ] **Phase 8: The Underhearth**: stratum + nodes + lava lakes + the Breach gate (Delving 15); Banked Ember, Ironwood Sentinel, the Banked Furnace; Kael's "The Four Who Went Down" + Verrin; tool tier V; rope, Thornroot Grapple, Seam Rails + Cart, camps per stratum, Rift Anchors + Waystone Shards, Seam Siphon
- [ ] **Phase 9: Starfall Deep** (first Reach): low gravity + shear, starlight liquid (rises), starglass; Ephemeris Leech + Anchor Warden spawn, Lodestar Drift, the Unlit Star; Aureth's chain; Starfall and Eclipse Surge events; Rod V, Starlight Jar, Anchor Ring
- [ ] **Phase 10: Echo regions**: Prism Shelf, Ink Deeps, Orrery Underworks, Rootglass Depths; Afterimage Moth, Ink Lantern, Graftling spawn (closes audit #16); Echo fish; Veil Draught
- [ ] **Phase 11: The Void Shore**: void sea (light holds it back), five shattered islands, Plausibles, the Undertow (summoned by fishing), Breach Tide; the Merchant's chain; Rod VI, Pickaxe VI, Hollow Flask
- [ ] **Phase 12: The Unmade**: witnessing (light finishes outline cells), "One More" bands with no bottom, Drafts, the Nameless at band thresholds (owner question)
- Art briefs per slice are listed in the bible §9 (W7L liquid sheets are a new spec class for the style guide in 6.1)
- **Owner:** (1) may the Nameless appear as a figure in the Unmade; (2) Firestore cost of one region doc per explored 256×256-cell area

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
| Phone HUD follow-ups · Delve e2e positioning · Inventory S1+S2 (stop deleting items) · Tool tiers swing faster + readable tool stats | agent worktrees | `[~]` |

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

- **First-session audit** (`docs/handoff/first-session-audit.md`, spec `e2e/play-first-session.spec.ts`): a true first visit at 390 and 1280 px. Fixed on branch `worktree-agent-a534a7a255ebea4e2` (not yet merged): the Homestead's first Buy button was unreachable on phones (the Interact prompt covered it); a HUD **goal line** ("Goal n of 4" + Show me) now walks buy → hunt → craft → Delve, derived from the save (lazy EN + ES); every first visitor got the visitor-milestone card; the tutorial's doors now enter the world (`/play`, `/play?at=…`, Rune Forge door removed); forge jargon; buildings listed above the 5M crafting corner; Delve hotbar vs satchel on phones. **Owner:** the removed Rune Forge door, the cookie banner and always-open Hearth over the phone world, nothing craftable at the bench on a fresh save

- **Playtests merged** (`13b3e7e`): `e2e/play-*.spec.ts` (run with `PW_PORT=4291`), 25 pass + 6 `fixme` = app bugs in `docs/handoff/playtest-findings.md`: P-1 Exchange buy→sell profit (likely already fixed by the exploit fix), P-2 `?at=` to another town lost on reload, P-3 no Hunting XP from kills / no Mining XP from ore pickup (Hunting partly fixed by the gathering merge), P-4 monster coins never reach the purse, P-5 vendor pays equal to (not below) the Exchange floor, P-6 The Fracture's 600 XP exceeds the 500 per-action cap and is lost. Fix round: **P-1 confirmed fixed, P-5 fixed (Slag Fragment ties at 1 Gold, not a loop), P-6 fixed (mission XP split ≤500 per grant)** (`0c1c50f`); **P-2 fixed** (current town saved in `eclipse-play-world-v1`, `?at=` still wins), **P-3 fixed** (ore pickup pays 2 Mining XP), **P-4 fixed** (coins reach the purse once per drop) (`5471a66`); all six playtest findings closed, fixme specs un-fixme'd. **Second playtest wave merged** (`87346a3`): `e2e/play-delve-extras.spec.ts` (supports, charges, inscriptions, chest gear) + `e2e/play-life.spec.ts` (keepers beside their stalls in all five towns, greet once, townsfolk never on a stall, ES name tags) — 49 pass on chromium; **P-7 fixed** (Smithing-gated recipes now say "Reach Smithing N first"). Open owner question: Delve rock that pays Mining XP inherits the town seam's 2.5 s recovery, so a fresh-save cell can take 7 swings instead of 4, with no "seam needs a breath" line shown — intended?
- Keeper role titles approved 2026-10-13 (Buyback Clerk, Croupier, Exchange Broker, Expedition Steward, Bench Smith, Enchanter, Chart Clerk, Board Herald, Arena Gatekeeper, Trials Warden, Lodge Warden); personal names still need the owner
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

## Legacy website removed (owner, 2026-10-14) `[x]`

The site is now only the game. Removed: tool pages/registry/embeds/ads, the visit counter (a Firestore write per page load), tool lore/mastery/usage, 34 tool quests, 135 tool easter eggs, most of the cosmic engine (59 → 9.5 kB; the cursor trail and ritual drone stay because the game uses them), dead CSS, `jspdf`, 138 sync duplicates; `/play/storyboard` 301 → `/play`. Initial bundle 1.75 → 1.67 MB, dist 51.9 → 43.9 MB, styles.css 135 → 104 kB. The footer gained a "Support the forge" row (donation modals were unreachable since August). `CLAUDE.md` rewritten as the game's operating manual. Details: `docs/cleanup/site-removal.md`
- [~] Leftovers: daily tool pipeline, Pro Pack, Codex Solarii, empty Codex categories, Achievement Frame target, 4 stale Karma specs

## World & cast (2026-10-14) `[ ]`

Design: [`docs/world/world-and-cast.md`](../world/world-and-cast.md); new lore in
`docs/world/lore-addendum.md` ("World and cast", shipped — owner reviews in play,
per the owner's 2026-10-14 trust). The overworld, the main story (Prologue → Act
I *The Old Seam* in the Delve → Act II *Five Witnesses*, the narrative bible's
five chapters → Act III *The Fivefold Lock* below the Magma Halls → seasons),
17 named people (the six canon, the bible's ten chapter characters placed at
existing stations, and **Glim, the Margin-Light**, a lantern-moth companion
inspired by Claude), and the ethical daily/weekly/season rhythms. The infinite
Delve, liquids, fishing and the galactic dimensions are `docs/world/delve-and-beyond.md`.

- [x] S1 Glim, onboarding companion (2026-10-14): met on a new save (flies in to the shoulder, one hello), voices the goal line from a moth button that opens the 3-step hint ladder (nudge → direction → Show me, which flies Glim ahead with a trail), never hints at secrets (allowlist; Karma over every Codex secret id), is the Delve lantern (same radius; the light has a source), says when to stop, dims beside Mirror Substitutes; Codex entry; Delve-mission hints (2 steps; step 3 waits for the Atlas, S4). State `godforge-glim` through the gateway, merge-safe. Handoff: `docs/handoff/glim.md`
- [ ] S2 Story Act I framing (Prologue + Act I break scenes, Story journal, versioned `story` record)
- [ ] S3 NPC depth pass (personal names on role keepers, act-aware lines)
- [ ] S4 Glim's Atlas + "The Blank Places" · S5 commissions + bounties (banked, no streaks) · S6 Act II ch. 1 + ch. 3 in-world · S7 reputation · S8 ch. 2/4/5 · S9 Act III + the Long Eclipse
- Watch: the old progression ledger still settles a daily streak (`app.component.ts`); it must never gate or reset a reward (reframe as "days visited" in S5)

## How to work on this plan

- One owner per file area at a time; parallel agents get disjoint file lists.
- Every branch: `node --test scripts/seamworks-engine.test.cjs`, `check-ds-adherence`, `check-i18n-keys`, `audit-nav`, one `ng build`; then a look in a production build before merging to `main` and `dev`.
- Tick items here in the merge that ships them.
- **Simplest thing that works.** Write the least code that solves the task; no speculative options, abstractions or configurability nobody asked for. If 200 lines could be 50, make it 50.
- **Everything has a meaning.** A new item, material, block, stat, NPC, creature or station ships with a source, a use, a lore line (or canon tie) and a line the player can see. Run `npm run check:meaning`; a new violation fails it. A fix shrinks `scripts/meaning-baseline.json` in the same commit. See `docs/world/meaning-audit.md`.
- **Surgical diffs.** Every changed line traces to the task. Don't reformat, refactor or "improve" neighbouring code; remove only what your own change made unused, and report (don't delete) unrelated dead code.
