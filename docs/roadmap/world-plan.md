# World Plan — every page becomes a place

The working build tracker for turning Eclipse Realms into one walkable world.
Update it in the same commit that lands the work; an item is only `[x]` once it
is merged to `main` **and** checked in a production build.

Last updated: 2026-10-12

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
- [ ] Foraging/woodcutting nodes in each realm's hunt (herbs, rootglass, bark), using the same tool system
- [ ] **Smithing anvil mini-game** (strike timing sets quality): after the station-kit forge redesign lands
- [ ] **Enchanting ritual** in the world (place runes on a glowing circle, small skill check): after the station-kit redesign lands
- [ ] Tile and tool art added to the commission pack (rock, dirt, ore veins, cracked wall, roots; pickaxe/axe/sickle/staff tiers)

## Economy rebalance (Cookie-Clicker start) `[~]`

- [x] Spec + simulator (`docs/economy/rebalance-spec.md`, `scripts/economy-sim.mjs`): inventory of every Gold source/sink, target pacing, new numbers table, save migration, rollout plan; before/after timings from the simulator
- [x] Homestead built Cookie-style: big clickable Forge + always-visible buildings column (current numbers; new ones flow through later)
- [ ] **Owner:** review the spec's headline timings and number table
- [ ] Implement the rebalance in one coordinated change **after** the Homestead, Skills and Station-kit branches merge (they all touch Gold prices); versioned, idempotent save migration; tests guard the curve
- [ ] Golden-spark burst event

## Phase 2.6: Build and craft in the Delve (owner idea, 2026-10-12) `[ ]`

- [ ] **Per-player persistent Delve**: a seed per player stored in the save; dug, placed and built cells saved as a compact diff through the save gateway (local + Firestore when signed in), idempotent with the existing mutation ids. Owner decision 2026-10-12. Today the layout is one fixed seed for everyone and dug state is session-only
- [ ] **Biomes by depth**, each with its own palette, light, nodes and creatures: **Root Hollows** (roots, petrified trunks, mushrooms → Foraging/Woodcutting), **Basalt Caverns** (Cinder/Slag → Mining; today's Delve), **Glowcap Grotto** (glowing herbs, e.g. Moonpetal-type → Foraging), **Magma Halls** (Heartstone, Ember Residue, tough Maws → Mining/Delving)
- [ ] **"Found in…"** for every material: a line in the Skills panel and the Codex ("Moonpetal — Ember Delve, Glowcap Grotto"), generated from the node and drop-table data so it can't drift. Today herbs only come from Foraging work and hunt drops, and nothing says where

Turn the mine from "dig and collect" into a place you shape. Foundation first:
- [ ] **Persistent dug state** per delve (through the save gateway, idempotent), the prerequisite for everything below
- [ ] **Place blocks back**: mined dirt/rock go to the satchel as placeable blocks; place in front/below (bridge gaps, wall off monsters, stairs)
- [ ] **Torches**: crafted (ore + wood); placed torches permanently light cleared areas (ties into lantern/darkness)
- [ ] **Ladders and platforms**: traverse deep shafts back up
- [ ] **Portable workbench / campfire**: craft inside the dungeon with the station-kit journal, filtered to what's craftable there; doubles as a waypoint back down
- [ ] **Chests** to stash finds underground; later **supports and bombs** gated by staff/Smithing tiers
- [ ] Tile, torch, ladder, platform and workbench art → `docs/art-commissions/`

## Phase 3: World only

- [ ] Every navbar page reachable by walking, the Places list, and a Waystone
- [ ] Nav audit (`scripts/audit-nav.js`, which gates deploy) understands in-world places
- [ ] Standalone URLs (`/market`, `/gambler`, …) keep their SEO prerender and open into the world
- [ ] Navbar shrinks to Play + Character

## Art direction: hybrid sprites

- [x] Commission pack `docs/art-commissions/`: 129 assets (61 world sprites, 68 menu paintings), prompt + negative + export spec + exact library path each; `00-first-test-set.md` = make these first (`ccb0de5`)
- [x] Importer: lossless `Sprites/*` path + sidecar JSON → `sprite-manifest.generated.ts` / `spriteFor()`; see-through figures rejected; `--commissions` lists what's still missing; `ART_PENDING` auto-clears when art lands (`ccb0de5`)
- [ ] **Owner:** approve names for 4 invented NPC roles (material vendor, croupier, exchange broker, expedition steward)
- [ ] **Owner:** produce the test set and drop it in the library
- [ ] Engine sprite-sheet renderer (per-action frames, hand anchors for weapon attachment), with the rig as fallback
- [ ] A/B the test set in the Seamworks on a branch, then decide go / no-go for the full sprite pass
- [-] Full sprite pass for every town, creature and NPC (after the A/B)

## Distribution

- [x] **Installable app (PWA) polish** (`102bc57`): proper install prompt, full-screen standalone window, app icons and splash for iOS / Android / desktop, offline shell that opens straight into the game, save-sync on reconnect. Builds on the existing `service-worker.js` + `manifest.webmanifest`
- [-] **Desktop / Steam wrapper (later, on traction):** Tauri (or Electron) around the same web build; Steam overlay, achievements mapped to Collection eggs, cloud save via the existing Firestore account
- [-] **App-store wrapper (later, on traction):** Capacitor for iOS / Android from the same build; store review requirements (payments, sign-in) checked before starting

## Phase 4: Life

- [ ] NPC shopkeepers at each building (needs NPC art)
- [ ] Ambient townsfolk, per-realm weather / atmosphere
- [ ] True layered or frame animation once the art exists (`docs/animation/layered-art-spec.md`)

---

## ✅ Checkpoint merged (2026-10-12, `102bc57`)

All six checkpoint branches are on `main`: PWA, Station UI kit, Skills + tools, Ember Delve, Homestead, Economy spec (docs only). Handoff notes for each are in `docs/handoff/`. Initial bundle 1.70 MB. Nothing is in flight.

**Next session starts here:**
0. **Cache-bust the solid Keeper**: live serves the fixed image (83% opaque), but browsers that saw the ghost keep it up to 7 days (same filename, `max-age=604800`). Give `SOLIDIFY` outputs a new filename (or versioned name) in `scripts/import-assets.py` so every client refetches. Owner saw the ghost on 2026-10-12; a hard refresh fixes it locally.
1. **Owner review of the economy spec** (`docs/economy/rebalance-spec.md`): price scaling ×1.25 → ×1.15, first paid purchase 2m01s → 4s, 3 → 44 purchases in the first 10 min, rune strike 10k → 600 (all sinks ×0.06), prestige at 10T with cube-root shards. Open TODOs: item Gold/s conversion, veteran shard cap, migration fixture specs. Then implement as one change with a versioned save migration.
2. Convert the other 10 menus with the station kit (`src/app/shared/station-ui/README.md`).
3. Delve: persist dug state; ~~XP for roots/cache/walls~~ done: every node trains its own skill (rock Mining, roots Foraging, petrified trunks Woodcutting, walls/caches Delving); reconcile lantern-radius units (skills = tiles, engine = its own); header and enemy bar should say "Ember Delve".
4. Smithing anvil mini-game and Enchanting ritual (the kit and the skills hooks are both on main now).
5. A Skills station in the world (panel id `skills` exists, no station yet); Hunting XP; Smithing XP banner on bench crafts.
6. Tool art (`pickaxe/axe/sickle/staff-1..4`) and tile art → add to `docs/art-commissions/`.
7. PWA: real install tests on Android Chrome, iOS Safari, desktop Chrome (`docs/handoff/pwa.md`).

## Running in parallel right now

| Work | Branch | Status |
|---|---|---|

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

- Enemy bar names the creature by guessing from spawn positions; an `enemyName` on engine state would make mixed-creature hunts exact
- Initial bundle fixed: 2.00 MB → **1.68 MB** (`92a3b68`): tools registry, lore corpus and character hub moved out of the initial chunk. Keep new code lazy; biggest eager modules now `translation.service` 92 kB, `art-manifest.generated` 64 kB, header 50 kB
- `?at=<place>` only resolves stations in the current town (e.g. `?at=gambler` from Infernal is ignored); needs cross-town resolution (travel, then open)
- New creatures still draw with the Rivet Maw rig until the engine-visuals branch lands
- After closing an in-world panel, focus lands on the page body, not the game canvas (keyboard players must click once) — Phase 2 UI polish
- The Infernal town is 900px wider, so for a while after deploy, peers on an older client appear ~900px off east of the forge
- Gambler / rune-forge fixed overlays inside panels not yet exercised in-world (the gambler moves in-world with the Umbral town)
- Paper-doll gear sockets are small on phones (~17% of the doll); the equip/unequip flight and swap haven't been watched in motion yet
- Returning visitors may see the old ghostly Keeper for up to 7 days (image cache, same filename)
- Rig unverified in motion on mobile, high-DPR seams, Safari rim light (the test browser pane runs hidden, so the loop doesn't advance)
- "Daily Tool Generation Pipeline" workflow failing on main (pre-existing, unrelated)

## How to work on this plan

- One owner per file area at a time; parallel agents get disjoint file lists.
- Every branch: `node --test scripts/seamworks-engine.test.cjs`, `check-ds-adherence`, `check-i18n-keys`, `audit-nav`, one `ng build`; then a look in a production build before merging to `main` and `dev`.
- Tick items here in the merge that ships them.
